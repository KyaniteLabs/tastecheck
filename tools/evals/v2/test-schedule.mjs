import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import manifest from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";
import { sha256 } from "./lib/canonical-json.mjs";
import {
  buildGenerationSchedule,
  buildJudgmentSchedule,
  loadAndVerifyInstantiatedJudgmentSchedule,
  loadAndVerifyPrepacketSchedule,
  persistInstantiatedJudgmentSchedule,
  persistPrepacketSchedule,
  validateGenerationSchedule,
  validateJudgmentSchedule
} from "./lib/schedule.mjs";
import { buildGenerationPlan, validateAdmittedPlan } from "./lib/admission.mjs";
import { canonicalExecutorDigest } from "./lib/providers.mjs";
import { runGenerations } from "./lib/generate.mjs";
import { runIsolatedJudge, runJudgments } from "./run-judges.mjs";
import { packetSha256 } from "./validate-judges.mjs";
import { appendEvent } from "./lib/ledger.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const protocol = JSON.parse(readFileSync(join(root, "evals/v2/protocol.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(root, "evals/v2/scenario-registry.json"), "utf8"));
const d = (value) => sha256(value);
const executor = (family, identity) => ({
  call_class: "judge", provider: family === "family-a" ? "provider-a" : "provider-b",
  foundation_lineage: family === "family-a" ? "lineage-a" : "lineage-b",
  model_version: `${family}-model`, runtime_version: "runtime-1", adapter_sha256: d(`${family}|adapter`),
  system_prompt_sha256: d(`${family}|prompt`), rubric_sha256: d(`${family}|rubric`),
  settings_sha256: d(`${family}|settings`), tool_policy_sha256: d(`${family}|tools`),
  time_budget_seconds: 600, family, identity,
  zero_cost_proof: { kind: "flat-rate", incremental_spend_usd: 0 }
});
const judgeSelections = manifest.evaluator_families.flatMap((family) => family.identities.map((identity) => ({
  executor: executor(family.family_id, identity),
  executor_digest: d(`${family.family_id}|${identity}|executor`),
  resolver_attestation_sha256: d(`${family.family_id}|${identity}|attestation`)
})));
const generationExecutor = {
  call_class: "generation", provider: "generator-provider", foundation_lineage: "generator-lineage",
  model_version: "generator-model", runtime_version: "runtime-1", adapter_sha256: d("generator-adapter"),
  system_prompt_sha256: d("generator-prompt"), rubric_sha256: null,
  settings_sha256: d("generator-settings"), tool_policy_sha256: d("generator-tools"),
  time_budget_seconds: 900, family: "generator-family", identity: "generator-identity",
  zero_cost_proof: { kind: "flat-rate", incremental_spend_usd: 0 }
};
const generatorBinding = { executor: generationExecutor, executor_digest: canonicalExecutorDigest(generationExecutor), resolver_attestation_sha256: d("generator-attestation") };
const selection = { execution_manifest_sha256: d("execution-manifest"), generator: generatorBinding, judges: judgeSelections };

const generation = buildGenerationSchedule({ protocol, registry });
assert.equal(generation.length, 48);
assert.deepEqual(generation.map((entry) => entry.ordinal), Array.from({ length: 48 }, (_, i) => i + 1));
assert.deepEqual(generation.slice(0, 4).map(({ scenario_id, generation_seed, arm }) => [scenario_id, generation_seed, arm]), [
  ["accessibility-checkout-form", 101, "baseline"], ["accessibility-checkout-form", 101, "candidate"],
  ["accessibility-checkout-form", 202, "baseline"], ["accessibility-checkout-form", 202, "candidate"]
]);
assert.doesNotThrow(() => validateGenerationSchedule(generation, { protocol, registry }));
assert.throws(() => validateGenerationSchedule(generation.slice().reverse(), { protocol, registry }), /order|canonical/i);
assert.throws(() => validateGenerationSchedule(generation.slice(1), { protocol, registry }), /48|missing/i);
assert.throws(() => validateGenerationSchedule([...generation.slice(0, -1), generation[0]], { protocol, registry }), /duplicate|exact|order/i);

