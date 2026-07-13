import { buildGenerationPlan, executeAttempt, validateAdmittedPlan } from "./admission.mjs";
import { canonicalJson } from "./canonical-json.mjs";
import { loadAndVerifyPrepacketSchedule } from "./schedule.mjs";

function validateGenerationRequest(request, generatorBinding) {
  if (!request || request.call_class !== "generation" ||
      request.executor_digest !== generatorBinding.executor_digest ||
      request.resolver_attestation_sha256 !== generatorBinding.resolver_attestation_sha256 ||
      canonicalJson(request.executor) !== canonicalJson(generatorBinding.executor)) {
    throw new Error("generation request must match exact frozen generator executor digest and resolver attestation");
  }
}

export function planGenerations(input) {
  const plan = buildGenerationPlan(input);
  validateAdmittedPlan(plan, input);
  return plan;
}

export function runGenerations({ plan, protocol, registry, prepacketSchedulePath, state, requestFor, route, invoke }) {
  const generatorBinding = state?.frozen_execution_selection?.generator;
  const trustedInput = { protocol, registry, protocol_sha256: state?.protocol_sha256, generatorBinding };
  validateAdmittedPlan(plan, trustedInput);
  if (state.admitted !== 0) throw new Error("generation execution must begin at external-call ordinal 1");
  const prepacket = loadAndVerifyPrepacketSchedule({
    path: prepacketSchedulePath,
    generationPlan: plan,
    selection: state.frozen_execution_selection,
    protocol,
    registry,
    protocolSha256: state.protocol_sha256,
    scenarioRegistrySha256: state.scenario_registry_sha256,
    runId: state.run_id
  });
  if (state.prepacket_schedule_sha256 !== prepacket.schedule_sha256) {
    throw new Error("generation execution prepacket schedule digest mismatch");
  }
  if (state.execution_manifest_sha256 !== state.frozen_execution_selection.execution_manifest_sha256) {
    throw new Error("generation execution manifest binding mismatch");
  }
  const receipts = [];
  for (const [index, job] of plan.jobs.entries()) {
    const request = requestFor(job);
    validateGenerationRequest(request, generatorBinding);
    const scenarioSha256 = job.scenario.sha256 ?? job.scenario.scenario_sha256;
    const outcome = executeAttempt({
      state,
      request: {
        ...request,
        receipt_kind: "generation",
        receipt_binding: {
          run_id: state.run_id,
          protocol_sha256: state.protocol_sha256,
          scenario_registry_sha256: state.scenario_registry_sha256,
          scenario_id: job.scenario.scenario_id,
          scenario_sha256: scenarioSha256,
          generation_seed: job.seed,
          arm: job.arm,
          revision: job.revision
        }
      },
      route,
      invoke: (context) => invoke(job, context)
    });
    if (outcome.receipt.ordinal !== index + 1) throw new Error("generation receipt ordinal drift");
    receipts.push(outcome.receipt);
    if (outcome.run_status !== "running") return { run_status: outcome.run_status, receipts };
  }
  return { run_status: state.run_status, receipts };
}
