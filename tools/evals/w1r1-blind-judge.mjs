#!/usr/bin/env node
/**
 * Revision-local blind judge scaffold for the validated W1R1 remediation replay.
 *
 * This module deliberately does not read or write the historical W1 judge
 * corpus. It creates nine opaque A/B packets from the immutable attempt-1
 * baselines and the nine fresh Terra results, then validates a strict 27-slot
 * result corpus before any private unmasking or synthesis is allowed.
 */
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDiversity } from "./evaluators/diversity.mjs";
import { evaluateAntiSlop } from "./evaluators/anti-slop.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REVISION_ID = "w1r1-remediation-2026-07-11";
export const NAMESPACE = `evals/replays/${REVISION_ID}`;
export const BLIND_NAMESPACE = `${NAMESPACE}/blind-judge`;
export const PACKET_DIR = `${BLIND_NAMESPACE}/packets`;
export const RESULT_DIR = `${BLIND_NAMESPACE}/results`;
export const PRIVATE_DIR = `${BLIND_NAMESPACE}/private`;
export const UNMASK_PATH = `${PRIVATE_DIR}/unmask.json`;
export const SYNTHESIS_PATH = `${BLIND_NAMESPACE}/synthesis.json`;
export const AGGREGATE_PATH = `${BLIND_NAMESPACE}/aggregate.json`;

const MANIFEST_PATH = `${NAMESPACE}/manifest.json`;
const SKILLS = ["component-states", "deslop-ui", "tastecheck-pass"];
const SEEDS = [101, 202, 303];
const JUDGES = [
  { judge_id: "judge-luna-1", evaluator_family: "luna" },
  { judge_id: "judge-luna-2", evaluator_family: "luna" },
  { judge_id: "judge-sonnet", evaluator_family: "sonnet" },
];
const DIMENSIONS = ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"];
const CUE_FIELDS = new Set(["attempt_id", "job_id", "run_type", "source", "version", "lane", "family", "model", "executor", "skill_version", "skill_source_path", "external_source_lane"]);
const PACKET_FIELDS = new Set(["schema_version", "revision_id", "namespace", "packet_id", "skill", "scenario_id", "rubric", "binding", "candidates"]);
const PACKET_BINDING_FIELDS = new Set(["packet_hash", "source_sha256", "baseline_hash", "terra_result_hash"]);
const CANDIDATE_FIELDS = new Set(["label", "raw_output", "raw_output_hash"]);
const PENDING_RESULT_FIELDS = new Set(["schema_version", "revision_id", "namespace", "result_id", "packet_id", "packet_path", "packet_sha256", "evaluator_type", "judge_id", "evaluator_family", "status"]);
const COMPLETE_RESULT_FIELDS = new Set([
  ...PENDING_RESULT_FIELDS,
  "evaluator_model", "calibration_status", "candidate_scores", "score_scale_version",
  "candidate_evidence", "preference", "deltas", "regression_flags", "verdict",
  "rationale", "cited_evidence",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path, "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function packetHashInput(packet) {
  const { packet_hash: _ignored, ...binding } = packet.binding ?? {};
  return { ...packet, binding };
}

function readJson(path, label = path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`${label}: invalid JSON (${error.message})`); }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function repoPath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.startsWith("/") || relativePath.split("/").includes("..")) return null;
  const absolute = resolve(root, relativePath);
  const rootAbsolute = resolve(root);
  return absolute === rootAbsolute || absolute.startsWith(`${rootAbsolute}/`) ? absolute : null;
}

function under(relativePath, prefix) {
  return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
}

function loadManifest(root) {
  return readJson(join(root, MANIFEST_PATH), MANIFEST_PATH);
}

function loadRubric(root) {
  return readJson(join(root, "evals/w1/rubric/anchored-rubric.json"), "anchored rubric");
}

function sourceBinding(manifest, skill) {
  return manifest.source_bindings?.find((binding) => binding.skill === skill);
}

function jobFor(manifest, skill, seed) {
  return manifest.jobs?.find((job) => job.skill === skill && job.requested_seed === seed);
}