const packetIds = Array.from({ length: 24 }, (_, i) => d(`packet|${String(23 - i).padStart(2, "0")}`));
const anchorIds = Array.from({ length: 4 }, (_, i) => d(`anchor|${String(3 - i).padStart(2, "0")}`));
const packetFor = (packet_id) => {
  const brief = "Opaque test brief";
  const arms = [0, 1].map((opaque_slot) => {
    const artifact_bytes = `<main>opaque-${packet_id.slice(0, 8)}-${opaque_slot}</main>`;
    const artifact_sha256 = d(artifact_bytes);
    return {
      opaque_slot, artifact_id: d(`${packet_id}|artifact|${opaque_slot}`),
      label_id: d(`${packet_id}|label|${opaque_slot}`), artifact_bytes, artifact_sha256, brief,
      render_evidence: ["mobile", "desktop"].map((viewport_id) => ({
        viewport_id, viewport_id_token: d(`${packet_id}|viewport|${viewport_id}`),
        evidence_id: d(`${packet_id}|evidence|${opaque_slot}|${viewport_id}`), artifact_sha256,
        screenshot_sha256: d(`${packet_id}|screenshot|${opaque_slot}|${viewport_id}`),
        dom_sha256: d(`${packet_id}|dom|${opaque_slot}|${viewport_id}`),
        style_sha256: d(`${packet_id}|style|${opaque_slot}|${viewport_id}`)
      }))
    };
  });
  return {
    packet_id, unit_id: d(`${packet_id}|unit`), scenario_id_token: d(`${packet_id}|scenario`),
    arms, brief, rubric: "Score both opaque treatments.", viewport_ids: ["mobile", "desktop"]
  };
};
const packets = packetIds.map(packetFor);
const anchorPackets = anchorIds.map(packetFor);
const scheduleInput = { packets, anchorPackets, selection, runId: d("run") };
const judgments = buildJudgmentSchedule(scheduleInput);
assert.equal(judgments.length, 112);
assert.deepEqual(judgments.map((entry) => entry.ordinal), Array.from({ length: 112 }, (_, i) => i + 49));
assert.equal(judgments.filter(({ call_class }) => call_class === "production_judge").length, 96);
assert.equal(judgments.filter(({ call_class }) => call_class === "anchor_judge").length, 16);
assert.deepEqual(judgments.slice(0, 4).map(({ family, identity }) => [family, identity]), [
  ["family-a", "family-a-judge-1"], ["family-a", "family-a-judge-2"],
  ["family-b", "family-b-judge-1"], ["family-b", "family-b-judge-2"]
]);
assert.equal(new Set(judgments.map(({ invocation_id }) => invocation_id)).size, 112);
assert.equal(new Set(judgments.map(({ context_id }) => context_id)).size, 112);
assert.doesNotThrow(() => validateJudgmentSchedule(judgments, scheduleInput));
assert.throws(() => validateJudgmentSchedule(judgments.slice().reverse(), scheduleInput), /order|canonical/i);

