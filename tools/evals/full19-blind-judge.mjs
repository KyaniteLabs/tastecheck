#!/usr/bin/env node
/**
 * Revision-local blind judge and synthesis scaffold for full19-v1rc.
 *
 * This module packages sealed A/B packets and pending judge slots only. It
 * never executes a model or changes production skill sources/results. Private
 * role mapping is read only by synthesis after all 171 valid judgments exist.
 */
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateResultSet } from "./full19-replay.mjs";
import { evaluateDiversity } from "./evaluators/diversity.mjs";
import { evaluateAntiSlop } from "./evaluators/anti-slop.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REVISION_ID = "full19-v1rc-2026-07-11";
export const NAMESPACE = `evals/replays/${REVISION_ID}`;
export const BLIND_NAMESPACE = `${NAMESPACE}/blind-judge`;
export const PACKET_DIR = `${BLIND_NAMESPACE}/packets`;
export const RESULT_DIR = `${BLIND_NAMESPACE}/results`;
export const PRIVATE_DIR = `${BLIND_NAMESPACE}/private`;
export const UNMASK_PATH = `${PRIVATE_DIR}/unmask.json`;
export const GROUP_MATRIX_PATH = `${BLIND_NAMESPACE}/group-matrix.json`;
export const JUDGE_RESULT_SCHEMA_PATH = `${BLIND_NAMESPACE}/judge-result-schema.json`;
export const SYNTHESIS_PATH = `${BLIND_NAMESPACE}/synthesis.json`;
export const AGGREGATE_PATH = `${BLIND_NAMESPACE}/aggregate.json`;
export const MANIFEST_PATH = `${NAMESPACE}/manifest.json`;

export const SKILLS = [
  "a11y-pass", "art-direction", "cognitive-a11y", "color-system", "component-states",
  "data-viz", "design-system-interview", "deslop-ui", "empty-states", "form-ux",
  "humanize-copy", "i18n-ready", "improve-existing-website", "micro-motion", "responsive-layout",
  "spacing-system", "tastecheck-pass", "theming", "web-typography",
];
export const SEEDS = [101, 202, 303];
export const JUDGES = [
  { judge_id: "judge-luna-1", evaluator_family: "luna", dispatch_mode: "thread-per-group" },
  { judge_id: "judge-luna-2", evaluator_family: "luna", dispatch_mode: "thread-per-group" },
  { judge_id: "judge-sonnet", evaluator_family: "sonnet", dispatch_mode: "direct-call-per-group" },
];
export const DIMENSIONS = ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"];
export const CALIBRATION_ITEMS = [
  ["cal-01-anchor-literalism", "rubric anchors applied"],
  ["cal-02-evidence-substring", "evidence copied verbatim"],
  ["cal-03-blind-independence", "candidate identity not inferred"],
  ["cal-04-fail-closed-scan", "all required evidence fields checked"],
  ["cal-05-scope-boundary-check", "scope and handoff boundary checked"],
  ["cal-06-delta-consistency", "scores deltas and verdict agree"],
];

const CUE_FIELDS = new Set([
  "attempt_id", "job_id", "run_type", "source", "version", "lane", "family", "model", "executor",
  "skill_version", "skill_source_path", "external_source_lane", "requested_seed", "seed",
]);
const PACKET_FIELDS = new Set(["schema_version", "revision_id", "namespace", "packet_id", "skill", "scenario_id", "rubric", "binding", "candidates"]);
const PACKET_BINDING_FIELDS = new Set([
  "packet_hash", "baseline_result_sha256", "baseline_output_sha256", "upgraded_result_sha256", "upgraded_output_sha256",
  "baseline_source_sha256", "upgraded_source_sha256", "scenario_sha256", "contract_sha256",
]);
const CANDIDATE_FIELDS = new Set(["label", "raw_output", "raw_output_hash"]);
const SLOT_BINDING_FIELDS = [
  "baseline_result_sha256", "baseline_output_sha256", "upgraded_result_sha256", "upgraded_output_sha256",
  "source_sha256", "scenario_sha256", "contract_sha256",
];
const PENDING_RESULT_FIELDS = new Set([
  "schema_version", "revision_id", "namespace", "result_id", "packet_id", "packet_path", "packet_sha256", "result_path",
  "evaluator_type", "judge_id", "evaluator_family", "status", ...SLOT_BINDING_FIELDS,
]);
const COMPLETE_RESULT_FIELDS = new Set([
  ...PENDING_RESULT_FIELDS,
  "evaluator_model", "calibration_status", "candidate_scores", "score_scale_version",
  "candidate_evidence", "preference", "deltas", "regression_flags", "verdict", "rationale", "cited_evidence",
]);
const REGRESSION_FIELDS = new Set(["category", "candidate", "dimension", "delta", "evidence"]);
const ALLOWED_REGRESSION_CATEGORIES = new Set(["safety", "accessibility", "contract"]);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function fileSha256(path) { return sha256(readFileSync(path)); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function readJson(path, label = path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`${label}: invalid JSON (${error.message})`); }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
function repoPath(root, relPath) {
  if (typeof relPath !== "string" || relPath.startsWith("/") || relPath.split("/").includes("..")) return null;
  const absolute = resolve(root, relPath);
  const base = resolve(root);
  return absolute === base || absolute.startsWith(`${base}/`) ? absolute : null;
}
function under(relPath, prefix) { return relPath === prefix || relPath.startsWith(`${prefix}/`); }
function exactKeys(value, allowed, subject, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${subject} must be an object`); return; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${subject} unexpected field ${key}`);
  for (const key of allowed) if (!(key in value)) errors.push(`${subject} missing field ${key}`);
}
function loadManifest(root) { return readJson(join(root, MANIFEST_PATH), MANIFEST_PATH); }
function loadRubric(root) { return readJson(join(root, "evals/w1/rubric/anchored-rubric.json"), "anchored rubric"); }
function jobFor(manifest, skill, runType, seed) { return manifest.jobs?.find((job) => job.skill === skill && job.run_type === runType && job.requested_seed === seed); }
function resultFor(root, manifest, job) {
  const path = repoPath(root, job?.result_path);
  if (!path || !existsSync(path)) throw new Error(`missing full19 result ${job?.result_path ?? "unknown"}`);
  const result = readJson(path, job.result_path);
  if (result.job_id !== job.job_id || result.raw_output_hash !== sha256(result.raw_output ?? "")) throw new Error(`full19 result binding drift for ${job.job_id}`);
  return { job, result, path };
}
function deterministicSwap(skill, seed) { return Number.parseInt(sha256(`${REVISION_ID}:${skill}:seed${seed}:A-B`)[0], 16) % 2 === 0; }
function packetHashInput(packet) { const { packet_hash: _ignored, ...binding } = packet.binding; return { ...packet, binding }; }
function packetId(skill, seed) { return `${skill}-seed${seed}-paired-blind-001`; }

