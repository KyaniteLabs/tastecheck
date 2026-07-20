#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateTastecheckGate } from "./evaluators/tastecheck-gate.mjs";

const contract = {
  expected_verdict: "FAIL",
  required_ledger_ids: ["visual-quality:independent-review", "contrast:body-on-surface", "cold-load:initial-render", "error-state:invalid-skip"],
  required_evidence_fields: ["status", "reason", "remediation", "evidence", "provenance"],
  preference_lift_required: false,
};

function run(seed, architecture) {
  return {
    seed,
    raw_output: `FAIL ${architecture}`,
    assertions_result: [{ met: true }],
    evidence_fields_present: Object.fromEntries(contract.required_evidence_fields.map((field) => [field, true])),
    gate_evidence: {
      verdict: "FAIL",
      ledger_ids: contract.required_ledger_ids,
      canonical_facts: { technical_checks_pass: true, visual_self_review_only: true, visual_quality_hold: true, hidden_error: true, equal_card_grid: true, contrast_measured: false, cold_load_trace: false },
      presentation_architecture: architecture,
    },
  };
}

const passing = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  run(202, "evidence trace"),
  run(303, "release decision memo"),
], contract);
assert.equal(passing.release_eligible, true, passing.notes);
assert.equal(passing.verdict, "correct-and-invariant");
assert.equal(passing.preference_lift_required, false);

const missingRow = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  { ...run(202, "evidence trace"), gate_evidence: { ...run(202, "evidence trace").gate_evidence, ledger_ids: contract.required_ledger_ids.slice(1) } },
  run(303, "release decision memo"),
], contract);
assert.equal(missingRow.release_eligible, false, "missing canonical row must block");

const missingContract = evaluateTastecheckGate([run(101, "failure-first queue"), run(202, "evidence trace"), run(303, "release decision memo")]);
assert.equal(missingContract.release_eligible, false, "missing deterministic contract must block");

const missingLiftPolicy = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  run(202, "evidence trace"),
  run(303, "release decision memo"),
], { ...contract, preference_lift_required: undefined });
assert.equal(missingLiftPolicy.release_eligible, false, "deterministic contract must explicitly declare lift policy");

console.log("tastecheck deterministic gate tests: 4 passed");