function baselineFor(manifest, skill) {
  return manifest.baseline_references?.find((reference) => reference.skill === skill);
}

function freshResult(root, manifest, skill, seed) {
  const job = jobFor(manifest, skill, seed);
  if (!job) throw new Error(`missing replay job for ${skill}/seed${seed}`);
  const path = repoPath(root, job.result_path);
  if (!path || !existsSync(path)) throw new Error(`missing fresh Terra result ${job.result_path}`);
  const result = readJson(path, job.result_path);
  if (result.job_id !== job.job_id || result.skill !== skill || result.requested_seed !== seed) throw new Error(`fresh result binding drift for ${job.job_id}`);
  if (result.raw_output_hash !== sha256(result.raw_output ?? "")) throw new Error(`fresh result output hash drift for ${job.job_id}`);
  return { job, result, path };
}

function baselineOutput(root, manifest, skill) {
  const reference = baselineFor(manifest, skill);
  if (!reference || reference.immutable !== true || !reference.attempt_id.endsWith("-attempt-1")) throw new Error(`immutable baseline attempt-1 reference missing for ${skill}`);
  const path = repoPath(root, reference.path);
  if (!path || !existsSync(path)) throw new Error(`missing immutable baseline ${reference.path}`);
  if (fileSha256(path) !== reference.sha256) throw new Error(`immutable baseline digest drift for ${skill}`);
  const attempt = readJson(path, reference.path);
  if (attempt.attempt_id !== reference.attempt_id || attempt.run_type !== "baseline" || attempt.raw_output_hash !== sha256(attempt.raw_output ?? "")) throw new Error(`immutable baseline content drift for ${skill}`);
  return { reference, attempt, path };
}

function deterministicSwap(skill, seed) {
  return Number.parseInt(sha256(`${REVISION_ID}:${skill}:seed${seed}:A-B`)[0], 16) % 2 === 0;
}

function makePacket(root, manifest, rubric, skill, seed) {
  const job = jobFor(manifest, skill, seed);
  const source = sourceBinding(manifest, skill);
  const baseline = baselineOutput(root, manifest, skill);
  const fresh = freshResult(root, manifest, skill, seed);
  if (!source || fileSha256(join(root, source.path)) !== source.sha256) throw new Error(`current source digest drift for ${skill}`);
  const baselineCandidate = { label: "A", raw_output: baseline.attempt.raw_output, raw_output_hash: baseline.attempt.raw_output_hash };
  const terraCandidate = { label: "B", raw_output: fresh.result.raw_output, raw_output_hash: fresh.result.raw_output_hash };
  const swapped = deterministicSwap(skill, seed);
  const candidates = swapped
    ? { A: { ...terraCandidate, label: "A" }, B: { ...baselineCandidate, label: "B" } }
    : { A: baselineCandidate, B: terraCandidate };
  const packetId = `${skill}-seed${seed}-blind-001`;
  const packetWithoutHash = {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    packet_id: packetId,
    skill,
    scenario_id: job.scenario_id,
    rubric,
    binding: {
      source_sha256: source.sha256,
      baseline_hash: baseline.attempt.raw_output_hash,
      terra_result_hash: fresh.result.raw_output_hash,
    },
    candidates,
  };
  const packetHash = sha256(stable(packetWithoutHash));
  return {
    ...packetWithoutHash,
    binding: { ...packetWithoutHash.binding, packet_hash: packetHash },
    private_mapping: {
      A: { role: swapped ? "terra" : "baseline", seed: swapped ? seed : 101, result_hash: candidates.A.raw_output_hash },
      B: { role: swapped ? "baseline" : "terra", seed: swapped ? 101 : seed, result_hash: candidates.B.raw_output_hash },
    },
    job,
    baseline,
    fresh,
  };
}

