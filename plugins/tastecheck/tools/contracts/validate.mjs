export const CANONICAL_EVIDENCE = ["status", "reason", "remediation", "evidence", "provenance"];
const REQUIRED = ["schema_version", "skill", "class", "trigger", "exclusions", "inputs", "outputs", "stop_conditions", "handoff", "self_check_shape", "required_evidence_fields"];
const CLASSES = new Set(["generative", "repair", "gate"]);
const SELF_CHECKS = new Set(["checklist_with_evidence", "table_with_evidence", "ledger_with_verdict"]);

function nonemptyStrings(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a nonempty array`);
    return;
  }
  if (value.some((item) => typeof item !== "string" || !item.trim())) errors.push(`${label} must contain nonempty strings`);
}

export function validateSkillContract(contract, { knownSkills = new Set() } = {}) {
  const errors = [];
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return ["contract must be an object"];
  for (const key of REQUIRED) if (!(key in contract)) errors.push(`missing required property ${key}`);
  if (contract.schema_version !== 1) errors.push("schema_version must be 1");
  if (typeof contract.skill !== "string" || !contract.skill.trim()) errors.push("skill must be a nonempty string");
  if (knownSkills.size && !knownSkills.has(contract.skill)) errors.push(`skill is not in the known skill inventory: ${contract.skill}`);
  if (!CLASSES.has(contract.class)) errors.push(`class must be one of ${[...CLASSES].join(", ")}`);
  if (!contract.trigger || typeof contract.trigger !== "object") errors.push("trigger must be an object");
  else {
    nonemptyStrings(contract.trigger.positive, "trigger.positive", errors);
    nonemptyStrings(contract.trigger.negative, "trigger.negative", errors);
  }
  nonemptyStrings(contract.exclusions, "exclusions", errors);
  nonemptyStrings(contract.stop_conditions, "stop_conditions", errors);
  if (!contract.inputs || !Array.isArray(contract.inputs.required) || !Array.isArray(contract.inputs.optional)) errors.push("inputs.required and inputs.optional must be arrays");
  if (!contract.outputs || typeof contract.outputs.primary !== "string" || !contract.outputs.primary.trim()) errors.push("outputs.primary must be a nonempty string");
  if (!contract.handoff || !Array.isArray(contract.handoff.receives_from) || !Array.isArray(contract.handoff.sends_to)) errors.push("handoff.receives_from and handoff.sends_to must be arrays");
  if (!SELF_CHECKS.has(contract.self_check_shape)) errors.push(`self_check_shape must be one of ${[...SELF_CHECKS].join(", ")}`);
  if (JSON.stringify(contract.required_evidence_fields) !== JSON.stringify(CANONICAL_EVIDENCE)) errors.push(`required_evidence_fields must be exactly ${CANONICAL_EVIDENCE.join(", ")}`);
  return errors;
}