function makePacket(root, manifest, rubric, skill, seed) {
  const baseline = resultFor(root, manifest, jobFor(manifest, skill, "baseline", 101));
  const upgraded = resultFor(root, manifest, jobFor(manifest, skill, "upgraded", seed));
  const swapped = deterministicSwap(skill, seed);
  const candidates = swapped
    ? { A: { label: "A", raw_output: upgraded.result.raw_output, raw_output_hash: upgraded.result.raw_output_hash }, B: { label: "B", raw_output: baseline.result.raw_output, raw_output_hash: baseline.result.raw_output_hash } }
    : { A: { label: "A", raw_output: baseline.result.raw_output, raw_output_hash: baseline.result.raw_output_hash }, B: { label: "B", raw_output: upgraded.result.raw_output, raw_output_hash: upgraded.result.raw_output_hash } };
  const binding = {
    baseline_result_sha256: fileSha256(baseline.path),
    baseline_output_sha256: baseline.result.raw_output_hash,
    upgraded_result_sha256: fileSha256(upgraded.path),
    upgraded_output_sha256: upgraded.result.raw_output_hash,
    baseline_source_sha256: baseline.job.skill_source_sha256,
    upgraded_source_sha256: upgraded.job.skill_source_sha256,
    scenario_sha256: upgraded.job.scenario_registry_entry_sha256,
    contract_sha256: upgraded.job.contract_projection_sha256,
  };
  const packetWithoutHash = {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    packet_id: packetId(skill, seed),
    skill,
    scenario_id: upgraded.job.scenario_id,
    rubric,
    binding: { ...binding, packet_hash: null },
    candidates,
  };
  const packetHash = sha256(stable(packetHashInput(packetWithoutHash)));
  const mapping = swapped
    ? { A: { role: "upgraded", seed, result_hash: candidates.A.raw_output_hash }, B: { role: "baseline", seed: 101, result_hash: candidates.B.raw_output_hash } }
    : { A: { role: "baseline", seed: 101, result_hash: candidates.A.raw_output_hash }, B: { role: "upgraded", seed, result_hash: candidates.B.raw_output_hash } };
  return { packet: { ...packetWithoutHash, binding: { ...binding, packet_hash: packetHash } }, mapping, binding, skill, seed };
}

function slotFor(packetEntry, packet, judge, resultPath) {
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    result_id: `${packet.packet_id}-${judge.judge_id}`,
    packet_id: packet.packet_id,
    packet_path: packetEntry.packet_path,
    packet_sha256: packetEntry.packet_sha256,
    result_path: resultPath,
    evaluator_type: "paired_lift",
    judge_id: judge.judge_id,
    evaluator_family: judge.evaluator_family,
    status: "pending",
    baseline_result_sha256: packet.binding.baseline_result_sha256,
    baseline_output_sha256: packet.binding.baseline_output_sha256,
    upgraded_result_sha256: packet.binding.upgraded_result_sha256,
    upgraded_output_sha256: packet.binding.upgraded_output_sha256,
    source_sha256: packet.binding.upgraded_source_sha256,
    scenario_sha256: packet.binding.scenario_sha256,
    contract_sha256: packet.binding.contract_sha256,
  };
}

function expectedGroupSkills() { return [0, 5, 10, 15].map((start, index) => ({ group_id: `full19-judge-group-${index + 1}`, ordinal: index + 1, skills: SKILLS.slice(start, start + (index === 3 ? 4 : 5)) })); }