function slotFor(packet, judge) {
  const resultId = `${packet.packet_id}-${judge.judge_id}`;
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    result_id: resultId,
    packet_id: packet.packet_id,
    packet_path: `${PACKET_DIR}/${packet.packet_id}.json`,
    packet_sha256: packet.file_sha256,
    evaluator_type: "paired_lift",
    judge_id: judge.judge_id,
    evaluator_family: judge.evaluator_family,
    status: "pending",
  };
}

function manifestBlindSection(packets, slots) {
  return {
    schema_version: 1,
    status: "pending",
    packet_count: 9,
    result_slot_count: 27,
    packet_dir: PACKET_DIR,
    result_dir: RESULT_DIR,
    private_unmask_path: UNMASK_PATH,
    synthesis_path: SYNTHESIS_PATH,
    aggregate_path: AGGREGATE_PATH,
    judge_lanes: JUDGES.map((judge) => `${RESULT_DIR}/${judge.judge_id}`),
    packets: packets.map(({ packet_id, packet_path, packet_sha256, packet_hash, skill, seed, source_sha256, baseline_hash, terra_result_hash }) => ({ packet_id, packet_path, packet_sha256, packet_hash, skill, seed, source_sha256, baseline_hash, terra_result_hash })),
    result_slots: slots.map(({ result_id, result_path, packet_id, packet_path, packet_sha256, judge_id, evaluator_family }) => ({ result_id, result_path, packet_id, packet_path, packet_sha256, judge_id, evaluator_family })),
  };
}

export function buildBlindCorpus(root = ROOT) {
  const manifest = loadManifest(root);
  if (manifest.revision_id !== REVISION_ID || manifest.namespace !== NAMESPACE) throw new Error("wrong replay revision or namespace");
  const rubric = loadRubric(root);
  const blindRoot = join(root, BLIND_NAMESPACE);
  rmSync(join(root, PACKET_DIR), { recursive: true, force: true });
  rmSync(join(root, RESULT_DIR), { recursive: true, force: true });
  rmSync(join(root, PRIVATE_DIR), { recursive: true, force: true });
  rmSync(join(root, SYNTHESIS_PATH), { force: true });
  rmSync(join(root, AGGREGATE_PATH), { force: true });
  mkdirSync(blindRoot, { recursive: true });
  const packets = [];
  const slots = [];
  const unmask = { schema_version: 1, private: true, revision_id: REVISION_ID, namespace: NAMESPACE, packets: {} };
  for (const skill of SKILLS) {
    for (const seed of SEEDS) {
      const packet = makePacket(root, manifest, rubric, skill, seed);
      const packetPath = `${PACKET_DIR}/${packet.packet_id}.json`;
      const packetPublic = { ...packet };
      delete packetPublic.private_mapping;
      delete packetPublic.job;
      delete packetPublic.baseline;
      delete packetPublic.fresh;
      writeJson(join(root, packetPath), packetPublic);
      const packetSha = fileSha256(join(root, packetPath));
      packet.file_sha256 = packetSha;
      packets.push({
        packet_id: packet.packet_id,
        packet_path: packetPath,
        packet_sha256: packetSha,
        packet_hash: packet.binding.packet_hash,
        skill,
        seed,
        source_sha256: packet.binding.source_sha256,
        baseline_hash: packet.binding.baseline_hash,
        terra_result_hash: packet.binding.terra_result_hash,
      });
      unmask.packets[packet.packet_id] = packet.private_mapping;
      for (const judge of JUDGES) {
        const slot = slotFor(packet, judge);
        const resultPath = `${RESULT_DIR}/${judge.judge_id}/${slot.result_id}.json`;
        writeJson(join(root, resultPath), slot);
        slots.push({ ...slot, result_path: resultPath });
      }
    }
  }
  writeJson(join(root, UNMASK_PATH), unmask);
  const nextManifest = { ...manifest, blind_judge: manifestBlindSection(packets, slots) };
  writeJson(join(root, MANIFEST_PATH), nextManifest);
  return {
    revision_id: REVISION_ID,
    packet_paths: packets.map((packet) => packet.packet_path),
    result_paths: slots.map((slot) => slot.result_path),
    unmask_path: UNMASK_PATH,
  };
}

