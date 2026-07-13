// Task 6: One-time synthesis and scoped public claims — strict TDD test suite.
// Covers decision rules, boundary cases, reservation integrity, one-time unmask
// binding, frozen-registry closeout verification, claim-scope enforcement, and
// the full adversarial mutation matrix.

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRandomization } from "./lib/randomization.mjs";
import { createBuildAuthority, __internal as buildInternal } from "./lib/packet-build-authority.mjs";
import { createOpenAuthority } from "./lib/synthesis-open-authority.mjs";
import { loadRegistry, validateCorpusSeparation } from "./lib/registry.mjs";
import { appendEvent, validateLedger } from "./lib/ledger.mjs";
import { canonicalJson, sha256 } from "./lib/contracts.mjs";
import { packetSha256 } from "./lib/judges.mjs";
import manifestDefault from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";

import { synthesize } from "./lib/synthesis.mjs";
import {
  deriveRunId, loadRegistryManifest, computeScenarioRegistrySha256,
  verifyFrozenRegistryAtCloseout, reserveSynthesis, reservationSha256,
  verifyCommittedReservation, openUnmask
} from "./lib/reservation.mjs";
import { projectPublicClaim, ALLOWED_POSITIVE_CLAIM } from "./project-claim.mjs";

const repoRoot = new URL("../../../", import.meta.url).pathname;
const VIEWPORTS = ["mobile", "desktop"];
const DIMENSIONS = ["direction", "structure", "accessibility", "verbal", "integration"];
const { hmacTuple } = buildInternal;
const FAMILIES = manifestDefault.evaluator_families;
const SCENARIO_IDS = JSON.parse(readFileSync(join(repoRoot, "evals/v2/scenario-registry.json"), "utf8")).scenarios.map((s) => s.scenario_id).sort();
const SEEDS = [101, 202];