function makeGroupMatrix(packets, slots) {
  const byPacket = new Map(packets.map((packet) => [packet.packet_id, packet]));
  const bySlot = new Map(slots.map((slot) => [slot.result_id, slot]));
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    status: "sealed-pending",
    group_sizes: [5, 5, 5, 4],
    groups: expectedGroupSkills().map((group) => {
      const groupPackets = [...byPacket.values()].filter((packet) => group.skills.includes(packet.skill));
      return {
        ...group,
        packet_reads: groupPackets.map((packet) => packet.packet_path),
        exact_packet_read_count: groupPackets.length,
        result_writes: Object.fromEntries(JUDGES.map((judge) => [judge.judge_id, slots.filter((slot) => groupPackets.some((packet) => packet.packet_id === slot.packet_id) && slot.judge_id === judge.judge_id).map((slot) => slot.result_path)])),
        exact_result_write_counts: Object.fromEntries(JUDGES.map((judge) => [judge.judge_id, slots.filter((slot) => groupPackets.some((packet) => packet.packet_id === slot.packet_id) && slot.judge_id === judge.judge_id).length])),
        lane_dispatch: Object.fromEntries(JUDGES.map((judge) => [judge.judge_id, { evaluator_family: judge.evaluator_family, dispatch_mode: judge.dispatch_mode, no_unmask_access: true }])),
      };
    }),
  };
}

function judgeResultSchema() {
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    evaluator_type: "paired_lift",
    pending_required_fields: [...PENDING_RESULT_FIELDS],
    complete_required_fields: [...COMPLETE_RESULT_FIELDS],
    dimensions: DIMENSIONS,
    score_scale: { version: "anchored-1-5-v1", minimum: 1, maximum: 5, total: "sum of five dimensions" },
    calibration: { required: true, passed: true, items_passed: 6, items: CALIBRATION_ITEMS.map(([calibration_id, check]) => ({ calibration_id, check, passed: true })) },
    regression_flags: { allowed_categories: [...ALLOWED_REGRESSION_CATEGORIES], allowed_candidates: ["A", "B"], delta: "negative integer", evidence: "exact substring from candidate output" },
    evidence: { candidate_evidence: "exact substring from matching A/B output", rationale: "must contain both candidate excerpts", cited_evidence: "at least one exact substring from each candidate" },
  };
}

function strictResultPaths(root) {
  const dir = repoPath(root, `${NAMESPACE}/results`);
  if (!dir || !existsSync(dir)) throw new Error("full19 results directory is missing");
  const names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  if (names.length !== 76) throw new Error(`full19 strict result gate requires exactly 76 result files; found ${names.length}`);
  return names.map((name) => `${NAMESPACE}/results/${name}`);
}

function assertStrictFull19Results(root) {
  const checked = validateResultSet(root, strictResultPaths(root));
  if (checked.errors.length > 0) throw new Error(`full19 blind build blocked by strict 76-result validation:\n${checked.errors.map((error) => `- ${error}`).join("\n")}`);
  return checked.results;
}

export function buildBlindCorpus(root = ROOT) {
  const manifest = loadManifest(root);
  if (manifest.revision_id !== REVISION_ID || manifest.namespace !== NAMESPACE) throw new Error("wrong full19 replay revision or namespace");
  assertStrictFull19Results(root);
  const rubric = loadRubric(root);
  rmSync(join(root, BLIND_NAMESPACE), { recursive: true, force: true });
  const packets = [];
  const slots = [];
  const unmask = { schema_version: 1, private: true, revision_id: REVISION_ID, namespace: NAMESPACE, packets: {} };
  for (const skill of SKILLS) for (const seed of SEEDS) {
    const made = makePacket(root, manifest, rubric, skill, seed);
    const path = `${PACKET_DIR}/${made.packet.packet_id}.json`;
    writeJson(join(root, path), made.packet);
    const packetEntry = {
      packet_id: made.packet.packet_id,
      packet_path: path,
      packet_sha256: fileSha256(join(root, path)),
      packet_hash: made.packet.binding.packet_hash,
      skill,
      seed,
      ...made.binding,
    };
    packets.push(packetEntry);
    unmask.packets[made.packet.packet_id] = made.mapping;
    for (const judge of JUDGES) {
      const resultPath = `${RESULT_DIR}/${judge.judge_id}/${made.packet.packet_id}-${judge.judge_id}.json`;
      const slot = slotFor(packetEntry, made.packet, judge, resultPath);
      writeJson(join(root, resultPath), slot);
      slots.push(slot);
    }
  }
  writeJson(join(root, UNMASK_PATH), unmask);
  const groupMatrix = makeGroupMatrix(packets, slots);
  writeJson(join(root, GROUP_MATRIX_PATH), groupMatrix);
  writeJson(join(root, JUDGE_RESULT_SCHEMA_PATH), judgeResultSchema());
  const blindJudge = {
    schema_version: 1,
    status: "pending",
    packet_count: 57,
    result_slot_count: 171,
    packet_dir: PACKET_DIR,
    result_dir: RESULT_DIR,
    private_unmask_path: UNMASK_PATH,
    group_matrix_path: GROUP_MATRIX_PATH,
    judge_result_schema_path: JUDGE_RESULT_SCHEMA_PATH,
    synthesis_path: SYNTHESIS_PATH,
    aggregate_path: AGGREGATE_PATH,
    judge_lanes: JUDGES.map((judge) => `${RESULT_DIR}/${judge.judge_id}`),
    packets,
    result_slots: slots,
    groups: groupMatrix.groups.map(({ group_id, ordinal, skills, packet_reads, result_writes, exact_packet_read_count, exact_result_write_counts }) => ({ group_id, ordinal, skills, packet_reads, result_writes, exact_packet_read_count, exact_result_write_counts })),
  };
  writeJson(join(root, MANIFEST_PATH), { ...manifest, blind_judge: blindJudge });
  return { revision_id: REVISION_ID, packet_paths: packets.map((packet) => packet.packet_path), result_paths: slots.map((slot) => slot.result_path), unmask_path: UNMASK_PATH, group_matrix_path: GROUP_MATRIX_PATH };
}