const dir = mkdtempSync(join(tmpdir(), "effectiveness-v2-schedule-"));
try {
  const prepacketPath = join(dir, "prepacket-schedule.json");
  const judgmentPath = join(dir, "judgment-schedule.json");
  const protocolSha256 = d("protocol");
  const scenarioRegistrySha256 = d("registry");
  const generationPlan = buildGenerationPlan({ protocol, registry, protocol_sha256: protocolSha256, generatorBinding });
  const trustedPlan = { protocol, registry, protocol_sha256: protocolSha256, generatorBinding };
  assert.doesNotThrow(() => validateAdmittedPlan(generationPlan, trustedPlan));
  for (const mutate of [
    (plan) => ({ ...plan, jobs: plan.jobs.map((job, index) => index === 0 ? { ...job, revision: protocol.candidate_revision } : job) }),
    (plan) => ({ ...plan, jobs: plan.jobs.map((job, index) => index === 0 ? { ...job, scenario: { ...job.scenario, sha256: d("forged-brief") } } : job) }),
    (plan) => ({ ...plan, jobs: plan.jobs.map((job, index) => index === 0 ? { ...job, time_budget_seconds: 999999 } : job) }),
    (plan) => ({ ...plan, jobs: plan.jobs.map((job, index) => index === 0 ? { ...job, tool_policy_sha256: d("unrestricted-tools") } : job) }),
    (plan) => ({ ...plan, jobs: plan.jobs.map((job, index) => index === 0 ? { ...job, settings_sha256: d("forged-settings") } : job) }),
    (plan) => ({ ...plan, jobs: plan.jobs.slice().reverse() }),
    (plan) => ({ ...plan, jobs: plan.jobs.slice(1) }),
    (plan) => ({ ...plan, jobs: [...plan.jobs, plan.jobs[0]] }),
    (plan) => ({ ...plan, jobs: [...plan.jobs.slice(0, -1), plan.jobs[0]] })
  ]) assert.throws(() => validateAdmittedPlan(mutate(generationPlan), trustedPlan), /canonical|exact|mismatch/i);

  const prepacket = persistPrepacketSchedule({ path: prepacketPath, generationSchedule: generation, generationPlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256, runId: d("run") });
  assert.match(prepacket.schedule_sha256, /^[0-9a-f]{64}$/);
  assert.doesNotThrow(() => loadAndVerifyPrepacketSchedule({ path: prepacketPath, generationPlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256, runId: d("run") }));
  for (const overrides of [
    { runId: d("other-run") }, { protocolSha256: d("other-protocol") },
    { scenarioRegistrySha256: d("other-registry") },
    { selection: { ...selection, generator: { ...generatorBinding, executor_digest: d("other-executor") } } }
  ]) assert.throws(() => loadAndVerifyPrepacketSchedule({ path: prepacketPath, generationPlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256, runId: d("run"), ...overrides }), /mismatch|binding|digest|canonical/i);
  assert.throws(() => persistPrepacketSchedule({ path: prepacketPath, generationSchedule: generation, generationPlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256, runId: d("run") }), /exists|exclusive/i);
  const withAdmission = (state) => {
    let previous = appendEvent(state.ledger_path, null, {
      type: "run_initialized", run_id: state.run_id, protocol_sha256: state.protocol_sha256,
      source_sha256: state.source_sha256, execution_manifest_sha256: state.execution_manifest_sha256,
      scenario_registry_sha256: state.scenario_registry_sha256,
      randomization_commitment_sha256: state.randomization_commitment_sha256, exclusions: []
    });
    previous = appendEvent(state.ledger_path, previous, {
      type: "production_admitted", run_id: state.run_id, protocol_sha256: state.protocol_sha256,
      source_sha256: state.source_sha256, execution_manifest_sha256: state.execution_manifest_sha256,
      scenario_registry_sha256: state.scenario_registry_sha256,
      randomization_commitment_sha256: state.randomization_commitment_sha256,
      selection_sha256: state.selection_sha256, prepacket_schedule_sha256: state.prepacket_schedule_sha256,
      exclusions: [], max_external_calls: 160, incremental_spend_cap_usd: 0, retry_policy: "none"
    });
    for (let ordinal = 1; ordinal <= state.admitted; ordinal += 1) {
      previous = appendEvent(state.ledger_path, previous, { type: "ordinal_reserved", ordinal, call_class: "generation" });
    }
    return state;
  };
  const judgmentState = { admitted: 48, run_status: "running", run_id: d("run"), protocol_sha256: protocolSha256, scenario_registry_sha256: scenarioRegistrySha256, execution_manifest_sha256: selection.execution_manifest_sha256, frozen_execution_selection: selection };
  const instantiated = persistInstantiatedJudgmentSchedule({ path: judgmentPath, judgmentSchedule: judgments, state: judgmentState, prepacketScheduleSha256: prepacket.schedule_sha256 });
  assert.match(instantiated.judgment_tuple_sha256, /^[0-9a-f]{64}$/);
  assert.equal(instantiated.artifact_path, judgmentPath);
  assert.doesNotThrow(() => loadAndVerifyInstantiatedJudgmentSchedule({ path: judgmentPath, judgmentSchedule: judgments, state: judgmentState, prepacketScheduleSha256: prepacket.schedule_sha256 }));
  assert.throws(() => persistInstantiatedJudgmentSchedule({ path: join(dir, "early.json"), judgmentSchedule: judgments, state: { ...judgmentState, admitted: 47 }, prepacketScheduleSha256: prepacket.schedule_sha256 }), /ordinal 49|48 generation/i);

  const generationSuccess = { exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1, artifacts: [{ artifact_sha256: d("artifact") }] };
  const makeGenerationState = (suffix) => withAdmission({ admitted: 0, spend_usd: 0, run_status: "running", ledger_path: join(dir, `generation-${suffix}.jsonl`), max_external_calls: 160, protocol_sha256: protocolSha256, source_sha256: d("source"), execution_manifest_sha256: selection.execution_manifest_sha256, scenario_registry_sha256: scenarioRegistrySha256, run_id: d("run"), prepacket_schedule_sha256: prepacket.schedule_sha256, randomization_commitment_sha256: d("commitment"), selection_sha256: d("selection"), frozen_execution_selection: selection });
  const generatorRequest = { call_class: "generation", executor: generationExecutor, executor_digest: generatorBinding.executor_digest, resolver_attestation_sha256: generatorBinding.resolver_attestation_sha256, cost: { kind: "flat-rate", usd: 0 }, protocol_sha256: protocolSha256, source_sha256: d("source"), execution_manifest_sha256: selection.execution_manifest_sha256 };
  const wrongJudge = judgeSelections[0];
  for (const [label, badRequest] of [
    ["judge-class", { ...generatorRequest, call_class: "production_judge", executor: wrongJudge.executor, executor_digest: wrongJudge.executor_digest, resolver_attestation_sha256: wrongJudge.resolver_attestation_sha256 }],
    ["digest", { ...generatorRequest, executor_digest: d("wrong-generator") }],
    ["attestation", { ...generatorRequest, resolver_attestation_sha256: d("wrong-attestation") }]
  ]) {
    const rejectedState = makeGenerationState(`rejected-${label}`); let invoked = false;
    assert.throws(() => runGenerations({ plan: generationPlan, protocol, registry, prepacketSchedulePath: prepacketPath, state: rejectedState, requestFor: () => badRequest, route: () => { throw new Error("must not route"); }, invoke: () => { invoked = true; } }), /generation request|frozen generator|attestation|digest/i);
    assert.equal(rejectedState.admitted, 0); assert.equal(invoked, false);
  }
  const generationState = makeGenerationState("valid");
  const gen = runGenerations({ plan: generationPlan, protocol, registry, prepacketSchedulePath: prepacketPath, state: generationState, requestFor: () => generatorRequest, route: ({ request }) => ({ executor: request.executor, executor_digest: request.executor_digest, resolver_attestation_sha256: request.resolver_attestation_sha256 }), invoke: () => generationSuccess });
  assert.equal(gen.receipts.length, 48);
  for (const [index, receipt] of gen.receipts.entries()) {
    const entry = generation[index]; assert.equal(receipt.ordinal, entry.ordinal); assert.equal(receipt.scenario_id, entry.scenario_id);
    assert.equal(receipt.generation_seed, entry.generation_seed); assert.equal(receipt.arm, entry.arm); assert.equal(receipt.revision, entry.revision);
    assert.equal(receipt.scenario_registry_sha256, scenarioRegistrySha256); assert.equal(receipt.run_id, d("run")); assert.deepEqual(receipt.artifacts, generationSuccess.artifacts);
    assert.equal(receipt.executor_digest, generatorBinding.executor_digest); assert.equal(receipt.resolver_attestation_sha256, generatorBinding.resolver_attestation_sha256);
  }

  const packetRoot = join(dir, "packets"); mkdirSync(packetRoot);
  const paths = new Map();
  for (const entry of judgments) {
    if (paths.has(entry.packet_id)) continue;
    const packet = [...packets, ...anchorPackets].find(({ packet_id }) => packet_id === entry.packet_id);
    const path = join(packetRoot, `${entry.packet_id}.json`); const bytes = JSON.stringify(packet);
    writeFileSync(path, bytes); paths.set(entry.packet_id, { path, digest: d(bytes), packet });
  }
  const frozenByDigest = Object.fromEntries(judgeSelections.map((item) => [item.executor_digest, item]));
  const runState = withAdmission({ ...judgmentState, spend_usd: 0, ledger_path: join(dir, "ledger.jsonl"), max_external_calls: 160, source_sha256: d("source"), prepacket_schedule_sha256: prepacket.schedule_sha256, randomization_commitment_sha256: d("commitment"), selection_sha256: d("selection"), instantiated_judgment_tuple_sha256: instantiated.judgment_tuple_sha256, instantiated_judgment_schedule_sha256: instantiated.artifact_sha256, instantiated_judgment_schedule_path: judgmentPath });
  const requestFor = (entry) => ({ call_class: entry.call_class, executor: frozenByDigest[entry.executor_digest].executor, executor_digest: entry.executor_digest, resolver_attestation_sha256: entry.resolver_attestation_sha256, cost: { kind: "flat-rate", usd: 0 }, protocol_sha256: protocolSha256, source_sha256: d("source"), execution_manifest_sha256: selection.execution_manifest_sha256 });
  const validResult = (entry) => {
    const packet = paths.get(entry.packet_id).packet;
    const arm = packet.arms[0];
    const codepoints = Array.from(arm.artifact_bytes);
    const end = Math.min(12, codepoints.length);
    const dimensions = { direction: 4, structure: 4, accessibility: 4, verbal: 4, integration: 4 };
    return {
      schema_version: 2, kind: "effectiveness-v2-judge-result", packet_id: entry.packet_id,
      family_id: entry.family, identity_id: entry.identity, invocation_id: entry.invocation_id,
      context_id: entry.context_id, packet_sha256: packetSha256(packet), preference: "tie",
      arm_scores: [{ opaque_slot: 0, dimensions }, { opaque_slot: 1, dimensions }],
      hard_regressions: [], evidence_citations: [{
        artifact_id: arm.artifact_id, opaque_slot: 0, viewport_id: "mobile",
        artifact_sha256: arm.artifact_sha256, start_codepoint: 0, end_codepoint: end,
        exact_span: codepoints.slice(0, end).join("")
      }]
    };
  };
  const artifactFailure = (state, path) => assert.throws(() => runJudgments({ schedule: judgments, scheduleInput, state, instantiatedJudgmentSchedulePath: path, packetPathFor: () => { throw new Error("must not read packet"); }, packetFileSha256For: () => { throw new Error("must not read packet digest"); }, requestFor: () => { throw new Error("must not request"); }, route: () => { throw new Error("must not route"); }, invoke: () => { throw new Error("must not invoke"); } }), /instantiated|artifact|schedule|path|read|binding/i);
  const deletedPath = join(dir, "deleted-judgments.json"); const deletedState = { ...judgmentState };
  persistInstantiatedJudgmentSchedule({ path: deletedPath, judgmentSchedule: judgments, state: deletedState, prepacketScheduleSha256: prepacket.schedule_sha256 }); unlinkSync(deletedPath); artifactFailure(deletedState, deletedPath); assert.equal(deletedState.admitted, 48);
  const tamperedPath = join(dir, "tampered-judgments.json"); const tamperedState = { ...judgmentState };
  persistInstantiatedJudgmentSchedule({ path: tamperedPath, judgmentSchedule: judgments, state: tamperedState, prepacketScheduleSha256: prepacket.schedule_sha256 }); writeFileSync(tamperedPath, "{}\n"); artifactFailure(tamperedState, tamperedPath); assert.equal(tamperedState.admitted, 48);
  const copiedPath = join(dir, "copied-judgments.json"); copyFileSync(judgmentPath, copiedPath); artifactFailure(runState, copiedPath); assert.equal(runState.admitted, 48);

  const outcome = runJudgments({ schedule: judgments, scheduleInput, state: runState, instantiatedJudgmentSchedulePath: judgmentPath, packetPathFor: (entry) => paths.get(entry.packet_id).path, packetFileSha256For: (entry) => paths.get(entry.packet_id).digest, requestFor, route: ({ request }) => ({ executor: request.executor, executor_digest: request.executor_digest, resolver_attestation_sha256: request.resolver_attestation_sha256 }), invoke: (entry) => ({ exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1, artifacts: [JSON.stringify(validResult(entry))] }) });
  assert.equal(outcome.receipts.length, 112); assert.equal(runState.admitted, 160); assert.equal(outcome.results.length, 112);
  const first = judgments[0];
  const badRouteState = withAdmission({ ...runState, admitted: 48, run_status: "running", ledger_path: join(dir, "bad-ledger.jsonl") });
  assert.throws(() => runIsolatedJudge({ entry: first, state: badRouteState, packetPath: paths.get(first.packet_id).path, packetFileSha256: paths.get(first.packet_id).digest, request: requestFor(first), route: ({ request }) => ({ executor: request.executor, executor_digest: request.executor_digest, resolver_attestation_sha256: d("forged") }), invoke: () => { throw new Error("must not invoke"); } }), /routing|attestation/i);
  const invalidState = withAdmission({ ...runState, admitted: 48, run_status: "running", ledger_path: join(dir, "invalid-ledger.jsonl") });
  const invalid = runIsolatedJudge({ entry: first, state: invalidState, packetPath: paths.get(first.packet_id).path, packetFileSha256: paths.get(first.packet_id).digest, request: requestFor(first), route: ({ request }) => ({ executor: request.executor, executor_digest: request.executor_digest, resolver_attestation_sha256: request.resolver_attestation_sha256 }), invoke: () => ({ exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1, artifacts: ["```json\n{}\n```"] }) });
  assert.equal(invalid.run_status, "production_incomplete"); assert.equal(invalid.receipt.ordinal, 49); assert.equal(invalid.receipt.status, "invalid_artifact");
  assert.throws(() => runIsolatedJudge({ entry: first, state: invalidState, packetPath: paths.get(first.packet_id).path, packetFileSha256: paths.get(first.packet_id).digest, request: requestFor(first), route: () => null, invoke: () => null }), /terminal|ordinal/i);
  const link = join(packetRoot, "linked.json"); symlinkSync(paths.get(first.packet_id).path, link);
  assert.throws(() => runIsolatedJudge({ entry: first, state: { ...runState, admitted: 48, run_status: "running", ledger_path: join(dir, "link-ledger.jsonl") }, packetPath: link, packetFileSha256: paths.get(first.packet_id).digest, request: requestFor(first), route: () => { throw new Error("must not route"); }, invoke: () => { throw new Error("must not invoke"); } }), /non-symlink/i);
  const tampered = join(packetRoot, "tampered.json"); writeFileSync(tampered, "{}");
  assert.throws(() => runIsolatedJudge({ entry: first, state: { ...runState, admitted: 48, run_status: "running", ledger_path: join(dir, "packet-ledger.jsonl") }, packetPath: tampered, packetFileSha256: paths.get(first.packet_id).digest, request: requestFor(first), route: () => { throw new Error("must not route"); }, invoke: () => { throw new Error("must not invoke"); } }), /packet.*digest|digest.*packet/i);
} finally { rmSync(dir, { recursive: true, force: true }); }

console.log("effectiveness-v2 Task 7B schedule and binding tests passed; fake calls 160; real calls 0");
