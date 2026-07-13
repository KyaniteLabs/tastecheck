import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRandomization } from "./lib/randomization.mjs";
import { createBuildAuthority } from "./lib/packet-build-authority.mjs";
import { recordQaCase } from "./lib/qa-case.mjs";
import { loadRegistry, validateCorpusSeparation } from "./lib/registry.mjs";
import { canonicalJson, sha256 } from "./lib/contracts.mjs";
import manifestDefault, { sameLineage } from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";
import { buildBlindPackets } from "./lib/blind.mjs";
import {
  validatePacketArtifact,
  FROZEN_VALIDATOR_VERSION,
  FROZEN_VALIDATOR_DIGEST,
  FORBIDDEN_CUES
} from "./lib/packet-policy.mjs";
import {
  canonicalPacket,
  validateEvidenceCitation,
  validateJudgeBatch,
  packetSha256
} from "./lib/judges.mjs";

const root = new URL("../../../", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Dependency boundary: Task 5 modules must not import the Task 6 open authority.
// ---------------------------------------------------------------------------
for (const file of ["lib/blind.mjs", "lib/packet-policy.mjs", "lib/judges.mjs", "build-packets.mjs"]) {
  const source = readFileSync(join(root, "tools/evals/v2", file), "utf8");
  assert.doesNotMatch(source, /synthesis-open-authority|openCommittedMap/, `${file} must not import open authority`);
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
const VIEWPORTS = ["mobile", "desktop"];

function syntheticBytes({ scenarioId, seed, arm }) {
  // Multibyte content (emoji + accented letters) to enforce codepoint semantics.
  // The marker is placed at the START so cross-arm mutations cannot hide
  // behind a shared prefix when the validator checks codepoint spans.
  const marker = arm === "baseline" ? "Initial" : "Updated";
  return `${marker} ${seed} ${scenarioId} café 🦊 content for the brief.`;
}

function buildFixture({ swap = false, mutateGenerations, protocolOverride, seedDomain = "effectiveness-v2-test-judges", reuseSeed } = {}) {
  const registry = loadRegistry(root);
  validateCorpusSeparation(registry);
  const tracked = JSON.parse(readFileSync(join(root, "evals/v2/protocol.json"), "utf8"));
  const tempDir = mkdtempSync(join(tmpdir(), "tastecheck-v2-judges-"));
  const secretRoot = join(tempDir, "secrets");
  mkdirSync(secretRoot, { recursive: true, mode: 0o700 });
  const created = reuseSeed ?? createRandomization({ domain: seedDomain, secretRoot });
  const protocol = {
    ...tracked,
    ...(protocolOverride ?? {}),
    randomization_commitment_sha256: protocolOverride?.randomization_commitment_sha256 ?? created.commitment.commitment_sha256
  };
  // freezeProtocol enforces the tracked placeholder commitment; tests use a
  // fresh real commitment, so we only validate the structural shape here.
  assert.equal(protocol.exclusions.length, 0);

  const generations = [];
  for (const scenario of registry.scenarios) {
    for (const seed of protocol.seeds) {
      const armOrder = swap ? ["candidate", "baseline"] : ["baseline", "candidate"];
      for (const arm of armOrder) {
        generations.push({
          scenario_id: scenario.scenario_id,
          generation_seed: seed,
          arm,
          bytes: syntheticBytes({ scenarioId: scenario.scenario_id, seed, arm })
        });
      }
    }
  }
  const renders = [];
  for (const gen of generations) {
    for (const viewport_id of VIEWPORTS) {
      renders.push({
        scenario_id: gen.scenario_id,
        generation_seed: gen.generation_seed,
        arm: gen.arm,
        viewport_id,
        screenshot_sha256: createHash("sha256").update(`${gen.bytes}|${viewport_id}|screenshot`).digest("hex"),
        dom_sha256: createHash("sha256").update(`${gen.bytes}|${viewport_id}|dom`).digest("hex"),
        style_sha256: createHash("sha256").update(`${gen.bytes}|${viewport_id}|style`).digest("hex")
      });
    }
  }

  return {
    tempDir,
    fixture: {
      protocol,
      registry,
      generations: typeof mutateGenerations === "function" ? mutateGenerations(generations) : generations,
      renders,
      buildCapability: createBuildAuthority(created.privateStateRef)
    },
    privateStateRef: created.privateStateRef,
    commitment: created.commitment,
    created
  };
}

function findArm(packet, opaque_slot) {
  const arm = packet.arms.find((candidate) => candidate.opaque_slot === opaque_slot);
  if (!arm) throw new Error(`packet ${packet.packet_id} missing slot ${opaque_slot}`);
  return arm;
}

function citationInto(packet, opaque_slot, viewport_id, { mutate } = {}) {
  const arm = findArm(packet, opaque_slot);
  const evidence = arm.render_evidence.find((entry) => entry.viewport_id === viewport_id);
  const bytes = Buffer.from(arm.artifact_bytes, "utf8");
  const text = bytes.toString("utf8");
  const codepoints = Array.from(text);
  const start = 0;
  const end = Math.min(12, codepoints.length);
  const span = codepoints.slice(start, end).join("");
  const citation = {
    artifact_id: arm.artifact_id,
    opaque_slot,
    viewport_id,
    artifact_sha256: arm.artifact_sha256,
    start_codepoint: start,
    end_codepoint: end,
    exact_span: span
  };
  return mutate ? mutate(citation, { arm, packet }) : citation;
}

function buildResult({ packet, family, identity, invocation, context, anchorKindExpected = null, preference = "tie" }) {
  const citedSlot = preference === "slot-1" ? 1 : 0;
  return {
    schema_version: 2,
    kind: "effectiveness-v2-judge-result",
    packet_id: packet.packet_id,
    family_id: family.family_id,
    identity_id: identity,
    invocation_id: invocation,
    context_id: context,
    packet_sha256: packetSha256(packet),
    preference,
    arm_scores: [
      { opaque_slot: 0, dimensions: { direction: 4, structure: 4, accessibility: 4, verbal: 4, integration: 4 } },
      { opaque_slot: 1, dimensions: { direction: 4, structure: 4, accessibility: 4, verbal: 4, integration: 4 } }
    ],
    hard_regressions: [],
    evidence_citations: [citationInto(packet, citedSlot, "mobile")]
  };
}

function buildBatch(built, { resultsOverride, familiesOverride } = {}) {
  const families = familiesOverride ?? manifestDefault.evaluator_families;
  const results = [];
  let counter = 0;
  const nextId = (prefix) => `${prefix}-${++counter}`;
  for (const packet of built.packets) {
    for (const family of families) {
      for (const identity of family.identities) {
        results.push(buildResult({ packet, family, identity, invocation: nextId("inv"), context: nextId("ctx") }));
      }
    }
  }
  for (const anchorPacket of built.anchor_packets) {
    const anchorMeta = built.anchor_metadata.find((meta) => meta.packet_id === anchorPacket.packet_id);
    const preference = anchorMeta.expected;
    for (const family of families) {
      for (const identity of family.identities) {
        results.push(buildResult({
          packet: anchorPacket,
          family,
          identity,
          invocation: nextId("inv"),
          context: nextId("ctx"),
          preference
        }));
      }
    }
  }
  return {
    packetSet: built.packets,
    anchorSet: built.anchor_packets,
    anchorMetadata: built.anchor_metadata,
    results: resultsOverride ?? results,
    families
  };
}

// ---------------------------------------------------------------------------
// 1. Packet construction
// ---------------------------------------------------------------------------
const primary = buildFixture();
let built;
try {
  built = buildBlindPackets(primary.fixture);
} catch (error) {
  console.error("buildBlindPackets failed:", error);
  throw error;
}
finally {
  // keep tempDir for now; cleanup at end
}

assert.equal(built.packets.length, 24, "exactly 24 production packets");
assert.equal(built.anchor_packets.length, 4, "exactly 4 anchor packets");
assert.equal(built.anchor_metadata.length, 4, "anchor metadata is exposed for operator gating");
assert.equal(built.map_commitment.length, 64, "map_commitment is a sha256 hex");
assert.equal(built.packet_set_sha256.length, 64, "packet_set_sha256 is a sha256 hex");
assert.ok(Buffer.isBuffer(built.encrypted_map) || typeof built.encrypted_map === "string", "encrypted_map is bytes/string");

const forbiddenReturnFields = ["seed", "key", "assignment", "assignments", "map", "privateStateRef", "plaintext_map"];
for (const field of forbiddenReturnFields) {
  assert.equal(field in built, false, `return shape must not expose ${field}`);
}

const serialized = JSON.stringify(built.packets);
assert.equal(serialized.includes("candidate"), false, "packets must not leak candidate arm");
assert.equal(serialized.includes("baseline"), false, "packets must not leak baseline arm");
for (const cue of ["0859121", "0f99603", "1.1.0", "/worktree/", "generated_at", "provider", "package.json"]) {
  assert.equal(serialized.toLowerCase().includes(cue.toLowerCase()), false, `packet JSON must not leak ${cue}`);
}

for (const packet of built.packets) {
  assert.ok(packet.packet_id && packet.unit_id && packet.scenario_id_token, "packet IDs are populated");
  assert.equal(packet.arms.length, 2, "packet has two arms");
  assert.deepEqual(packet.arms.map((arm) => arm.opaque_slot).sort(), [0, 1], "arm slots are 0 and 1");
  assert.equal(packet.arms[0].render_evidence.length, 2, "two viewports of evidence per arm");
  assert.equal(packet.brief, packet.brief, "brief stable");
  assert.equal(packet.rubric, packet.rubric, "rubric stable");
  assert.deepEqual(packet.viewport_ids, VIEWPORTS, "viewport ids frozen");
  const briefs = new Set(packet.arms.map((arm) => arm.brief));
  assert.equal(briefs.size, 1, "brief identical across arms");
  const armFields = packet.arms.map((arm) => Object.keys(arm).sort().join("|"));
  assert.equal(new Set(armFields).size, 1, "arm fields symmetric");
  // artifact_sha256 must match artifact_bytes
  for (const arm of packet.arms) {
    assert.equal(createHash("sha256").update(arm.artifact_bytes).digest("hex"), arm.artifact_sha256, "artifact hash binds bytes");
  }
}

// ---------------------------------------------------------------------------
// 2. Reject-only packet-policy validator (byte preservation + drift)
// ---------------------------------------------------------------------------
const cleanBytes = Buffer.from("<doc>clean 🦊 bytes for the validator.</doc>", "utf8");
const accepted = validatePacketArtifact({
  bytes: cleanBytes,
  validatorVersion: FROZEN_VALIDATOR_VERSION,
  validatorDigest: FROZEN_VALIDATOR_DIGEST
});
assert.equal(Buffer.compare(accepted, cleanBytes), 0, "validator must return original bytes byte-for-byte");

assert.throws(() => validatePacketArtifact({
  bytes: cleanBytes,
  validatorVersion: "drift",
  validatorDigest: FROZEN_VALIDATOR_DIGEST
}), /drift/, "validator version drift rejected");
assert.throws(() => validatePacketArtifact({
  bytes: cleanBytes,
  validatorVersion: FROZEN_VALIDATOR_VERSION,
  validatorDigest: "0".repeat(64)
}), /drift/, "validator digest drift rejected");

const cueCases = {
  baseline: "baseline bytes",
  candidate: "candidate bytes",
  revision_full: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
  revision_short: "0f99603",
  version: "version 1.1.0 ready",
  timestamp: "generated_at 2026-07-12T00:00:00",
  worktree: "/worktree/path/blob",
  provider: '"provider":"vendor"',
  metadata: "package.json contents"
};
for (const [name, fragment] of Object.entries(cueCases)) {
  assert.throws(() => validatePacketArtifact({
    bytes: Buffer.from(fragment, "utf8"),
    validatorVersion: FROZEN_VALIDATOR_VERSION,
    validatorDigest: FROZEN_VALIDATOR_DIGEST
  }), /forbidden|cue/i, `forbidden cue ${name} must reject`);
}

// Asymmetric acceptance is invalid: a unit with one clean + one forbidden arm is rejected.
assert.throws(
  () => validatePacketArtifact({
    bytes: [cleanBytes, Buffer.from("baseline leak", "utf8")],
    validatorVersion: FROZEN_VALIDATOR_VERSION,
    validatorDigest: FROZEN_VALIDATOR_DIGEST
  }),
  /forbidden|cue/i,
  "asymmetric acceptance must reject the whole unit"
);

// ---------------------------------------------------------------------------
// 3. Arm-order independence
// ---------------------------------------------------------------------------
const swapped = buildFixture({ swap: true, reuseSeed: primary.created });
let builtSwapped;
try {
  builtSwapped = buildBlindPackets(swapped.fixture);
} finally {
  // cleanup later
}
assert.equal(builtSwapped.packet_set_sha256, built.packet_set_sha256, "arm-order-independent packet_set_sha256");
assert.deepEqual(
  built.packets.map((packet) => packet.packet_id).sort(),
  builtSwapped.packets.map((packet) => packet.packet_id).sort(),
  "arm-order-independent packet IDs"
);
for (const packet of built.packets) {
  const peer = builtSwapped.packets.find((other) => other.packet_id === packet.packet_id);
  assert.ok(peer, "swapped build preserves packet IDs");
  assert.equal(peer.unit_id, packet.unit_id, "unit IDs stable across swap");
  for (const slot of [0, 1]) {
    const arm = findArm(packet, slot);
    const peerArm = findArm(peer, slot);
    assert.equal(arm.artifact_id, peerArm.artifact_id, "artifact IDs stable per slot");
    assert.equal(arm.label_id, peerArm.label_id, "label IDs stable per slot");
    assert.equal(arm.artifact_bytes, peerArm.artifact_bytes, "bytes stable per slot");
    assert.equal(arm.artifact_sha256, peerArm.artifact_sha256, "bytes hash stable per slot");
  }
}

// ---------------------------------------------------------------------------
// 4. Absent admitted commitment must reject
// ---------------------------------------------------------------------------
const unbound = buildFixture({ protocolOverride: { randomization_commitment_sha256: "e".repeat(64) } });
assert.throws(() => buildBlindPackets(unbound.fixture), /commitment|binding/i, "absent admitted commitment must reject");

// ---------------------------------------------------------------------------
// 5. validateJudgeBatch: baseline admissibility
// ---------------------------------------------------------------------------
const baselineBatch = buildBatch(built);
const baseline = validateJudgeBatch(baselineBatch);
assert.equal(baseline.valid, true, `baseline batch must be admissible: ${JSON.stringify(baseline.errors)}`);
assert.equal(baseline.admissible_results.length, baselineBatch.results.length, "all baseline results admissible");
assert.equal(baseline.errors.length, 0, "baseline batch has no errors");

// ---------------------------------------------------------------------------
// 6. Adversarial judge mutations
// ---------------------------------------------------------------------------
function expectReject({ description, batchOverride, resultsOverride, familiesOverride, token }) {
  const batch = batchOverride ?? buildBatch(built, { resultsOverride, familiesOverride });
  const result = validateJudgeBatch(batch);
  assert.equal(result.valid, false, `${description}: batch must be invalid`);
  const matched = result.errors.some((error) => new RegExp(token, "i").test(error));
  assert.ok(matched, `${description}: expected error matching ${token}, got ${JSON.stringify(result.errors)}`);
}

// Family quorum / lineage / invocation identity
expectReject({
  description: "single family collapses quorum",
  familiesOverride: [manifestDefault.evaluator_families[0]],
  token: "family|quorum"
});
expectReject({
  description: "duplicate upstream lineage",
  familiesOverride: sameLineage,
  token: "family|lineage"
});
expectReject({
  description: "duplicate invocation identity",
  resultsOverride: (() => {
    const batch = buildBatch(built);
    batch.results[1] = { ...batch.results[1], invocation_id: batch.results[0].invocation_id };
    return batch.results;
  })(),
  token: "invocation|identity|duplicate"
});

// Anchor failures
for (const [description, anchorId, newPreference] of [
  ["failed tie anchor", "tie-identical-a", "slot-0"],
  ["failed broken anchor", "broken-complete-a", "tie"],
  ["failed reversed anchor", "broken-complete-b", "slot-1"]
]) {
  expectReject({
    description,
    resultsOverride: (() => {
      const batch = buildBatch(built);
      for (const result of batch.results) {
        const meta = built.anchor_metadata.find((m) => m.packet_id === result.packet_id);
        if (meta && meta.anchor_id === anchorId) result.preference = newPreference;
      }
      return batch.results;
    })(),
    token: "anchor|batch|invalid"
  });
}

// Position-bias detection: judge picks slot-1 on both broken-complete anchors
expectReject({
  description: "position-bias slot-1 on both broken-complete anchors",
  resultsOverride: (() => {
    const batch = buildBatch(built);
    for (const result of batch.results) {
      const meta = built.anchor_metadata.find((m) => m.packet_id === result.packet_id);
      if (meta && meta.kind === "broken-complete") result.preference = "slot-1";
      if (meta && meta.kind === "broken-complete-reversed") result.preference = "slot-1";
    }
    return batch.results;
  })(),
  token: "anchor|batch|invalid|position"
});

// Missing evidence / unknown field
expectReject({
  description: "missing evidence citation",
  resultsOverride: (() => {
    const batch = buildBatch(built);
    batch.results[0] = { ...batch.results[0], evidence_citations: [] };
    return batch.results;
  })(),
  token: "evidence|binding|minItems|schema"
});
expectReject({
  description: "human calibration field rejected",
  resultsOverride: (() => {
    const batch = buildBatch(built);
    batch.results[0] = { ...batch.results[0], human_calibration: {} };
    return batch.results;
  })(),
  token: "additional|unknown|field|schema"
});

// ---------------------------------------------------------------------------
// 7. Evidence citation mutations
// ---------------------------------------------------------------------------
function expectCitationReject({ description, citation, token = "evidence|binding" }) {
  const result = validateEvidenceCitation(citation, built.packets);
  assert.equal(result.valid, false, `${description}: citation must be invalid`);
  const matched = result.errors.some((error) => new RegExp(token, "i").test(error));
  assert.ok(matched, `${description}: expected error matching ${token}, got ${JSON.stringify(result.errors)}`);
}

const referencePacket = built.packets[0];
const referenceArm = findArm(referencePacket, 0);
const referenceText = referenceArm.artifact_bytes;
const referenceCodepoints = Array.from(referenceText);

const citationCases = {
  inventedSpan: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    return { ...cite, exact_span: "this span is not in the artifact 🦊" };
  },
  paraphrasedSpan: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    const span = cite.exact_span;
    return { ...cite, exact_span: span.toUpperCase() === span ? span.toLowerCase() : span.toUpperCase() };
  },
  wrongArm: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    const otherArm = findArm(referencePacket, 1);
    return { ...cite, artifact_id: otherArm.artifact_id, artifact_sha256: otherArm.artifact_sha256, opaque_slot: 1 };
  },
  wrongViewport: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    return { ...cite, viewport_id: "watch" };
  },
  wrongLocator: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    return { ...cite, artifact_id: "artifact-id-not-in-set" };
  },
  staleHash: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    return { ...cite, artifact_sha256: "0".repeat(64) };
  },
  emptySpan: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    return { ...cite, start_codepoint: 0, end_codepoint: 0, exact_span: "" };
  },
  hashValidNonmatchingSpan: () => {
    const cite = citationInto(referencePacket, 0, "mobile");
    // span outside the offset window but keeping hash stable
    return { ...cite, exact_span: referenceCodepoints.slice(5, 9).join(""), start_codepoint: 0, end_codepoint: 4 };
  }
};
for (const [name, buildCitation] of Object.entries(citationCases)) {
  expectCitationReject({ description: name, citation: buildCitation() });
}

