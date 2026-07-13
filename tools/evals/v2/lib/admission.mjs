import { readFileSync } from "node:fs";
import { appendEvent } from "./ledger.mjs";
import { canonicalJson } from "./canonical-json.mjs";

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
const sameExecutor = (left, right) => left && right && canonicalJson(left) === canonicalJson(right);
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
  let frozen = state.frozen_executors?.[request.call_class];
  let frozenBinding = null;
  if (request.executor_digest || request.resolver_attestation_sha256 || state.frozen_execution_selection) {
    const candidates = request.call_class === "generation"
      ? [state.frozen_execution_selection?.generator]
      : (state.frozen_execution_selection?.judges ?? []);
    frozenBinding = candidates.find((candidate) => candidate?.executor_digest === request.executor_digest);
    if (!frozenBinding || frozenBinding.resolver_attestation_sha256 !== request.resolver_attestation_sha256) {
      throw new Error("request does not match frozen executor and resolver attestation");
    }
    frozen = frozenBinding.executor;
  }
  if (!sameExecutor(frozen, request.executor)) throw new Error("request does not match frozen executor");
  const ordinal = (state.admitted ?? 0) + 1;
  const binding = request.receipt_binding && typeof request.receipt_binding === "object" && !Array.isArray(request.receipt_binding)
    ? structuredClone(request.receipt_binding) : {};
  for (const reserved of ["ordinal", "call_class", "cost_classification", "incremental_spend_usd", "executor", "status"]) {
    if (reserved in binding) throw new Error(`receipt binding may not override ${reserved}`);
  }
  const receipt = {
    ...binding, ordinal, call_class: request.call_class, cost_classification,
    incremental_spend_usd: 0, executor: frozen,
    ...(frozenBinding ? { executor_digest: frozenBinding.executor_digest, resolver_attestation_sha256: frozenBinding.resolver_attestation_sha256 } : {}),
    status: "reserved"
  };
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

export function executeAttempt({ state, request, invoke, route, validateArtifact }) {
  const receipt = admitCall(state, request);
  let routed;
  try { routed = route({ request, ordinal: receipt.ordinal, frozen_executor: receipt.executor }); }
  catch { return failRouting(state, receipt, "routing attestation failed"); }
  if (!routed) return failRouting(state, receipt, "routing attestation missing");
  const expectedRoute = receipt.executor_digest
    ? { executor: receipt.executor, executor_digest: receipt.executor_digest, resolver_attestation_sha256: receipt.resolver_attestation_sha256 }
    : receipt.executor;
  if (canonicalJson(routed) !== canonicalJson(expectedRoute)) return failRouting(state, receipt, "routing attestation does not match frozen executor or resolver attestation");
  try { persist(state, {
    type: "routing_attested", ordinal: receipt.ordinal, call_class: receipt.call_class,
    executor: receipt.executor,
    ...(receipt.executor_digest ? { executor_digest: receipt.executor_digest, resolver_attestation_sha256: receipt.resolver_attestation_sha256 } : {})
  }); }
  catch (error) {
    receipt.status = "routing_persist_uncertain";
    state.run_status = "production_incomplete";
    throw new Error(`routing attestation persist uncertainty: ${error.message}`);
  }
  let result;
  try { result = invoke({ request, ordinal: receipt.ordinal, executor: receipt.executor }); }
  catch (error) { result = { exit_code: null, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [], transport_error: error?.message ?? "executor failure" }; }
  let status = classifyExecution(result);
  let validatedArtifact;
  if (status === "completed" && validateArtifact) {
    try { validatedArtifact = validateArtifact(result); }
    catch (error) {
      status = "invalid_artifact";
      result = { ...result, artifact_validation_error: error?.message ?? "artifact validation failed" };
    }
  }
  receipt.status = status;
  if (status === "completed" && request.receipt_kind === "generation") receipt.artifacts = structuredClone(result.artifacts);
  try { persist(state, { type: "attempt_closed", ...receipt, run_status: status === "completed" ? state.run_status : "production_incomplete" }); }
  catch (error) {
    receipt.status = "close_persist_uncertain";
    state.run_status = "production_incomplete";
    throw new Error(`attempt close persist uncertainty: ${error.message}`);
  }
  if (status !== "completed") state.run_status = "production_incomplete";
  return { run_status: state.run_status, receipt, result, validated_artifact: validatedArtifact };
}

export function buildArmJob({ scenario, seed, arm, revision, protocol_sha256, skill_pack_content, generatorBinding }) {
  if (!["baseline", "candidate"].includes(arm)) throw new Error("invalid arm");
  if (!generatorBinding?.executor || typeof generatorBinding.executor_digest !== "string" ||
      typeof generatorBinding.resolver_attestation_sha256 !== "string") {
    throw new Error("frozen generator binding required");
  }
  const executor = generatorBinding.executor;
  return {
    scenario: structuredClone(scenario), seed, arm, revision, protocol_sha256, skill_pack_content,
    executor_digest: generatorBinding.executor_digest,
    resolver_attestation_sha256: generatorBinding.resolver_attestation_sha256,
    system_prompt_sha256: executor.system_prompt_sha256,
    settings_sha256: executor.settings_sha256,
    tool_policy_sha256: executor.tool_policy_sha256,
    time_budget_seconds: executor.time_budget_seconds,
    retry_policy: "none"
  };
}

export function buildGenerationPlan({ protocol, registry, protocol_sha256, generatorBinding }) {
  if (protocol.exclusions?.length) throw new Error("admitted protocol exclusions must be empty");
  const jobs = [];
  const scenarios = [...registry.scenarios].sort((left, right) => Buffer.from(left.scenario_id).compare(Buffer.from(right.scenario_id)));
  const seeds = [...protocol.seeds].sort((left, right) => left - right);
  for (const scenario of scenarios) for (const seed of seeds) for (const arm of ["baseline", "candidate"]) jobs.push(buildArmJob({ scenario, seed, arm, revision: arm === "baseline" ? protocol.baseline_revision : protocol.candidate_revision, protocol_sha256, skill_pack_content: `${arm}-skill-pack`, generatorBinding }));
  return { comparison_units: protocol.comparison_units, required_viewports: REQUIRED_VIEWPORTS.map((viewport) => ({ ...viewport })), exclusions: [], jobs };
}

export function validateAdmittedPlan(plan, trustedInput) {
  if (!trustedInput?.protocol || !trustedInput?.registry || !trustedInput?.generatorBinding) {
    throw new Error("trusted protocol, registry, and frozen generator binding required");
  }
  const expected = buildGenerationPlan(trustedInput);
  if (canonicalJson(plan) !== canonicalJson(expected)) {
    throw new Error("generation plan exact canonical trusted-input mismatch");
  }
  return true;
}

export function addLateExclusion(_plan, scope) { throw new Error(`late ${scope} exclusion prohibited`); }
