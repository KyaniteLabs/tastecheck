#!/usr/bin/env node
/**
 * Validate the W1 blind-judge corpus.
 *
 * Packets are lane-agnostic candidate material. Each packet has exactly three
 * independent result slots; only a complete, calibrated result may count.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const packetsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-packets");
const resultsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-results");

const PACKET_FIELDS = new Set([
  "schema_version", "packet_id", "evaluator_type", "skill", "scenario_id",
  "prompt_hash", "calibration_ref", "candidates",
]);
const RESULT_BASE_FIELDS = new Set([
  "schema_version", "result_id", "packet_id", "evaluator_type", "judge_id",
  "evaluator_family", "status",
]);
const RESULT_COMPLETE_FIELDS = new Set([
  ...RESULT_BASE_FIELDS, "evaluator_model", "calibration_status", "candidate_scores",
  "score_scale_version", "candidate_evidence", "preference", "deltas", "regression_flags", "pair_analyses",
  "candidate_findings", "verdict", "rationale", "cited_evidence",
]);
const JUDGE_FAMILIES = new Map([["luna-1", "luna"], ["luna-2", "luna"], ["sonnet-1", "sonnet"]]);
const PAIR_DIMENSIONS = [
  "domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline",
];
const CALIBRATION_ITEMS = [
  "cal-001-full-pass/verdict_correct", "cal-001-full-pass/total_within_threshold",
  "cal-002-bare-checkmark/verdict_correct", "cal-002-bare-checkmark/total_within_threshold",
  "cal-003-partial-evidence/verdict_correct", "cal-003-partial-evidence/total_within_threshold",
].sort();
const CUE_FIELDS = new Set([
  "attempt_id", "job_id", "run_type", "source", "version", "lane", "family", "model",
  "executor", "skill_version", "skill_source_path", "external_source_lane",
]);

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function keysEqual(actual, expected) {
  return actual.length === expected.size && actual.every((key) => expected.has(key));
}

function addUnexpectedFields(errors, value, allowed, subject) {
  for (const key of Object.keys(value)) {
    if (CUE_FIELDS.has(key)) errors.push(`${subject} cue leakage: forbidden field "${key}"`);
    if (!allowed.has(key)) errors.push(`${subject} unexpected field: ${key}`);
  }
}

function candidateLabels(type) {
  return type === "paired_lift" ? ["A", "B"] : ["C1", "C2", "C3"];
}

function containsCandidateText(packet, text, labels = Object.keys(packet.candidates ?? {})) {
  return typeof text === "string" && text.length > 0 && labels.some((label) =>
    typeof packet.candidates?.[label]?.raw_output === "string" && packet.candidates[label].raw_output.includes(text)
  );
}

export function validateJudgePacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return { errors: ["packet must be an object"] };
  if (packet.schema_version !== 1) errors.push("packet schema_version must be 1");
  for (const field of PACKET_FIELDS) if (!(field in packet)) errors.push(`packet missing required field: ${field}`);
  addUnexpectedFields(errors, packet, PACKET_FIELDS, "packet");
  if (!["paired_lift", "diversity", "anti_slop"].includes(packet.evaluator_type)) errors.push(`invalid evaluator_type: ${packet.evaluator_type}`);
  if (!/^[0-9a-f]{64}$/.test(packet.prompt_hash ?? "")) errors.push("packet prompt_hash must be a SHA-256 hex string");
  if (!packet.candidates || typeof packet.candidates !== "object" || Array.isArray(packet.candidates)) {
    errors.push("packet candidates must be an object");
    return { errors };
  }
  const labels = candidateLabels(packet.evaluator_type);
  if (!keysEqual(Object.keys(packet.candidates).sort(), new Set(labels))) {
    errors.push(`packet candidates must be exactly ${labels.join(", ")}`);
  }
  for (const [label, candidate] of Object.entries(packet.candidates)) {
    const subject = `candidate ${label}`;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      errors.push(`${subject} must be an object`);
      continue;
    }
    const allowed = new Set(["label", "raw_output", "raw_output_hash"]);
    addUnexpectedFields(errors, candidate, allowed, subject);
    if (!keysEqual(Object.keys(candidate).sort(), allowed)) errors.push(`${subject} must contain only label, raw_output, raw_output_hash`);
    if (candidate.label !== label) errors.push(`${subject} label must equal its opaque key`);
    if (typeof candidate.raw_output !== "string" || candidate.raw_output.length === 0) errors.push(`${subject} raw_output must be non-empty`);
    if (!/^[0-9a-f]{64}$/.test(candidate.raw_output_hash ?? "")) errors.push(`${subject} raw_output_hash must be a SHA-256 hex string`);
    if (typeof candidate.raw_output === "string" && candidate.raw_output_hash && hash(candidate.raw_output) !== candidate.raw_output_hash) {
      errors.push(`${subject} raw_output_hash does not match raw_output`);
    }
  }
  return { errors };
}

function validateCalibration(calibration, errors) {
  if (!calibration || typeof calibration !== "object" || Array.isArray(calibration)) {
    errors.push("complete result missing calibration_status");
    return;
  }
  const expected = new Set(["passed", "items_passed", "items"]);
  if (!keysEqual(Object.keys(calibration).sort(), expected)) errors.push("calibration_status has unexpected or missing fields");
  if (calibration.passed !== true || calibration.items_passed !== 6) errors.push("calibration must pass all six items");
  if (!Array.isArray(calibration.items) || calibration.items.length !== 6) {
    errors.push("calibration must contain exactly six items");
    return;
  }
  const seen = calibration.items.map((item) => `${item?.calibration_id}/${item?.check}`).sort();
  if (JSON.stringify(seen) !== JSON.stringify(CALIBRATION_ITEMS)) errors.push("calibration items must cover each required example/check once");
  if (calibration.items.some((item) => !item || item.passed !== true)) errors.push("calibration contains a failed item");
}

function validatePairedResult(result, packet, errors) {
  const scoreLabels = Object.keys(result.candidate_scores ?? {}).sort();
  if (JSON.stringify(scoreLabels) !== JSON.stringify(["A", "B"])) errors.push("paired result requires A and B candidate_scores");
  for (const label of ["A", "B"]) {
    const scores = result.candidate_scores?.[label];
    const expected = new Set([...PAIR_DIMENSIONS, "total"]);
    if (!scores || !keysEqual(Object.keys(scores).sort(), expected)) {
      errors.push(`paired ${label} scores must contain all rubric dimensions and total`);
      continue;
    }
    const total = PAIR_DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0);
    if (PAIR_DIMENSIONS.some((dimension) => !Number.isInteger(scores[dimension]) || scores[dimension] < 1 || scores[dimension] > 5) || scores.total !== total) {
      errors.push(`paired ${label} scores must use anchored 1-5 integers and an internally consistent total`);
    }
  }
  if (result.score_scale_version !== "anchored-1-5-v1") {
    errors.push("paired result must declare score_scale_version \"anchored-1-5-v1\"");
  }
  for (const label of ["A", "B"]) {
    if (!containsCandidateText(packet, result.candidate_evidence?.[label], [label])) errors.push(`paired ${label} evidence is fabricated or assigned to the wrong candidate`);
  }
  if (!["A", "B", "tie"].includes(result.preference) || !["A_better", "B_better", "tie"].includes(result.verdict)) errors.push("paired preference or verdict is invalid");
  if ((result.preference === "A" && result.verdict !== "A_better") || (result.preference === "B" && result.verdict !== "B_better") || (result.preference === "tie" && result.verdict !== "tie")) errors.push("paired preference and verdict disagree");
  for (const dimension of PAIR_DIMENSIONS) {
    if (result.deltas?.[dimension] !== (result.candidate_scores?.A?.[dimension] - result.candidate_scores?.B?.[dimension])) errors.push(`paired delta for ${dimension} is inconsistent`);
  }
  if (!Array.isArray(result.regression_flags)) {
    errors.push("paired regression_flags must be an array");
  } else {
    for (const flag of result.regression_flags) {
      const expected = new Set(["category", "candidate", "dimension", "delta", "evidence"]);
      if (!flag || !keysEqual(Object.keys(flag).sort(), expected)) {
        errors.push("paired regression flag must contain category, candidate, dimension, delta, and evidence");
        continue;
      }
      if (!["safety", "accessibility", "contract"].includes(flag.category) || !["A", "B"].includes(flag.candidate) || !PAIR_DIMENSIONS.includes(flag.dimension) || !Number.isInteger(flag.delta) || flag.delta >= 0 || !containsCandidateText(packet, flag.evidence, [flag.candidate])) {
        errors.push("paired regression flag must be a candidate-specific safety, accessibility, or contract regression");
      }
    }
  }
}

function validateDiversityResult(result, packet, errors) {
  const pairs = { "C1-C2": ["C1", "C2"], "C1-C3": ["C1", "C3"], "C2-C3": ["C2", "C3"] };
  if (!result.pair_analyses || !keysEqual(Object.keys(result.pair_analyses).sort(), new Set(Object.keys(pairs)))) errors.push("diversity requires exactly C1-C2, C1-C3, C2-C3 analyses");
  for (const [pair, labels] of Object.entries(pairs)) {
    const analysis = result.pair_analyses?.[pair];
    for (const key of ["structural_evidence", "aesthetic_evidence", "voice_evidence"]) {
      if (!containsCandidateText(packet, analysis?.[key], labels)) errors.push(`${pair} ${key} is fabricated or not candidate-specific`);
    }
    for (const key of ["coherence", "usability", "brief_fit", "accessibility", "skill_requirement"]) {
      if (!["pass", "fail"].includes(analysis?.[key])) errors.push(`${pair} ${key} must be pass or fail`);
    }
  }
  if (!["pass", "fail"].includes(result.verdict)) errors.push("diversity verdict must be pass or fail");
}

function validateAntiSlopResult(result, packet, errors) {
  if (!result.candidate_findings || !keysEqual(Object.keys(result.candidate_findings).sort(), new Set(["C1", "C2", "C3"]))) errors.push("anti-slop requires concrete findings for C1, C2, and C3");
  for (const label of ["C1", "C2", "C3"]) {
    const findings = result.candidate_findings?.[label];
    if (!Array.isArray(findings) || findings.length === 0) {
      errors.push(`anti-slop ${label} requires at least one concrete finding`);
      continue;
    }
    for (const finding of findings) {
      if (!finding || typeof finding.type !== "string" || /regex|pattern match/i.test(finding.type) || typeof finding.evidence !== "string" || typeof finding.quote !== "string" || !finding.evidence.includes(finding.quote) || !containsCandidateText(packet, finding.quote, [label])) {
        errors.push(`anti-slop ${label} finding must be candidate-specific evidence, not regex-only`);
      }
    }
  }
  if (!["pass", "fail"].includes(result.verdict)) errors.push("anti-slop verdict must be pass or fail");
}

export function validateJudgeResult(result, packet) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return { errors: ["result must be an object"], complete: false };
  const allowed = result.status === "complete" ? RESULT_COMPLETE_FIELDS : RESULT_BASE_FIELDS;
  for (const field of RESULT_BASE_FIELDS) if (!(field in result)) errors.push(`result missing required field: ${field}`);
  addUnexpectedFields(errors, result, allowed, "result");
  if (result.schema_version !== 1) errors.push("result schema_version must be 1");
  if (!packet) errors.push(`result parent packet not found: ${result.packet_id}`);
  if (packet && (result.packet_id !== packet.packet_id || result.evaluator_type !== packet.evaluator_type)) errors.push("result does not bind to its packet");
  if (!JUDGE_FAMILIES.has(result.judge_id) || JUDGE_FAMILIES.get(result.judge_id) !== result.evaluator_family) errors.push("result judge_id and evaluator_family do not match an approved slot");
  if (result.result_id !== `${result.packet_id}-${result.judge_id}`) errors.push("result_id must equal packet_id-judge_id");
  if (!["pending", "complete"].includes(result.status)) errors.push("result status must be pending or complete");
  if (result.status === "pending") return { errors, complete: false };
  if (typeof result.evaluator_model !== "string" || result.evaluator_model.length === 0) errors.push("complete result requires evaluator_model");
  validateCalibration(result.calibration_status, errors);
  if (!containsCandidateText(packet ?? {}, result.rationale) || !Array.isArray(result.cited_evidence) || result.cited_evidence.length === 0 || result.cited_evidence.some((text) => !containsCandidateText(packet ?? {}, text))) errors.push("result contains fabricated rationale or cited evidence");
  if (packet?.evaluator_type === "paired_lift") validatePairedResult(result, packet, errors);
  if (packet?.evaluator_type === "diversity") validateDiversityResult(result, packet, errors);
  if (packet?.evaluator_type === "anti_slop") validateAntiSlopResult(result, packet, errors);
  return { errors, complete: errors.length === 0 };
}

export function validateJudgeCorpus(packets, results) {
  const errors = [];
  if (packets.length !== 9) errors.push(`corpus must contain exactly 9 packets, got ${packets.length}`);
  if (results.length !== 27) errors.push(`corpus must contain exactly 27 result slots, got ${results.length}`);
  const packetById = new Map();
  for (const packet of packets) {
    if (packetById.has(packet.packet_id)) errors.push(`duplicate packet_id: ${packet.packet_id}`);
    packetById.set(packet.packet_id, packet);
    for (const error of validateJudgePacket(packet).errors) errors.push(`${packet.packet_id}: ${error}`);
  }
  const resultIds = new Set();
  const judgeIdsByPacket = new Map();
  const completedByPacket = new Map();
  for (const result of results) {
    if (resultIds.has(result.result_id)) errors.push(`duplicate result_id: ${result.result_id}`);
    resultIds.add(result.result_id);
    const judgeKey = `${result.packet_id}/${result.judge_id}`;
    if (judgeIdsByPacket.has(judgeKey)) errors.push(`duplicate judge_id: ${judgeKey}`);
    judgeIdsByPacket.set(judgeKey, true);
    const validation = validateJudgeResult(result, packetById.get(result.packet_id));
    for (const error of validation.errors) errors.push(`${result.result_id}: ${error}`);
    if (validation.complete) completedByPacket.set(result.packet_id, [...(completedByPacket.get(result.packet_id) ?? []), result]);
  }
  for (const packet of packets) {
    const slots = results.filter((result) => result.packet_id === packet.packet_id);
    const slotIds = slots.map((result) => result.judge_id).sort();
    if (JSON.stringify(slotIds) !== JSON.stringify([...JUDGE_FAMILIES.keys()].sort())) errors.push(`${packet.packet_id}: must have exactly luna-1, luna-2, sonnet-1 result slots`);
    const complete = completedByPacket.get(packet.packet_id) ?? [];
    if (complete.length !== 3) errors.push(`${packet.packet_id}: quorum requires exactly 3 valid complete results; found ${complete.length}`);
    const families = new Set(complete.map((result) => result.evaluator_family));
    if (complete.length === 3 && families.size < 2) errors.push(`${packet.packet_id}: quorum requires at least two evaluator families`);
  }
  return {
    errors,
    valid_complete_judgments: [...completedByPacket.values()].flat().length,
    synthesized_ready_packets: [...completedByPacket.values()].filter((entries) => entries.length === 3).length,
  };
}

function readJsonDirectory(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")));
}

if (process.argv[1]?.endsWith("validate-judge-packets.mjs")) {
  const corpus = validateJudgeCorpus(readJsonDirectory(packetsDir), readJsonDirectory(resultsDir));
  console.log(JSON.stringify(corpus, null, 2));
  if (corpus.errors.length > 0) process.exit(1);
}
