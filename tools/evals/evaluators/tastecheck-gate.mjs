#!/usr/bin/env node
/**
 * Correctness/invariant gate for deterministic tastecheck-pass scenarios.
 *
 * This lane does not ask a deterministic gate to beat its baseline. It checks
 * that every run preserves the canonical verdict and ledger while allowing the
 * readable presentation architecture to vary.
 */

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function signature(evidence) {
  return JSON.stringify(stable({
    verdict: evidence?.verdict,
    ledger_ids: [...(evidence?.ledger_ids ?? [])].sort(),
    canonical_facts: evidence?.canonical_facts ?? null,
  }));
}

export function evaluateTastecheckGate(attempts, contract) {
  const errors = [];
  if (!Array.isArray(attempts) || attempts.length !== 3) errors.push("deterministic gate requires exactly three current runs");
  if (!contract || typeof contract !== "object") errors.push("deterministic gate contract is required");
  const expectedVerdict = contract?.expected_verdict;
  const expectedLedger = Array.isArray(contract?.required_ledger_ids) ? [...contract.required_ledger_ids].sort() : [];
  const requiredEvidence = Array.isArray(contract?.required_evidence_fields) ? contract.required_evidence_fields : [];
  const preferenceLiftRequired = contract?.preference_lift_required;
  if (typeof expectedVerdict !== "string" || !expectedVerdict) errors.push("deterministic gate expected_verdict is required");
  if (expectedLedger.length === 0) errors.push("deterministic gate required_ledger_ids must be non-empty");
  if (requiredEvidence.length === 0) errors.push("deterministic gate required_evidence_fields must be non-empty");
  if (typeof preferenceLiftRequired !== "boolean") errors.push("deterministic gate preference_lift_required must be an explicit boolean");
  const checked = (attempts ?? []).map((attempt, index) => {
    const evidence = attempt?.gate_evidence;
    if (!evidence || evidence.verdict !== expectedVerdict) errors.push(`seed${attempt?.seed ?? index}: canonical verdict mismatch`);
    if (!evidence?.canonical_facts || typeof evidence.canonical_facts !== "object" || Array.isArray(evidence.canonical_facts)) errors.push(`seed${attempt?.seed ?? index}: canonical facts are required`);
    const ledger = [...(evidence?.ledger_ids ?? [])].sort();
    if (JSON.stringify(ledger) !== JSON.stringify(expectedLedger)) errors.push(`seed${attempt?.seed ?? index}: canonical ledger IDs mismatch`);
    if (!Array.isArray(attempt?.assertions_result) || attempt.assertions_result.length === 0 || attempt.assertions_result.some((item) => item?.met !== true)) errors.push(`seed${attempt?.seed ?? index}: assertions are not all met`);
    for (const field of requiredEvidence) if (attempt?.evidence_fields_present?.[field] !== true) errors.push(`seed${attempt?.seed ?? index}: missing evidence field ${field}`);
    return { seed: attempt?.seed ?? attempt?.requested_seed ?? null, signature: signature(evidence), presentation_architecture: evidence?.presentation_architecture ?? null };
  });
  const signatures = new Set(checked.map((item) => item.signature));
  if (signatures.size > 1) errors.push("canonical verdict, ledger, or facts changed across runs");
  const pass = errors.length === 0;
  return {
    schema_version: 1,
    evaluator: "tastecheck-deterministic-gate",
    expected_verdict: expectedVerdict,
    required_ledger_ids: expectedLedger,
    runs: checked,
    canonical_invariants_preserved: pass,
    preference_lift_required: preferenceLiftRequired,
    diversity_required: false,
    release_eligible: pass,
    verdict: pass ? "correct-and-invariant" : "blocked",
    errors,
    notes: pass ? "Presentation architecture may vary; canonical gate facts remain invariant." : "Deterministic gate failed closed on correctness or invariant preservation.",
  };
}
