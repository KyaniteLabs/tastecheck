// Task 7A: validator, resolver, executor-selection, and admission foundations.
// Pure verification only: no network, provider, executor, or production calls.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import manifestFixture from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";
import {
  PACKET_POLICY_DEPENDENCY_FILES,
  computeValidatorClosure,
  validateContract
} from "./lib/contracts.mjs";
import { FROZEN_VALIDATOR_DIGEST, FROZEN_VALIDATOR_VERSION } from "./lib/packet-policy.mjs";
import {
  RESOLVER_ATTESTATION_ISSUER_ALLOWLIST,
  canonicalExecutorDigest,
  discoverProvisionedFamilies,
  freezeExecutionSelection,
  sanitizeCapability,
  selectFamilies,
  verifyAdmissionBindings,
  verifyResolverAttestation,
  verifyResolverAttestationFormat
} from "./lib/providers.mjs";
import { canonicalJson, sha256 } from "./lib/canonical-json.mjs";

const repoRoot = new URL("../../../", import.meta.url).pathname;
const protocol = JSON.parse(readFileSync(join(repoRoot, "evals/v2/protocol.json"), "utf8"));

const providerPreflight = spawnSync(process.execPath, [join(repoRoot, "tools/evals/v2/generate.mjs"), "preflight"], { encoding: "utf8" });
assert.notEqual(providerPreflight.status, 0, "provider preflight must not claim success without sealed two-provider proof");
assert.match(`${providerPreflight.stdout}\n${providerPreflight.stderr}`, /production_not_started/);
assert.doesNotMatch(`${providerPreflight.stdout}\n${providerPreflight.stderr}`, /preflight passed/i);

const synthesisCli = spawnSync(process.execPath, [
  join(repoRoot, "tools/evals/v2/synthesize.mjs"), "synthesize", repoRoot, "a".repeat(64)
], { encoding: "utf8" });
assert.notEqual(synthesisCli.status, 0, "unsealed synthesis CLI must fail closed");
assert.match(`${synthesisCli.stdout}\n${synthesisCli.stderr}`, /production_not_started/);

// Exact, closed, sorted five-file validator dependency set.
assert.equal(PACKET_POLICY_DEPENDENCY_FILES.length, 5);
assert.equal(new Set(PACKET_POLICY_DEPENDENCY_FILES).size, 5);
assert.deepEqual(PACKET_POLICY_DEPENDENCY_FILES, [...PACKET_POLICY_DEPENDENCY_FILES].sort());
assert.deepEqual(PACKET_POLICY_DEPENDENCY_FILES, [
  "contracts/v2/effectiveness/judgment.schema.json",
  "contracts/v2/effectiveness/packet.schema.json",
  "tools/evals/v2/lib/canonical-json.mjs",
  "tools/evals/v2/lib/packet-policy.mjs",
  "tools/evals/v2/validate-judges.mjs"
]);
const closure = computeValidatorClosure(repoRoot);
assert.match(closure.sha256, /^[0-9a-f]{64}$/);
assert.equal(closure.version, "effectiveness-v2-packet-policy-1");
assert.equal(FROZEN_VALIDATOR_VERSION, closure.version);
assert.equal(FROZEN_VALIDATOR_DIGEST, closure.sha256);
assert.equal(protocol.packet_validator_sha256, closure.sha256);
assert.notEqual(closure.sha256, "b".repeat(64));
assert.equal(validateContract("packet", { unknown: true }).valid, false);
assert.equal(validateContract("judgment", { unknown: true }).valid, false);
const validatorSource = readFileSync(join(repoRoot, "tools/evals/v2/validate-judges.mjs"), "utf8");
const packetPolicySource = readFileSync(join(repoRoot, "tools/evals/v2/lib/packet-policy.mjs"), "utf8");
assert.doesNotMatch(validatorSource, /from\s+["'][^"']*(?:contracts|judges)\.mjs["']/);
assert.doesNotMatch(packetPolicySource, /from\s+["'][^"']*contracts\.mjs["']/);

// The closure entry point applies packet.schema.json to anchors as well as
// production packets; no judge-visible packet class can bypass the schema.
const cliRoot = mkdtempSync(join(tmpdir(), "tastecheck-v2-validator-cli-"));
try {
  const packetPath = join(cliRoot, "packets.json");
  const resultPath = join(cliRoot, "results.json");
  writeFileSync(packetPath, JSON.stringify({ packets: [], anchor_packets: [{ unknown: true }], anchor_metadata: [] }));
  writeFileSync(resultPath, JSON.stringify({ results: [] }));
  const cli = spawnSync(process.execPath, [join(repoRoot, "tools/evals/v2/validate-judges.mjs"), packetPath, resultPath], { encoding: "utf8" });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stdout, /packet\|\?|unknown|additional/i);
} finally {
  rmSync(cliRoot, { recursive: true, force: true });
}