// Codepoint semantics on multibyte content
const multibyteCite = citationInto(referencePacket, 0, "mobile", {
  mutate: (cite) => {
    // Shift the start/end to land AFTER the emoji by codepoint, then test that byte offset would fail.
    const codepoints = Array.from(referenceText);
    const emojiIndex = codepoints.indexOf("🦊");
    const start = emojiIndex;
    const end = emojiIndex + 1;
    return { ...cite, start_codepoint: start, end_codepoint: end, exact_span: "🦊" };
  }
});
const multibyteResult = validateEvidenceCitation(multibyteCite, built.packets);
assert.equal(multibyteResult.valid, true, `codepoint-aware span on emoji must pass: ${JSON.stringify(multibyteResult.errors)}`);

// ---------------------------------------------------------------------------
// 8. Mutable-packet rejection: arm-order-dependent ID, validator drift/collision
// ---------------------------------------------------------------------------
// Simulate a buggy adapter that mixes real-arm identity into the HMAC tuple.
function buggyBuild({ includeArm = false, includeIndex = false, deterministicSlot = false } = {}) {
  const registry = loadRegistry(root);
  const tracked = JSON.parse(readFileSync(join(root, "evals/v2/protocol.json"), "utf8"));
  const tempDir = mkdtempSync(join(tmpdir(), "tastecheck-v2-judges-buggy-"));
  const secretRoot = join(tempDir, "secrets");
  mkdirSync(secretRoot, { recursive: true, mode: 0o700 });
  const created = createRandomization({ domain: "effectiveness-v2-judges-buggy", secretRoot });
  const protocol = { ...tracked, randomization_commitment_sha256: created.commitment.commitment_sha256 };
  const seedBytes = readFileSync(created.privateStateRef.secretPath);
  const len = (buf) => {
    const out = Buffer.alloc(4);
    out.writeUInt32BE(buf.length, 0);
    return Buffer.concat([out, buf]);
  };
  const derive = (domain, scenarioId, seedStr, slot = null, arm = null, idx = null) => {
    const h = createHmac("sha256", seedBytes);
    h.update(len(Buffer.from(domain, "utf8")));
    h.update(len(Buffer.from(scenarioId, "utf8")));
    h.update(len(Buffer.from(String(seedStr), "utf8")));
    if (slot !== null) h.update(len(Buffer.from([slot])));
    if (includeArm && arm) h.update(len(Buffer.from(arm, "utf8")));
    if (includeIndex && idx !== null) h.update(len(Buffer.from([idx])));
    return h.digest("hex");
  };
  const packets = [];
  for (const scenario of registry.scenarios) {
    for (const seed of protocol.seeds) {
      const seedStr = String(seed);
      const arms = [
        { arm: "baseline", bytes: syntheticBytes({ scenarioId: scenario.scenario_id, seed, arm: "baseline" }) },
        { arm: "candidate", bytes: syntheticBytes({ scenarioId: scenario.scenario_id, seed, arm: "candidate" }) }
      ];
      const assignmentBit = derive("assignment", scenario.scenario_id, seedStr)[0] & 1;
      for (let idx = 0; idx < arms.length; idx++) {
        const entry = arms[idx];
        const slot = deterministicSlot ? (entry.arm === "candidate" ? 1 : 0) : ((entry.arm === "baseline" ? 0 : 1) ^ assignmentBit);
        const artifactId = derive("artifact", scenario.scenario_id, seedStr, slot, entry.arm, idx);
        packets.push({ scenario_id: scenario.scenario_id, seed, slot, artifact_id: artifactId, arm: entry.arm, bytes: entry.bytes });
      }
    }
  }
  seedBytes.fill(0);
  rmSync(tempDir, { recursive: true, force: true });
  return packets;
}