function validatePacket(root, manifest, entry, rubric, errors) {
  const path = repoPath(root, entry.packet_path);
  if (!path || !under(entry.packet_path, PACKET_DIR) || !existsSync(path)) { errors.push(`${entry.packet_id}: packet missing or outside revision namespace`); return null; }
  if (fileSha256(path) !== entry.packet_sha256) errors.push(`${entry.packet_id}: packet file hash mismatch`);
  const packet = readJson(path, entry.packet_path);
  exactKeys(packet, PACKET_FIELDS, `${entry.packet_id} packet`, errors);
  if (packet.revision_id !== REVISION_ID || packet.namespace !== NAMESPACE || packet.packet_id !== entry.packet_id) errors.push(`${entry.packet_id}: packet revision/namespace/id mismatch`);
  if (packet.skill !== entry.skill || !SKILLS.includes(packet.skill) || packet.scenario_id !== jobFor(manifest, entry.skill, "upgraded", entry.seed)?.scenario_id) errors.push(`${entry.packet_id}: packet scenario binding mismatch`);
  if (JSON.stringify(packet.rubric) !== JSON.stringify(rubric)) errors.push(`${entry.packet_id}: rubric drift`);
  exactKeys(packet.binding, PACKET_BINDING_FIELDS, `${entry.packet_id} binding`, errors);
  const recomputed = sha256(stable(packetHashInput(packet)));
  if (packet.binding.packet_hash !== recomputed || packet.binding.packet_hash !== entry.packet_hash) errors.push(`${entry.packet_id}: packet hash binding mismatch`);
  const baseline = resultFor(root, manifest, jobFor(manifest, entry.skill, "baseline", 101));
  const upgraded = resultFor(root, manifest, jobFor(manifest, entry.skill, "upgraded", entry.seed));
  const expected = {
    baseline_result_sha256: fileSha256(baseline.path), baseline_output_sha256: baseline.result.raw_output_hash,
    upgraded_result_sha256: fileSha256(upgraded.path), upgraded_output_sha256: upgraded.result.raw_output_hash,
    baseline_source_sha256: baseline.job.skill_source_sha256, upgraded_source_sha256: upgraded.job.skill_source_sha256,
    scenario_sha256: upgraded.job.scenario_registry_entry_sha256, contract_sha256: upgraded.job.contract_projection_sha256,
  };
  for (const [key, value] of Object.entries(expected)) if (packet.binding[key] !== value || entry[key] !== value) errors.push(`${entry.packet_id}: ${key} binding mismatch`);
  if (JSON.stringify(Object.keys(packet.candidates ?? {}).sort()) !== JSON.stringify(["A", "B"])) errors.push(`${entry.packet_id}: candidates must be exactly A and B`);
  for (const label of ["A", "B"]) {
    const candidate = packet.candidates?.[label];
    exactKeys(candidate, CANDIDATE_FIELDS, `${entry.packet_id} candidate ${label}`, errors);
    if (candidate?.label !== label || typeof candidate?.raw_output !== "string" || candidate.raw_output.length === 0) errors.push(`${entry.packet_id} candidate ${label}: exact output text missing`);
    if (candidate?.raw_output_hash !== sha256(candidate?.raw_output ?? "")) errors.push(`${entry.packet_id} candidate ${label}: output hash mismatch`);
    for (const key of Object.keys(candidate ?? {})) if (CUE_FIELDS.has(key)) errors.push(`${entry.packet_id} candidate ${label}: candidate identity cue ${key}`);
  }
  return packet;
}