// Every arm must carry one mobile and one desktop receipt. Cardinality two is
// insufficient because two distinct mobile receipt objects otherwise pass.
const viewportCliRoot = mkdtempSync(join(tmpdir(), "tastecheck-v2-validator-viewports-"));
try {
  const d = (value) => sha256(value);
  const render = (suffix) => ({
    viewport_id: "mobile", viewport_id_token: d(`viewport|${suffix}`), evidence_id: d(`evidence|${suffix}`),
    artifact_sha256: d("artifact"), screenshot_sha256: d(`shot|${suffix}`),
    dom_sha256: d(`dom|${suffix}`), style_sha256: d(`style|${suffix}`)
  });
  const arm = (slot) => ({
    opaque_slot: slot, artifact_id: d(`artifact-id|${slot}`), label_id: d(`label|${slot}`),
    artifact_bytes: "clean artifact", artifact_sha256: d("artifact"), brief: "brief",
    render_evidence: [render(`${slot}|a`), render(`${slot}|b`)]
  });
  const packet = {
    packet_id: d("packet"), unit_id: d("unit"), scenario_id_token: d("scenario"),
    arms: [arm(0), arm(1)], brief: "brief", rubric: "rubric", viewport_ids: ["mobile", "desktop"]
  };
  const packetPath = join(viewportCliRoot, "packets.json");
  const resultPath = join(viewportCliRoot, "results.json");
  writeFileSync(packetPath, JSON.stringify({ packets: [packet], anchor_packets: [], anchor_metadata: [] }));
  writeFileSync(resultPath, JSON.stringify({ results: [], families: [] }));
  const cli = spawnSync(process.execPath, [join(repoRoot, "tools/evals/v2/validate-judges.mjs"), packetPath, resultPath], { encoding: "utf8" });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stdout, /render_evidence|contain|desktop/i);
} finally {
  rmSync(viewportCliRoot, { recursive: true, force: true });
}

const closureRoot = mkdtempSync(join(tmpdir(), "tastecheck-v2-foundation-"));
try {
  for (const path of PACKET_POLICY_DEPENDENCY_FILES) {
    mkdirSync(dirname(join(closureRoot, path)), { recursive: true });
    cpSync(join(repoRoot, path), join(closureRoot, path));
  }
  assert.equal(computeValidatorClosure(closureRoot).sha256, closure.sha256);
  for (const path of PACKET_POLICY_DEPENDENCY_FILES) {
    const target = join(closureRoot, path);
    const original = readFileSync(target);
    writeFileSync(target, Buffer.concat([original, Buffer.from("\n") ]));
    assert.notEqual(computeValidatorClosure(closureRoot).sha256, closure.sha256, `${path} drift must change closure`);
    writeFileSync(target, original);
  }
  const canonicalizer = join(closureRoot, "tools/evals/v2/lib/canonical-json.mjs");
  rmSync(canonicalizer);
  symlinkSync(join(repoRoot, "tools/evals/v2/lib/canonical-json.mjs"), canonicalizer);
  assert.throws(() => computeValidatorClosure(closureRoot), /symlink/i);
  rmSync(canonicalizer);
  assert.throws(() => computeValidatorClosure(closureRoot), /missing/i);
} finally {
  rmSync(closureRoot, { recursive: true, force: true });
}

function attestation({ subject_kind, subject_canonical_id, provider, foundation_lineage, resolved_version, cost_kind = "flat-rate" }) {
  return {
    schema_version: 2,
    kind: "effectiveness-v2-resolver-attestation",
    issuer: RESOLVER_ATTESTATION_ISSUER_ALLOWLIST[0],
    subject_kind,
    subject_canonical_id,
    provider,
    resolved_version,
    foundation_lineage,
    evidence_sha256: sha256(`resolver-evidence|${subject_kind}|${subject_canonical_id}`),
    introspection_only: true,
    cost_kind,
    incremental_spend_usd: 0
  };
}