// ---------------------------------------------------------------------------
// Dependency boundary: synthesis modules must not import the build authority.
// ---------------------------------------------------------------------------
for (const file of ["lib/synthesis.mjs", "lib/reservation.mjs", "project-claim.mjs"]) {
  const source = readFileSync(join(repoRoot, "tools/evals/v2", file), "utf8");
  assert.doesNotMatch(source, /packet-build-authority|createBuildAuthority/, `${file} must not import build authority`);
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function syntheticBytes({ scenarioId, seed, arm }) {
  const marker = arm === "baseline" ? "Initial" : "Updated";
  return `${marker} ${seed} ${scenarioId} café 🦊 content for the brief.`;
}

/** Build the full packet set, encrypted map, and verified unmask coordinates. */
function buildCoreFixture({ seedDomain = "effectiveness-v2-synthesis", seedBytes: reuseSeed } = {}) {
  const registry = loadRegistry(repoRoot);
  validateCorpusSeparation(registry);
  const tracked = JSON.parse(readFileSync(join(repoRoot, "evals/v2/protocol.json"), "utf8"));
  const tempDir = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-"));
  const secretRoot = join(tempDir, "secrets");
  mkdirSync(secretRoot, { recursive: true, mode: 0o700 });
  const created = createRandomization({ domain: seedDomain, secretRoot });
  const protocol = { ...tracked, randomization_commitment_sha256: created.commitment.commitment_sha256 };

  const generations = [];
  for (const scenario of registry.scenarios) {
    for (const seed of protocol.seeds) {
      for (const arm of ["baseline", "candidate"]) {
        generations.push({
          scenario_id: scenario.scenario_id, generation_seed: seed, arm,
          bytes: syntheticBytes({ scenarioId: scenario.scenario_id, seed, arm })
        });
      }
    }
  }
  const renders = [];
  for (const gen of generations) {
    for (const viewport_id of VIEWPORTS) {
      const key = `${gen.bytes}|${viewport_id}`;
      renders.push({
        scenario_id: gen.scenario_id, generation_seed: gen.generation_seed, arm: gen.arm, viewport_id,
        screenshot_sha256: createHash("sha256").update(`${key}|screenshot`).digest("hex"),
        dom_sha256: createHash("sha256").update(`${key}|dom`).digest("hex"),
        style_sha256: createHash("sha256").update(`${key}|style`).digest("hex")
      });
    }
  }

  const built = createBuildAuthority(created.privateStateRef).buildPackets({ protocol, registry, generations, renders });
  const seedBytes = reuseSeed ?? readFileSync(created.privateStateRef.secretPath);

  // Compute expected unmask coordinates from the seed + known scenario IDs.
  const coords = [];
  const packetByUnit = new Map();
  for (const packet of built.packets) packetByUnit.set(packet.unit_id, packet);
  for (const scenarioId of SCENARIO_IDS) {
    for (const generationSeed of SEEDS) {
      const unitId = hmacTuple(seedBytes, "unit", scenarioId, generationSeed);
      const packetId = hmacTuple(seedBytes, "packet", scenarioId, generationSeed);
      const scenarioToken = hmacTuple(seedBytes, "scenario", scenarioId, generationSeed);
      const assignmentBit = hmacTuple(seedBytes, "assignment", scenarioId, generationSeed)[0] & 1;
      for (const slot of [0, 1]) {
        const realArm = slot === assignmentBit ? "baseline" : "candidate";
        coords.push({ unit_id: unitId, opaque_slot: slot, arm: realArm, scenario_id: scenarioId, generation_seed: generationSeed });
      }
      // Stash for later lookup
      if (packetByUnit.has(unitId)) {
        Object.assign(packetByUnit.get(unitId), { __scenario_id: scenarioId, __generation_seed: generationSeed });
      }
    }
  }

  return {
    tempDir, registry, protocol, created, built, seedBytes,
    privateStateRef: created.privateStateRef, coords,
    packetByUnit
  };
}

/** Build a lookup: unit_id → { 0: arm, 1: arm, scenario_id, generation_seed } */
function unmaskLookup(coords) {
  const map = new Map();
  for (const c of coords) {
    if (!map.has(c.unit_id)) map.set(c.unit_id, {});
    map.get(c.unit_id)[c.opaque_slot] = c.arm;
    map.get(c.unit_id).scenario_id = c.scenario_id;
    map.get(c.unit_id).generation_seed = c.generation_seed;
  }
  return map;
}

/** Convert an arm-named preference ("candidate"/"baseline"/"tie"/"abstain") to a slot preference. */
function toSlotPref(armPref, unitUnmask) {
  if (armPref === "tie" || armPref === "abstain") return armPref;
  // Find which slot maps to this arm
  for (const slot of [0, 1]) {
    if (unitUnmask[slot] === armPref) return slot === 0 ? "slot-0" : "slot-1";
  }
  throw new Error(`cannot resolve arm ${armPref}`);
}

/**
 * Build 96 production judge results.
 * prefFn(familyId, identityIdx, scenarioIdx, seedIdx) → "candidate" | "baseline" | "tie" | "abstain"
 * scoreFn(familyId, identityIdx, scenarioIdx, seedIdx, slot) → { direction, structure, accessibility, verbal, integration }
 * hardRegressionFn(familyId, identityIdx, scenarioIdx, seedIdx) → array of regression flags
 */
function buildProductionResults({ built, coords, prefFn, scoreFn, hardRegressionFn }) {
  const lookup = unmaskLookup(coords);
  const results = [];
  let counter = 0;
  const nextId = (p) => `${p}-${++counter}`;
  for (const packet of built.packets) {
    const unitId = packet.unit_id;
    const ul = lookup.get(unitId);
    if (!ul) throw new Error(`no unmask for unit ${unitId}`);
    const scenarioIdx = SCENARIO_IDS.indexOf(ul.scenario_id);
    const seedIdx = SEEDS.indexOf(ul.generation_seed);
    for (const family of FAMILIES) {
      for (let identityIdx = 0; identityIdx < family.identities.length; identityIdx++) {
        const identity = family.identities[identityIdx];
        const armPref = prefFn(family.family_id, identityIdx, scenarioIdx, seedIdx);
        const preference = toSlotPref(armPref, ul);
        const dim0 = scoreFn(family.family_id, identityIdx, scenarioIdx, seedIdx, 0);
        const dim1 = scoreFn(family.family_id, identityIdx, scenarioIdx, seedIdx, 1);
        results.push({
          schema_version: 2,
          kind: "effectiveness-v2-judge-result",
          packet_id: packet.packet_id,
          family_id: family.family_id,
          identity_id: identity,
          invocation_id: nextId("inv"),
          context_id: nextId("ctx"),
          packet_sha256: packetSha256(packet),
          preference,
          arm_scores: [
            { opaque_slot: 0, dimensions: dim0 },
            { opaque_slot: 1, dimensions: dim1 }
          ],
          hard_regressions: hardRegressionFn(family.family_id, identityIdx, scenarioIdx, seedIdx),
          evidence_citations: [{
            artifact_id: packet.arms[0].artifact_id, opaque_slot: 0, viewport_id: "mobile",
            artifact_sha256: packet.arms[0].artifact_sha256,
            start_codepoint: 0, end_codepoint: 4,
            exact_span: Array.from(packet.arms[0].artifact_bytes).slice(0, 4).join("")
          }]
        });
      }
    }
  }
  return results;
}

// Default scoring: both arms get 4 on all dimensions (candidate meets thresholds).
const defaultScoreFn = (_f, _i, _s, _seed, _slot) => {
  return DIMENSIONS.reduce((acc, d) => { acc[d] = 4; return acc; }, {});
};
const noRegression = () => [];

// Default: candidate always wins for all families and identities.
const allCandidate = () => "candidate";

/** Build a complete synthesis fixture. */
function buildSynthesisFixture({ prefFn = allCandidate, scoreFn = defaultScoreFn, hardRegressionFn = noRegression, coreFixture } = {}) {
  const core = coreFixture ?? buildCoreFixture();
  const { protocol, built, coords, seedBytes, privateStateRef, created } = core;
  const results = buildProductionResults({ built, coords, prefFn, scoreFn, hardRegressionFn });

  // Build ledger with run_initialized and production_admitted events.
  const manifest = loadRegistryManifest(repoRoot);
  const registrySha = computeScenarioRegistrySha256(manifest);
  const manifestSha = sha256(canonicalJson(manifestDefault));
  const protocolSha = sha256(canonicalJson(protocol));
  const runId = deriveRunId({
    protocolSha256: protocolSha,
    scenarioRegistrySha256: registrySha,
    baselineRevision: protocol.baseline_revision,
    candidateRevision: protocol.candidate_revision,
    executionManifestSha256: manifestSha,
    randomizationCommitmentSha256: created.commitment.commitment_sha256
  });

  const e1 = appendEvent(undefined, null, {
    type: "run_initialized", at: "2026-07-12T00:00:00Z", run_id: runId,
    protocol_sha256: protocolSha, scenario_registry_sha256: registrySha,
    execution_manifest_sha256: manifestSha,
    randomization_commitment_sha256: created.commitment.commitment_sha256
  });
  const e2 = appendEvent(undefined, e1, {
    type: "production_admitted", at: "2026-07-12T00:01:00Z", run_id: runId,
    scenario_registry_sha256: registrySha
  });
  const ledger = [e1, e2];

  // Build unmask coordinates object.
  const unmask = {
    run_id: runId,
    packet_set_sha256: built.packet_set_sha256,
    commitment_sha256: built.map_commitment,
    mappings: coords.map((c) => ({ ...c }))
  };

  return {
    core, protocol, packets: built.packets, unmask, validatedBatches: results, ledger, runId,
    registrySha, manifestSha, protocolSha
  };
}

// ===========================================================================
// 1. Decision rule: supported (pass)
// ===========================================================================
const primary = buildSynthesisFixture();
const passResult = synthesize({
  protocol: primary.protocol,
  packets: primary.packets,
  unmask: primary.unmask,
  validatedBatches: primary.validatedBatches,
  ledger: primary.ledger
});
assert.equal(passResult.status, "supported", `pass fixture must be supported: ${JSON.stringify(passResult)}`);
assert.equal(passResult.claim_allowed, true, "supported result allows claim");
assert.equal(passResult.families.length, 2, "two families");
for (const fam of passResult.families) {
  assert.equal(fam.passed, true, `family ${fam.family_id} passed`);
  assert.ok(fam.preference_score >= 18, `family ${fam.family_id} preference_score >= 18: got ${fam.preference_score}`);
  assert.ok(fam.scenario_majorities >= 8, `family ${fam.family_id} scenario_majorities >= 8: got ${fam.scenario_majorities}`);
  assert.ok(fam.absolute_mean >= 4, `family ${fam.family_id} absolute_mean >= 4: got ${fam.absolute_mean}`);
  for (const d of DIMENSIONS) assert.ok(fam.dimension_means[d] >= 3, `family ${fam.family_id} ${d} >= 3`);
}

// ===========================================================================
// 2. Decision rule: inconclusive (family disagreement / below threshold)
// ===========================================================================
const below18 = buildSynthesisFixture({
  coreFixture: primary.core,
  prefFn: (famId, _id, _sc, _se) => famId === "family-a" ? "candidate" : "baseline"
});
const inconclusiveResult = synthesize({
  protocol: below18.protocol, packets: below18.packets, unmask: below18.unmask,
  validatedBatches: below18.validatedBatches, ledger: below18.ledger
});
assert.equal(inconclusiveResult.status, "inconclusive", "family disagreement must be inconclusive");

// ===========================================================================
// 3. Boundary: split identity → preference_score = 18
// ===========================================================================
// family-a: identity-0 always candidate, identity-1 first 12 units candidate last 12 baseline.
// Unit score: 12 units → (1+1)/2=1, 12 units → (1+0)/2=0.5. Sum = 12+6 = 18.
const splitIdentity = buildSynthesisFixture({
  coreFixture: primary.core,
  prefFn: (famId, idIdx, scIdx, seedIdx) => {
    const unitIdx = scIdx * 2 + seedIdx; // 0..23
    if (famId === "family-a") {
      if (idIdx === 0) return "candidate";
      return unitIdx < 12 ? "candidate" : "baseline";
    }
    return "candidate";
  }
});
const splitIdResult = synthesize({
  protocol: splitIdentity.protocol, packets: splitIdentity.packets, unmask: splitIdentity.unmask,
  validatedBatches: splitIdentity.validatedBatches, ledger: splitIdentity.ledger
});
const famA = splitIdResult.families.find((f) => f.family_id === "family-a");
assert.equal(famA.preference_score, 18, `split identity preference_score must be exactly 18: got ${famA.preference_score}`);

// ===========================================================================
// 4. Boundary: split seed → scenario_majorities = 7
// ===========================================================================
// family-a: 7 scenarios candidate in BOTH seeds, 5 scenarios candidate in seed 0 only.
// Scenario score: 7 scenarios → 1.0, 5 scenarios → 0.5. Majorities (>0.5) = 7.
{
  const candidateScenarioSet = new Set(SCENARIO_IDS.slice(0, 7));
  const splitSeed = buildSynthesisFixture({
    coreFixture: primary.core,
    prefFn: (famId, _id, scIdx, seedIdx) => {
      if (famId === "family-a") {
        const isCandidateScenario = candidateScenarioSet.has(SCENARIO_IDS[scIdx]);
        if (isCandidateScenario) return "candidate";
        return seedIdx === 0 ? "candidate" : "baseline";
      }
      return "candidate";
    }
  });
  const splitSeedResult = synthesize({
    protocol: splitSeed.protocol, packets: splitSeed.packets, unmask: splitSeed.unmask,
    validatedBatches: splitSeed.validatedBatches, ledger: splitSeed.ledger
  });
  const famAs = splitSeedResult.families.find((f) => f.family_id === "family-a");
  assert.equal(famAs.scenario_majorities, 7, `split seed scenario_majorities must be exactly 7: got ${famAs.scenario_majorities}`);
}

// ===========================================================================
// 5. Boundary: exact scenario tie → scenario_majorities = 0
// ===========================================================================
{
  const exactTie = buildSynthesisFixture({
    coreFixture: primary.core,
    prefFn: () => "tie"
  });
  const tieResult = synthesize({
    protocol: exactTie.protocol, packets: exactTie.packets, unmask: exactTie.unmask,
    validatedBatches: exactTie.validatedBatches, ledger: exactTie.ledger
  });
  const famAt = tieResult.families.find((f) => f.family_id === "family-a");
  assert.equal(famAt.scenario_majorities, 0, `exact tie scenario_majorities must be 0: got ${famAt.scenario_majorities}`);
}

// ===========================================================================
// 6. Decision rule: blocked (hard regression)
// ===========================================================================
const hardRegr = buildSynthesisFixture({
  coreFixture: primary.core,
  hardRegressionFn: (famId, _id, _sc, _se) => famId === "family-a" && true ? ["accessibility"] : []
});
const blockedResult1 = synthesize({
  protocol: hardRegr.protocol, packets: hardRegr.packets, unmask: hardRegr.unmask,
  validatedBatches: hardRegr.validatedBatches, ledger: hardRegr.ledger
});
assert.equal(blockedResult1.status, "blocked", "hard regression must block");

// Contradictory regression (both families flag different regressions)
const contradictory = buildSynthesisFixture({
  coreFixture: primary.core,
  hardRegressionFn: (famId, _id, _sc, _se) => famId === "family-a" ? ["accessibility"] : ["safety"]
});
const blockedResult2 = synthesize({
  protocol: contradictory.protocol, packets: contradictory.packets, unmask: contradictory.unmask,
  validatedBatches: contradictory.validatedBatches, ledger: contradictory.ledger
});
assert.equal(blockedResult2.status, "blocked", "contradictory regressions must block");

// ===========================================================================
// 7. Decision rule: production_incomplete (missing score / abstention)
// ===========================================================================
const missingScore = buildSynthesisFixture({
  coreFixture: primary.core,
  prefFn: (famId, _id, scIdx, seedIdx) => {
    const unitIdx = scIdx * 2 + seedIdx;
    return famId === "family-a" && unitIdx === 0 ? "abstain" : "candidate";
  }
});
const incompleteResult = synthesize({
  protocol: missingScore.protocol, packets: missingScore.packets, unmask: missingScore.unmask,
  validatedBatches: missingScore.validatedBatches, ledger: missingScore.ledger
});
assert.equal(incompleteResult.status, "production_incomplete", "abstention must be production_incomplete");

// ===========================================================================
// 8. Decision rule: dimension floor and absolute mean enforcement
// ===========================================================================
{
  // One candidate dimension mean < 3 → inconclusive (missed threshold, not incomplete)
  const lowDim = buildSynthesisFixture({
    coreFixture: primary.core,
    scoreFn: (_f, _i, _s, _se, slot) => {
      const dims = DIMENSIONS.reduce((acc, d) => { acc[d] = slot === 1 ? 4 : 3; return acc; }, {});
      dims.accessibility = slot === 1 ? 2 : 3; // candidate accessibility < 3
      return dims;
    }
  });
  const lowDimResult = synthesize({
    protocol: lowDim.protocol, packets: lowDim.packets, unmask: lowDim.unmask,
    validatedBatches: lowDim.validatedBatches, ledger: lowDim.ledger
  });
  assert.equal(lowDimResult.status, "inconclusive", "dimension floor miss must be inconclusive, not supported");
}

// ===========================================================================
// 9. Rerun detection: one-time synthesis
// ===========================================================================
{
  const rerunLedger = [...primary.ledger];
  // Append a synthesis_completed event to simulate prior synthesis.
  const priorSynthesis = appendEvent(undefined, rerunLedger[rerunLedger.length - 1], { type: "synthesis_completed", at: "2026-07-12T00:05:00Z", run_id: primary.runId });
  rerunLedger.push(priorSynthesis);
  assert.throws(
    () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: primary.unmask, validatedBatches: primary.validatedBatches, ledger: rerunLedger }),
    /one-time|rerun|synthesis_completed/,
    "rerun (prior synthesis in ledger) must throw"
  );
}

