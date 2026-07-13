import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addLateExclusion, admitCall, buildArmJob, buildGenerationPlan, classifyCost,
  classifyExecution, executeAttempt, validateAdmittedPlan
} from "./lib/admission.mjs";
import { runGenerations } from "./lib/generate.mjs";
import { canonicalExecutorDigest } from "./lib/providers.mjs";
import { sha256 } from "./lib/canonical-json.mjs";
import { buildGenerationSchedule, persistPrepacketSchedule } from "./lib/schedule.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const protocol = JSON.parse(readFileSync(join(root, "evals/v2/protocol.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(root, "evals/v2/scenario-registry.json"), "utf8"));
const success = JSON.parse(readFileSync(join(root, "evals/v2/fixtures/generator-success.json"), "utf8"));
const falseSuccess = JSON.parse(readFileSync(join(root, "evals/v2/fixtures/generator-false-success.json"), "utf8"));
const d = (value) => sha256(value);
const frozen = {
  call_class: "generation", provider: "provider-generator", foundation_lineage: "generator-lineage",
  model_version: "generator-model-2026-07-01", runtime_version: "dispatch-3.2.1",
  adapter_sha256: d("adapter"), system_prompt_sha256: d("prompt"), rubric_sha256: null,
  settings_sha256: d("settings"), tool_policy_sha256: d("tools"), time_budget_seconds: 900,
  family: "generator-family", identity: "generator-primary",
  zero_cost_proof: { kind: "flat-rate", incremental_spend_usd: 0 }
};
const generatorBinding = { executor: frozen, executor_digest: canonicalExecutorDigest(frozen), resolver_attestation_sha256: d("attestation") };
const request = { call_class: "generation", executor: frozen, cost: { kind: "flat-rate", usd: 0 }, protocol_sha256: "a", source_sha256: "b", execution_manifest_sha256: "c" };
const state = (path) => ({ admitted: 0, spend_usd: 0, run_status: "running", ledger_path: path, max_external_calls: 160, protocol_sha256: "a", source_sha256: "b", execution_manifest_sha256: "c", frozen_executors: { generation: frozen, production_judge: frozen, anchor_judge: frozen } });

assert.equal(classifyExecution(falseSuccess), "false_success");
assert.equal(classifyExecution({ ...success, exit_code: 1 }), "transport_failed");
assert.equal(classifyExecution(success), "completed");
for (const invalid of [
  { ...success, tokens_in: -1 }, { ...success, tokens_out: 0.5 }, { ...success, turns: 1.5 },
  { ...success, artifacts: [""] }, { ...success, artifacts: [{}] }, { ...success, artifacts: [null] }
]) assert.equal(classifyExecution(invalid), "false_success");
assert.equal(classifyExecution({ ...success, artifacts: ["artifact-receipt"] }), "completed");
assert.throws(() => classifyCost({ kind: "incremental", usd: 0.01 }), /incremental spend/);
assert.throws(() => admitCall(state(), { ...request, cost: { kind: "incremental", usd: 0.01 } }), /incremental spend/);
assert.throws(() => admitCall({ ...state(), admitted: 160 }, request), /160/);
assert.throws(() => admitCall({ ...state(), admitted: 160, max_external_calls: 999 }, request), /160/);