function exactKeys(value, allowed, subject, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${subject} must be an object`); return; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${subject} unexpected field ${key}`);
  for (const key of allowed) if (!(key in value)) errors.push(`${subject} missing field ${key}`);
}

function validatePacket(root, manifest, entry, rubric, errors) {
  const path = repoPath(root, entry.packet_path);
  if (!path || !under(entry.packet_path, PACKET_DIR) || !existsSync(path)) { errors.push(`${entry.packet_id}: packet missing or outside namespace`); return null; }
  if (fileSha256(path) !== entry.packet_sha256) errors.push(`${entry.packet_id}: packet file hash mismatch`);
  const packet = readJson(path, entry.packet_path);
  exactKeys(packet, PACKET_FIELDS, `${entry.packet_id} packet`, errors);
  if (packet.revision_id !== REVISION_ID || packet.namespace !== NAMESPACE || packet.packet_id !== entry.packet_id) errors.push(`${entry.packet_id}: packet revision/namespace/id mismatch`);
  if (packet.skill !== entry.skill || packet.scenario_id !== jobFor(manifest, entry.skill, entry.seed)?.scenario_id) errors.push(`${entry.packet_id}: packet job binding mismatch`);
  if (JSON.stringify(packet.rubric) !== JSON.stringify(rubric)) errors.push(`${entry.packet_id}: rubric drift`);
  exactKeys(packet.binding, PACKET_BINDING_FIELDS, `${entry.packet_id} binding`, errors);
  const recomputedHash = sha256(stable(packetHashInput(packet)));
  if (packet.binding.packet_hash !== recomputedHash || packet.binding.packet_hash !== entry.packet_hash) errors.push(`${entry.packet_id}: packet hash binding mismatch`);
  const source = sourceBinding(manifest, entry.skill);
  if (!source || packet.binding.source_sha256 !== source.sha256 || fileSha256(join(root, source.path)) !== source.sha256) errors.push(`${entry.packet_id}: current source digest binding mismatch`);
  const baseline = baselineFor(manifest, entry.skill);
  const fresh = freshResult(root, manifest, entry.skill, entry.seed);
  if (!baseline || packet.binding.baseline_hash !== baselineOutput(root, manifest, entry.skill).attempt.raw_output_hash) errors.push(`${entry.packet_id}: baseline hash binding mismatch`);
  if (packet.binding.terra_result_hash !== fresh.result.raw_output_hash) errors.push(`${entry.packet_id}: Terra result hash binding mismatch`);
  if (!packet.candidates || JSON.stringify(Object.keys(packet.candidates).sort()) !== JSON.stringify(["A", "B"])) errors.push(`${entry.packet_id}: candidates must be exactly A and B`);
  for (const label of ["A", "B"]) {
    const candidate = packet.candidates?.[label];
    exactKeys(candidate, CANDIDATE_FIELDS, `${entry.packet_id} candidate ${label}`, errors);
    if (candidate?.label !== label || typeof candidate?.raw_output !== "string" || candidate.raw_output.length === 0) errors.push(`${entry.packet_id} candidate ${label}: exact output text missing`);
    if (candidate?.raw_output_hash !== sha256(candidate?.raw_output ?? "")) errors.push(`${entry.packet_id} candidate ${label}: output hash mismatch`);
    for (const key of Object.keys(candidate ?? {})) if (CUE_FIELDS.has(key)) errors.push(`${entry.packet_id} candidate ${label}: cue leakage ${key}`);
  }
  return packet;
}

function containsExact(packet, citation, labels = ["A", "B"]) {
  return typeof citation === "string" && citation.length > 0 && labels.some((label) => packet.candidates?.[label]?.raw_output.includes(citation));
}

function validateCalibration(value, errors, subject) {
  if (!value || value.passed !== true || value.items_passed !== 6 || !Array.isArray(value.items) || value.items.length !== 6) { errors.push(`${subject}: calibration must pass exactly six items`); return; }
  if (value.items.some((item) => item?.passed !== true || typeof item?.calibration_id !== "string" || typeof item?.check !== "string")) errors.push(`${subject}: calibration contains a failed or malformed item`);
}