function containsExact(packet, citation, label) { return typeof citation === "string" && citation.length > 0 && packet.candidates?.[label]?.raw_output.includes(citation); }
function validateCalibration(value, subject, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["items", "items_passed", "passed"])) { errors.push(`${subject}: calibration structure is malformed`); return; }
  if (value.passed !== true || value.items_passed !== 6 || !Array.isArray(value.items) || value.items.length !== 6) { errors.push(`${subject}: calibration must pass exactly six items`); return; }
  const ids = value.items.map((item) => item?.calibration_id);
  if (JSON.stringify(ids) !== JSON.stringify(CALIBRATION_ITEMS.map(([id]) => id))) errors.push(`${subject}: calibration ids are incomplete or out of order`);
  value.items.forEach((item, index) => {
    if (!item || JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(["calibration_id", "check", "passed"]) || item.calibration_id !== CALIBRATION_ITEMS[index]?.[0] || typeof item.check !== "string" || item.passed !== true) errors.push(`${subject}: calibration item ${index + 1} is malformed`);
  });
}
function validateScores(value, label, subject, errors) {
  const expectedKeys = [...DIMENSIONS, "total"].sort();
  if (!value || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expectedKeys)) { errors.push(`${subject}: ${label} score object is malformed`); return; }
  if (DIMENSIONS.some((dimension) => !Number.isInteger(value[dimension]) || value[dimension] < 1 || value[dimension] > 5) || value.total !== DIMENSIONS.reduce((sum, dimension) => sum + value[dimension], 0)) errors.push(`${subject}: invalid ${label} scores or total`);
}
function validateCompleteResult(result, packet, errors) {
  exactKeys(result, COMPLETE_RESULT_FIELDS, `${result.result_id} result`, errors);
  validateCalibration(result.calibration_status, result.result_id, errors);
  if (typeof result.evaluator_model !== "string" || result.evaluator_model.length === 0) errors.push(`${result.result_id}: evaluator_model required`);
  if (result.score_scale_version !== "anchored-1-5-v1") errors.push(`${result.result_id}: score scale mismatch`);
  if (!result.candidate_scores || JSON.stringify(Object.keys(result.candidate_scores).sort()) !== JSON.stringify(["A", "B"])) errors.push(`${result.result_id}: candidate_scores must contain A and B`);
  for (const label of ["A", "B"]) { validateScores(result.candidate_scores?.[label], label, result.result_id, errors); if (!containsExact(packet, result.candidate_evidence?.[label], label)) errors.push(`${result.result_id}: ${label} evidence is not an exact substring`); }
  if (!result.candidate_evidence || JSON.stringify(Object.keys(result.candidate_evidence).sort()) !== JSON.stringify(["A", "B"])) errors.push(`${result.result_id}: candidate_evidence must contain A and B`);
  const scoresA = result.candidate_scores?.A;
  const scoresB = result.candidate_scores?.B;
  if (!result.deltas || !scoresA || !scoresB || JSON.stringify(Object.keys(result.deltas).sort()) !== JSON.stringify(DIMENSIONS.slice().sort()) || DIMENSIONS.some((dimension) => result.deltas[dimension] !== scoresA[dimension] - scoresB[dimension])) errors.push(`${result.result_id}: score deltas are inconsistent`);
  if (!(["A", "B", "tie"].includes(result.preference) && ["A_better", "B_better", "tie"].includes(result.verdict))) errors.push(`${result.result_id}: score/verdict fields invalid`);
  if ((result.preference === "A" && result.verdict !== "A_better") || (result.preference === "B" && result.verdict !== "B_better") || (result.preference === "tie" && result.verdict !== "tie")) errors.push(`${result.result_id}: preference/verdict disagreement`);
  if (typeof result.rationale !== "string" || !result.rationale.includes(result.candidate_evidence?.A ?? "") || !result.rationale.includes(result.candidate_evidence?.B ?? "")) errors.push(`${result.result_id}: rationale must contain exact excerpts from both candidates`);
  if (!Array.isArray(result.cited_evidence) || result.cited_evidence.length < 2 || !result.cited_evidence.some((citation) => containsExact(packet, citation, "A")) || !result.cited_evidence.some((citation) => containsExact(packet, citation, "B"))) errors.push(`${result.result_id}: cited_evidence must contain exact substrings from both candidates`);
  if (!Array.isArray(result.regression_flags)) errors.push(`${result.result_id}: regression_flags must be an array`);
  else for (const flag of result.regression_flags) {
    exactKeys(flag, REGRESSION_FIELDS, `${result.result_id} regression flag`, errors);
    if (!ALLOWED_REGRESSION_CATEGORIES.has(flag?.category) || !["A", "B"].includes(flag?.candidate) || !DIMENSIONS.includes(flag?.dimension) || !Number.isInteger(flag?.delta) || flag.delta >= 0 || !containsExact(packet, flag?.evidence, flag?.candidate)) errors.push(`${result.result_id}: invalid regression flag`);
  }
}

function validateSlot(result, packet, entry, errors, requireComplete) {
  if (!result) return;
  exactKeys(result, result.status === "complete" ? COMPLETE_RESULT_FIELDS : PENDING_RESULT_FIELDS, `${entry.result_id} result`, errors);
  if (result.schema_version !== 1 || result.revision_id !== REVISION_ID || result.namespace !== NAMESPACE) errors.push(`${entry.result_id}: cross-revision binding`);
  for (const key of ["result_id", "packet_id", "packet_path", "packet_sha256", "result_path", "evaluator_type", "judge_id", "evaluator_family", ...SLOT_BINDING_FIELDS]) if (result[key] !== entry[key]) errors.push(`${entry.result_id}: slot ${key} binding mismatch`);
  if (!JUDGES.some((judge) => judge.judge_id === result.judge_id && judge.evaluator_family === result.evaluator_family)) errors.push(`${entry.result_id}: unapproved judge lane`);
  if (!["pending", "complete"].includes(result.status)) errors.push(`${entry.result_id}: invalid status`);
  if (result.status === "pending") { if (requireComplete) errors.push(`${entry.result_id}: pending slot blocks complete corpus`); return; }
  validateCompleteResult(result, packet, errors);
}

