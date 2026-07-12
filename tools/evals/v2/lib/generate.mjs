import { buildGenerationPlan, executeAttempt, validateAdmittedPlan } from "./admission.mjs";

export function planGenerations(input) {
  const plan = buildGenerationPlan(input);
  validateAdmittedPlan(plan);
  return plan;
}

export function runGenerations({ plan, state, requestFor, route, invoke }) {
  validateAdmittedPlan(plan);
  const receipts = [];
  for (const job of plan.jobs) {
    const outcome = executeAttempt({ state, request: requestFor(job), route, invoke: (context) => invoke(job, context) });
    receipts.push(outcome.receipt);
    if (outcome.run_status !== "running") return { run_status: outcome.run_status, receipts };
  }
  return { run_status: state.run_status, receipts };
}