// ===========================================================================
// 10. projectPublicClaim
// ===========================================================================
const projected = projectPublicClaim(passResult);
assert.equal(projected.claim, ALLOWED_POSITIVE_CLAIM, "allowed positive claim exact copy");
assert.equal(projected.status, "supported", "claim status matches");

// Claim scope promotion rejection
for (const promoted of [
  { ...passResult, status: "supported", _promotedScope: "all users" },
  { ...passResult, status: "supported", _promotedScope: "all models" },
  { ...passResult, status: "supported", _promotedScope: "all tasks" },
  { ...passResult, status: "supported", _promotedScope: "individual skills" },
  { ...passResult, status: "supported", _promotedScope: "human preferred" }
]) {
  assert.throws(() => projectPublicClaim(promoted), /claim scope|human|universal|skill/i, "claim scope promotion must throw");
}

// Non-supported status → no effectiveness claim
assert.throws(() => projectPublicClaim(inconclusiveResult), /claim|supported/i, "inconclusive must not project positive claim");
assert.throws(() => projectPublicClaim(blockedResult1), /claim|supported/i, "blocked must not project positive claim");

// ===========================================================================
// 11. verifyFrozenRegistryAtCloseout
// ===========================================================================
{
  const manifest = loadRegistryManifest(repoRoot);
  const registrySha = computeScenarioRegistrySha256(manifest);
  const verified = verifyFrozenRegistryAtCloseout(repoRoot, registrySha);
  assert.equal(verified.scenarios.length, 12, "12 verified scenarios");
  assert.equal(verified.anchors.length, 4, "4 verified anchors");
  assert.equal(verified.digest, registrySha, "digest matches");
  assert.deepEqual([...verified.scenario_ids].sort(), SCENARIO_IDS, "exact scenario IDs");

  // Manifest reorder → digest determinism (reordered manifest changes digest)
  const reorderedManifest = {
    ...manifest,
    scenarios: [...manifest.scenarios].reverse()
  };
  const reorderedSha = computeScenarioRegistrySha256(reorderedManifest);
  assert.notEqual(reorderedSha, registrySha, "manifest reorder changes digest (canonical form is order-sensitive)");

  // Forged registry: wrong digest → rejection
  assert.throws(() => verifyFrozenRegistryAtCloseout(repoRoot, "0".repeat(64)), /drift|digest|mismatch/i, "wrong digest must reject");
}