function validateCompleteResult(result, packet, errors) {
  exactKeys(result, COMPLETE_RESULT_FIELDS, `${result.result_id} result`, errors);
  validateCalibration(result.calibration_status, errors, result.result_id);
  if (typeof result.evaluator_model !== "string" || result.evaluator_model.length === 0) errors.push(`${result.result_id}: evaluator_model required`);
  if (result.score_scale_version !== "anchored-1-5-v1") errors.push(`${result.result_id}: score scale mismatch`);
  for (const label of ["A", "B"]) {
    const scores = result.candidate_scores?.[label];
    if (!scores || DIMENSIONS.some((dimension) => !Number.isInteger(scores[dimension]) || scores[dimension] < 1 || scores[dimension] > 5) || scores.total !== DIMENSIONS.reduce((sum, dimension) => sum + (scores[dimension] ?? 0), 0)) errors.push(`${result.result_id}: invalid ${label} scores`);
    if (!containsExact(packet, result.candidate_evidence?.[label], [label])) errors.push(`${result.result_id}: ${label} evidence is not an exact substring`);
  }
  if (!result.deltas || DIMENSIONS.some((dimension) => result.deltas[dimension] !== result.candidate_scores.A[dimension] - result.candidate_scores.B[dimension])) errors.push(`${result.result_id}: score deltas are inconsistent`);
  if (!["A", "B", "tie"].includes(result.preference) || !["A_better", "B_better", "tie"].includes(result.verdict)) errors.push(`${result.result_id}: score/verdict fields invalid`);
  if ((result.preference === "A" && result.verdict !== "A_better") || (result.preference === "B" && result.verdict !== "B_better") || (result.preference === "tie" && result.verdict !== "tie")) errors.push(`${result.result_id}: preference/verdict disagreement`);
  if (typeof result.rationale !== "string" || !result.rationale.includes(result.candidate_evidence?.A ?? "") || !result.rationale.includes(result.candidate_evidence?.B ?? "")) errors.push(`${result.result_id}: rationale must cite exact evidence from both candidates`);
  if (!Array.isArray(result.cited_evidence) || result.cited_evidence.length < 2 || !result.cited_evidence.some((citation) => containsExact(packet, citation, ["A"])) || !result.cited_evidence.some((citation) => containsExact(packet, citation, ["B"]))) errors.push(`${result.result_id}: cited_evidence must contain exact substrings from both candidates`);
  if (!Array.isArray(result.regression_flags)) errors.push(`${result.result_id}: regression_flags must be an array`);
  else for (const flag of result.regression_flags) {
    if (!flag || !["safety", "accessibility", "contract"].includes(flag.category) || !["A", "B"].includes(flag.candidate) || !DIMENSIONS.includes(flag.dimension) || !Number.isInteger(flag.delta) || flag.delta >= 0 || !containsExact(packet, flag.evidence, [flag.candidate])) errors.push(`${result.result_id}: invalid regression flag`);
  }
}

function validateSlot(result, packet, entry, errors, requireComplete) {
  if (!result) return;
  const allowed = result.status === "complete" ? COMPLETE_RESULT_FIELDS : PENDING_RESULT_FIELDS;
  exactKeys(result, allowed, `${entry.result_id} result`, errors);
  if (result.schema_version !== 1 || result.revision_id !== REVISION_ID || result.namespace !== NAMESPACE) errors.push(`${entry.result_id}: revision binding mismatch`);
  if (result.result_id !== entry.result_id || result.packet_id !== entry.packet_id || result.packet_path !== entry.packet_path || result.packet_sha256 !== entry.packet_sha256 || result.evaluator_type !== "paired_lift" || result.judge_id !== entry.judge_id || result.evaluator_family !== entry.evaluator_family) errors.push(`${entry.result_id}: slot binding mismatch`);
  if (!JUDGES.some((judge) => judge.judge_id === result.judge_id && judge.evaluator_family === result.evaluator_family)) errors.push(`${entry.result_id}: unapproved judge lane`);
  if (!["pending", "complete"].includes(result.status)) errors.push(`${entry.result_id}: invalid status`);
  if (result.status === "pending") {
    if (requireComplete) errors.push(`${entry.result_id}: pending slot blocks complete corpus`);
    return;
  }
  validateCompleteResult(result, packet, errors);
}