const attestations = [attestation({
  subject_kind: "generator",
  subject_canonical_id: manifestFixture.generator.identity,
  provider: manifestFixture.generator.provider,
  foundation_lineage: manifestFixture.generator.foundation_lineage,
  resolved_version: manifestFixture.generator.model_version,
  cost_kind: "already-provisioned"
})];
for (const family of manifestFixture.evaluator_families) {
  for (const identity of family.identities) {
    attestations.push(attestation({
      subject_kind: "judge",
      subject_canonical_id: identity,
      provider: family.provider,
      foundation_lineage: family.foundation_lineage,
      resolved_version: family.model_version
    }));
  }
}
assert.equal(attestations.length, 5);
for (const item of attestations) assert.doesNotThrow(() => verifyResolverAttestationFormat(item));
assert.throws(() => verifyResolverAttestationFormat({ ...attestations[0], issuer: "untrusted" }), /issuer/i);
assert.throws(() => verifyResolverAttestationFormat({ ...attestations[0], introspection_only: false }), /schema|introspection/i);
assert.throws(() => verifyResolverAttestationFormat({ ...attestations[0], incremental_spend_usd: 0.01 }), /schema|spend/i);
assert.throws(() => verifyResolverAttestationFormat({ ...attestations[0], subject_canonical_id: "model\u200b" }), /canonical|ascii/i);
assert.throws(() => verifyResolverAttestationFormat({ ...attestations[0], alias: "latest" }), /schema/i);
assert.throws(() => verifyResolverAttestationFormat(
  { ...attestations[0], resolved_version: "generator-model-2099-01-01" },
  { boundVersions: new Map([[attestations[0].subject_canonical_id, attestations[0].resolved_version]]) }
), /drift/i);
// Production path: unsigned attestations must require trusted signature.
assert.throws(() => verifyResolverAttestation(attestations[0]), /trusted-signature|required/);

const secretCapability = {
  provider: "provider-a",
  foundation_lineage: "lineage-a",
  model_version: "model-a-2026-06-15",
  lineage_verified: true,
  cost_kind: "flat-rate",
  incremental_spend_usd: 0,
  credentials: { api_key: "not-public" },
  nested: { token: "not-public-either", safe: true }
};
const safeCapability = sanitizeCapability(secretCapability);
assert.equal(JSON.stringify(safeCapability).includes("not-public"), false);
assert.equal(safeCapability.nested.safe, true);
assert.throws(() => selectFamilies([secretCapability]), /exactly two/i);
assert.throws(() => selectFamilies([
  secretCapability,
  { ...secretCapability, provider: "provider-b" }
]), /lineage/i);
assert.throws(() => selectFamilies([
  secretCapability,
  { ...secretCapability, provider: "provider-b", foundation_lineage: "lineage-b", cost_kind: "incremental" }
]), /incremental/i);
assert.equal(selectFamilies([
  secretCapability,
  { ...secretCapability, provider: "provider-b", foundation_lineage: "lineage-b" }
]).length, 2);
const discovered = discoverProvisionedFamilies({ capabilities: [secretCapability], attestations });
assert.equal(discovered.length, 1);
assert.equal(JSON.stringify(discovered).includes("not-public"), false);

const selection = freezeExecutionSelection({ manifest: manifestFixture, attestations });
assert.match(selection.generator.executor_digest, /^[0-9a-f]{64}$/);
assert.equal(selection.judges.length, 4);
assert.equal(new Set(selection.judges.map(({ executor_digest }) => executor_digest)).size, 4);
assert.equal(selection.generator.executor.call_class, "generation");
assert.ok(selection.judges.every(({ executor }) => executor.call_class === "judge"));
assert.equal(selection.generator.executor.zero_cost_proof.kind, "already-provisioned");
assert.throws(() => freezeExecutionSelection({ manifest: manifestFixture, attestations: attestations.slice(1) }), /generator|attestation|exactly-one/i);
assert.throws(() => freezeExecutionSelection({ manifest: manifestFixture, attestations: [...attestations, attestations[0]] }), /exactly-one/i);
assert.throws(() => freezeExecutionSelection({
  manifest: manifestFixture,
  attestations: attestations.map((item, index) => index === 1 ? { ...item, provider: "wrong-provider" } : item)
}), /provider|mismatch/i);
assert.throws(() => freezeExecutionSelection({
  manifest: manifestFixture,
  attestations: attestations.map((item, index) => index === 0 ? { ...item, subject_canonical_id: manifestFixture.generator.provider } : item)
}), /generator|attestation|exactly-one/i);
for (const field of ["settings_sha256", "tool_policy_sha256", "time_budget_seconds"]) {
  const changed = structuredClone(manifestFixture);
  changed.evaluator_families[0][field] = field === "time_budget_seconds"
    ? changed.evaluator_families[0][field] + 1
    : sha256(`changed|${field}`);
  const changedSelection = freezeExecutionSelection({ manifest: changed, attestations });
  assert.notEqual(changedSelection.judges[0].executor_digest, selection.judges[0].executor_digest, `${field} must bind judge executor digest`);
}
for (const collision of [
  { identity: manifestFixture.evaluator_families[0].identities[0] },
  { family_id: manifestFixture.evaluator_families[0].family_id }
]) {
  assert.throws(() => freezeExecutionSelection({
    manifest: { ...manifestFixture, generator: { ...manifestFixture.generator, ...collision } }, attestations
  }), /generator|collision|identity|family/i);
}