for (const call_class of ["generation", "production_judge", "anchor_judge"]) {
  const dir = mkdtempSync(join(tmpdir(), "effectiveness-v2-attempt-"));
  try {
    const path = join(dir, "ledger.jsonl");
    const s = state(path); const order = [];
    const result = executeAttempt({ state: s, request: { ...request, call_class }, route: () => { order.push("route"); return frozen; }, invoke: () => { order.push("invoke"); return falseSuccess; } });
    assert.equal(result.run_status, "production_incomplete");
    assert.equal(result.receipt.ordinal, 1);
    assert.equal(result.receipt.status, "false_success");
    assert.deepEqual(order, ["route", "invoke"]);
    const events = readFileSync(path, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(events.map((event) => event.type), ["ordinal_reserved", "routing_attested", "attempt_closed"]);
    assert.throws(() => admitCall(s, { ...request, call_class }), /terminal|retry/);

    const missing = state(join(dir, "missing.jsonl"));
    assert.throws(() => executeAttempt({ state: missing, request: { ...request, call_class }, route: () => null, invoke: () => success }), /routing/);
    assert.equal(missing.admitted, 1); assert.equal(missing.run_status, "production_incomplete");
    assert.deepEqual(missing.current_receipt, { ordinal: 1, call_class, cost_classification: "flat-rate", incremental_spend_usd: 0, executor: frozen, status: "routing_failed" });
    const missingClose = JSON.parse(readFileSync(missing.ledger_path, "utf8").trim().split("\n").at(-1));
    assert.equal(missingClose.ordinal, 1); assert.equal(missingClose.cost_classification, "flat-rate"); assert.deepEqual(missingClose.executor, frozen); assert.equal(missingClose.status, "routing_failed"); assert.equal(missingClose.run_status, "production_incomplete");
    const mismatch = state(join(dir, "mismatch.jsonl"));
    assert.throws(() => executeAttempt({ state: mismatch, request: { ...request, call_class }, route: () => ({ ...frozen, model_version: "other" }), invoke: () => success }), /routing|frozen executor/);
    assert.equal(mismatch.admitted, 1); assert.equal(mismatch.run_status, "production_incomplete");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const phase of ["reserve", "route", "close"]) {
  const dir = mkdtempSync(join(tmpdir(), `effectiveness-v2-persist-${phase}-`));
  try {
    const s = state(join(dir, "ledger.jsonl"));
    if (phase === "reserve") writeFileSync(`${s.ledger_path}.lock`, "held");
    assert.throws(() => executeAttempt({
      state: s, request,
      route: () => { if (phase === "route") writeFileSync(`${s.ledger_path}.lock`, "held"); return frozen; },
      invoke: () => { if (phase === "close") writeFileSync(`${s.ledger_path}.lock`, "held"); return success; }
    }), /persist|ledger|lock/);
    assert.equal(s.admitted, 1);
    assert.equal(s.run_status, "production_incomplete");
    assert.equal(s.current_receipt.ordinal, 1);
    assert.match(s.current_receipt.status, /persist_uncertain/);
    rmSync(`${s.ledger_path}.lock`, { force: true });
    assert.throws(() => admitCall(s, request), /terminal|retry/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const current = buildArmJob({ scenario: registry.scenarios[0], seed: 101, arm: "candidate", revision: protocol.candidate_revision, protocol_sha256: "a", skill_pack_content: "candidate-pack", generatorBinding });
const baseline = buildArmJob({ scenario: registry.scenarios[0], seed: 101, arm: "baseline", revision: protocol.baseline_revision, protocol_sha256: "a", skill_pack_content: "baseline-pack", generatorBinding });
const stripIdentity = ({ arm, revision, skill_pack_content, ...value }) => value;
assert.deepEqual(stripIdentity(current), stripIdentity(baseline));
const planInput = { protocol, registry, protocol_sha256: "a", generatorBinding };
const plan = buildGenerationPlan(planInput);
assert.equal(plan.jobs.length, 48);
assert.equal(new Set(plan.jobs.map((job) => `${job.scenario.scenario_id}:${job.seed}`)).size, 24);
assert.doesNotThrow(() => validateAdmittedPlan(plan, planInput));
assert.throws(() => validateAdmittedPlan({ ...plan, jobs: plan.jobs.slice(1) }, planInput), /canonical|exact|mismatch/);
assert.throws(() => validateAdmittedPlan({ ...plan, jobs: plan.jobs.map((job, index) => index < 4 ? { ...job, scenario: { ...job.scenario, scenario_id: "invented-scenario" } } : job) }, planInput), /canonical|exact|mismatch/);
assert.throws(() => validateAdmittedPlan({ ...plan, required_viewports: [{ viewport_id: "mobile", width: 390, height: 844 }] }, planInput), /canonical|exact|mismatch/);
assert.throws(() => validateAdmittedPlan({ ...plan, required_viewports: [{ viewport_id: "mobile", width: 390, height: 844 }, { viewport_id: "desktop", width: 1280, height: 720 }] }, planInput), /canonical|exact|mismatch/);
for (const scope of ["scenario", "unit", "arm", "viewport"]) assert.throws(() => addLateExclusion(plan, scope), /exclusion/);

const e2eDir = mkdtempSync(join(tmpdir(), "effectiveness-v2-generation-e2e-"));
try {
  const protocolSha256 = d("protocol"); const registrySha256 = d("registry"); const runId = d("run");
  const e2ePlan = buildGenerationPlan({ protocol, registry, protocol_sha256: protocolSha256, generatorBinding });
  const judge = (family, identity) => ({ executor: { family, identity }, executor_digest: d(`${family}|${identity}|executor`), resolver_attestation_sha256: d(`${family}|${identity}|attestation`) });
  const selection = { execution_manifest_sha256: d("manifest"), generator: generatorBinding, judges: [judge("family-a", "judge-1"), judge("family-a", "judge-2"), judge("family-b", "judge-1"), judge("family-b", "judge-2")] };
  const prepacketPath = join(e2eDir, "prepacket.json");
  const prepacket = persistPrepacketSchedule({ path: prepacketPath, generationSchedule: buildGenerationSchedule({ protocol, registry }), generationPlan: e2ePlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256: registrySha256, runId });
  const e2eState = { admitted: 0, spend_usd: 0, run_status: "running", ledger_path: join(e2eDir, "ledger.jsonl"), max_external_calls: 160, protocol_sha256: protocolSha256, source_sha256: "b", execution_manifest_sha256: selection.execution_manifest_sha256, scenario_registry_sha256: registrySha256, run_id: runId, prepacket_schedule_sha256: prepacket.schedule_sha256, frozen_execution_selection: selection };
  const e2eRequest = { call_class: "generation", executor: frozen, executor_digest: generatorBinding.executor_digest, resolver_attestation_sha256: generatorBinding.resolver_attestation_sha256, cost: { kind: "flat-rate", usd: 0 }, protocol_sha256: protocolSha256, source_sha256: "b", execution_manifest_sha256: selection.execution_manifest_sha256 };
  const result = runGenerations({
    plan: e2ePlan, protocol, registry, prepacketSchedulePath: prepacketPath,
    state: e2eState,
    requestFor: () => e2eRequest,
    route: ({ request }) => ({ executor: request.executor, executor_digest: request.executor_digest, resolver_attestation_sha256: request.resolver_attestation_sha256 }),
    invoke: () => success
  });
  assert.equal(result.run_status, "running");
  assert.equal(result.receipts.length, 48);
  assert.deepEqual(result.receipts.map(({ ordinal }) => ordinal), Array.from({ length: 48 }, (_, index) => index + 1));
  assert.equal(readFileSync(e2eState.ledger_path, "utf8").trim().split("\n").length, 144);
} finally { rmSync(e2eDir, { recursive: true, force: true }); }

console.log("effectiveness-v2 generation tests passed; 48 arm jobs; budget fail-closed");