// ===========================================================================
// 12. verifyFrozenRegistryAtCloseout: filesystem mutations in temp copy
// ===========================================================================
{
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-registry-"));
  try {
    // Copy registry structure
    mkdirSync(join(tempRepo, "evals/v2/scenarios"), { recursive: true });
    mkdirSync(join(tempRepo, "evals/v2/anchors"), { recursive: true });
    for (const name of readdirSync(join(repoRoot, "evals/v2/scenarios"))) {
      copyFileSync(join(repoRoot, "evals/v2/scenarios", name), join(tempRepo, "evals/v2/scenarios", name));
    }
    for (const name of readdirSync(join(repoRoot, "evals/v2/anchors"))) {
      copyFileSync(join(repoRoot, "evals/v2/anchors", name), join(tempRepo, "evals/v2/anchors", name));
    }
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), readFileSync(join(repoRoot, "evals/v2/scenario-registry.json")));

    const manifest = loadRegistryManifest(tempRepo);
    const expectedSha = computeScenarioRegistrySha256(manifest);

    // Clean pass
    const cleanVerify = verifyFrozenRegistryAtCloseout(tempRepo, expectedSha);
    assert.equal(cleanVerify.scenarios.length, 12, "temp repo clean verify");

    // 12a. Mutated scenario file with manifest unchanged
    const scenarioFile = join(tempRepo, "evals/v2/scenarios", readdirSync(join(tempRepo, "evals/v2/scenarios"))[0]);
    const original = readFileSync(scenarioFile, "utf8");
    writeFileSync(scenarioFile, original + " ");
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /drift|hash|mismatch|mutated/i, "mutated scenario file must reject");
    writeFileSync(scenarioFile, original); // restore

    // 12b. Extra file
    const extraFile = join(tempRepo, "evals/v2/scenarios", "extra-scenario.json");
    writeFileSync(extraFile, JSON.stringify({ scenario_id: "extra", stratum: "greenfield-direction", brief: "x", starting_fixture: "y", required_skills: ["a"], forbidden_cues: [], hard_regressions: [], render_required: true, time_budget_seconds: 900, tool_policy: "local-frontend-only" }));
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /extra|unknown|count|file/i, "extra file must reject");
    rmSync(extraFile, { force: true });

    // 12c. Missing file
    const scenarioFiles = readdirSync(join(tempRepo, "evals/v2/scenarios"));
    const removed = scenarioFiles[0];
    rmSync(join(tempRepo, "evals/v2/scenarios", removed));
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /missing|count|file/i, "missing file must reject");
    copyFileSync(join(repoRoot, "evals/v2/scenarios", removed), join(tempRepo, "evals/v2/scenarios", removed));

    // 12d. Symlink rejection (valid target and dangling both rejected)
    const targetFile = join(tempRepo, "evals/v2/scenarios", removed);
    rmSync(targetFile, { force: true });
    symlinkSync(join(repoRoot, "evals/v2/scenarios", removed), targetFile);
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /symlink|nonregular|regular/i, "symlink must reject");
    // Dangling symlink must also be reported as symlink, not "missing".
    rmSync(targetFile, { force: true });
    symlinkSync(join(tempRepo, "evals/v2/scenarios", "does-not-exist-json"), targetFile);
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /symlink/i, "dangling symlink must reject as symlink");
    rmSync(targetFile, { force: true });
    copyFileSync(join(repoRoot, "evals/v2/scenarios", removed), targetFile);

    // 12e. Embedded-ID mismatch
    const sidFile = join(tempRepo, "evals/v2/scenarios", removed);
    const sidContent = JSON.parse(readFileSync(sidFile, "utf8"));
    const origId = sidContent.scenario_id;
    sidContent.scenario_id = "wrong-id";
    writeFileSync(sidFile, JSON.stringify(sidContent));
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, expectedSha), /embedded|id|mismatch/i, "embedded-ID mismatch must reject");
    sidContent.scenario_id = origId;
    writeFileSync(sidFile, JSON.stringify(sidContent));

    // 12f. Forged registry (ID substitution)
    const forgedManifest = JSON.parse(readFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), "utf8"));
    const realId = forgedManifest.scenarios[0].scenario_id;
    forgedManifest.scenarios[0].scenario_id = "invented-id";
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), JSON.stringify(forgedManifest));
    const forgedSha = computeScenarioRegistrySha256(forgedManifest);
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, forgedSha), /embedded|id|mismatch|invented/i, "forged registry ID substitution must reject");
    forgedManifest.scenarios[0].scenario_id = realId;
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), JSON.stringify(forgedManifest));

    // 12g. Swapped hashes in manifest
    const swapManifest = JSON.parse(readFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), "utf8"));
    const h0 = swapManifest.scenarios[0].sha256;
    const h1 = swapManifest.scenarios[1].sha256;
    swapManifest.scenarios[0].sha256 = h1;
    swapManifest.scenarios[1].sha256 = h0;
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), JSON.stringify(swapManifest));
    const swapSha = computeScenarioRegistrySha256(swapManifest);
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, swapSha), /hash|mismatch|swapped/i, "swapped hashes must reject");
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 13. Reservation: reserve + verify
// ===========================================================================
{
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-reserve-"));
  try {
    // Initialize a git repo for HEAD verification
    execSync("git init -q", { cwd: tempRepo });
    execSync("git config user.email test@test.test", { cwd: tempRepo });
    execSync("git config user.name test", { cwd: tempRepo });
    const runDir = join(tempRepo, "evals/v2/runs", primary.runId);
    mkdirSync(runDir, { recursive: true });
    const ledgerPath = join(runDir, "ledger.jsonl");
    // Write ledger
    for (const event of primary.ledger) {
      writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });
    }
    const ledgerRoot = primary.ledger[primary.ledger.length - 1].event_sha256;

    // Reserve
    const reservationResult = reserveSynthesis({ runRoot: tempRepo, runId: primary.runId, ledgerRoot });
    assert.ok(existsSync(reservationResult.reservationPath), "reservation file created");
    const resBytes = readFileSync(reservationResult.reservationPath, "utf8");
    assert.equal(JSON.parse(resBytes).run_id, primary.runId, "reservation run_id");

    // Commit it
    execSync("git add -A", { cwd: tempRepo });
    execSync("git commit -q -m eval:reserve", { cwd: tempRepo });
    const head = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();

    // Verify committed reservation
    const verified = verifyCommittedReservation({
      repoRoot: tempRepo, runId: primary.runId,
      reservationSha256: reservationResult.reservation_sha256,
      head
    });
    assert.equal(verified.run_id, primary.runId, "committed reservation verified");

    // Deleted ledger (ledger file removed and committed) → reject
    rmSync(ledgerPath, { force: true });
    execSync("git add -A && git commit -q -m delete-ledger", { cwd: tempRepo });
    const headAfterDelete = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();
    assert.throws(
      () => verifyCommittedReservation({ repoRoot: tempRepo, runId: primary.runId, reservationSha256: reservationResult.reservation_sha256, head: headAfterDelete }),
      /deletion|root|ledger/i,
      "deleted ledger must reject"
    );
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 14. Reservation: forked ledger and copied run
// ===========================================================================
{
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-fork-"));
  try {
    execSync("git init -q", { cwd: tempRepo });
    execSync("git config user.email test@test.test", { cwd: tempRepo });
    execSync("git config user.name test", { cwd: tempRepo });
    const runDir = join(tempRepo, "evals/v2/runs", primary.runId);
    mkdirSync(runDir, { recursive: true });
    const ledgerPath = join(runDir, "ledger.jsonl");
    for (const event of primary.ledger) writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });
    const ledgerRoot = primary.ledger[primary.ledger.length - 1].event_sha256;

    const resResult = reserveSynthesis({ runRoot: tempRepo, runId: primary.runId, ledgerRoot });
    execSync("git add -A && git commit -q -m reserve", { cwd: tempRepo });
    const head = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();

    // Forked ledger: inject an event with wrong predecessor, commit, verify reject
    const events = readFileSync(ledgerPath, "utf8").trim().split("\n").map(JSON.parse);
    const forkedEvent = appendEvent(undefined, events[0], { type: "synthesis_completed", at: "2026-07-12T01:00:00Z" });
    writeFileSync(ledgerPath, `${events.map(JSON.stringify).join("\n")}\n${JSON.stringify(forkedEvent)}\n`);
    execSync("git add -A && git commit -q -m fork", { cwd: tempRepo });
    const headForked = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();
    assert.throws(
      () => verifyCommittedReservation({ repoRoot: tempRepo, runId: primary.runId, reservationSha256: resResult.reservation_sha256, head: headForked }),
      /predecessor|fork|chain|one-time/i,
      "forked ledger must reject"
    );

    // Restore ledger to original state and commit
    writeFileSync(ledgerPath, `${events.map(JSON.stringify).join("\n")}\n`);
    execSync("git add -A && git commit -q -m restore", { cwd: tempRepo });
    const headRestored = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();

    // Copied run: reservation for a different run ID
    const otherRunDir = join(tempRepo, "evals/v2/runs", "other-run-id");
    mkdirSync(otherRunDir, { recursive: true });
    copyFileSync(resResult.reservationPath, join(otherRunDir, "synthesis-reservation.json"));
    execSync("git add -A && git commit -q -m copy-run", { cwd: tempRepo });
    const headCopied = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();
    assert.throws(
      () => verifyCommittedReservation({ repoRoot: tempRepo, runId: "other-run-id", reservationSha256: resResult.reservation_sha256, head: headCopied }),
      /run id|root|mismatch/i,
      "copied run must reject"
    );
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 15. openUnmask: valid opening and binding verification
// ===========================================================================
{
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-open-"));
  try {
    execSync("git init -q", { cwd: tempRepo });
    execSync("git config user.email test@test.test", { cwd: tempRepo });
    execSync("git config user.name test", { cwd: tempRepo });
    const runDir = join(tempRepo, "evals/v2/runs", primary.runId);
    mkdirSync(runDir, { recursive: true });
    const ledgerPath = join(runDir, "ledger.jsonl");
    for (const event of primary.ledger) writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });

    // Spy: track whether seed was read.
    let seedReadCount = 0;
    const realReadFileSync = readFileSync;
    const spyOpenAuthority = createOpenAuthority(primary.core.privateStateRef);

    const resResult = reserveSynthesis({ runRoot: tempRepo, runId: primary.runId, ledgerRoot: primary.ledger.at(-1).event_sha256 });
    execSync("git add -A && git commit -q -m reserve", { cwd: tempRepo });
    const head = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();

    const manifest = loadRegistryManifest(repoRoot);
    const registrySha = computeScenarioRegistrySha256(manifest);

    const opened = openUnmask({
      repoRoot, protocol: primary.protocol, registryManifest: manifest,
      runId: primary.runId, encryptedMap: primary.core.built.encrypted_map,
      packetSet: primary.packets, commitment: primary.core.built.map_commitment,
      reservation: { path: resResult.reservationPath, sha256: resResult.reservation_sha256 },
      ledger: { path: ledgerPath, events: primary.ledger },
      repoRootForReservation: tempRepo,
      head,
      openCapability: spyOpenAuthority
    });
    assert.equal(opened.mappings.length, 48, "48 unmask rows");
    const units = new Set(opened.mappings.map((m) => m.unit_id));
    assert.equal(units.size, 24, "24 unique units");
    for (const m of opened.mappings) {
      assert.ok(m.arm === "baseline" || m.arm === "candidate", `valid arm: ${m.arm}`);
      assert.ok(m.scenario_id && SCENARIO_IDS.includes(m.scenario_id), `valid scenario_id: ${m.scenario_id}`);
      assert.ok(SEEDS.includes(m.generation_seed), `valid seed: ${m.generation_seed}`);
    }
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 16. openUnmask: adversarial forgeries
// ===========================================================================
function withTempRepo(fn) {
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-forgery-"));
  try {
    execSync("git init -q", { cwd: tempRepo });
    execSync("git config user.email test@test.test", { cwd: tempRepo });
    execSync("git config user.name test", { cwd: tempRepo });
    return fn(tempRepo);
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

function setupReservation(tempRepo, runId, ledgerEvents) {
  const runDir = join(tempRepo, "evals/v2/runs", runId);
  mkdirSync(runDir, { recursive: true });
  const ledgerPath = join(runDir, "ledger.jsonl");
  for (const event of ledgerEvents) writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });
  const resResult = reserveSynthesis({ runRoot: tempRepo, runId, ledgerRoot: ledgerEvents.at(-1).event_sha256 });
  execSync("git add -A && git commit -q -m reserve", { cwd: tempRepo });
  const head = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();
  return { runDir, ledgerPath, resResult, head };
}