const generationExecutor = selection.generator.executor;
assert.equal(canonicalExecutorDigest(generationExecutor), selection.generator.executor_digest);
assert.throws(() => canonicalExecutorDigest({ ...generationExecutor, extra: true }), /closed/i);
assert.throws(() => canonicalExecutorDigest({ ...generationExecutor, provider: "Provider A" }), /canonical|ascii/i);
assert.throws(() => canonicalExecutorDigest({ ...generationExecutor, adapter_sha256: "x".repeat(64) }), /sha256/i);
assert.throws(() => canonicalExecutorDigest({
  ...generationExecutor,
  zero_cost_proof: { kind: "incremental", incremental_spend_usd: 0.01 }
}), /zero-cost|incremental/i);

const commitment = sha256("task7a-test-randomization-commitment");
const admittedProtocol = { ...protocol, randomization_commitment_sha256: commitment };
const admission = verifyAdmissionBindings({
  protocol: admittedProtocol,
  manifest: manifestFixture,
  selection,
  attestations,
  commitmentSha256: commitment
});
assert.match(admission.protocol_sha256, /^[0-9a-f]{64}$/);
assert.equal(admission.selection_sha256, selection.selection_sha256);
for (const mutation of [
  { exclusions: ["unit"] },
  { max_external_calls: 159 },
  { retry_policy: "once" },
  { incremental_spend_cap_usd: 1 },
  { human_calibration_claimed: true }
]) {
  assert.throws(() => verifyAdmissionBindings({
    protocol: { ...admittedProtocol, ...mutation }, manifest: manifestFixture, selection, attestations, commitmentSha256: commitment
  }), /admission|must equal|protocol/i);
}
assert.throws(() => verifyAdmissionBindings({
  protocol: admittedProtocol, manifest: manifestFixture,
  selection: { ...selection, selection_sha256: "0".repeat(64) }, attestations, commitmentSha256: commitment
}), /selection|digest/i);
assert.throws(() => verifyAdmissionBindings({
  protocol: admittedProtocol, manifest: manifestFixture, selection, attestations,
  commitmentSha256: "a".repeat(64)
}), /commitment/i);

function selfConsistentSelectionWithGeneratorMutation(field, value) {
  const generatorExecutor = { ...selection.generator.executor, [field]: value };
  const forged = {
    ...selection,
    generator: {
      ...selection.generator,
      executor: generatorExecutor,
      executor_digest: canonicalExecutorDigest(generatorExecutor)
    }
  };
  const payload = {
    execution_manifest_sha256: forged.execution_manifest_sha256,
    generator: {
      executor_digest: forged.generator.executor_digest,
      resolver_attestation_sha256: forged.generator.resolver_attestation_sha256
    },
    judges: forged.judges.map((judge) => ({
      executor_digest: judge.executor_digest,
      resolver_attestation_sha256: judge.resolver_attestation_sha256
    })).sort((left, right) => left.executor_digest.localeCompare(right.executor_digest))
  };
  return { ...forged, selection_sha256: sha256(canonicalJson(payload)) };
}
for (const [field, value] of [
  ["provider", "rogue-provider"],
  ["foundation_lineage", "rogue-lineage"],
  ["model_version", "rogue-model-2026-01-01"]
]) {
  assert.throws(() => verifyAdmissionBindings({
    protocol: admittedProtocol, manifest: manifestFixture,
    selection: selfConsistentSelectionWithGeneratorMutation(field, value), attestations,
    commitmentSha256: commitment
  }), /admission|selection|mismatch/i, `self-consistent rogue ${field} selection must reject`);
}
assert.throws(() => verifyAdmissionBindings({
  protocol: admittedProtocol, manifest: manifestFixture, selection,
  attestations: attestations.map((item, index) => index === 0 ? { ...item, evidence_sha256: "not-a-digest" } : item),
  commitmentSha256: commitment
}), /attestation|sha256|schema|invalid/i);

console.log("effectiveness-v2 Task 7A foundation tests passed; external calls 0");