export function validateBlindCorpus(root = ROOT, { requireComplete = false } = {}) {
  const errors = [];
  let manifest;
  try { manifest = loadManifest(root); } catch (error) { return { errors: [error.message], packet_count: 0, slot_count: 0, complete_count: 0 }; }
  const section = manifest.blind_judge;
  if (manifest.revision_id !== REVISION_ID || manifest.namespace !== NAMESPACE) errors.push("manifest revision or namespace mismatch");
  if (!section || section.schema_version !== 1 || section.packet_count !== 9 || section.result_slot_count !== 27) errors.push("blind-judge manifest counts/schema are invalid");
  const rubric = loadRubric(root);
  const packetEntries = section?.packets ?? [];
  const slotEntries = section?.result_slots ?? [];
  if (packetEntries.length !== 9) errors.push(`blind corpus must contain exactly 9 packet entries; got ${packetEntries.length}`);
  if (slotEntries.length !== 27) errors.push(`blind corpus must contain exactly 27 result entries; got ${slotEntries.length}`);
  const packets = new Map();
  for (const entry of packetEntries) {
    if (packets.has(entry.packet_id)) errors.push(`duplicate packet_id ${entry.packet_id}`);
    const packet = validatePacket(root, manifest, entry, rubric, errors);
    if (packet) packets.set(entry.packet_id, packet);
  }
  const resultFilesOnDisk = [];
  for (const lane of JUDGES) {
    const laneDir = join(root, RESULT_DIR, lane.judge_id);
    if (existsSync(laneDir)) for (const filename of readdirSync(laneDir).filter((name) => name.endsWith(".json"))) resultFilesOnDisk.push(`${RESULT_DIR}/${lane.judge_id}/${filename}`);
  }
  if (resultFilesOnDisk.length !== 27) errors.push(`blind corpus must contain exactly 27 result files; found ${resultFilesOnDisk.length}`);
  const expectedPaths = new Set(slotEntries.map((entry) => entry.result_path));
  const actualPaths = new Set(resultFilesOnDisk);
  for (const path of expectedPaths) if (!actualPaths.has(path)) errors.push(`missing result slot file ${path}`);
  for (const path of actualPaths) if (!expectedPaths.has(path)) errors.push(`unexpected result slot file ${path}`);
  const resultIds = new Set();
  let completeCount = 0;
  for (const entry of slotEntries) {
    if (resultIds.has(entry.result_id)) errors.push(`duplicate result_id ${entry.result_id}`);
    resultIds.add(entry.result_id);
    const path = repoPath(root, entry.result_path);
    if (!path || !under(entry.result_path, RESULT_DIR) || !existsSync(path)) continue;
    let result;
    try { result = readJson(path, entry.result_path); } catch (error) { errors.push(error.message); continue; }
    const packet = packets.get(entry.packet_id);
    if (!packet) errors.push(`${entry.result_id}: parent packet missing`);
    validateSlot(result, packet, entry, errors, requireComplete);
    if (result.status === "complete" && !errors.some((error) => error.startsWith(`${entry.result_id}:`))) completeCount++;
  }
  if (requireComplete && completeCount !== 27) errors.push(`complete corpus requires exactly 27 valid complete judgments; found ${completeCount}`);
  return { errors, packet_count: packets.size, slot_count: slotEntries.length, complete_count: completeCount, packets: [...packets.values()] };
}