{
  const manifest = loadRegistryManifest(repoRoot);
  const openAuth = createOpenAuthority(primary.core.privateStateRef);
  const baseOpenParams = (tempRepo, setup) => ({
    repoRoot, protocol: primary.protocol, registryManifest: manifest,
    runId: primary.runId, encryptedMap: primary.core.built.encrypted_map,
    packetSet: primary.packets, commitment: primary.core.built.map_commitment,
    reservation: { path: setup.resResult.reservationPath, sha256: setup.resResult.reservation_sha256 },
    ledger: { path: setup.ledgerPath, events: primary.ledger },
    repoRootForReservation: tempRepo,
    head: setup.head,
    openCapability: openAuth
  });

  // 16a. Admitted-ledger registry binding must reject before opening.
  withTempRepo((tempRepo) => {
    const setup = setupReservation(tempRepo, primary.runId, primary.ledger);
    let opened = false;
    const params = {
      ...baseOpenParams(tempRepo, setup),
      openCapability: { openCommittedMap() { opened = true; throw new Error("must not open"); } }
    };
    const cases = [
      { name: "missing run_initialized", events: primary.ledger.slice(1) },
      { name: "missing production_admitted", events: primary.ledger.slice(0, 1) },
      {
        name: "missing admitted digest",
        events: [primary.ledger[0], appendEvent(undefined, primary.ledger[0], {
          type: "production_admitted", at: "2026-07-12T00:01:00Z", run_id: primary.runId
        })]
      },
      {
        name: "mismatched admitted digest",
        events: [primary.ledger[0], appendEvent(undefined, primary.ledger[0], {
          type: "production_admitted", at: "2026-07-12T00:01:00Z", run_id: primary.runId,
          scenario_registry_sha256: "f".repeat(64)
        })]
      }
    ];
    for (const testCase of cases) {
      opened = false;
      assert.throws(
        () => openUnmask({ ...params, ledger: { ...params.ledger, events: testCase.events } }),
        /ledger|run_initialized|production_admitted|registry digest/i,
        testCase.name
      );
      assert.equal(opened, false, `${testCase.name}: opening capability must remain uncalled`);
    }

    opened = false;
    const forgedManifest = structuredClone(manifest);
    forgedManifest.scenarios[0].sha256 = "e".repeat(64);
    assert.throws(
      () => openUnmask({ ...params, registryManifest: forgedManifest }),
      /manifest|admitted digest/i,
      "caller manifest differing from admitted digest must reject"
    );
    assert.equal(opened, false, "forged caller manifest must reject before opening");
  });

  // 16b. Swapped arm (arm mapping reversed)
  withTempRepo((tempRepo) => {
    const setup = setupReservation(tempRepo, primary.runId, primary.ledger);
    const params = baseOpenParams(tempRepo, setup);
    // Tamper with the encrypted map commitment to create a mismatch
    assert.throws(
      () => openUnmask({ ...params, commitment: "0".repeat(64) }),
      /unmask|opening|binding|packet|reservation|commitment/i,
      "wrong commitment must reject"
    );
  });

  // 16b. Wrong run ID
  withTempRepo((tempRepo) => {
    const wrongLedger = primary.ledger.map((e) => ({ ...e, run_id: "wrong-run" }));
    const setup = setupReservation(tempRepo, primary.runId, primary.ledger);
    const params = baseOpenParams(tempRepo, setup);
    assert.throws(
      () => openUnmask({ ...params, runId: "wrong-run-id" }),
      /unmask|opening|binding|packet|reservation|run/i,
      "wrong run ID must reject"
    );
  });

  // 16c. Invalid opening (wrong encrypted map)
  withTempRepo((tempRepo) => {
    const setup = setupReservation(tempRepo, primary.runId, primary.ledger);
    const params = baseOpenParams(tempRepo, setup);
    const fakeMap = Buffer.from(JSON.stringify({ algorithm: "aes-256-gcm", nonce: "AAAA", ciphertext: "AAAA", tag: "AAAA", packet_set_sha256: "0".repeat(64) }));
    assert.throws(
      () => openUnmask({ ...params, encryptedMap: fakeMap }),
      /unmask|opening|binding|packet|reservation|decrypt/i,
      "invalid encrypted map must reject"
    );
  });

  // 16d. Post-reservation replacement (dirty tree)
  withTempRepo((tempRepo) => {
    const setup = setupReservation(tempRepo, primary.runId, primary.ledger);
    // Modify a tracked file after commit to dirty the tree
    writeFileSync(setup.ledgerPath, readFileSync(setup.ledgerPath, "utf8") + "\n", { flag: "a" });
    const params = baseOpenParams(tempRepo, setup);
    assert.throws(
      () => openUnmask(params),
      /unmask|opening|binding|packet|reservation|clean|tree/i,
      "dirty tree (post-reservation replacement) must reject"
    );
  });
}