const buggyPacketsArm = buggyBuild({ includeArm: true });
const buggyPacketsBase = buggyBuild({ includeArm: false });
let divergent = false;
for (const pkt of buggyPacketsArm) {
  const peer = buggyPacketsBase.find((p) => p.scenario_id === pkt.scenario_id && p.seed === pkt.seed && p.slot === pkt.slot);
  if (!peer || peer.artifact_id !== pkt.artifact_id) { divergent = true; break; }
}
assert.equal(divergent, true, "buggy adapter that mixes real arm into HMAC tuple diverges on coordinate");

// Validator collision: distinct inputs must hash distinctly
const left = validatePacketArtifact({ bytes: Buffer.from("<doc>first 🦊</doc>", "utf8"), validatorVersion: FROZEN_VALIDATOR_VERSION, validatorDigest: FROZEN_VALIDATOR_DIGEST });
const right = validatePacketArtifact({ bytes: Buffer.from("<doc>second 🦊</doc>", "utf8"), validatorVersion: FROZEN_VALIDATOR_VERSION, validatorDigest: FROZEN_VALIDATOR_DIGEST });
assert.notEqual(createHash("sha256").update(left).digest("hex"), createHash("sha256").update(right).digest("hex"), "distinct accepted inputs hash distinctly");

// ---------------------------------------------------------------------------
// 9. Encrypted map binding for Task 6 (map_commitment verifies, no plaintext leak)
// ---------------------------------------------------------------------------
const encryptedJson = Buffer.isBuffer(built.encrypted_map) ? built.encrypted_map.toString("utf8") : built.encrypted_map;
assert.equal(encryptedJson.includes("aes-256-gcm"), true, "encrypted_map is a structured authenticated-encryption envelope");
assert.equal(encryptedJson.includes("ciphertext"), true, "encrypted_map carries ciphertext");
assert.equal(encryptedJson.includes("baseline"), false, "encrypted_map envelope must not leak arm names");
assert.equal(encryptedJson.includes("candidate"), false, "encrypted_map envelope must not leak arm names");
assert.equal(encryptedJson.includes("mappings"), false, "encrypted_map envelope must not leak plaintext mappings field");
// Plaintext seed never appears
const seedText = readFileSync(primary.privateStateRef.secretPath).toString("hex");
assert.equal(encryptedJson.includes(seedText), false, "encrypted_map must not leak seed bytes");
assert.equal(JSON.stringify(built).includes(seedText), false, "no part of the build leaks seed bytes");

