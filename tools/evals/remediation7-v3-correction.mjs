#!/usr/bin/env node
/** Validate the static remediation7 v3 correction evidence; it never generates model output. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDiversity } from "./evaluators/diversity.mjs";
import { evaluateAntiSlop } from "./evaluators/anti-slop.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const SKILLS = ["micro-motion", "spacing-system"];
export const SEEDS = [101, 202, 303];
export const DEFAULT_NAMESPACE = "evals/replays/remediation7-v3-correction-2026-07-11";
const V2 = "evals/replays/remediation7-v2-2026-07-11";
export const JUDGE_DIMENSIONS = ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"];
export const MIN_UPGRADED_MEAN_DELTA = 0.6;
const EXPECTED_JUDGMENT_COUNT = 18;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fileSha256 = (path) => sha256(readFileSync(path));
function files(root, repoPath) {
  const at = join(root, repoPath);
  const out = [];
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) walk(child); else if (entry.isFile()) out.push(relative(root, child));
  });
  walk(at); return out.sort();
}
function v2Tree(root) {
  const rows = files(root, V2).map((path) => `${path}\u0000${fileSha256(join(root, path))}\n`);
  return { file_count: rows.length, tree_sha256: sha256(rows.join("")) };
}
function scenario(root, skill) { return readJson(join(root, "evals/scenarios", `${skill}.json`)); }
function diversityContract(skill) {
  return skill === "micro-motion"
    ? { required_axes: ["structure", "decision", "voice"], minimum_material_axes_per_pair: 2, required_invariants: ["reduced motion", "interruption", "duration"] }
    : { required_axes: ["structure", "token_decision", "voice"], minimum_material_axes_per_pair: 2, required_invariants: ["compact dispatcher", "long-form", "shared scale"] };
}
export function validateBlindPacket(packet) {
  const errors = [];
  if (packet?.schema_version !== 2 || packet?.candidate_payloads_embedded !== true) errors.push("packet must use embedded-payload schema v2");
  for (const name of ["candidate_a", "candidate_b"]) {
    const candidate = packet?.[name];
    if (!candidate || typeof candidate.raw_output !== "string" || candidate.raw_output.length === 0) errors.push(`${name}: raw_output is required`);
    else if (candidate.raw_output_sha256 !== sha256(candidate.raw_output)) errors.push(`${name}: raw_output hash mismatch`);
    const allowed = new Set(["raw_output", "raw_output_sha256"]);
    for (const key of Object.keys(candidate ?? {})) if (!allowed.has(key)) errors.push(`${name}: non-blind candidate metadata is prohibited (${key})`);
  }
  return errors;
}
export function validateJudgeResultSchema(schema) {
  const errors = [];
  const required = ["revision_id", "packet_id", "judge_id", "preference", "dimension_scores", "reason", "evidence"];
  if (schema?.schema_version !== 2) errors.push("judge result schema must be version 2");
  if (JSON.stringify(schema?.required) !== JSON.stringify(required)) errors.push("judge result required fields must use dimension_scores");
  if (JSON.stringify(schema?.preference) !== JSON.stringify(["candidate-a", "candidate-b", "tie"])) errors.push("judge result preference contract drifted");
  for (const candidate of ["candidate-a", "candidate-b"]) if (JSON.stringify(schema?.dimension_scores?.[candidate]) !== JSON.stringify(JUDGE_DIMENSIONS)) errors.push(`${candidate}: per-dimension score contract drifted`);
  if (schema?.paired_release_policy?.min_upgraded_mean_delta !== 0.6) errors.push("paired release threshold must remain 0.6");
  return errors;
}
export function validateJudgeResult(result, schema) {
  const errors = [];
  errors.push(...validateJudgeResultSchema(schema));
  const required = schema?.required ?? [];
  for (const field of required) if (!(field in (result ?? {}))) errors.push(`judge result missing ${field}`);
  for (const field of ["revision_id", "packet_id", "judge_id"]) if (typeof result?.[field] !== "string" || result[field].trim().length === 0) errors.push(`judge result ${field} must be a non-empty string`);
  if ("scores" in (result ?? {})) errors.push("legacy comparison-level scores are prohibited");
  if (!["candidate-a", "candidate-b", "tie"].includes(result?.preference)) errors.push("judge result preference invalid");
  for (const candidate of ["candidate-a", "candidate-b"]) {
    const scores = result?.dimension_scores?.[candidate];
    if (!scores || typeof scores !== "object") { errors.push(`${candidate}: dimension scores missing`); continue; }
    for (const dimension of JUDGE_DIMENSIONS) if (!Number.isInteger(scores[dimension]) || scores[dimension] < 1 || scores[dimension] > 5) errors.push(`${candidate}/${dimension}: score must be an integer from 1 to 5`);
    for (const key of Object.keys(scores)) if (!JUDGE_DIMENSIONS.includes(key)) errors.push(`${candidate}/${key}: unknown dimension`);
  }
  if (typeof result?.reason !== "string" || result.reason.trim().length === 0) errors.push("judge result reason is required");
  if (!Array.isArray(result?.evidence) || result.evidence.length === 0) errors.push("judge result evidence is required");
  for (const item of result?.evidence ?? []) if (!item || !["candidate-a", "candidate-b"].includes(item.candidate) || typeof item.quote !== "string" || item.quote.trim().length === 0) errors.push("judge evidence must cite an anonymous candidate and non-empty quote");
  return errors;
}

function jsonFiles(root, dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current) => readdirSync(current, { withFileTypes: true }).forEach((entry) => {
    const path = join(current, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(path);
  });
  walk(dir);
  return out.sort().map((path) => ({ path: relative(root, path), result: readJson(path) }));
}

export function collectV3Packets(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const records = jsonFiles(root, join(root, namespace, "blind-judge", "packets"));
  return { records };
}

export function collectV3Judgments(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const records = jsonFiles(root, join(root, namespace, "blind-judge", "judgments"));
  return { records };
}

function mean(scores) {
  return JUDGE_DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) / JUDGE_DIMENSIONS.length;
}

function round4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function packetIdFromRecord(record) {
  return record?.result?.packet_id ?? record?.packet_id;
}

export function validateJudgmentCorpus({ judgments, packets, schema, expectedRevisionId = "remediation7-v3-correction-2026-07-11" }) {
  const errors = [];
  const judgmentRecords = Array.isArray(judgments) ? judgments : [];
  const packetRecords = Array.isArray(packets) ? packets : [];
  const packetMap = new Map();
  for (const record of packetRecords) {
    const packet = record?.result ?? record;
    if (!packet?.packet_id) {
      errors.push("packet is missing packet_id");
      continue;
    }
    if (packetMap.has(packet.packet_id)) errors.push(`duplicate packet_id: ${packet.packet_id}`);
    packetMap.set(packet.packet_id, packet);
    errors.push(...validateBlindPacket(packet).map((error) => `${packet.packet_id}: ${error}`));
  }
  if (packetRecords.length !== 6) errors.push(`exactly 6 packet IDs required; found ${packetRecords.length}`);

  const pairKeys = new Set();
  const judgePacketCounts = new Map();
  const packetCounts = new Map();
  let evidenceVerified = 0;
  for (const record of judgmentRecords) {
    const result = record?.result ?? record;
    const packetId = packetIdFromRecord(record);
    const packet = packetMap.get(packetId);
    const label = record?.path ?? packetId ?? "unknown judgment";
    errors.push(...validateJudgeResult(result, schema).map((error) => `${label}: ${error}`));
    if (result?.revision_id !== expectedRevisionId) errors.push(`${label}: revision_id mismatch`);
    if (!packet) {
      errors.push(`${label}: judgment packet_id is not one of the six materialized packets`);
      continue;
    }
    if (packet.packet_id !== packetId) errors.push(`${label}: packet_id does not bind to packet file`);
    const pairKey = `${result.judge_id}\u0000${packetId}`;
    if (pairKeys.has(pairKey)) errors.push(`duplicate judgment: ${result.judge_id}/${packetId}`);
    pairKeys.add(pairKey);
    judgePacketCounts.set(result.judge_id, (judgePacketCounts.get(result.judge_id) ?? 0) + 1);
    packetCounts.set(packetId, (packetCounts.get(packetId) ?? 0) + 1);
    let evidenceOkay = true;
    for (const item of result.evidence ?? []) {
      const candidate = packet[item?.candidate === "candidate-a" ? "candidate_a" : "candidate_b"];
      if (!candidate || typeof item?.quote !== "string" || !candidate.raw_output.includes(item.quote)) {
        errors.push(`${label}: evidence quote is not bound to embedded ${item?.candidate ?? "candidate"} raw_output`);
        evidenceOkay = false;
      }
    }
    if (evidenceOkay && Array.isArray(result.evidence) && result.evidence.length > 0) evidenceVerified += 1;
  }
  if (judgmentRecords.length !== EXPECTED_JUDGMENT_COUNT) errors.push(`exactly ${EXPECTED_JUDGMENT_COUNT} unique judgments required; found ${judgmentRecords.length}`);
  if (judgePacketCounts.size !== 3) errors.push(`exactly 3 independent judge IDs required; found ${judgePacketCounts.size}`);
  for (const [judgeId, count] of judgePacketCounts) if (count !== 6) errors.push(`${judgeId}: exactly 6 packet judgments required; found ${count}`);
  for (const [packetId, count] of packetCounts) if (count !== 3) errors.push(`${packetId}: exactly 3 independent judgments required; found ${count}`);
  for (const packetId of packetMap.keys()) if ((packetCounts.get(packetId) ?? 0) !== 3) errors.push(`${packetId}: missing one or more independent judgments`);
  return {
    errors,
    counts: {
      judgments: judgmentRecords.length,
      unique_judgments: pairKeys.size,
      judges: judgePacketCounts.size,
      packets: packetMap.size,
      evidence_verified: evidenceVerified,
      per_judge: Object.fromEntries([...judgePacketCounts.entries()].sort()),
      per_packet: Object.fromEntries([...packetCounts.entries()].sort()),
    },
  };
}

function validateHistoricalBindings(root, manifest, namespace) {
  const errors = [];
  const historicalPath = join(root, namespace, "paired", "historical-inputs.json");
  if (!existsSync(historicalPath)) return ["historical-inputs.json is missing"];
  const historical = readJson(historicalPath);
  if (!Array.isArray(historical.inputs) || historical.inputs.length !== 6) errors.push("exactly 6 historical baseline inputs are required");
  const seen = new Set();
  for (const input of historical.inputs ?? []) {
    const key = `${input.skill}/${input.seed}`;
    if (seen.has(key)) errors.push(`duplicate historical input: ${key}`);
    seen.add(key);
    const resultPath = join(root, input.result_path);
    if (!existsSync(resultPath)) { errors.push(`${key}: historical result is missing`); continue; }
    if (fileSha256(resultPath) !== input.result_sha256) errors.push(`${key}: historical result hash mismatch`);
    if (input.source_sha256 !== manifest.source_bindings.baseline_v010?.[input.skill]?.sha256) errors.push(`${key}: historical source binding mismatch`);
  }
  return errors;
}

function validateCurrentSourceBindings(root, namespace) {
  const errors = [];
  const contractPath = join(root, namespace, "synthesis-contract.json");
  if (!existsSync(contractPath)) return ["synthesis-contract.json is missing"];
  const contract = readJson(contractPath);
  for (const row of contract.unaffected_v2?.skills ?? []) {
    const skillPath = join(root, "skills", row.skill, "SKILL.md");
    if (!existsSync(skillPath)) errors.push(`${row.skill}: unaffected current source is missing`);
    else if (fileSha256(skillPath) !== row.sha256) errors.push(`${row.skill}: unaffected current source hash mismatch`);
  }
  return errors;
}

export function validateV3Judgments(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const base = validateCorrection(root, { namespace });
  const packets = collectV3Packets(root, { namespace });
  const judgments = collectV3Judgments(root, { namespace });
  const schemaPath = join(root, namespace, "blind-judge", "judge-result-schema.json");
  const schema = existsSync(schemaPath) ? readJson(schemaPath) : {};
  const corpus = validateJudgmentCorpus({ judgments: judgments.records, packets: packets.records, schema });
  const manifest = base.manifest ?? (existsSync(join(root, namespace, "manifest.json")) ? readJson(join(root, namespace, "manifest.json")) : {});
  const errors = [
    ...base.errors,
    ...validateHistoricalBindings(root, manifest, namespace),
    ...validateCurrentSourceBindings(root, namespace),
    ...corpus.errors,
  ];
  return {
    errors,
    counts: { ...base.counts, ...corpus.counts, packet_count: packets.records.length, judgment_files: judgments.records.length },
    records: judgments.records,
    packets: packets.records,
    schema,
  };
}

function validateUnmask(unmask, packetIds) {
  const errors = [];
  if (unmask?.schema_version !== 1 || unmask?.private !== true || !unmask?.packets || typeof unmask.packets !== "object") errors.push("unmask must be a private schema-v1 packet map");
  const actualIds = Object.keys(unmask?.packets ?? {}).sort();
  const expectedIds = [...packetIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) errors.push("unmask packet IDs must exactly match the six validated packets");
  for (const packetId of expectedIds) {
    const mapping = unmask?.packets?.[packetId];
    if (!mapping || JSON.stringify(Object.keys(mapping).sort()) !== JSON.stringify(["candidate-a", "candidate-b"])) errors.push(`${packetId}: unmask must map both anonymous candidates`);
    for (const candidate of ["candidate-a", "candidate-b"]) if (!["fresh-upgraded", "historical-baseline"].includes(mapping?.[candidate])) errors.push(`${packetId}/${candidate}: invalid unmask source`);
    if (mapping?.["candidate-a"] === mapping?.["candidate-b"]) errors.push(`${packetId}: unmask candidates must have different sources`);
  }
  return errors;
}

function preferenceOutcome(result, mapping) {
  if (result.preference === "tie") return "tie";
  return mapping[result.preference] === "fresh-upgraded" ? "upgraded" : "baseline";
}

export function aggregateV3(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const validation = validateV3Judgments(root, { namespace });
  if (validation.errors.length > 0) return { errors: validation.errors, fail_closed: true, release_eligible: false, counts: validation.counts, by_skill: {}, records: [] };
  const unmaskPath = join(root, namespace, "blind-judge", "private", "unmask.json");
  const unmask = existsSync(unmaskPath) ? readJson(unmaskPath) : {};
  const unmaskErrors = validateUnmask(unmask, validation.packets.map((record) => record.result.packet_id));
  if (unmaskErrors.length > 0) return { errors: unmaskErrors, fail_closed: true, release_eligible: false, counts: validation.counts, by_skill: {}, records: [] };

  const records = validation.records.map((record) => {
    const result = record.result;
    const mapping = unmask.packets[result.packet_id];
    const candidateMeans = {
      "candidate-a": round4(mean(result.dimension_scores["candidate-a"])),
      "candidate-b": round4(mean(result.dimension_scores["candidate-b"])),
    };
    const upgradedCandidate = mapping["candidate-a"] === "fresh-upgraded" ? "candidate-a" : "candidate-b";
    const baselineCandidate = upgradedCandidate === "candidate-a" ? "candidate-b" : "candidate-a";
    const upgradedMean = candidateMeans[upgradedCandidate];
    const baselineMean = candidateMeans[baselineCandidate];
    return {
      judge_id: result.judge_id,
      packet_id: result.packet_id,
      skill: result.packet_id.split("-seed")[0],
      seed: Number(result.packet_id.match(/seed(\d+)/)?.[1]),
      candidate_source_by_label: mapping,
      preference: result.preference,
      preference_outcome: preferenceOutcome(result, mapping),
      dimension_scores: result.dimension_scores,
      candidate_means: candidateMeans,
      upgraded_mean: upgradedMean,
      baseline_mean: baselineMean,
      mean_delta: round4(upgradedMean - baselineMean),
      reason: result.reason,
      evidence: result.evidence,
      candidate_hashes: {
        "candidate-a": validation.packets.find((packet) => packet.result.packet_id === result.packet_id).result.candidate_a.raw_output_sha256,
        "candidate-b": validation.packets.find((packet) => packet.result.packet_id === result.packet_id).result.candidate_b.raw_output_sha256,
      },
    };
  });
  const bySkill = {};
  for (const skill of SKILLS) {
    const skillRecords = records.filter((record) => record.skill === skill);
    const perSeed = SEEDS.map((seed) => {
      const seedRecords = skillRecords.filter((record) => record.seed === seed);
      const preferenceVotes = { upgraded: 0, baseline: 0, tie: 0 };
      for (const record of seedRecords) preferenceVotes[record.preference_outcome] += 1;
      const meanDelta = round4(seedRecords.reduce((sum, record) => sum + record.mean_delta, 0) / seedRecords.length);
      return { seed, judgment_count: seedRecords.length, preference_votes: preferenceVotes, mean_delta: meanDelta, threshold: MIN_UPGRADED_MEAN_DELTA, release_eligible: meanDelta >= MIN_UPGRADED_MEAN_DELTA, verdict: meanDelta >= MIN_UPGRADED_MEAN_DELTA ? "pass" : "blocked" };
    });
    const meanDelta = round4(skillRecords.reduce((sum, record) => sum + record.mean_delta, 0) / skillRecords.length);
    const preferenceVotes = { upgraded: 0, baseline: 0, tie: 0 };
    for (const record of skillRecords) preferenceVotes[record.preference_outcome] += 1;
    const releaseEligible = meanDelta >= MIN_UPGRADED_MEAN_DELTA && perSeed.every((row) => row.release_eligible);
    bySkill[skill] = { skill, judgment_count: skillRecords.length, preference_votes: preferenceVotes, upgraded_preference_count: preferenceVotes.upgraded, mean_delta: meanDelta, threshold: MIN_UPGRADED_MEAN_DELTA, per_seed: perSeed, release_eligible: releaseEligible, verdict: releaseEligible ? "pass" : "blocked" };
  }
  return { errors: [], fail_closed: false, release_eligible: Object.values(bySkill).every((row) => row.release_eligible), counts: validation.counts, threshold: MIN_UPGRADED_MEAN_DELTA, delta_basis: "unmasked upgraded mean minus baseline mean across five dimensions; votes are descriptive only", by_skill: bySkill, records };
}

export function synthesizeV3(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const validation = validateV3Judgments(root, { namespace });
  const aggregate = aggregateV3(root, { namespace });
  const manifestPath = join(root, namespace, "manifest.json");
  const contractPath = join(root, namespace, "synthesis-contract.json");
  const reclassificationPath = join(root, namespace, "evaluators", "reclassification.json");
  const v2Paths = [
    "evals/replays/remediation7-v2-2026-07-11/manifest.json",
    "evals/replays/remediation7-v2-2026-07-11/blind-judge/synthesis.json",
    "evals/replays/remediation7-v2-2026-07-11/blind-judge/paired-aggregate.json",
    "evals/replays/remediation7-v2-2026-07-11/blind-judge/judge-validation.json",
  ];
  const contract = existsSync(contractPath) ? readJson(contractPath) : {};
  const reclassification = existsSync(reclassificationPath) ? readJson(reclassificationPath) : {};
  const evidencePaths = v2Paths.map((path) => ({ path, sha256: existsSync(join(root, path)) ? fileSha256(join(root, path)) : null }));
  const evidenceBindingErrors = evidencePaths.filter((row) => !row.sha256).map((row) => `missing immutable v2 evidence: ${row.path}`);
  const releaseBlockers = [...evidenceBindingErrors];
  for (const [skill, decision] of Object.entries(aggregate.by_skill)) if (!decision.release_eligible) releaseBlockers.push(`${skill}: mean delta ${decision.mean_delta.toFixed(4)} is below ${MIN_UPGRADED_MEAN_DELTA.toFixed(4)}`);
  if (validation.errors.length > 0 || aggregate.errors.length > 0) releaseBlockers.push("evidence binding or judgment validation failed");
  const bindingValid = validation.errors.length === 0 && aggregate.errors.length === 0 && evidenceBindingErrors.length === 0;
  return {
    errors: [...validation.errors, ...aggregate.errors, ...evidenceBindingErrors],
    schema_version: 1,
    revision_id: "remediation7-v3-correction-2026-07-11",
    namespace,
    kind: "additive-remediation7-v3-synthesis",
    status: bindingValid ? "validated-fail-closed" : "blocked-invalid-evidence",
    release_eligible: bindingValid && aggregate.release_eligible,
    verdict: bindingValid && aggregate.release_eligible ? "release-eligible" : "release-blocked",
    fail_closed: true,
    source: {
      v2_manifest: { path: v2Paths[0], sha256: evidencePaths[0].sha256 },
      v2_evidence: evidencePaths,
      v3_manifest: { path: `${namespace}/manifest.json`, sha256: existsSync(manifestPath) ? fileSha256(manifestPath) : null },
      v3_contract: { path: `${namespace}/synthesis-contract.json`, sha256: existsSync(contractPath) ? fileSha256(contractPath) : null },
      current_source_bindings: readJson(manifestPath).source_bindings?.current ?? {},
      evaluator_reclassification: { path: `${namespace}/evaluators/reclassification.json`, sha256: existsSync(reclassificationPath) ? fileSha256(reclassificationPath) : null, policy: reclassification.policy },
    },
    unaffected_v2: {
      preserved: bindingValid,
      source_hash_gate: contract.unaffected_v2?.source_hash_gate,
      skills: contract.unaffected_v2?.skills ?? [],
      evidence_paths: evidencePaths,
    },
    corrected_evaluator_reclassification: reclassification,
    corrected_skills: aggregate.by_skill,
    paired_release_policy: { min_upgraded_mean_delta: MIN_UPGRADED_MEAN_DELTA, basis: aggregate.delta_basis },
    merge_rule: contract.merge_rule,
    release_blockers: releaseBlockers,
  };
}

export function validateCorrection(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const errors = [];
  const manifestPath = join(root, namespace, "manifest.json");
  if (!existsSync(manifestPath)) return { errors: [`correction manifest missing: ${namespace}/manifest.json`], counts: {} };
  const manifest = readJson(manifestPath);
  if (manifest.namespace !== namespace || manifest.revision_id !== "remediation7-v3-correction-2026-07-11") errors.push("v3 identity mismatch");
  const v2 = v2Tree(root);
  const v2Changed = v2.file_count === manifest.v2_integrity?.file_count
    && v2.tree_sha256 === manifest.v2_integrity?.tree_sha256 ? 0 : 1;
  if (v2Changed) errors.push("immutable v2 tree hash changed");
  let fresh = 0;
  for (const skill of SKILLS) for (const seed of SEEDS) for (const lane of ["paired", "diversity"]) {
    const stem = lane === "paired" ? `${skill}-upgraded-seed${seed}` : `${skill}-diversity-seed${seed}`;
    const path = join(root, namespace, lane, "results", `${stem}.json`);
    if (!existsSync(path)) { errors.push(`missing ${stem}`); continue; }
    fresh += 1;
    const row = readJson(path);
    if (row.executor !== "gpt-5.6-terra" || row.status !== "complete") errors.push(`${stem}: not a complete Terra receipt`);
    if (row.raw_output_hash !== sha256(row.raw_output ?? "")) errors.push(`${stem}: raw output hash mismatch`);
    for (const field of ["status", "reason", "remediation", "evidence", "provenance"]) if (!new RegExp(`\\b${field}\\b`, "i").test(row.raw_output)) errors.push(`${stem}: ${field} missing`);
    if (row.skill_source_sha256 !== manifest.source_bindings.current[skill].sha256) errors.push(`${stem}: current source binding mismatch`);
    if (lane === "diversity") for (const item of row.semantic_variation_evidence?.material_axes ?? []) if (!row.raw_output.includes(item.evidence)) errors.push(`${stem}: semantic evidence is not exact`);
  }
  for (const skill of SKILLS) {
    const attempts = SEEDS.map((seed) => readJson(join(root, namespace, "diversity", "results", `${skill}-diversity-seed${seed}.json`)));
    if (!evaluateDiversity(attempts, { semantic_diversity: diversityContract(skill) }).overall_pass) errors.push(`${skill}: semantic diversity failed`);
    for (const attempt of attempts) if (!evaluateAntiSlop(attempt, { source_text: scenario(root, skill).prompt }).pass) errors.push(`${attempt.job_id}: anti-slop failed`);
  }
  const packetDir = join(root, namespace, "blind-judge", "packets");
  const packets = existsSync(packetDir) ? readdirSync(packetDir).filter((name) => name.endsWith(".json")) : [];
  if (packets.length !== 6) errors.push("six neutral blinded packets required");
  for (const name of packets) {
    const packetErrors = validateBlindPacket(readJson(join(packetDir, name)));
    errors.push(...packetErrors.map((error) => `${name}: ${error}`));
  }
  const judgeManifest = existsSync(join(root, namespace, "blind-judge", "manifest.json")) && readJson(join(root, namespace, "blind-judge", "manifest.json"));
  const schemaPath = join(root, namespace, "blind-judge", "judge-result-schema.json");
  if (!existsSync(schemaPath)) errors.push("judge result schema missing");
  else errors.push(...validateJudgeResultSchema(readJson(schemaPath)).map((error) => `judge schema: ${error}`));
  if (!judgeManifest || judgeManifest.packet_schema_version !== 2 || judgeManifest.judge_result_schema_version !== 2 || judgeManifest.expected_judgment_count !== EXPECTED_JUDGMENT_COUNT || !["scaffolded-not-judged", "validated-aggregated"].includes(judgeManifest.status)) errors.push("18-Judgment Luna manifest invalid");
  if (manifest.paired_lane.threshold.min_upgraded_mean_delta !== MIN_UPGRADED_MEAN_DELTA || manifest.synthesis_contract.corrected_evaluator_reclassification.policy !== "current-contract-recompute-only") errors.push("synthesis threshold or reclassification contract drifted");
  return { errors, counts: { fresh_terra_results: fresh, historical_baseline_inputs: manifest.paired_lane.historical_input_count, blind_packets: packets.length, pending_luna_judgments: judgeManifest?.expected_judgment_count ?? 0, v2_files_changed: v2Changed }, manifest };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = process.argv.includes("--synthesize") ? synthesizeV3() : process.argv.includes("--aggregate") ? aggregateV3() : validateV3Judgments();
  if ((result.errors ?? []).length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
  else console.log(JSON.stringify(result.counts, null, 2));
}