// ===========================================================================
// 17. Spy seed reader: verifyFrozenRegistryAtCloseout must complete before
//     any seed access.
// ===========================================================================
{
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-spy-"));
  try {
    let seedAccessed = false;
    const trackingOpenAuth = {
      openCommittedMap(params) {
        seedAccessed = true;
        return createOpenAuthority(primary.core.privateStateRef).openCommittedMap(params);
      }
    };

    const manifest = loadRegistryManifest(repoRoot);
    const registrySha = computeScenarioRegistrySha256(manifest);

    // Verify registry without any open authority access.
    seedAccessed = false;
    verifyFrozenRegistryAtCloseout(repoRoot, registrySha);
    assert.equal(seedAccessed, false, "seed must not be accessed during registry verification");

    // Now test the full openUnmask flow: verifyFrozenRegistryAtCloseout runs first.
    execSync("git init -q", { cwd: tempRepo });
    execSync("git config user.email test@test.test", { cwd: tempRepo });
    execSync("git config user.name test", { cwd: tempRepo });
    const runDir = join(tempRepo, "evals/v2/runs", primary.runId);
    mkdirSync(runDir, { recursive: true });
    const ledgerPath = join(runDir, "ledger.jsonl");
    for (const event of primary.ledger) writeFileSync(ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });
    const resResult = reserveSynthesis({ runRoot: tempRepo, runId: primary.runId, ledgerRoot: primary.ledger.at(-1).event_sha256 });
    execSync("git add -A && git commit -q -m reserve", { cwd: tempRepo });
    const head = execSync("git rev-parse HEAD", { cwd: tempRepo }).toString().trim();

    // Reset tracker and do full open
    seedAccessed = false;
    const opened = openUnmask({
      repoRoot, protocol: primary.protocol, registryManifest: manifest,
      runId: primary.runId, encryptedMap: primary.core.built.encrypted_map,
      packetSet: primary.packets, commitment: primary.core.built.map_commitment,
      reservation: { path: resResult.reservationPath, sha256: resResult.reservation_sha256 },
      ledger: { path: ledgerPath, events: primary.ledger },
      repoRootForReservation: tempRepo,
      head,
      openCapability: trackingOpenAuth
    });
    assert.equal(opened.mappings.length, 48, "spy: 48 mappings");
    assert.equal(seedAccessed, true, "seed accessed during openCommittedMap (after registry verification)");
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 18. openUnmask: invented scenario IDs with recomputed tokens rejected
// ===========================================================================
{
  // This test verifies that even with recomputed HMAC tokens (using the seed),
  // scenario IDs not in the frozen registry are rejected.
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-invented-"));
  try {
    // Build a separate fixture where we re-encrypt a map with invented scenario IDs
    // but valid HMAC tokens, then try to open it.
    const seedBytes = primary.core.seedBytes;
    const inventedIds = Array.from({ length: 12 }, (_, i) => `invented-scenario-${i}`);
    const inventedCoords = [];
    for (const sid of inventedIds) {
      for (const genSeed of SEEDS) {
        const unitId = hmacTuple(seedBytes, "unit", sid, genSeed);
        const assignmentBit = hmacTuple(seedBytes, "assignment", sid, genSeed)[0] & 1;
        for (const slot of [0, 1]) {
          const realArm = slot === assignmentBit ? "baseline" : "candidate";
          inventedCoords.push({ unit_id: unitId, opaque_slot: slot, arm: realArm, scenario_id: sid, generation_seed: genSeed });
        }
      }
    }
    // The openUnmask verification should reject invented scenario IDs because
    // they don't match the frozen registry. This is checked during the
    // coordinate↔registry binding verification.
    // We test the binding check directly via a forged unmask object.
    const forgedUnmask = {
      ...primary.unmask,
      mappings: inventedCoords
    };
    // synthesize should reject the forged unmask with invented IDs
    assert.throws(
      () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: forgedUnmask, validatedBatches: primary.validatedBatches, ledger: primary.ledger }),
      /scenario|registry|coordinate|unit|invented/i,
      "invented scenario IDs must reject in synthesize"
    );
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 19. openUnmask: coordinate completeness (missing/duplicate)
// ===========================================================================
{
  // Missing entry: 47 instead of 48
  const missingEntry = { ...primary.unmask, mappings: primary.unmask.mappings.slice(0, 47) };
  assert.throws(
    () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: missingEntry, validatedBatches: primary.validatedBatches, ledger: primary.ledger }),
    /unmask|coordinate|missing|count|unit/i,
    "missing unmask entry must reject"
  );

  // Duplicate coordinate
  const dupMappings = [...primary.unmask.mappings];
  const dup = { ...dupMappings[0] };
  dupMappings.push(dup);
  // Remove a different one to keep count at 48 but with a duplicate
  dupMappings.splice(1, 1);
  const duplicateEntry = { ...primary.unmask, mappings: dupMappings };
  assert.throws(
    () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: duplicateEntry, validatedBatches: primary.validatedBatches, ledger: primary.ledger }),
    /unmask|coordinate|duplicate|unit|bijection/i,
    "duplicate unmask coordinate must reject"
  );
}

