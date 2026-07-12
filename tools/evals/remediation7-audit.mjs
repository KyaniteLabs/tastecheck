#!/usr/bin/env node
/**
 * Additive, model-output-preserving audit for the seven-skill remediation7
 * corpus. It validates every packaged result, evaluates the two current-only
 * evaluator lanes, builds a deterministic tastecheck gate receipt, and emits
 * a blinded paired-judge scaffold without running judges.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_NAMESPACE,
  DEFAULT_REVISION_ID,
  SKILLS,
  SEEDS,
  loadReplayDefinition,
  validateModelResult,
  validateReplayPackage,
} from "./remediation7-replay.mjs";
import { evaluateAntiSlop } from "./evaluators/anti-slop.mjs";
import { evaluateDiversity } from "./evaluators/diversity.mjs";
import { evaluateTastecheckGate } from "./evaluators/tastecheck-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPAIR_FIXTURE_SKILLS = new Set(["a11y-pass", "responsive-layout", "component-states"]);
const RECEIPT_DIR = "evaluators";
const BLIND_DIR = "blind-judge";
const JUDGE_SLOTS = ["independent-1", "independent-2", "independent-3"];
export const JUDGE_DIMENSIONS = [
  "domain_specificity",
  "evidence_completeness",
  "fail_closed",
  "handoff_readiness",
  "scope_discipline",
];
export const PAIRED_RELEASE_POLICY = {
  min_upgraded_mean_delta: 0.6,
  min_upgraded_preference_count: 2,
  mandatory_dimension_mean_delta_floor: -0.25,
  required_judgments_per_skill: 9,
  dimensions: JUDGE_DIMENSIONS,
  score_scale: { min: 1, max: 5, dimensions: JUDGE_DIMENSIONS.length },
  min_upgraded_mean_delta_full_range_fraction: 0.15,
  threshold_basis: "raw mean delta across five anchored 1-5 dimension scores",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function readJson(path, label = path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label}: invalid JSON (${error.message})`);
  }
}

function safePath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.startsWith("/") || relativePath.split("/").includes("..")) return null;
  const absolute = resolve(root, relativePath);
  const rootAbsolute = resolve(root);
  return absolute === rootAbsolute || absolute.startsWith(`${rootAbsolute}/`) ? absolute : null;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function jsonSha256(value) {
  return sha256(`${JSON.stringify(value, null, 2)}\n`);
}

function allJobs(manifest) {
  return [...(manifest.paired_lane?.jobs ?? []), ...(manifest.diversity_lane?.jobs ?? [])];
}

function resultInventory(root, namespace, manifest) {
  const expected = allJobs(manifest).map((job) => job.result_path).sort();
  const actual = [];
  for (const lane of ["paired", "diversity"]) {
    const directory = safePath(root, `${namespace}/${lane}/results`);
    if (!directory || !existsSync(directory)) continue;
    for (const name of readdirSync(directory).sort()) {
      if (name.endsWith(".json")) actual.push(`${namespace}/${lane}/results/${name}`);
    }
  }
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    expected_count: expected.length,
    found_count: actual.length,
    expected_paths: expected,
    actual_paths: actual,
    missing: expected.filter((path) => !actualSet.has(path)),
    extras: actual.filter((path) => !expectedSet.has(path)),
    duplicate_paths: actual.filter((path, index) => actual.indexOf(path) !== index),
    exact: expected.length === actual.length
      && expected.every((path) => actualSet.has(path))
      && actual.every((path) => expectedSet.has(path)),
  };
}

function loadResultRecords(root, manifest) {
  return allJobs(manifest).map((job) => {
    const absolute = safePath(root, job.result_path);
    if (!absolute || !existsSync(absolute)) {
      return {
        job,
        result: null,
        validation_errors: [`${job.job_id}: result file missing`],
        result_file_sha256: null,
      };
    }
    let result;
    try {
      result = readJson(absolute, job.result_path);
    } catch (error) {
      return {
        job,
        result: null,
        validation_errors: [error.message],
        result_file_sha256: fileSha256(absolute),
      };
    }
    const validation = validateModelResult(root, result);
    return {
      job,
      result,
      validation_errors: validation.errors,
      result_file_sha256: fileSha256(absolute),
      validation,
    };
  });
}

function resultReceipt(record) {
  const result = record.result;
  const job = record.job;
  return {
    job_id: job.job_id,
    lane: job.lane,
    run_type: job.run_type,
    skill: job.skill,
    scenario_id: job.scenario_id,
    requested_seed: job.requested_seed,
    result_path: job.result_path,
    result_file_sha256: record.result_file_sha256,
    raw_output_sha256: result?.raw_output_hash ?? null,
    raw_output_hash_verified: typeof result?.raw_output === "string"
      && result.raw_output_hash === sha256(result.raw_output),
    prompt_packet_ref: job.prompt_packet_ref,
    prompt_packet_sha256: job.prompt_packet_sha256,
    skill_source_path: job.skill_source_path,
    skill_source_sha256: job.skill_source_sha256,
    artifact_receipts: (result?.artifact_receipts ?? []).map((receipt) => ({
      fixture_id: receipt.fixture_id,
      id: receipt.id,
      path: receipt.path,
      sha256: receipt.sha256,
      captured_at: receipt.captured_at,
    })),
    validation_errors: record.validation_errors,
  };
}

function fixtureReceiptSummary(root, manifest, records, packageCheck) {
  const repairRecords = records.filter((record) => REPAIR_FIXTURE_SKILLS.has(record.job.skill));
  const receiptRows = repairRecords.flatMap((record) => (record.result?.artifact_receipts ?? []).map((receipt) => ({
    job_id: record.job.job_id,
    skill: record.job.skill,
    lane: record.job.lane,
    run_type: record.job.run_type,
    requested_seed: record.job.requested_seed,
    fixture_id: receipt.fixture_id,
    id: receipt.id,
    path: receipt.path,
    sha256: receipt.sha256,
    captured_at: receipt.captured_at,
  })));
  const bindingFailures = repairRecords.flatMap((record) => record.validation_errors
    .filter((error) => /artifact|receipt|fixture/i.test(error))
    .map((error) => ({ job_id: record.job.job_id, error })));
  const expectedReceiptResultCount = allJobs(manifest).filter((job) => REPAIR_FIXTURE_SKILLS.has(job.skill)).length;
  const expectedReceiptCount = expectedReceiptResultCount * 3;
  const indexPath = manifest.artifact_index_path ?? `${manifest.artifact_root}/fixture-index.json`;
  const indexAbsolute = safePath(root, indexPath);
  return {
    artifact_root: manifest.artifact_root,
    artifact_index_path: indexPath,
    artifact_index_sha256: indexAbsolute && existsSync(indexAbsolute) ? fileSha256(indexAbsolute) : null,
    expected_fixture_index_entries: packageCheck.artifactIndex?.entries?.length ?? 0,
    expected_receipt_result_count: expectedReceiptResultCount,
    verified_receipt_result_count: repairRecords.filter((record) => record.validation_errors.length === 0
      && (record.result?.artifact_receipts?.length ?? 0) === 3).length,
    expected_receipt_count: expectedReceiptCount,
    verified_receipt_count: receiptRows.filter((row) => bindingFailures.every((failure) => failure.job_id !== row.job_id)).length,
    receipt_rows: receiptRows,
    binding_failures: bindingFailures,
    fixture_contracts: (manifest.fixture_contracts ?? []).map((contract) => ({
      skill: contract.skill,
      fixture_id: contract.fixture_id,
      path: contract.path,
      sha256: contract.sha256,
    })),
  };
}

function parsePipeCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return body.split("|").map((cell) => cell.trim());
}

export function parseTastecheckGateEvidence(output, contract) {
  const requiredLedger = contract?.required_ledger_ids ?? [];
  const requiredFields = contract?.required_evidence_fields ?? [];
  const lines = String(output ?? "").split("\n");
  const headerIndex = lines.findIndex((line) => {
    const cells = parsePipeCells(line)?.map((cell) => cell.toLowerCase());
    return cells?.some((cell) => cell === "ledger id" || cell === "id")
      && requiredFields.every((field) => cells.includes(field.toLowerCase()));
  });
  const header = headerIndex >= 0 ? parsePipeCells(lines[headerIndex]) : [];
  const lowerHeader = header.map((cell) => cell.toLowerCase());
  const idIndex = lowerHeader.findIndex((cell) => cell === "ledger id" || cell === "id");
  const statusIndex = lowerHeader.indexOf("status");
  const rows = new Map();
  if (headerIndex >= 0 && idIndex >= 0 && statusIndex >= 0) {
    for (const line of lines.slice(headerIndex + 1)) {
      const cells = parsePipeCells(line);
      if (!cells || cells.length <= Math.max(idIndex, statusIndex)) {
        if (rows.size > 0) break;
        continue;
      }
      const id = cells[idIndex];
      if (requiredLedger.includes(id)) rows.set(id, { status: cells[statusIndex]?.toUpperCase() ?? null });
    }
  }
  const verdictMatch = String(output ?? "").match(/(?:^|\n)\s*#*\s*(?:verdict|decision)\s*:\s*([A-Za-z]+)/i);
  const verdict = verdictMatch?.[1]?.toUpperCase() ?? null;
  const evidenceFieldsPresent = Object.fromEntries(requiredFields.map((field) => [
    field,
    lowerHeader.includes(field.toLowerCase()),
  ]));
  const ledgerIds = requiredLedger.filter((id) => rows.has(id));
  const expectedVerdict = String(contract?.expected_verdict ?? "").toUpperCase();
  const assertionsResult = requiredLedger.map((id) => ({
    id,
    met: rows.get(id)?.status === expectedVerdict && Object.values(evidenceFieldsPresent).every(Boolean),
    row_present: rows.has(id),
    observed_status: rows.get(id)?.status ?? null,
  }));
  return {
    seed: null,
    assertions_result: assertionsResult,
    evidence_fields_present: evidenceFieldsPresent,
    gate_evidence: {
      verdict,
      ledger_ids: ledgerIds,
      canonical_facts: {
        ledger_statuses: Object.fromEntries(requiredLedger.map((id) => [id, rows.get(id)?.status ?? null])),
        required_rows_present: Object.fromEntries(requiredLedger.map((id) => [id, rows.has(id)])),
        evidence_fields_present: evidenceFieldsPresent,
        required_row_count: ledgerIds.length,
      },
      presentation_architecture: lines.find((line) => /^\s*#{1,6}\s+/.test(line.trim()))?.trim() ?? null,
    },
  };
}

function diversityReceipt(root, definition, records) {
  const bySkill = definition.skills.map((entry) => {
    const attempts = records
      .filter((record) => record.job.lane === "diversity" && record.job.skill === entry.skill)
      .map((record) => ({ ...record.result, seed: record.result.requested_seed }))
      .filter(Boolean)
      .sort((left, right) => left.requested_seed - right.requested_seed);
    let evaluation;
    try {
      evaluation = evaluateDiversity(attempts, entry);
    } catch (error) {
      evaluation = {
        schema_version: 2,
        evaluator: "diversity",
        skill: entry.skill,
        overall_pass: false,
        semantic_pass: false,
        release_gate_eligible: false,
        error: error.message,
      };
    }
    return { skill: entry.skill, attempt_count: attempts.length, evaluation };
  });
  return {
    schema_version: 1,
    evaluator: "diversity",
    lane: "diversity",
    current_only: true,
    expected_skill_count: SKILLS.length,
    expected_attempt_count: SKILLS.length * SEEDS.length,
    evaluated_attempt_count: bySkill.reduce((sum, item) => sum + item.attempt_count, 0),
    pass_count: bySkill.filter((item) => item.evaluation.overall_pass).length,
    fail_count: bySkill.filter((item) => !item.evaluation.overall_pass).length,
    failed_skills: bySkill.filter((item) => !item.evaluation.overall_pass).map((item) => item.skill),
    by_skill: bySkill,
  };
}

function antiSlopReceipt(root, records) {
  const results = records.map((record) => {
    let evaluation;
    try {
      const packetPath = safePath(root, record.job.prompt_packet_ref);
      const packet = packetPath && existsSync(packetPath) ? readJson(packetPath, record.job.prompt_packet_ref) : {};
      evaluation = evaluateAntiSlop(record.result ?? {}, { source_text: packet.user_prompt });
    } catch (error) {
      evaluation = {
        evaluator: "anti-slop",
        pass: false,
        verdict: "blocked",
        notes: error.message,
      };
    }
    return { job_id: record.job.job_id, evaluation };
  });
  const byLaneSkill = [];
  for (const lane of ["paired", "diversity"]) for (const skill of SKILLS) {
    const selected = results.filter((item) => item.evaluation.run_type === undefined
      ? records.find((record) => record.job.job_id === item.job_id)?.job.lane === lane
        && records.find((record) => record.job.job_id === item.job_id)?.job.skill === skill
      : item.evaluation.run_type !== undefined
        && records.find((record) => record.job.job_id === item.job_id)?.job.lane === lane
        && records.find((record) => record.job.job_id === item.job_id)?.job.skill === skill);
    byLaneSkill.push({
      lane,
      skill,
      result_count: selected.length,
      pass_count: selected.filter((item) => item.evaluation.pass).length,
      fail_count: selected.filter((item) => !item.evaluation.pass).length,
      failed_jobs: selected.filter((item) => !item.evaluation.pass).map((item) => item.job_id),
      max_slop_score: selected.length ? Math.max(...selected.map((item) => item.evaluation.slop_score ?? 0)) : 0,
      unjustified_abstention_count: selected.reduce((sum, item) => sum + (item.evaluation.unjustified_abstention_count ?? 0), 0),
    });
  }
  return {
    schema_version: 1,
    evaluator: "anti-slop",
    expected_result_count: records.length,
    evaluated_result_count: results.length,
    pass_count: results.filter((item) => item.evaluation.pass).length,
    fail_count: results.filter((item) => !item.evaluation.pass).length,
    failed_jobs: results.filter((item) => !item.evaluation.pass).map((item) => item.job_id),
    by_lane_skill: byLaneSkill,
    results,
  };
}

const BLIND_RUBRIC = {
  schema_version: 1,
  dimensions: [
    "domain_specificity",
    "evidence_completeness",
    "fail_closed",
    "handoff_readiness",
    "scope_discipline",
  ],
  scoring_scale: "Score each dimension 1-5 and cite exact candidate text; do not infer missing evidence.",
  preference_values: ["A", "B", "tie", "abstain"],
  required_judge_fields: ["packet_id", "preference", "dimension_scores", "reason", "evidence"],
};

const JUDGE_RESULT_SCHEMA = {
  schema_version: 1,
  kind: "paired-preference-independent-judge-result",
  required: BLIND_RUBRIC.required_judge_fields,
  allowed_preference: BLIND_RUBRIC.preference_values,
  no_result_files_present_until_independent_judges_run: true,
};

function parseEvidenceClaim(claim) {
  if (claim && typeof claim === "object" && !Array.isArray(claim)) {
    return { candidate: claim.candidate, quote: claim.quote };
  }
  if (typeof claim !== "string") return { candidate: null, quote: null };
  const match = claim.match(/^\s*([AB])\s*:\s*(.*)\s*$/s);
  if (!match) return { candidate: null, quote: null };
  let quote = match[2].trim();
  if ((quote.startsWith('"') && quote.endsWith('"')) || (quote.startsWith("'") && quote.endsWith("'"))) quote = quote.slice(1, -1);
  return { candidate: match[1], quote };
}

export function validateJudgeResultAgainstPacket(result, packet, schema = JUDGE_RESULT_SCHEMA) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["judge result must be an object"];
  if (!packet || typeof packet !== "object") return ["blind packet is required"];
  for (const field of schema.required ?? JUDGE_RESULT_SCHEMA.required) {
    if (!(field in result)) errors.push(`missing required field: ${field}`);
  }
  if (result.packet_id !== packet.packet_id) errors.push(`packet_id mismatch: expected ${packet.packet_id}`);
  const allowedPreferences = schema.allowed_preference ?? JUDGE_RESULT_SCHEMA.allowed_preference;
  if (!allowedPreferences.includes(result.preference)) errors.push(`invalid preference: ${result.preference}`);
  if (typeof result.reason !== "string" || !result.reason.trim()) errors.push("reason must be a non-empty string");
  if (!result.dimension_scores || typeof result.dimension_scores !== "object" || Array.isArray(result.dimension_scores)) {
    errors.push("dimension_scores must be an object");
  } else {
    for (const candidate of ["A", "B"]) {
      const scores = result.dimension_scores[candidate];
      if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
        errors.push(`dimension_scores.${candidate} must be an object`);
        continue;
      }
      for (const dimension of JUDGE_DIMENSIONS) {
        const score = scores[dimension];
        if (!Number.isInteger(score) || score < 1 || score > 5) errors.push(`dimension_scores.${candidate}.${dimension} must be an integer from 1 to 5`);
      }
    }
  }
  if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
    errors.push("evidence must be a non-empty array");
  } else {
    for (const [index, claim] of result.evidence.entries()) {
      const parsed = parseEvidenceClaim(claim);
      const candidate = packet.candidates?.[parsed.candidate];
      if (!candidate) {
        errors.push(`evidence[${index}] must name candidate A or B`);
        continue;
      }
      if (typeof parsed.quote !== "string" || !parsed.quote.trim()) {
        errors.push(`evidence[${index}] quote must be non-empty`);
      } else if (!candidate.raw_output.includes(parsed.quote)) {
        errors.push(`evidence[${index}] is not an exact candidate substring for ${parsed.candidate}`);
      }
    }
  }
  return errors;
}

function expectedJudgeResults(manifest) {
  return (manifest.independent_judge_slots ?? []).flatMap((slot) => (manifest.packet_paths ?? []).map((packet) => ({
    slot,
    packet_id: basename(packet.path, ".json"),
    packet_path: packet.path,
    result_path: `${manifest.namespace}/${BLIND_DIR}/results/${slot}/${basename(packet.path)}`,
  })));
}

function listJudgeResultFiles(root, manifest) {
  const actual = [];
  for (const slot of manifest.independent_judge_slots ?? []) {
    const directory = safePath(root, `${manifest.namespace}/${BLIND_DIR}/results/${slot}`);
    if (!directory || !existsSync(directory)) continue;
    for (const name of readdirSync(directory).sort()) if (name.endsWith(".json")) actual.push(`${manifest.namespace}/${BLIND_DIR}/results/${slot}/${name}`);
  }
  return actual;
}

function readBlindPackets(root, manifest) {
  const packets = new Map();
  const errors = [];
  for (const binding of manifest.packet_paths ?? []) {
    const path = safePath(root, binding.path);
    if (!path || !existsSync(path)) {
      errors.push(`blind packet missing: ${binding.path}`);
      continue;
    }
    if (fileSha256(path) !== binding.sha256) errors.push(`blind packet digest mismatch: ${binding.path}`);
    try {
      const packet = readJson(path, binding.path);
      if (packets.has(packet.packet_id)) errors.push(`duplicate blind packet: ${packet.packet_id}`);
      packets.set(packet.packet_id, packet);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { packets, errors };
}

function validateUnmaskBindings(root, manifest, packets) {
  const errors = [];
  const path = safePath(root, manifest.unmask_path);
  if (!path || !existsSync(path)) return { errors: [`unmask missing: ${manifest.unmask_path}`], bindings: new Map(), verified_count: 0 };
  if (manifest.unmask_sha256 && fileSha256(path) !== manifest.unmask_sha256) errors.push(`unmask digest mismatch: ${manifest.unmask_path}`);
  let unmask;
  try { unmask = readJson(path, manifest.unmask_path); } catch (error) { return { errors: [...errors, error.message], bindings: new Map(), verified_count: 0 }; }
  if (unmask.schema_version !== 1 || unmask.kind !== "private-local-blind-unmask" || unmask.revision_id !== manifest.revision_id) errors.push("unmask identity invalid");
  const bindings = new Map();
  for (const entry of unmask.packets ?? []) {
    if (!entry?.packet_id || bindings.has(entry.packet_id)) { errors.push(`duplicate or missing unmask packet: ${entry?.packet_id ?? "unknown"}`); continue; }
    bindings.set(entry.packet_id, entry);
  }
  let verifiedCount = 0;
  for (const [packetId, packet] of packets) {
    const entry = bindings.get(packetId);
    const localErrors = [];
    if (!entry) localErrors.push(`unmask entry missing: ${packetId}`);
    for (const candidate of ["A", "B"]) {
      const binding = entry?.candidates?.[candidate];
      if (!binding || !["baseline", "upgraded"].includes(binding.run_type)) {
        localErrors.push(`${packetId}/${candidate}: unmask source binding invalid`);
        continue;
      }
      const sourcePath = safePath(root, binding.result_path);
      if (!sourcePath || !existsSync(sourcePath)) { localErrors.push(`${packetId}/${candidate}: source result missing`); continue; }
      if (fileSha256(sourcePath) !== binding.result_file_sha256) localErrors.push(`${packetId}/${candidate}: source result digest mismatch`);
      try {
        const source = readJson(sourcePath, binding.result_path);
        if (source.raw_output_hash !== packet.candidates?.[candidate]?.raw_output_hash) localErrors.push(`${packetId}/${candidate}: packet output is not bound to source output`);
        if (source.raw_output_hash !== sha256(source.raw_output ?? "")) localErrors.push(`${packetId}/${candidate}: source output hash invalid`);
      } catch (error) { localErrors.push(error.message); }
    }
    const runTypes = [entry?.candidates?.A?.run_type, entry?.candidates?.B?.run_type].sort();
    if (JSON.stringify(runTypes) !== JSON.stringify(["baseline", "upgraded"])) localErrors.push(`${packetId}: unmask must bind one baseline and one upgraded candidate`);
    if (localErrors.length === 0) verifiedCount += 1;
    errors.push(...localErrors);
  }
  for (const packetId of bindings.keys()) if (!packets.has(packetId)) errors.push(`unmask has unexpected packet: ${packetId}`);
  return { errors, bindings, verified_count: verifiedCount };
}

export function validateBlindJudgeCorpus(root, manifest) {
  const schemaPath = safePath(root, manifest.judge_result_schema_path);
  const schemaErrors = [];
  let schema = null;
  if (!schemaPath || !existsSync(schemaPath)) schemaErrors.push(`judge result schema missing: ${manifest.judge_result_schema_path}`);
  else {
    if (manifest.judge_result_schema_sha256 && fileSha256(schemaPath) !== manifest.judge_result_schema_sha256) schemaErrors.push("judge result schema digest mismatch");
    try { schema = readJson(schemaPath, manifest.judge_result_schema_path); } catch (error) { schemaErrors.push(error.message); }
  }
  const packetRead = readBlindPackets(root, manifest);
  const unmask = validateUnmaskBindings(root, manifest, packetRead.packets);
  const expected = expectedJudgeResults(manifest);
  const actual = listJudgeResultFiles(root, manifest);
  const expectedSet = new Set(expected.map((item) => item.result_path));
  const actualSet = new Set(actual);
  const globalFailures = [...schemaErrors, ...packetRead.errors, ...unmask.errors];
  const records = expected.map((item) => {
    const errors = [...(packetRead.packets.has(item.packet_id) ? [] : [`packet unavailable: ${item.packet_id}`])];
    if (globalFailures.some((failure) => failure.includes(item.packet_id))) errors.push(...globalFailures.filter((failure) => failure.includes(item.packet_id)));
    const resultPath = safePath(root, item.result_path);
    let result = null;
    let resultFileSha256 = null;
    if (!resultPath || !existsSync(resultPath)) errors.push(`judge result missing: ${item.result_path}`);
    else {
      resultFileSha256 = fileSha256(resultPath);
      try {
        result = readJson(resultPath, item.result_path);
        errors.push(...validateJudgeResultAgainstPacket(result, packetRead.packets.get(item.packet_id), schema ?? JUDGE_RESULT_SCHEMA));
      } catch (error) { errors.push(error.message); }
    }
    return { ...item, result, packet: packetRead.packets.get(item.packet_id) ?? null, result_file_sha256: resultFileSha256, errors: [...new Set(errors)] };
  });
  const failures = records.filter((record) => record.errors.length > 0).map((record) => ({
    slot: record.slot,
    packet_id: record.packet_id,
    result_path: record.result_path,
    errors: record.errors,
  }));
  const missing = expected.filter((item) => !actualSet.has(item.result_path)).map((item) => item.result_path);
  const extras = actual.filter((path) => !expectedSet.has(path));
  const validatedCount = records.filter((record) => record.errors.length === 0).length;
  const bySkill = SKILLS.map((skill) => {
    const selected = records.filter((record) => record.packet?.skill === skill);
    const failures = selected.filter((record) => record.errors.length > 0);
    return {
      skill,
      expected_count: selected.length,
      found_count: selected.filter((record) => record.result !== null).length,
      validated_count: selected.length - failures.length,
      evidence_verified_count: selected.length - failures.length,
      failure_count: failures.length,
      invalid_results: failures.map((record) => ({
        slot: record.slot,
        packet_id: record.packet_id,
        result_path: record.result_path,
        errors: record.errors,
      })),
    };
  });
  const pass = expected.length === manifest.expected_judgment_count
    && actual.length === expected.length
    && missing.length === 0
    && extras.length === 0
    && globalFailures.length === 0
    && failures.length === 0
    && unmask.verified_count === (manifest.packet_paths ?? []).length;
  return {
    schema_version: 1,
    kind: "remediation7-blind-judge-validation",
    status: pass ? "validated" : "blocked",
    pass,
    expected_count: expected.length,
    found_count: actual.length,
    validated_count: validatedCount,
    evidence_verified_count: validatedCount,
    failure_count: failures.length,
    packet_count: (manifest.packet_paths ?? []).length,
    unmask_verified_count: unmask.verified_count,
    by_skill: bySkill,
    missing,
    extras,
    global_failures: [...new Set(globalFailures)],
    failures,
    rows: records.map((record) => ({
      slot: record.slot,
      packet_id: record.packet_id,
      result_path: record.result_path,
      result_file_sha256: record.result_file_sha256,
      evidence_verified: record.errors.length === 0,
      errors: record.errors,
    })),
    records,
  };
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Number(value.toFixed(4));
}

export function summarizePreferenceRows(rows) {
  const preferenceVotes = { upgraded: 0, baseline: 0, tie: 0, abstain: 0 };
  for (const row of rows) preferenceVotes[row.preference_class] += 1;
  const dimensionMeanDeltas = Object.fromEntries(JUDGE_DIMENSIONS.map((dimension) => [
    dimension,
    round(average(rows.map((row) => row.dimension_deltas[dimension]))),
  ]));
  const meanDelta = round(average(Object.values(dimensionMeanDeltas)));
  const mandatoryDimensionRegressions = Object.entries(dimensionMeanDeltas)
    .filter(([, delta]) => delta < PAIRED_RELEASE_POLICY.mandatory_dimension_mean_delta_floor)
    .map(([dimension, delta]) => [dimension, delta]);
  const pairedReleaseEligible = rows.length === PAIRED_RELEASE_POLICY.required_judgments_per_skill
    && meanDelta >= PAIRED_RELEASE_POLICY.min_upgraded_mean_delta
    && preferenceVotes.upgraded >= PAIRED_RELEASE_POLICY.min_upgraded_preference_count
    && mandatoryDimensionRegressions.length === 0;
  return {
    judgment_count: rows.length,
    preference_votes: preferenceVotes,
    upgraded_preference_count: preferenceVotes.upgraded,
    mean_delta: meanDelta,
    dimension_mean_deltas: dimensionMeanDeltas,
    mandatory_dimension_regressions: mandatoryDimensionRegressions,
    hard_regression_flags: [],
    paired_release_eligible: pairedReleaseEligible,
    verdict: pairedReleaseEligible ? "improved" : meanDelta < 0 || preferenceVotes.baseline > preferenceVotes.upgraded ? "regressed" : "blocked",
  };
}

export function aggregateBlindPreferences(root, manifest, validation) {
  if (!validation?.pass) {
    return {
      schema_version: 1,
      kind: "remediation7-paired-preference-aggregate",
      status: "blocked-invalid-judge-corpus",
      expected_judgment_count: validation?.expected_count ?? 0,
      completed_judgment_count: validation?.validated_count ?? 0,
      by_skill: [],
      errors: ["paired preferences cannot be unmasked or aggregated before all judge files validate"],
    };
  }
  const rowsBySkill = new Map(SKILLS.map((skill) => [skill, []]));
  const unmaskPath = safePath(root, manifest.unmask_path);
  const unmask = readJson(unmaskPath, manifest.unmask_path);
  const bindings = new Map((unmask.packets ?? []).map((entry) => [entry.packet_id, entry]));
  for (const record of validation.records) {
    const binding = bindings.get(record.packet_id);
    const upgradedLabel = ["A", "B"].find((candidate) => binding.candidates[candidate].run_type === "upgraded");
    const baselineLabel = upgradedLabel === "A" ? "B" : "A";
    const preferenceClass = record.result.preference === "tie" ? "tie"
      : record.result.preference === "abstain" ? "abstain"
        : binding.candidates[record.result.preference].run_type === "upgraded" ? "upgraded" : "baseline";
    const dimensionDeltas = Object.fromEntries(JUDGE_DIMENSIONS.map((dimension) => [
      dimension,
      record.result.dimension_scores[upgradedLabel][dimension] - record.result.dimension_scores[baselineLabel][dimension],
    ]));
    const seed = Number(record.packet.packet_id.match(/-seed(\d+)-/)?.[1] ?? 0);
    rowsBySkill.get(record.packet.skill)?.push({
      packet_id: record.packet_id,
      slot: record.slot,
      seed,
      preference_class: preferenceClass,
      dimension_deltas: dimensionDeltas,
    });
  }
  const bySkill = SKILLS.map((skill) => {
    const rows = rowsBySkill.get(skill) ?? [];
    const summary = summarizePreferenceRows(rows);
    const perSeed = SEEDS.map((seed) => ({
      seed,
      ...summarizePreferenceRows(rows.filter((row) => row.seed === seed)),
    }));
    return { skill, ...summary, per_seed: perSeed };
  });
  return {
    schema_version: 1,
    kind: "remediation7-paired-preference-aggregate",
    status: "validated-aggregated",
    release_policy: PAIRED_RELEASE_POLICY,
    expected_judgment_count: validation.expected_count,
    completed_judgment_count: validation.validated_count,
    by_skill: bySkill,
  };
}

function blindPacketScaffold(manifest, records) {
  const packets = [];
  const unmaskPackets = [];
  for (const skill of SKILLS) for (const seed of SEEDS) {
    const baseline = records.find((record) => record.job.skill === skill && record.job.requested_seed === seed
      && record.job.lane === "paired" && record.job.run_type === "baseline");
    const upgraded = records.find((record) => record.job.skill === skill && record.job.requested_seed === seed
      && record.job.lane === "paired" && record.job.run_type === "upgraded");
    if (!baseline || !upgraded || !baseline.result || !upgraded.result) continue;
    const packetId = `${skill}-seed${seed}-paired-blind-001`;
    const digest = sha256(`${manifest.revision_id}|${skill}|${seed}`);
    const baselineIsA = Number.parseInt(digest[0], 16) < 8;
    const candidateSource = baselineIsA ? { A: baseline, B: upgraded } : { A: upgraded, B: baseline };
    const packet = {
      schema_version: 1,
      revision_id: manifest.revision_id,
      namespace: manifest.namespace,
      packet_id: packetId,
      skill,
      scenario_id: baseline.job.scenario_id,
      rubric: BLIND_RUBRIC,
      candidates: {
        A: { label: "A", raw_output: candidateSource.A.result.raw_output, raw_output_hash: candidateSource.A.result.raw_output_hash },
        B: { label: "B", raw_output: candidateSource.B.result.raw_output, raw_output_hash: candidateSource.B.result.raw_output_hash },
      },
    };
    const packetPath = `${manifest.namespace}/${BLIND_DIR}/packets/${packetId}.json`;
    packets.push({ packet_id: packetId, path: packetPath, value: packet, sha256: jsonSha256(packet) });
    unmaskPackets.push({
      packet_id: packetId,
      candidates: {
        A: { job_id: candidateSource.A.job.job_id, run_type: candidateSource.A.job.run_type, result_path: candidateSource.A.job.result_path, result_file_sha256: candidateSource.A.result_file_sha256 },
        B: { job_id: candidateSource.B.job.job_id, run_type: candidateSource.B.job.run_type, result_path: candidateSource.B.job.result_path, result_file_sha256: candidateSource.B.result_file_sha256 },
      },
    });
  }
  const unmask = {
    schema_version: 1,
    kind: "private-local-blind-unmask",
    access: "local-audit-only",
    revision_id: manifest.revision_id,
    packets: unmaskPackets,
  };
  const blindManifest = {
    schema_version: 1,
    revision_id: manifest.revision_id,
    namespace: manifest.namespace,
    kind: "paired-preference-blind-scaffold",
    status: "pending-independent-judges",
    source_lane: "paired",
    candidate_pair_count: packets.length,
    expected_judgment_count: packets.length * JUDGE_SLOTS.length,
    completed_judgment_count: 0,
    independent_judge_slots: JUDGE_SLOTS,
    packet_paths: packets.map((packet) => ({ path: packet.path, sha256: packet.sha256 })),
    unmask_path: `${manifest.namespace}/${BLIND_DIR}/private/unmask.json`,
    judge_result_schema_path: `${manifest.namespace}/${BLIND_DIR}/judge-result-schema.json`,
    model_execution_in_package: false,
  };
  return {
    packet_count: packets.length,
    expected_judgment_count: blindManifest.expected_judgment_count,
    completed_judgment_count: 0,
    pending_judgment_count: blindManifest.expected_judgment_count,
    independent_judge_slots: JUDGE_SLOTS,
    packets,
    unmask,
    manifest: blindManifest,
    judge_result_schema: JUDGE_RESULT_SCHEMA,
  };
}

function conciseDiversity(value) {
  return {
    expected_skill_count: value.expected_skill_count,
    evaluated_attempt_count: value.evaluated_attempt_count,
    pass_count: value.pass_count,
    fail_count: value.fail_count,
    failed_skills: value.failed_skills,
    by_skill: value.by_skill.map((item) => ({
      skill: item.skill,
      attempt_count: item.attempt_count,
      overall_pass: item.evaluation.overall_pass,
      semantic_pass: item.evaluation.semantic_pass,
      release_gate_eligible: item.evaluation.release_gate_eligible,
      required_axes: item.evaluation.required_axes ?? [],
      failed_pairs: (item.evaluation.semantic_pair_results ?? []).filter((pair) => !pair.pass).map((pair) => ({ pair: pair.pair, errors: pair.errors })),
      failed_invariants: (item.evaluation.invariant_results ?? []).filter((invariant) => !invariant.pass).map((invariant) => invariant.invariant),
    })),
  };
}

function conciseAntiSlop(value) {
  return {
    expected_result_count: value.expected_result_count,
    evaluated_result_count: value.evaluated_result_count,
    pass_count: value.pass_count,
    fail_count: value.fail_count,
    failed_jobs: value.failed_jobs,
    by_lane_skill: value.by_lane_skill,
  };
}

function publicJudgeValidation(value) {
  return {
    schema_version: value.schema_version,
    kind: value.kind,
    status: value.status,
    pass: value.pass,
    expected_count: value.expected_count,
    found_count: value.found_count,
    validated_count: value.validated_count,
    evidence_verified_count: value.evidence_verified_count,
    failure_count: value.failure_count,
    packet_count: value.packet_count,
    unmask_verified_count: value.unmask_verified_count,
    by_skill: value.by_skill,
    missing: value.missing,
    extras: value.extras,
    global_failures: value.global_failures,
    failures: value.failures,
    rows: value.rows,
  };
}

function antiSlopSkillSummary(antiSlop, skill) {
  const rows = antiSlop.by_lane_skill.filter((item) => item.skill === skill);
  return {
    result_count: rows.reduce((sum, row) => sum + row.result_count, 0),
    pass_count: rows.reduce((sum, row) => sum + row.pass_count, 0),
    fail_count: rows.reduce((sum, row) => sum + row.fail_count, 0),
    release_eligible: rows.length === 2 && rows.every((row) => row.fail_count === 0),
    failed_jobs: rows.flatMap((row) => row.failed_jobs),
  };
}

export function releaseGateSummary(aggregate, diversity, antiSlop, deterministicGates, judgeValidation) {
  const bySkill = SKILLS.map((skill) => {
    const paired = aggregate.by_skill.find((item) => item.skill === skill) ?? {
      paired_release_eligible: false,
      verdict: "blocked",
      judgment_count: 0,
      preference_votes: { upgraded: 0, baseline: 0, tie: 0, abstain: 0 },
    };
    const semantic = diversity.by_skill.find((item) => item.skill === skill);
    const anti = antiSlopSkillSummary(antiSlop, skill);
    const deterministicGate = deterministicGates?.[skill];
    const deterministic = deterministicGate?.applicable === true
      ? { applicable: true, release_eligible: deterministicGate.release_eligible === true, verdict: deterministicGate.verdict }
      : { applicable: false, release_eligible: true, verdict: "not-applicable" };
    const pairedPreferenceRequired = !(deterministic.applicable && deterministic.release_eligible && deterministicGate.preference_lift_required === false);
    const pairedPreference = {
      ...paired,
      required_for_release: pairedPreferenceRequired,
      diagnostic_only: !pairedPreferenceRequired,
    };
    const reasons = [];
    if (judgeValidation.pass !== true) reasons.push("judge_validation_failed");
    if (pairedPreferenceRequired && paired.paired_release_eligible !== true) reasons.push("paired_preference_gate_failed");
    if (semantic?.evaluation?.overall_pass !== true) reasons.push("semantic_diversity_gate_failed");
    if (anti.release_eligible !== true) reasons.push("anti_slop_gate_failed");
    if (deterministic.release_eligible !== true) reasons.push("deterministic_gate_failed");
    return {
      skill,
      paired_preference: pairedPreference,
      semantic_diversity: {
        release_eligible: semantic?.evaluation?.overall_pass === true,
        verdict: semantic?.evaluation?.verdict ?? "blocked",
      },
      anti_slop: anti,
      deterministic_gate: deterministic,
      release_eligible: reasons.length === 0,
      verdict: reasons.length === 0 ? "release-eligible" : "blocked",
      blocking_reasons: reasons,
    };
  });
  const eligible = judgeValidation.pass === true && bySkill.every((item) => item.release_eligible);
  return {
    schema_version: 1,
    kind: "remediation7-release-gate",
    status: eligible ? "release-eligible" : "blocked",
    verdict: eligible ? "release-eligible" : "release-blocked",
    release_eligible: eligible,
    paired_preference_policy: PAIRED_RELEASE_POLICY,
    by_skill: bySkill,
    blocking_skills: bySkill.filter((item) => !item.release_eligible).map((item) => item.skill),
  };
}

export function auditReplay(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const packageCheck = validateReplayPackage(root, { namespace });
  if (!packageCheck.manifest) throw new Error(packageCheck.errors.join("\n"));
  const manifest = packageCheck.manifest;
  const definition = loadReplayDefinition(root);
  const inventory = resultInventory(root, namespace, manifest);
  const records = loadResultRecords(root, manifest);
  const validationReceipts = records.map(resultReceipt);
  const validation = {
    expected_count: inventory.expected_count,
    found_count: inventory.found_count,
    validated_count: records.filter((record) => record.validation_errors.length === 0).length,
    failure_count: records.filter((record) => record.validation_errors.length > 0).length,
    failures: records.filter((record) => record.validation_errors.length > 0).map((record) => ({ job_id: record.job.job_id, errors: record.validation_errors })),
    inventory,
    result_receipts: validationReceipts,
  };
  const fixtureReceipts = fixtureReceiptSummary(root, manifest, records, packageCheck);
  const diversity = diversityReceipt(root, definition, records);
  const antiSlop = antiSlopReceipt(root, records);
  const gateEntry = definition.skills.find((entry) => entry.skill === "tastecheck-pass");
  const gateAttempts = records
    .filter((record) => record.job.skill === "tastecheck-pass" && record.job.lane === "paired" && record.job.run_type === "upgraded")
    .sort((left, right) => left.job.requested_seed - right.job.requested_seed)
    .map((record) => ({
      seed: record.job.requested_seed,
      ...parseTastecheckGateEvidence(record.result?.raw_output ?? "", gateEntry.deterministic_gate),
    }));
  const deterministicGate = evaluateTastecheckGate(gateAttempts, gateEntry.deterministic_gate);
  const blindScaffold = blindPacketScaffold(manifest, records);
  const existingBlindManifestPath = safePath(root, `${namespace}/${BLIND_DIR}/manifest.json`);
  const existingBlindManifest = existingBlindManifestPath && existsSync(existingBlindManifestPath)
    ? readJson(existingBlindManifestPath, `${namespace}/${BLIND_DIR}/manifest.json`)
    : blindScaffold.manifest;
  const blind = { ...blindScaffold, manifest: existingBlindManifest };
  const judgeValidation = validateBlindJudgeCorpus(root, existingBlindManifest);
  const pairedPreferences = aggregateBlindPreferences(root, existingBlindManifest, judgeValidation);
  const deterministicGates = {
    [gateEntry.skill]: { ...deterministicGate, applicable: true },
  };
  const releaseGate = releaseGateSummary(pairedPreferences, diversity, antiSlop, deterministicGates, judgeValidation);
  const blockingReasons = [];
  if (validation.failure_count !== 0 || !inventory.exact) blockingReasons.push("result_validation_not_63_of_63");
  if (diversity.fail_count > 0) blockingReasons.push(`semantic_diversity_failed_for_${diversity.fail_count}_skills`);
  if (antiSlop.fail_count > 0) blockingReasons.push(`anti_slop_failed_for_${antiSlop.fail_count}_results`);
  if (deterministicGate.release_eligible !== true) blockingReasons.push("tastecheck_deterministic_gate_failed");
  if (judgeValidation.pass !== true) blockingReasons.push("independent_judge_validation_failed");
  if (pairedPreferences.status !== "validated-aggregated") blockingReasons.push("paired_preference_aggregation_blocked");
  if (releaseGate.blocking_skills.length > 0) blockingReasons.push(`release_gate_blocked_for_${releaseGate.blocking_skills.length}_skills`);
  blind.judge_validation = judgeValidation;
  blind.judge_validation_receipt = publicJudgeValidation(judgeValidation);
  blind.paired_preferences = pairedPreferences;
  blind.completed_judgment_count = judgeValidation.validated_count;
  blind.pending_judgment_count = Math.max(0, blind.expected_judgment_count - judgeValidation.validated_count);
  blind.manifest = {
    ...blind.manifest,
    status: judgeValidation.pass ? "validated-aggregated" : "blocked-invalid-judges",
    completed_judgment_count: blind.completed_judgment_count,
    pending_judgment_count: blind.pending_judgment_count,
  };
  return {
    schema_version: 1,
    revision_id: manifest.revision_id,
    namespace,
    kind: "remediation7-evaluator-audit",
    package: {
      manifest_path: `${namespace}/manifest.json`,
      manifest_status: manifest.status,
      model_execution_started: manifest.model_execution_started,
      package_errors: packageCheck.errors,
      historical_parent: manifest.historical_parent,
    },
    validation,
    fixture_receipts: fixtureReceipts,
    diversity,
    anti_slop: antiSlop,
    deterministic_gate: deterministicGate,
    blind,
    paired_preferences: pairedPreferences,
    release_gate: releaseGate,
    status: releaseGate.status,
    release_eligible: releaseGate.release_eligible,
    verdict: releaseGate.verdict,
    blocking_reasons: blockingReasons,
    receipt_payloads: {
      validation,
      fixture_receipts: fixtureReceipts,
      diversity,
      anti_slop: antiSlop,
      deterministic_gate: deterministicGate,
      judge_validation: publicJudgeValidation(judgeValidation),
      paired_preferences: pairedPreferences,
      release_gate: releaseGate,
    },
  };
}

function synthesisFor(audit, receiptFiles) {
  return {
    schema_version: 1,
    revision_id: audit.revision_id,
    namespace: audit.namespace,
    kind: "remediation7-judge-synthesis",
    phase: "post-judge",
    status: audit.status,
    release_eligible: audit.release_eligible,
    verdict: audit.verdict,
    source: {
      manifest_path: audit.package.manifest_path,
      manifest_status: audit.package.manifest_status,
      model_execution_started: audit.package.model_execution_started,
      historical_parent: audit.package.historical_parent,
    },
    result_corpus: {
      expected_count: audit.validation.expected_count,
      found_count: audit.validation.found_count,
      validated_count: audit.validation.validated_count,
      failure_count: audit.validation.failure_count,
      exact_inventory: audit.validation.inventory.exact,
    },
    fixture_receipts: {
      artifact_root: audit.fixture_receipts.artifact_root,
      artifact_index_path: audit.fixture_receipts.artifact_index_path,
      artifact_index_sha256: audit.fixture_receipts.artifact_index_sha256,
      expected_fixture_index_entries: audit.fixture_receipts.expected_fixture_index_entries,
      expected_receipt_result_count: audit.fixture_receipts.expected_receipt_result_count,
      verified_receipt_result_count: audit.fixture_receipts.verified_receipt_result_count,
      expected_receipt_count: audit.fixture_receipts.expected_receipt_count,
      verified_receipt_count: audit.fixture_receipts.verified_receipt_count,
      binding_failure_count: audit.fixture_receipts.binding_failures.length,
    },
    semantic_diversity: conciseDiversity(audit.diversity),
    anti_slop: conciseAntiSlop(audit.anti_slop),
    deterministic_tastecheck_gate: {
      release_eligible: audit.deterministic_gate.release_eligible,
      verdict: audit.deterministic_gate.verdict,
      canonical_invariants_preserved: audit.deterministic_gate.canonical_invariants_preserved,
      preference_lift_required: audit.deterministic_gate.preference_lift_required,
      errors: audit.deterministic_gate.errors,
    },
    paired_preference: {
      status: audit.blind.manifest.status,
      packet_count: audit.blind.packet_count,
      expected_judgment_count: audit.blind.expected_judgment_count,
      completed_judgment_count: audit.blind.completed_judgment_count,
      pending_judgment_count: audit.blind.pending_judgment_count,
      independent_judge_slots: audit.blind.independent_judge_slots,
      judge_validation: audit.blind.judge_validation_receipt,
      aggregate: audit.paired_preferences,
      blind_manifest_path: `${audit.namespace}/${BLIND_DIR}/manifest.json`,
      judge_validation_path: `${audit.namespace}/${BLIND_DIR}/judge-validation.json`,
      aggregate_path: `${audit.namespace}/${BLIND_DIR}/paired-aggregate.json`,
      judge_result_schema_path: `${audit.namespace}/${BLIND_DIR}/judge-result-schema.json`,
      no_judges_executed: false,
    },
    release_gate: audit.release_gate,
    receipt_files: receiptFiles,
    blocking_reasons: audit.blocking_reasons,
  };
}

export function writeAudit(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const audit = auditReplay(root, { namespace });
  const evaluatorRoot = safePath(root, `${namespace}/${RECEIPT_DIR}`);
  if (!evaluatorRoot) throw new Error("evaluator receipt root is outside repository");
  const receiptSpecs = [
    ["result-validation.json", audit.receipt_payloads.validation],
    ["fixture-receipts.json", audit.receipt_payloads.fixture_receipts],
    ["diversity.json", audit.receipt_payloads.diversity],
    ["anti-slop.json", audit.receipt_payloads.anti_slop],
    ["tastecheck-gate.json", audit.receipt_payloads.deterministic_gate],
  ];
  for (const [name, value] of receiptSpecs) writeJson(join(evaluatorRoot, name), value);

  const blindRoot = safePath(root, `${namespace}/${BLIND_DIR}`);
  if (!blindRoot) throw new Error("blind receipt root is outside repository");
  for (const packet of audit.blind.packets) {
    const packetPath = safePath(root, packet.path);
    if (!existsSync(packetPath)) writeJson(packetPath, packet.value);
    else if (fileSha256(packetPath) !== packet.sha256) throw new Error(`refusing to overwrite tampered blind packet: ${packet.path}`);
  }
  const unmaskPath = join(blindRoot, "private/unmask.json");
  if (!existsSync(unmaskPath)) writeJson(unmaskPath, audit.blind.unmask);
  const judgeSchemaPath = join(blindRoot, "judge-result-schema.json");
  if (!existsSync(judgeSchemaPath)) writeJson(judgeSchemaPath, audit.blind.judge_result_schema);
  const judgeValidationPath = join(blindRoot, "judge-validation.json");
  const aggregatePath = join(blindRoot, "paired-aggregate.json");
  writeJson(judgeValidationPath, audit.blind.judge_validation_receipt);
  writeJson(aggregatePath, audit.paired_preferences);
  const blindManifest = {
    ...audit.blind.manifest,
    unmask_sha256: fileSha256(unmaskPath),
    judge_result_schema_sha256: fileSha256(judgeSchemaPath),
    judge_validation_path: `${namespace}/${BLIND_DIR}/judge-validation.json`,
    judge_validation_sha256: fileSha256(judgeValidationPath),
    aggregate_path: `${namespace}/${BLIND_DIR}/paired-aggregate.json`,
    aggregate_sha256: fileSha256(aggregatePath),
  };
  writeJson(join(blindRoot, "manifest.json"), blindManifest);

  const receiptFiles = receiptSpecs.map(([name]) => ({
    path: `${namespace}/${RECEIPT_DIR}/${name}`,
    sha256: fileSha256(join(evaluatorRoot, name)),
  }));
  receiptFiles.push(
    { path: `${namespace}/${BLIND_DIR}/manifest.json`, sha256: fileSha256(join(blindRoot, "manifest.json")) },
    { path: `${namespace}/${BLIND_DIR}/judge-validation.json`, sha256: fileSha256(judgeValidationPath) },
    { path: `${namespace}/${BLIND_DIR}/paired-aggregate.json`, sha256: fileSha256(aggregatePath) },
    { path: `${namespace}/${BLIND_DIR}/judge-result-schema.json`, sha256: fileSha256(judgeSchemaPath) },
    { path: `${namespace}/${BLIND_DIR}/private/unmask.json`, sha256: fileSha256(unmaskPath) },
  );
  const synthesis = synthesisFor({ ...audit, blind: { ...audit.blind, manifest: blindManifest } }, receiptFiles);
  const synthesisPath = join(blindRoot, "synthesis.json");
  writeJson(synthesisPath, synthesis);
  return {
    audit,
    synthesis,
    paths: {
      receipts: receiptSpecs.map(([name]) => `${namespace}/${RECEIPT_DIR}/${name}`),
      blind_manifest: `${namespace}/${BLIND_DIR}/manifest.json`,
      judge_validation: `${namespace}/${BLIND_DIR}/judge-validation.json`,
      paired_aggregate: `${namespace}/${BLIND_DIR}/paired-aggregate.json`,
      blind_synthesis: `${namespace}/${BLIND_DIR}/synthesis.json`,
      blind_packets: audit.blind.packets.map((packet) => packet.path),
      unmask: `${namespace}/${BLIND_DIR}/private/unmask.json`,
    },
  };
}

function usage() {
  console.error("Usage: node tools/evals/remediation7-audit.mjs audit [--namespace PATH]");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2];
  const namespaceIndex = process.argv.indexOf("--namespace");
  const namespace = namespaceIndex >= 0 ? process.argv[namespaceIndex + 1] : DEFAULT_NAMESPACE;
  if (command !== "audit") {
    usage();
    process.exitCode = 1;
  } else {
    try {
      const result = writeAudit(ROOT, { namespace });
      console.log(JSON.stringify({
        revision_id: result.audit.revision_id,
        namespace: result.audit.namespace,
        result_count: result.audit.validation.validated_count,
        result_failures: result.audit.validation.failure_count,
        diversity_pass_count: result.audit.diversity.pass_count,
        diversity_fail_count: result.audit.diversity.fail_count,
        anti_slop_pass_count: result.audit.anti_slop.pass_count,
        anti_slop_fail_count: result.audit.anti_slop.fail_count,
        deterministic_gate: result.audit.deterministic_gate.verdict,
        judge_validation: result.audit.blind.judge_validation.status,
        validated_judgment_count: result.audit.blind.judge_validation.validated_count,
        blind_packet_count: result.audit.blind.packet_count,
        pending_judgment_count: result.audit.blind.pending_judgment_count,
        release_gate: result.audit.release_gate.verdict,
        synthesis_path: result.paths.blind_synthesis,
      }, null, 2));
      if (result.audit.validation.failure_count > 0
        || result.audit.diversity.evaluated_attempt_count !== 21
        || result.audit.anti_slop.evaluated_result_count !== 63
        || result.audit.blind.judge_validation.pass !== true) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