function validateUnmask(root, corpus) {
  const errors = [];
  const path = join(root, UNMASK_PATH);
  if (!existsSync(path)) return ["private unmask file is missing"];
  const unmask = readJson(path, UNMASK_PATH);
  if (unmask.private !== true || unmask.revision_id !== REVISION_ID || unmask.namespace !== NAMESPACE) errors.push("private unmask revision/private binding is invalid");
  for (const packet of corpus.packets) {
    const mapping = unmask.packets?.[packet.packet_id];
    if (!mapping || !["A", "B"].every((label) => mapping[label]?.result_hash === packet.candidates[label].raw_output_hash)) errors.push(`${packet.packet_id}: private unmask mapping does not match packet hashes`);
    if (mapping && new Set([mapping.A?.role, mapping.B?.role]).size !== 2) errors.push(`${packet.packet_id}: unmask must contain one baseline and one Terra role`);
  }
  return errors;
}

function synthesizeSkill(skill, packets, results, unmask) {
  const judgments = [];
  const deltas = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
  const votes = { upgraded: 0, baseline: 0, tie: 0 };
  const regressions = [];
  for (const packet of packets.filter((entry) => entry.skill === skill)) {
    const mapping = unmask.packets[packet.packet_id];
    const upgradedLabel = mapping.A.role === "terra" ? "A" : "B";
    const baselineLabel = upgradedLabel === "A" ? "B" : "A";
    for (const result of results.filter((entry) => entry.packet_id === packet.packet_id)) {
      const scoreDelta = result.candidate_scores[upgradedLabel];
      const baseScore = result.candidate_scores[baselineLabel];
      for (const dimension of DIMENSIONS) deltas[dimension] += scoreDelta[dimension] - baseScore[dimension];
      if (result.preference === upgradedLabel) votes.upgraded++;
      else if (result.preference === baselineLabel) votes.baseline++;
      else votes.tie++;
      for (const flag of result.regression_flags ?? []) if (flag.candidate === upgradedLabel) regressions.push(flag);
      judgments.push(result.result_id);
    }
  }
  const count = judgments.length;
  const meanDimensionDeltas = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, Number((deltas[dimension] / Math.max(count, 1)).toFixed(4))]));
  const meanDelta = Number((Object.values(meanDimensionDeltas).reduce((sum, value) => sum + value, 0) / DIMENSIONS.length).toFixed(4));
  const mandatoryRegressions = Object.entries(meanDimensionDeltas).filter(([, value]) => value < -0.25);
  const pairedPass = count === 9 && meanDelta >= 0.6 && votes.upgraded >= 6 && mandatoryRegressions.length === 0 && regressions.length === 0;
  return { evaluator: "paired-lift", skill, judgment_count: count, mean_delta: meanDelta, dimension_mean_deltas: meanDimensionDeltas, preference_votes: votes, upgraded_preference_count: votes.upgraded, mandatory_dimension_regressions: mandatoryRegressions, hard_regression_flags: regressions, release_eligible: pairedPass, verdict: pairedPass ? "improved" : "blocked" };
}