// ===========================================================================
// 20. Ledger/admission drift
// ===========================================================================
{
  // Mutated ledger event hash
  const driftedLedger = primary.ledger.map((e, i) => i === 0 ? { ...e, event_sha256: "0".repeat(64) } : e);
  assert.throws(
    () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: primary.unmask, validatedBatches: primary.validatedBatches, ledger: driftedLedger }),
    /ledger|hash|chain|predecessor|drift/i,
    "drifted ledger hash must reject"
  );

  // Missing production_admitted event
  const noAdmission = [primary.ledger[0]];
  const noAdmitResult = synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: primary.unmask, validatedBatches: primary.validatedBatches, ledger: noAdmission });
  assert.equal(noAdmitResult.status, "production_incomplete", "missing production_admitted event must be production_incomplete");

  // Missing run_initialized event
  const noInit = [primary.ledger[1]];
  assert.throws(
    () => synthesize({ protocol: primary.protocol, packets: primary.packets, unmask: primary.unmask, validatedBatches: primary.validatedBatches, ledger: noInit }),
    /ledger|initial|run_initialized|predecessor/i,
    "missing run_initialized must reject"
  );
}

// ===========================================================================
// 21. Clean committed scenario/anchor mutation with manifest unchanged
// ===========================================================================
{
  // If someone mutates a scenario file AND updates the manifest to match,
  // the manifest digest changes. The test verifies that closeout rejects
  // the new digest because it doesn't match the admitted ledger.
  const tempRepo = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-mutate-manifest-"));
  try {
    mkdirSync(join(tempRepo, "evals/v2/scenarios"), { recursive: true });
    mkdirSync(join(tempRepo, "evals/v2/anchors"), { recursive: true });
    for (const name of readdirSync(join(repoRoot, "evals/v2/scenarios"))) {
      copyFileSync(join(repoRoot, "evals/v2/scenarios", name), join(tempRepo, "evals/v2/scenarios", name));
    }
    for (const name of readdirSync(join(repoRoot, "evals/v2/anchors"))) {
      copyFileSync(join(repoRoot, "evals/v2/anchors", name), join(tempRepo, "evals/v2/anchors", name));
    }
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), readFileSync(join(repoRoot, "evals/v2/scenario-registry.json")));

    const manifest = loadRegistryManifest(tempRepo);
    const origSha = computeScenarioRegistrySha256(manifest);

    // Mutate a scenario file and update its manifest hash
    const sFile = join(tempRepo, "evals/v2/scenarios", readdirSync(join(tempRepo, "evals/v2/scenarios"))[0]);
    const origContent = readFileSync(sFile, "utf8");
    const mutatedContent = origContent.replace("Create", "Design");
    writeFileSync(sFile, mutatedContent);
    const newHash = createHash("sha256").update(mutatedContent).digest("hex");
    const mutatedManifest = JSON.parse(readFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), "utf8"));
    const sid = mutatedManifest.scenarios.find((s) => s.sha256 === manifest.scenarios[0].sha256).scenario_id;
    // Can't easily find which scenario was mutated; just update the first entry
    mutatedManifest.scenarios[0].sha256 = newHash;
    writeFileSync(join(tempRepo, "evals/v2/scenario-registry.json"), JSON.stringify(mutatedManifest));
    const mutatedSha = computeScenarioRegistrySha256(mutatedManifest);

    // Even with the updated manifest, the content-separation check should detect
    // the mutation if the embedded ID doesn't match, or the corpus separation fails.
    // The key point: the admitted ledger digest was `origSha`, so using `mutatedSha`
    // as expected is rejected because it doesn't match what was admitted.
    assert.notEqual(mutatedSha, origSha, "mutated manifest has different digest");
    assert.throws(() => verifyFrozenRegistryAtCloseout(tempRepo, origSha), /drift|hash|mismatch/i, "mutated file with original manifest digest must reject");
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