function validateGroups(root, section, packetEntries, slots, errors) {
  const matrixPath = repoPath(root, section?.group_matrix_path);
  if (!matrixPath || !existsSync(matrixPath)) { errors.push("sealed group matrix is missing"); return; }
  const matrix = readJson(matrixPath, section.group_matrix_path);
  if (matrix.revision_id !== REVISION_ID || matrix.namespace !== NAMESPACE || JSON.stringify(matrix.group_sizes) !== JSON.stringify([5, 5, 5, 4]) || matrix.groups?.length !== 4) errors.push("group matrix revision/count binding is invalid");
  for (const [index, group] of (matrix.groups ?? []).entries()) {
    const expected = expectedGroupSkills()[index];
    if (!expected || JSON.stringify(group.skills) !== JSON.stringify(expected.skills) || group.packet_reads?.length !== expected.skills.length * 3) errors.push(`group ${index + 1}: skill or packet read partition drift`);
    for (const path of group.packet_reads ?? []) if (!packetEntries.some((packet) => packet.packet_path === path)) errors.push(`group ${index + 1}: packet read is not an exact sealed packet`);
    for (const judge of JUDGES) {
      const writes = group.result_writes?.[judge.judge_id] ?? [];
      if (writes.length !== expected.skills.length * 3) errors.push(`group ${index + 1}: ${judge.judge_id} write count drift`);
      for (const path of writes) if (!slots.some((slot) => slot.result_path === path && slot.judge_id === judge.judge_id)) errors.push(`group ${index + 1}: invalid ${judge.judge_id} write`);
    }
  }
}

function revisionJsonFiles(root, relDir) {
  const absolute = repoPath(root, relDir);
  if (!absolute || !existsSync(absolute)) return [];
  const files = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(directory, entry.name), rel);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(rel);
    }
  };
  walk(absolute, relDir);
  return files;
}

export function validateBlindCorpus(root = ROOT, { requireComplete = false } = {}) {
  const errors = [];
  let manifest;
  try { manifest = loadManifest(root); } catch (error) { return { errors: [error.message], packet_count: 0, slot_count: 0, complete_count: 0 }; }
  const section = manifest.blind_judge;
  if (manifest.revision_id !== REVISION_ID || manifest.namespace !== NAMESPACE) errors.push("manifest revision or namespace mismatch");
  if (!section || section.schema_version !== 1 || section.packet_count !== 57 || section.result_slot_count !== 171) errors.push("blind-judge manifest counts/schema are invalid");
  const schemaPath = repoPath(root, section?.judge_result_schema_path);
  if (!schemaPath || !existsSync(schemaPath) || readJson(schemaPath, section.judge_result_schema_path).revision_id !== REVISION_ID) errors.push("judge result schema is missing or cross-revision");
  const packetEntries = section?.packets ?? [];
  const slotEntries = section?.result_slots ?? [];
  if (packetEntries.length !== 57) errors.push(`blind corpus must contain exactly 57 packet entries; got ${packetEntries.length}`);
  if (slotEntries.length !== 171) errors.push(`blind corpus must contain exactly 171 result entries; got ${slotEntries.length}`);
  const packets = new Map();
  for (const entry of packetEntries) { if (packets.has(entry.packet_id)) errors.push(`duplicate packet_id ${entry.packet_id}`); const packet = validatePacket(root, manifest, entry, loadRubric(root), errors); if (packet) packets.set(entry.packet_id, packet); }
  const packetFiles = revisionJsonFiles(root, PACKET_DIR);
  if (packetFiles.length !== 57) errors.push(`blind corpus must contain exactly 57 packet files; found ${packetFiles.length}`);
  const expectedPacketPaths = new Set(packetEntries.map((entry) => entry.packet_path));
  for (const path of packetFiles) if (!expectedPacketPaths.has(path)) errors.push(`unexpected packet file ${path}`);
  const resultFiles = revisionJsonFiles(root, RESULT_DIR);
  if (resultFiles.length !== 171) errors.push(`blind corpus must contain exactly 171 result files; found ${resultFiles.length}`);
  const expectedResultPaths = new Set(slotEntries.map((entry) => entry.result_path));
  for (const path of resultFiles) if (!expectedResultPaths.has(path)) errors.push(`unexpected result file ${path}`);
  const resultIds = new Set();
  let completeCount = 0;
  for (const entry of slotEntries) {
    if (resultIds.has(entry.result_id)) errors.push(`duplicate result_id ${entry.result_id}`);
    resultIds.add(entry.result_id);
    const path = repoPath(root, entry.result_path);
    if (!path || !under(entry.result_path, RESULT_DIR) || !existsSync(path)) { errors.push(`${entry.result_id}: missing result slot`); continue; }
    let result; try { result = readJson(path, entry.result_path); } catch (error) { errors.push(error.message); continue; }
    const packet = packets.get(entry.packet_id);
    if (!packet) errors.push(`${entry.result_id}: parent packet missing`);
    validateSlot(result, packet, entry, errors, requireComplete);
    if (result.status === "complete" && !errors.some((error) => error.startsWith(`${entry.result_id}:`))) completeCount++;
  }
  validateGroups(root, section, packetEntries, slotEntries, errors);
  if (requireComplete && completeCount !== 171) errors.push(`complete corpus requires exactly 171 valid complete judgments; found ${completeCount}`);
  return { errors, packet_count: packets.size, slot_count: slotEntries.length, complete_count: completeCount, packets: [...packets.values()], slots: slotEntries };
}