export function synthesizeBlindCorpus(root = ROOT, { evaluatorOverrides = {} } = {}) {
  const corpus = validateBlindCorpus(root, { requireComplete: true });
  if (corpus.errors.length > 0) throw new Error(`W1R1 blind synthesis blocked:\n${corpus.errors.map((error) => `- ${error}`).join("\n")}`);
  const unmaskErrors = validateUnmask(root, corpus);
  if (unmaskErrors.length > 0) throw new Error(`W1R1 blind synthesis blocked:\n${unmaskErrors.map((error) => `- ${error}`).join("\n")}`);
  const manifest = loadManifest(root);
  const unmask = readJson(join(root, UNMASK_PATH), UNMASK_PATH);
  const results = manifest.blind_judge.result_slots.map((entry) => readJson(join(root, entry.result_path), entry.result_path));
  const paired = Object.fromEntries(SKILLS.map((skill) => [skill, synthesizeSkill(skill, corpus.packets, results, unmask)]));
  const terraBySkill = Object.fromEntries(SKILLS.map((skill) => [skill, SEEDS.map((seed) => freshResult(root, manifest, skill, seed).result)]));
  const diversity = {};
  const antiSlop = {};
  for (const skill of SKILLS) {
    const diversityAttempts = terraBySkill[skill].map((attempt) => ({ ...attempt, seed: attempt.requested_seed }));
    diversity[skill] = evaluatorOverrides[skill]?.diversity ? { evaluator: "diversity", overall_pass: false, verdict: "failed-override", override: true } : evaluateDiversity(diversityAttempts);
    antiSlop[skill] = evaluatorOverrides[skill]?.anti_slop ? { evaluator: "anti-slop", pass: false, verdict: "failed-override", override: true } : { evaluator: "anti-slop", runs: terraBySkill[skill].map(evaluateAntiSlop), pass: terraBySkill[skill].every((attempt) => evaluateAntiSlop(attempt).pass), verdict: terraBySkill[skill].every((attempt) => evaluateAntiSlop(attempt).pass) ? "clean" : "slop-detected" };
  }
  const gate = Object.fromEntries(SKILLS.map((skill) => [skill, {
    paired_lift_improved: paired[skill].release_eligible,
    diversity_pass: diversity[skill].overall_pass === true,
    anti_slop_pass: antiSlop[skill].pass === true,
    release_eligible: paired[skill].release_eligible && diversity[skill].overall_pass === true && antiSlop[skill].pass === true,
  }]));
  const releaseEligible = SKILLS.every((skill) => gate[skill].release_eligible);
  const synthesis = { schema_version: 1, revision_id: REVISION_ID, namespace: NAMESPACE, source: "w1r1-blind-judge", unmasked_after_complete_corpus: true, paired, diversity, anti_slop: antiSlop, gate, release_eligible: releaseEligible, verdict: releaseEligible ? "release-eligible" : "blocked" };
  writeJson(join(root, SYNTHESIS_PATH), synthesis);
  return { ...synthesis, path: SYNTHESIS_PATH };
}

export function aggregateBlindCorpus(root = ROOT) {
  const path = join(root, SYNTHESIS_PATH);
  if (!existsSync(path)) throw new Error("W1R1 aggregate blocked: complete synthesis is missing");
  const synthesis = readJson(path, SYNTHESIS_PATH);
  if (synthesis.revision_id !== REVISION_ID || synthesis.namespace !== NAMESPACE || synthesis.unmasked_after_complete_corpus !== true) throw new Error("W1R1 aggregate blocked: synthesis binding is invalid");
  const aggregate = { schema_version: 1, revision_id: REVISION_ID, namespace: NAMESPACE, source: SYNTHESIS_PATH, gate: synthesis.gate, release_eligible: synthesis.release_eligible === true, verdict: synthesis.release_eligible === true ? "release-eligible" : "blocked" };
  writeJson(join(root, AGGREGATE_PATH), aggregate);
  return { ...aggregate, path: AGGREGATE_PATH };
}

function usage() {
  console.error("Usage: node tools/evals/w1r1-blind-judge.mjs build | validate | synthesize | aggregate");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2];
  try {
    if (command === "build") {
      const result = buildBlindCorpus(ROOT);
      console.log(`built ${result.packet_paths.length} packets and ${result.result_paths.length} pending judge slots`);
      result.packet_paths.forEach((path) => console.log(path));
    } else if (command === "validate") {
      const result = validateBlindCorpus(ROOT);
      if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
      console.log(`valid: ${result.packet_count} packets, ${result.slot_count} result slots (${result.complete_count} complete)`);
    } else if (command === "synthesize") {
      const result = synthesizeBlindCorpus(ROOT);
      console.log(JSON.stringify({ path: result.path, release_eligible: result.release_eligible, verdict: result.verdict }, null, 2));
      if (!result.release_eligible) process.exitCode = 1;
    } else if (command === "aggregate") {
      const result = aggregateBlindCorpus(ROOT);
      console.log(JSON.stringify({ path: result.path, release_eligible: result.release_eligible, verdict: result.verdict }, null, 2));
      if (!result.release_eligible) process.exitCode = 1;
    } else { usage(); process.exitCode = 1; }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