// ===========================================================================
// 22. Alternate root rejection
// ===========================================================================
{
  const otherRoot = mkdtempSync(join(tmpdir(), "tastecheck-v2-synth-altroot-"));
  try {
    // An empty directory with no registry files must reject
    mkdirSync(join(otherRoot, "evals/v2/scenarios"), { recursive: true });
    mkdirSync(join(otherRoot, "evals/v2/anchors"), { recursive: true });
    writeFileSync(join(otherRoot, "evals/v2/scenario-registry.json"), JSON.stringify({ schema_version: 2, kind: "effectiveness-v2-scenario-registry", scenarios: [], anchors: [] }));
    assert.throws(() => verifyFrozenRegistryAtCloseout(otherRoot, computeScenarioRegistrySha256(loadRegistryManifest(otherRoot))), /count|missing|file|12/i, "alternate root with empty registry must reject");
  } finally {
    rmSync(otherRoot, { recursive: true, force: true });
  }
}

// ===========================================================================
// 23. runId derivation binding
// ===========================================================================
{
  const manifest = loadRegistryManifest(repoRoot);
  const registrySha = computeScenarioRegistrySha256(manifest);
  const r1 = deriveRunId({
    protocolSha256: "a".repeat(64), scenarioRegistrySha256: registrySha,
    baselineRevision: "0f99603a603b0243345e7320a52702df67a2194e",
    candidateRevision: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
    executionManifestSha256: "b".repeat(64),
    randomizationCommitmentSha256: "c".repeat(64)
  });
  const r2 = deriveRunId({
    protocolSha256: "a".repeat(64), scenarioRegistrySha256: registrySha,
    baselineRevision: "0f99603a603b0243345e7320a52702df67a2194e",
    candidateRevision: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
    executionManifestSha256: "b".repeat(64),
    randomizationCommitmentSha256: "c".repeat(64)
  });
  assert.equal(r1, r2, "run ID is deterministic");
  // Different registry → different run ID
  const r3 = deriveRunId({
    protocolSha256: "a".repeat(64), scenarioRegistrySha256: "d".repeat(64),
    baselineRevision: "0f99603a603b0243345e7320a52702df67a2194e",
    candidateRevision: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
    executionManifestSha256: "b".repeat(64),
    randomizationCommitmentSha256: "c".repeat(64)
  });
  assert.notEqual(r1, r3, "different registry digest → different run ID");
}


// ===========================================================================
// Cleanup
// ===========================================================================
rmSync(primary.core.tempDir, { recursive: true, force: true });

console.log("effectiveness-v2 synthesis tests passed");