function validateUnmask(root, corpus) {
  const errors = [];
  const path = repoPath(root, UNMASK_PATH);
  if (!path || !existsSync(path)) return ["private unmask file is missing"];
  const unmask = readJson(path, UNMASK_PATH);
  if (unmask.private !== true || unmask.revision_id !== REVISION_ID || unmask.namespace !== NAMESPACE) errors.push("private unmask revision/private binding is invalid");
  const ids = Object.keys(unmask.packets ?? {}).sort();
  if (JSON.stringify(ids) !== JSON.stringify(corpus.packets.map((packet) => packet.packet_id).sort())) errors.push("private unmask packet ids do not exactly match sealed packets");
  for (const packet of corpus.packets) {
    const mapping = unmask.packets?.[packet.packet_id];
    if (!mapping || JSON.stringify(Object.keys(mapping).sort()) !== JSON.stringify(["A", "B"])) { errors.push(`${packet.packet_id}: private mapping is malformed`); continue; }
    const packetSeed = Number.parseInt(packet.packet_id.match(/-seed(\d+)-/)?.[1] ?? "NaN", 10);
    if (new Set([mapping.A.role, mapping.B.role]).size !== 2 || !["baseline", "upgraded"].includes(mapping.A.role) || !["baseline", "upgraded"].includes(mapping.B.role)) errors.push(`${packet.packet_id}: unmask roles are invalid`);
    for (const label of ["A", "B"]) {
      if (JSON.stringify(Object.keys(mapping[label] ?? {}).sort()) !== JSON.stringify(["result_hash", "role", "seed"])) errors.push(`${packet.packet_id}: unmask entry shape is invalid`);
      const expectedSeed = mapping[label]?.role === "baseline" ? 101 : packetSeed;
      if (mapping[label]?.result_hash !== packet.candidates[label].raw_output_hash || mapping[label]?.seed !== expectedSeed) errors.push(`${packet.packet_id}: unmask hash/seed binding is invalid`);
    }
  }
  return errors;
}

function synthesizeSkill(skill, packets, results, unmask) {
  const judgments = results.filter((result) => packets.some((packet) => packet.packet_id === result.packet_id && packet.skill === skill));
  const deltas = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
  const votes = { upgraded: 0, baseline: 0, tie: 0 };
  const hardRegressionFlags = [];
  for (const packet of packets.filter((entry) => entry.skill === skill)) {
    const mapping = unmask.packets[packet.packet_id];
    const upgradedLabel = mapping.A.role === "upgraded" ? "A" : "B";
    const baselineLabel = upgradedLabel === "A" ? "B" : "A";
    for (const result of judgments.filter((entry) => entry.packet_id === packet.packet_id)) {
      for (const dimension of DIMENSIONS) deltas[dimension] += result.candidate_scores[upgradedLabel][dimension] - result.candidate_scores[baselineLabel][dimension];
      if (result.preference === upgradedLabel) votes.upgraded++; else if (result.preference === baselineLabel) votes.baseline++; else votes.tie++;
      for (const flag of result.regression_flags) if (flag.candidate === upgradedLabel) hardRegressionFlags.push(flag);
    }
  }
  const judgmentCount = judgments.length;
  const dimensionMeanDeltas = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, Number((deltas[dimension] / Math.max(judgmentCount, 1)).toFixed(4))]));
  const meanDelta = Number((Object.values(dimensionMeanDeltas).reduce((sum, value) => sum + value, 0) / DIMENSIONS.length).toFixed(4));
  const mandatoryRegressions = Object.entries(dimensionMeanDeltas).filter(([, value]) => value < -0.25);
  const improved = judgmentCount === 9 && meanDelta >= 0.6 && votes.upgraded >= 6 && mandatoryRegressions.length === 0 && hardRegressionFlags.length === 0;
  return { evaluator: "paired-lift", skill, judgment_count: judgmentCount, expected_judgment_count: 9, mean_delta: meanDelta, dimension_mean_deltas: dimensionMeanDeltas, preference_votes: votes, upgraded_preference_count: votes.upgraded, mandatory_dimension_regressions: mandatoryRegressions, hard_regression_flags: hardRegressionFlags, release_eligible: improved, verdict: improved ? "improved" : "blocked" };
}

function upgradedResults(root, manifest, skill) { return SEEDS.map((seed) => ({ ...resultFor(root, manifest, jobFor(manifest, skill, "upgraded", seed)).result, seed })); }

function evaluateDiversityStrict(attempts) {
  if (attempts.length !== 3 || JSON.stringify(attempts.map((attempt) => attempt.requested_seed)) !== JSON.stringify(SEEDS) || JSON.stringify(attempts.map((attempt) => attempt.seed)) !== JSON.stringify(SEEDS)) throw new Error("diversity requires real seed labels 101, 202, 303");
  return evaluateDiversity(attempts);
}