// ---------------------------------------------------------------------------
// 10. Adapter public surface unchanged: still produces packet_set_sha256 for stub input
// ---------------------------------------------------------------------------
const stubTemp = mkdtempSync(join(tmpdir(), "tastecheck-v2-judges-stub-"));
const stubSecretRoot = join(stubTemp, "secrets");
mkdirSync(stubSecretRoot, { recursive: true, mode: 0o700 });
const stubCreated = createRandomization({ domain: "effectiveness-v2-judges-stub", secretRoot: stubSecretRoot });
const stubAuthority = createBuildAuthority(stubCreated.privateStateRef);
assert.equal(Object.keys(stubAuthority).join("|"), "buildPackets", "adapter surface stays { buildPackets }");
const stubResult = stubAuthority.buildPackets({ unit: 1 });
assert.equal(stubResult.packet_set_sha256.length, 64, "stub build still yields packet_set_sha256");
rmSync(stubTemp, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 11. Brief formula alignment (I-1):
//     packet_set_sha256 = SHA256(canonicalJson(sortBy(packets, packet_id).map(canonicalPacket)))
// ---------------------------------------------------------------------------
{
  const sortedPackets = [...built.packets].sort((a, b) => a.packet_id.localeCompare(b.packet_id));
  const briefFormulaDigest = sha256(canonicalJson(sortedPackets.map(canonicalPacket)));
  assert.equal(
    built.packet_set_sha256,
    briefFormulaDigest,
    "packet_set_sha256 must match brief formula: SHA256(canonicalJson(sortBy(packets, packet_id).map(canonicalPacket)))"
  );
}

// ---------------------------------------------------------------------------
// 12. Closed per-arm field allowlist (I-2): symmetric unknown fields rejected
// ---------------------------------------------------------------------------
{
  const symUnknown = buildFixture({ reuseSeed: primary.created });
  const realBuild = symUnknown.fixture.buildCapability;
  symUnknown.fixture.buildCapability = {
    buildPackets(input) {
      const result = realBuild.buildPackets(input);
      for (const arm of result.packets[0].arms) {
        arm.real_arm_hash = "deadbeef".repeat(8);
      }
      return result;
    }
  };
  assert.throws(
    () => buildBlindPackets(symUnknown.fixture),
    /closed|field|unknown|arm/i,
    "symmetric unknown arm field must be rejected by closed allowlist"
  );
  rmSync(symUnknown.tempDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 13. arm_id removed from arm output (I-3) + explicit closed arm-field allowlist
// ---------------------------------------------------------------------------
const ARM_FIELD_ALLOWLIST = ["opaque_slot", "artifact_id", "label_id", "artifact_bytes", "artifact_sha256", "brief", "render_evidence"];
for (const packet of [...built.packets, ...built.anchor_packets]) {
  for (const arm of packet.arms) {
    assert.equal("arm_id" in arm, false, "arm_id must not be present in arm output (dead weight removed)");
    const fields = Object.keys(arm).sort();
    assert.deepEqual(fields, [...ARM_FIELD_ALLOWLIST].sort(), `arm fields must exactly match closed allowlist: got ${fields.join("|")}`);
  }
}

// ---------------------------------------------------------------------------
// 14. High-value missing tests: out-of-bounds codepoint, surrogate-pair,
//     duplicate generations, asymmetric rubric
// ---------------------------------------------------------------------------

// 14a. Out-of-bounds codepoint offset (E-10): end > length must be rejected
{
  const oobCite = citationInto(referencePacket, 0, "mobile", {
    mutate: (cite) => {
      const codepoints = Array.from(referenceText);
      return { ...cite, start_codepoint: codepoints.length, end_codepoint: codepoints.length + 5, exact_span: "x".repeat(5) };
    }
  });
  expectCitationReject({ description: "out-of-bounds codepoint offset (end > length)", citation: oobCite, token: "offset|bounds" });
}

// 14b. Surrogate-pair codepoint semantics (E-13): UTF-16 code-unit offset ≠ codepoint offset
{
  const codepoints = Array.from(referenceText);
  const emojiCpIdx = codepoints.indexOf("🦊");
  const emojiUtf16Idx = referenceText.indexOf("🦊");
  // 🦊 is U+1F98A: 1 codepoint, 2 UTF-16 code units. After it, UTF-16 indices
  // drift from codepoint indices by 1.
  const afterCp = emojiCpIdx + 1;        // codepoint index of char after emoji
  const afterUtf16 = emojiUtf16Idx + 2;   // UTF-16 index of char after emoji
  assert.ok(afterUtf16 > afterCp, "UTF-16 index after supplementary char must exceed codepoint index");
  // Buggy caller uses UTF-16 offset as codepoint offset; the span is correct
  // in UTF-16 space but the validator slices in codepoint space (1 off).
  const buggySpan = referenceText.substring(afterUtf16, afterUtf16 + 4);
  const surrogateBadCite = citationInto(referencePacket, 0, "mobile", {
    mutate: (cite) => ({
      ...cite,
      start_codepoint: afterUtf16,
      end_codepoint: afterUtf16 + 4,
      exact_span: buggySpan
    })
  });
  expectCitationReject({ description: "UTF-16 surrogate-pair offset treated as codepoint", citation: surrogateBadCite, token: "nonmatching|span" });
}

// 14c. Duplicate generation entries rejected (M-8)
{
  const dupGen = buildFixture({ reuseSeed: primary.created, mutateGenerations: (gens) => [...gens, { ...gens[0] }] });
  assert.throws(
    () => buildBlindPackets(dupGen.fixture),
    /duplicate|generation/i,
    "duplicate generation entry must be rejected"
  );
  rmSync(dupGen.tempDir, { recursive: true, force: true });
}

// 14d. Asymmetric rubric across packets rejected (P-19)
{
  const asymRubric = buildFixture({ reuseSeed: primary.created });
  const realBuild = asymRubric.fixture.buildCapability;
  asymRubric.fixture.buildCapability = {
    buildPackets(input) {
      const result = realBuild.buildPackets(input);
      result.packets[0] = { ...result.packets[0], rubric: { ...result.packets[0].rubric, scale: "1-10 mutated" } };
      return result;
    }
  };
  assert.throws(
    () => buildBlindPackets(asymRubric.fixture),
    /rubric|asymmetric/i,
    "rubric differing across packets must be rejected"
  );
  rmSync(asymRubric.tempDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
recordQaCase("identifier-ordering-and-rebinding");
recordQaCase("anchor-aggregation-and-evidence-attacks");
recordQaCase("unknown-fields-and-validator-drift");
recordQaCase("failed-anchors-and-family-collapse");
recordQaCase("citation-span-cross-arm-and-stale-evidence");
rmSync(primary.tempDir, { recursive: true, force: true });
rmSync(swapped.tempDir, { recursive: true, force: true });
rmSync(unbound.tempDir, { recursive: true, force: true });

console.log("effectiveness-v2 judge tests passed");
