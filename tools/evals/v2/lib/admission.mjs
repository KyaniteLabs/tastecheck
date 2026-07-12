import { readFileSync } from "node:fs";
import { appendEvent } from "./ledger.mjs";

const EXECUTOR_KEYS = ["provider", "model_version", "runtime_version"];
const MAX_EXTERNAL_CALLS = 160;
const REQUIRED_SCENARIOS = new Set([
  "accessibility-checkout-form", "accessibility-data-table", "brownfield-dense-operations", "brownfield-generic-saas",
  "greenfield-data-product", "greenfield-editorial-commerce", "orchestration-audit-handoff", "orchestration-design-system",
  "render-dashboard", "render-marketing-page", "verbal-error-recovery", "verbal-pricing-page"
]);
const REQUIRED_VIEWPORTS = [
  { viewport_id: "mobile", width: 390, height: 844 },
  { viewport_id: "desktop", width: 1440, height: 1000 }
];
const sameExecutor = (left, right) => left && right && EXECUTOR_KEYS.every((key) => left[key] === right[key]);
const lastEvent = (path) => {
  if (!path) return null;
  try { return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse).at(-1) ?? null; } catch { return null; }
};
const persist = (state, event) => appendEvent(state.ledger_path, lastEvent(state.ledger_path), event);

export function classifyCost(cost) {
  if (!cost || !["flat-rate", "already-provisioned", "incremental"].includes(cost.kind)) throw new Error("invalid cost classification");
  if (cost.kind === "incremental" || Number(cost.usd ?? 0) !== 0) throw new Error("incremental spend must remain zero");
  return cost.kind;
}

export function classifyExecution(result) {
  if (!result || result.exit_code !== 0) return "transport_failed";
  const validCount = (value) => Number.isInteger(value) && value >= 0;
  const validArtifact = (value) => typeof value === "string" ? value.trim().length > 0 : value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  if (!Number.isInteger(result.turns) || result.turns <= 0 || !validCount(result.tokens_in) || !validCount(result.tokens_out) || result.tokens_in + result.tokens_out <= 0 || !Array.isArray(result.artifacts) || result.artifacts.length === 0 || !result.artifacts.every(validArtifact)) return "false_success";
  return "completed";
}

export function admitCall(state, request) {
  if (state.run_status && state.run_status !== "running") throw new Error("terminal run prohibits retry");
  if ((state.admitted ?? 0) >= MAX_EXTERNAL_CALLS) throw new Error(`160 external-call cap reached`);
  if (Number(state.spend_usd ?? 0) !== 0) throw new Error("incremental spend must remain zero");
  const cost_classification = classifyCost(request.cost);
  for (const key of ["protocol_sha256", "source_sha256", "execution_manifest_sha256"]) if (state[key] !== request[key]) throw new Error(`${key} mismatch`);
  const frozen = state.frozen_executors?.[request.call_class];
  if (!sameExecutor(frozen, request.executor)) throw new Error("request does not match frozen executor");
  const ordinal = (state.admitted ?? 0) + 1;
  const receipt = { ordinal, call_class: request.call_class, cost_classification, incremental_spend_usd: 0, executor: frozen, status: "reserved" };
  state.admitted = ordinal;
  state.current_receipt = receipt;
  try { persist(state, { type: "ordinal_reserved", ...receipt }); }
  catch (error) {
    receipt.status = "reservation_persist_uncertain";
    state.run_status = "production_incomplete";
    throw new Error(`ordinal reservation persist uncertainty: ${error.message}`);
  }
  return receipt;
}

const failRouting = (state, receipt, message) => {
  receipt.status = "routing_failed";
  state.run_status = "production_incomplete";
  try { persist(state, { type: "attempt_closed", ...receipt, run_status: state.run_status }); }
  catch (error) { receipt.status = "routing_close_persist_uncertain"; throw new Error(`${message}; receipt persist uncertainty: ${error.message}`); }
  throw new Error(message);
};