export function synthesizeBlindCorpus(root = ROOT, { evaluatorOverrides = {} } = {}) {
  const corpus = validateBlindCorpus(root, { requireComplete: true });
  if (corpus.errors.length > 0) throw new Error(`full19 blind synthesis blocked:\n${corpus.errors.map((error) => `- ${error}`).join("\n")}`);
  const unmaskErrors = validateUnmask(root, corpus);
  if (unmaskErrors.length > 0) throw new Error(`full19 blind synthesis blocked:\n${unmaskErrors.map((error) => `- ${error}`).join("\n")}`);
  const manifest = loadManifest(root);
  const unmask = readJson(join(root, UNMASK_PATH), UNMASK_PATH);
  const results = corpus.slots.map((entry) => readJson(join(root, entry.result_path), entry.result_path));
  const paired = Object.fromEntries(SKILLS.map((skill) => [skill, synthesizeSkill(skill, corpus.packets, results, unmask)]));
  const diversity = {};
  const antiSlop = {};
  for (const skill of SKILLS) {
    const attempts = upgradedResults(root, manifest, skill);
    diversity[skill] = evaluatorOverrides[skill]?.diversity ? { evaluator: "diversity", seeds: SEEDS, pairwise_similarity: [], overall_pass: false, verdict: "failed-override", override: true } : evaluateDiversityStrict(attempts);
    const runs = attempts.map((attempt) => evaluateAntiSlop(attempt));
    const clean = runs.length === 3 && runs.every((run) => run.pass === true);
    antiSlop[skill] = evaluatorOverrides[skill]?.anti_slop ? { evaluator: "anti-slop", seeds: SEEDS, runs, pass: false, verdict: "failed-override", override: true } : { evaluator: "anti-slop", seeds: SEEDS, runs, pass: clean, verdict: clean ? "clean" : "slop-detected" };
  }
  const gate = Object.fromEntries(SKILLS.map((skill) => [skill, {
    paired_lift_improved: paired[skill].release_eligible === true,
    diversity_pass: diversity[skill].overall_pass === true,
    anti_slop_pass: antiSlop[skill].pass === true,
    release_eligible: paired[skill].release_eligible === true && diversity[skill].overall_pass === true && antiSlop[skill].pass === true,
  }]));
  const releaseEligible = SKILLS.every((skill) => gate[skill].release_eligible === true);
  const synthesis = { schema_version: 1, revision_id: REVISION_ID, namespace: NAMESPACE, source: "full19-blind-judge", unmasked_after_complete_corpus: true, expected_judgment_count: 171, paired, diversity, anti_slop: antiSlop, gate, release_eligible: releaseEligible, verdict: releaseEligible ? "release-eligible" : "blocked" };
  writeJson(join(root, SYNTHESIS_PATH), synthesis);
  return { ...synthesis, path: SYNTHESIS_PATH };
}

export function validateSynthesis(root = ROOT) {
  const errors = [];
  const path = repoPath(root, SYNTHESIS_PATH);
  if (!path || !existsSync(path)) return { errors: ["synthesis is missing"] };
  const synthesis = readJson(path, SYNTHESIS_PATH);
  if (synthesis.revision_id !== REVISION_ID || synthesis.namespace !== NAMESPACE || synthesis.unmasked_after_complete_corpus !== true || synthesis.expected_judgment_count !== 171) errors.push("synthesis revision/completion binding is invalid");
  for (const skill of SKILLS) {
    const diversity = synthesis.diversity?.[skill];
    if (!diversity || JSON.stringify(diversity.seeds) !== JSON.stringify(SEEDS) || JSON.stringify(diversity.pairwise_similarity?.map((pair) => pair.pair)) !== JSON.stringify(["seed101_vs_seed202", "seed101_vs_seed303", "seed202_vs_seed303"])) errors.push(`${skill}: diversity seed labels are invalid`);
    const antiSlop = synthesis.anti_slop?.[skill];
    if (!antiSlop || antiSlop.seeds?.join(",") !== SEEDS.join(",") || antiSlop.runs?.length !== 3) errors.push(`${skill}: anti-slop seed/run coverage is invalid`);
    const gate = synthesis.gate?.[skill];
    if (!gate || gate.paired_lift_improved !== true && gate.paired_lift_improved !== false || gate.diversity_pass !== true && gate.diversity_pass !== false || gate.anti_slop_pass !== true && gate.anti_slop_pass !== false) errors.push(`${skill}: release gate is malformed`);
  }
  return { errors, synthesis };
}

export function aggregateBlindCorpus(root = ROOT) {
  const checked = validateSynthesis(root);
  if (checked.errors.length > 0) throw new Error(`full19 aggregate blocked:\n${checked.errors.join("\n")}`);
  const synthesis = checked.synthesis;
  const aggregate = { schema_version: 1, revision_id: REVISION_ID, namespace: NAMESPACE, source: SYNTHESIS_PATH, gate: synthesis.gate, release_eligible: synthesis.release_eligible === true, verdict: synthesis.release_eligible === true ? "release-eligible" : "blocked" };
  writeJson(join(root, AGGREGATE_PATH), aggregate);
  return { ...aggregate, path: AGGREGATE_PATH };
}

function usage() { console.error("Usage: node tools/evals/full19-blind-judge.mjs build | validate | synthesize | aggregate"); }
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2];
  try {
    if (command === "build") { const result = buildBlindCorpus(ROOT); console.log(`built ${result.packet_paths.length} packets and ${result.result_paths.length} pending judge slots`); }
    else if (command === "validate") { const result = validateBlindCorpus(ROOT); if (result.errors.length > 0) throw new Error(result.errors.join("\n")); console.log(`valid: ${result.packet_count} packets, ${result.slot_count} result slots (${result.complete_count} complete)`); }
    else if (command === "synthesize") { const result = synthesizeBlindCorpus(ROOT); console.log(JSON.stringify({ path: result.path, release_eligible: result.release_eligible, verdict: result.verdict }, null, 2)); if (!result.release_eligible) process.exitCode = 1; }
    else if (command === "aggregate") { const result = aggregateBlindCorpus(ROOT); console.log(JSON.stringify({ path: result.path, release_eligible: result.release_eligible, verdict: result.verdict }, null, 2)); if (!result.release_eligible) process.exitCode = 1; }
    else { usage(); process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