export function executeAttempt({ state, request, invoke, route }) {
  const receipt = admitCall(state, request);
  let routed;
  try { routed = route({ request, ordinal: receipt.ordinal, frozen_executor: receipt.executor }); }
  catch { return failRouting(state, receipt, "routing attestation failed"); }
  if (!routed) return failRouting(state, receipt, "routing attestation missing");
  if (!sameExecutor(routed, receipt.executor)) return failRouting(state, receipt, "routing attestation does not match frozen executor");
  try { persist(state, { type: "routing_attested", ordinal: receipt.ordinal, call_class: receipt.call_class, executor: receipt.executor }); }
  catch (error) {
    receipt.status = "routing_persist_uncertain";
    state.run_status = "production_incomplete";
    throw new Error(`routing attestation persist uncertainty: ${error.message}`);
  }
  let result;
  try { result = invoke({ request, ordinal: receipt.ordinal, executor: receipt.executor }); }
  catch (error) { result = { exit_code: null, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [], transport_error: error?.message ?? "executor failure" }; }
  const status = classifyExecution(result);
  receipt.status = status;
  try { persist(state, { type: "attempt_closed", ...receipt, run_status: status === "completed" ? state.run_status : "production_incomplete" }); }
  catch (error) {
    receipt.status = "close_persist_uncertain";
    state.run_status = "production_incomplete";
    throw new Error(`attempt close persist uncertainty: ${error.message}`);
  }
  if (status !== "completed") state.run_status = "production_incomplete";
  return { run_status: state.run_status, receipt, result };
}

export function buildArmJob({ scenario, seed, arm, revision, protocol_sha256, skill_pack_content }) {
  if (!["baseline", "candidate"].includes(arm)) throw new Error("invalid arm");
  return { scenario, seed, arm, revision, protocol_sha256, skill_pack_content, time_budget_seconds: 900, tool_policy: "local-frontend-only", retry_policy: "none" };
}

export function buildGenerationPlan({ protocol, registry, protocol_sha256 }) {
  if (protocol.exclusions?.length) throw new Error("admitted protocol exclusions must be empty");
  const jobs = [];
  for (const scenario of registry.scenarios) for (const seed of protocol.seeds) for (const arm of ["baseline", "candidate"]) jobs.push(buildArmJob({ scenario, seed, arm, revision: arm === "baseline" ? protocol.baseline_revision : protocol.candidate_revision, protocol_sha256, skill_pack_content: `${arm}-skill-pack` }));
  return { comparison_units: protocol.comparison_units, required_viewports: REQUIRED_VIEWPORTS.map((viewport) => ({ ...viewport })), exclusions: [], jobs };
}

export function validateAdmittedPlan(plan) {
  if (plan.exclusions?.length) throw new Error("late exclusion prohibited");
  const units = new Map();
  for (const job of plan.jobs ?? []) {
    const id = `${job.scenario.scenario_id}:${job.seed}`;
    if (!units.has(id)) units.set(id, new Set());
    units.get(id).add(job.arm);
  }
  const scenarioIds = new Set([...units.keys()].map((id) => id.slice(0, id.lastIndexOf(":"))));
  const seeds = new Set([...units.keys()].map((id) => Number(id.slice(id.lastIndexOf(":") + 1))));
  if (scenarioIds.size !== 12 || [...scenarioIds].some((id) => !REQUIRED_SCENARIOS.has(id)) || seeds.size !== 2 || !seeds.has(101) || !seeds.has(202) || units.size !== 24 || [...units.values()].some((arms) => arms.size !== 2 || !arms.has("baseline") || !arms.has("candidate")) || plan.jobs?.length !== 48) throw new Error("exact admitted scenarios, seeds, arms, and 24 mandatory units required");
  if (JSON.stringify(plan.required_viewports) !== JSON.stringify(REQUIRED_VIEWPORTS)) throw new Error("exact mobile and desktop viewports required");
  return true;
}

export function addLateExclusion(_plan, scope) { throw new Error(`late ${scope} exclusion prohibited`); }
