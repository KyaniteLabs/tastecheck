#!/usr/bin/env node
/** Validate, unmask, and aggregate the single final remediation7 v5 spacing replay. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_NAMESPACE = "evals/replays/remediation7-v5-spacing-final-2026-07-11";
export const REVISION_ID = "remediation7-v5-spacing-final-2026-07-11";
export const JUDGES = ["luna-1", "luna-2", "luna-3", "luna-4"];
export const SEEDS = [101, 202, 303];
export const DIMENSIONS = ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"];
export const MIN_UPGRADED_MEAN_DELTA = 0.6;
export const DIRECT_LUNA_FALLBACK_THREAD_ID = "redacted-local-evaluator-session";
export const DIRECT_LUNA_FALLBACK_THREAD_SHA256 = "f4168a31730fd38346e547598e91f755f4d0820a5b99374982a18856cf7008cc";
export const HISTORICAL_REPLAYS = ["remediation7-v2-2026-07-11", "remediation7-v3-correction-2026-07-11", "remediation7-v4-correction-2026-07-11"];

const EXPECTED_JUDGMENTS = 20;
const EXPECTED_REAL_JUDGMENTS = 12;
const EXPECTED_CONTROLS = 8;
const CURRENT_SOURCE = "fresh-current-source";
const FROZEN_BASELINE = "frozen-v010-baseline";
const V2_BASELINE = "evals/replays/remediation7-v2-2026-07-11/paired/results";
const REQUIRED_RESULT_FIELDS = ["packet_id", "judge_id", "comparison_id", "preference", "dimension_scores", "reason", "evidence"];

const sha = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const fileSha = (path) => sha(readFileSync(path));
const round4 = (value) => Number(value.toFixed(4));
const add = (errors, condition, message) => { if (condition) errors.push(message); };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sameKeys = (value, expected) => isObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

function tree(root, repoPath) {
  const rows = [];
  const at = join(root, repoPath);
  if (!existsSync(at)) return { file_count: 0, tree_sha256: sha("") };
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) walk(child);
    else rows.push(`${relative(root, child)}\0${fileSha(child)}\n`);
  });
  walk(at);
  return { file_count: rows.length, tree_sha256: sha(rows.sort().join("")) };
}

function validateOutput(raw, label) {
  const errors = [];
  if (typeof raw !== "string" || raw.length === 0) return [`${label}: raw output must be non-empty text`];
  const lower = raw.toLowerCase();
  add(errors, raw.split("| relationship | token | dispatcher use | public-account/editorial use | layout ownership |").length - 1 !== 1, `${label}: needs one compact application map with exact fields`);
  for (const role of ["attachment", "control", "task", "group", "region", "chapter"]) add(errors, lower.split(`| ${role} |`).length - 1 !== 1, `${label}: application map must cover ${role} exactly once`);
  for (const phrase of ["4/8/12/16/24/32/48/64/96px", "--space-section: clamp(48px, 32px + 4vw, 96px)", "operational", "8/16/24", "editorial", "finding", "subsection", "chapter", "gap", "margin-block-start", "1em", "13px", "17px", "19px", "bare 24px", "var(--space-5)", "pending", "fixture", "responsive-layout"]) add(errors, !lower.includes(phrase.toLowerCase()), `${label}: missing scenario evidence ${phrase}`);
  add(errors, !lower.includes("reject"), `${label}: responsive-layout rejection is not explicit`);
  add(errors, raw.split("Authoritative self-check").length - 1 !== 1, `${label}: needs exactly one Authoritative self-check`);
  return errors;
}

function validateCandidate(candidate, label) {
  const errors = [];
  add(errors, !sameKeys(candidate, ["raw_output", "raw_output_sha256"]), `${label}: packet candidate metadata is not blind`);
  add(errors, typeof candidate?.raw_output !== "string" || candidate.raw_output.length === 0, `${label}: missing embedded candidate text`);
  add(errors, candidate?.raw_output_sha256 !== sha(candidate?.raw_output ?? ""), `${label}: candidate hash mismatch`);
  return errors;
}

function hasNonEmptyEvidence(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0 && value.every(hasNonEmptyEvidence);
  if (isObject(value)) return Object.keys(value).length > 0 && Object.values(value).every(hasNonEmptyEvidence);
  return false;
}

function schemaDimensions(schema) {
  return schema?.dimension_scores?.["candidate-a"] ?? DIMENSIONS;
}

function schemaPreferences(schema) {
  return schema?.preference ?? ["candidate-a", "candidate-b", "tie"];
}

export function validateJudgeBatchResults(batch, results, schema = {}, { expectedPacketId } = {}) {
  const errors = [];
  const items = Array.isArray(batch?.items) ? batch.items : [];
  const dimensions = schemaDimensions(schema);
  const preferences = schemaPreferences(schema);
  const requiredFields = schema?.required ?? REQUIRED_RESULT_FIELDS;
  const expectedIds = items.map((item) => item?.comparison_id).filter((id) => typeof id === "string");
  const itemsById = new Map();
  for (const item of items) {
    if (itemsById.has(item?.comparison_id)) errors.push(`${batch?.judge_id ?? "unknown judge"}: duplicate packet comparison ${item?.comparison_id}`);
    itemsById.set(item?.comparison_id, item);
  }
  if (!Array.isArray(results)) return [`${batch?.judge_id ?? "unknown judge"}: judgment results must be an array`];
  if (results.length !== items.length) errors.push(`${batch?.judge_id ?? "unknown judge"}: requires exactly ${items.length} results; found ${results.length}`);
  const seen = new Set();
  for (const result of results) {
    if (!isObject(result)) { errors.push(`${batch?.judge_id ?? "unknown judge"}: judgment result must be an object`); continue; }
    for (const field of requiredFields) if (!(field in result)) errors.push(`${result.comparison_id ?? "unknown comparison"}: missing required field ${field}`);
    const id = result.comparison_id;
    if (seen.has(id)) errors.push(`${batch.judge_id}: duplicate result ${id}`);
    seen.add(id);
    const item = itemsById.get(id);
    if (!item) { errors.push(`${batch.judge_id}: result targets an unknown comparison`); continue; }
    if (typeof result.packet_id !== "string" || result.packet_id.trim().length === 0) errors.push(`${id}: packet_id must be a non-empty string`);
    else if (expectedPacketId !== undefined && result.packet_id !== expectedPacketId) errors.push(`${id}: packet_id mismatch`);
    if (result.judge_id !== batch.judge_id) errors.push(`${id}: judge_id mismatch`);
    if (!preferences.includes(result.preference)) errors.push(`${id}: invalid preference`);
    if (typeof result.reason !== "string" || result.reason.trim().length === 0) errors.push(`${id}: reason must be non-empty`);
    if (!hasNonEmptyEvidence(result.evidence)) errors.push(`${id}: evidence must be non-empty`);
    for (const side of ["candidate-a", "candidate-b"]) {
      const scores = result.dimension_scores?.[side];
      if (!sameKeys(scores, dimensions)) errors.push(`${id}: ${side} dimension scores must match the five required dimensions exactly`);
      for (const dimension of dimensions) if (!Number.isInteger(scores?.[dimension]) || scores[dimension] < 1 || scores[dimension] > 5) errors.push(`${id}: invalid ${side} score for ${dimension}`);
    }
    if (item.kind === "identical-control") {
      const equal = dimensions.every((dimension) => result.dimension_scores?.["candidate-a"]?.[dimension] === result.dimension_scores?.["candidate-b"]?.[dimension]);
      if (result.preference !== "tie" || !equal) errors.push(`${batch.judge_id}: control ${id} failed; entire judge batch is inadmissible`);
    }
  }
  for (const id of expectedIds) if (!seen.has(id)) errors.push(`${batch.judge_id}: missing result ${id}`);
  return errors;
}

function collectJudgmentFiles(root, namespace) {
  const base = join(root, namespace, "blind-judge", "judgments");
  const rows = [];
  if (!existsSync(base)) return rows;
  const walk = (directory, judgeDirectory) => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, judgeDirectory ?? entry.name);
    if (!entry.name.endsWith(".json")) return;
    const row = { path: relative(root, path), sha256: fileSha(path), judge_directory: judgeDirectory, result: null, parse_error: null };
    try { row.result = read(path); } catch (error) { row.parse_error = error.message; }
    rows.push(row);
  });
  walk(base, undefined);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function staticValidation(root, namespace) {
  const errors = [];
  const base = join(root, namespace);
  const manifest = existsSync(join(base, "manifest.json")) ? read(join(base, "manifest.json")) : {};
  const index = existsSync(join(base, "receipts.json")) ? read(join(base, "receipts.json")) : {};
  const packets = existsSync(join(base, "blind-judge", "packets.json")) ? read(join(base, "blind-judge", "packets.json")) : {};
  const unmask = existsSync(join(base, "blind-judge", "private", "unmask-assignment-map.json")) ? read(join(base, "blind-judge", "private", "unmask-assignment-map.json")) : {};
  const schema = existsSync(join(base, "blind-judge", "judge-result-schema-v2.json")) ? read(join(base, "blind-judge", "judge-result-schema-v2.json")) : {};
  const receipts = Array.isArray(index.receipts) ? index.receipts : [];
  const receiptBySeed = new Map(receipts.map((receipt) => [receipt.requested_seed, receipt]));
  add(errors, receipts.length !== SEEDS.length || new Set(receipts.map((r) => r.requested_seed)).size !== SEEDS.length, "requires exactly three unique seed receipts");
  const skillHash = fileSha(join(root, "skills/spacing-system/SKILL.md"));
  const scenarioHash = fileSha(join(root, "evals/scenarios/spacing-system.json"));
  for (const seed of SEEDS) {
    const receipt = receiptBySeed.get(seed);
    const label = `seed${seed}`;
    const path = join(base, "paired", "results", `spacing-system-upgraded-seed${seed}.json`);
    add(errors, !receipt || receipt.executor !== "gpt-5.6-terra" || receipt.status !== "complete", `${label}: missing completed Terra receipt`);
    if (!receipt) continue;
    add(errors, receipt.skill_source_sha256 !== skillHash || receipt.scenario_source_sha256 !== scenarioHash, `${label}: current source hash mismatch`);
    add(errors, !existsSync(path) || JSON.stringify(read(path)) !== JSON.stringify(receipt), `${label}: static result file diverged`);
    add(errors, manifest.receipt_output_sha256?.[receipt.job_id] !== sha(receipt.raw_output), `${label}: raw output hash mismatch`);
    errors.push(...validateOutput(receipt.raw_output, label));
    const baseline = manifest.frozen_baseline?.results?.["spacing-system"]?.[seed];
    const baselinePath = join(root, baseline?.result_path ?? "");
    add(errors, !baseline || !existsSync(baselinePath) || fileSha(baselinePath) !== baseline.result_sha256 || sha(read(baselinePath).raw_output) !== baseline.raw_output_sha256, `${label}: frozen v0.1.0 baseline binding mismatch`);
  }
  add(errors, manifest.schema_version !== 1 || manifest.revision_id !== REVISION_ID || manifest.namespace !== namespace || manifest.static_evidence_only !== true, "manifest identity or static-evidence binding drifted");
  add(errors, manifest.frozen_baseline?.release !== "v0.1.0", "baseline must remain frozen v0.1.0");
  add(errors, JSON.stringify(manifest.source_bindings?.["spacing-system"]) !== JSON.stringify({ skill_path: "skills/spacing-system/SKILL.md", skill_sha256: skillHash, scenario_path: "evals/scenarios/spacing-system.json", scenario_sha256: scenarioHash }), "manifest source bindings drifted");
  add(errors, JSON.stringify(Object.keys(manifest.historical_integrity ?? {}).sort()) !== JSON.stringify(HISTORICAL_REPLAYS), "historical integrity registry must bind v2, v3, and v4 exactly");
  for (const replay of HISTORICAL_REPLAYS) add(errors, JSON.stringify(tree(root, `evals/replays/${replay}`)) !== JSON.stringify(manifest.historical_integrity?.[replay]), `immutable ${replay} tree changed`);
  add(errors, schema.schema_version !== 2 || JSON.stringify(schema.required) !== JSON.stringify(REQUIRED_RESULT_FIELDS) || JSON.stringify(schema.preference) !== JSON.stringify(["candidate-a", "candidate-b", "tie"]) || JSON.stringify(schema.dimension_scores?.["candidate-a"]) !== JSON.stringify(DIMENSIONS) || JSON.stringify(schema.dimension_scores?.["candidate-b"]) !== JSON.stringify(DIMENSIONS), "requires schema-v2 candidate-specific five dimensions and required result fields");
  add(errors, schema.control_admissibility?.preference !== "tie" || schema.control_admissibility?.equal_candidate_scores !== true || schema.control_admissibility?.invalidates_entire_judge_batch !== true, "control admissibility rules drifted");
  add(errors, schema.score_range?.minimum !== 1 || schema.score_range?.maximum !== 5 || schema.score_range?.integer !== true, "score range must be integer 1..5");

  const batches = Array.isArray(packets.judge_batches) ? packets.judge_batches : [];
  add(errors, packets.schema_version !== 2 || batches.length !== JUDGES.length, "requires four blind batches");
  add(errors, JSON.stringify(batches.map((batch) => batch.judge_id).sort()) !== JSON.stringify([...JUDGES].sort()), "blind batch judge set drifted");
  let realPairs = 0;
  let controls = 0;
  const freshPositions = new Map();
  for (const batch of batches) {
    const items = Array.isArray(batch.items) ? batch.items : [];
    const real = items.filter((item) => item.kind === "real");
    const control = items.filter((item) => item.kind === "identical-control");
    add(errors, batch.batch_id !== `blind-batch-${batch.judge_id}` || typeof batch.instructions !== "string" || batch.instructions.trim().length === 0, `${batch.judge_id}: batch identity or instructions drifted`);
    add(errors, items.length !== 5 || new Set(items.map((item) => item.comparison_id)).size !== 5 || real.length !== 3 || control.length !== 2, `${batch.judge_id}: requires three real pairs and two controls`);
    realPairs += real.length;
    controls += control.length;
    for (const item of items) {
      add(errors, item.candidate_payloads_embedded !== true, `${batch.judge_id}/${item.comparison_id}: packet is not self-contained`);
      errors.push(...validateCandidate(item.candidate_a, `${batch.judge_id}/${item.comparison_id}/a`), ...validateCandidate(item.candidate_b, `${batch.judge_id}/${item.comparison_id}/b`));
      if (item.kind === "identical-control") {
        const declared = unmask.controls?.[item.comparison_id];
        add(errors, item.expected_preference !== "tie" || item.candidate_a?.raw_output !== item.candidate_b?.raw_output || item.candidate_a?.raw_output_sha256 !== item.candidate_b?.raw_output_sha256 || declared?.expected_preference !== "tie" || declared?.identical !== true || declared?.candidate_a_sha256 !== item.candidate_a?.raw_output_sha256 || declared?.candidate_b_sha256 !== item.candidate_b?.raw_output_sha256, `${batch.judge_id}/${item.comparison_id}: control must be predeclared identical TIE`);
        continue;
      }
      const assignment = unmask.assignments?.[item.comparison_id];
      const mapping = assignment?.by_judge?.[batch.judge_id];
      add(errors, !assignment || assignment.skill !== "spacing-system" || !SEEDS.includes(assignment.seed) || assignment.frozen_baseline_release !== "v0.1.0" || !mapping, `${batch.judge_id}/${item.comparison_id}: private assignment missing or malformed`);
      for (const side of ["candidate-a", "candidate-b"]) {
        const source = mapping?.[side];
        const candidate = side === "candidate-a" ? item.candidate_a : item.candidate_b;
        const current = receiptBySeed.get(assignment?.seed)?.raw_output;
        const oldPath = join(root, V2_BASELINE, `spacing-system-baseline-seed${assignment?.seed}.json`);
        const expected = source === CURRENT_SOURCE ? current : source === FROZEN_BASELINE && existsSync(oldPath) ? read(oldPath).raw_output : undefined;
        add(errors, ![CURRENT_SOURCE, FROZEN_BASELINE].includes(source), `${batch.judge_id}/${item.comparison_id}/${side}: unknown private source label`);
        add(errors, candidate?.raw_output !== expected, `${batch.judge_id}/${item.comparison_id}/${side}: private source binding mismatch`);
        const tally = freshPositions.get(item.comparison_id) ?? { "candidate-a": 0, "candidate-b": 0 };
        if (source === CURRENT_SOURCE) tally[side] += 1;
        freshPositions.set(item.comparison_id, tally);
      }
    }
  }
  for (const [id, tally] of freshPositions) add(errors, tally["candidate-a"] !== 2 || tally["candidate-b"] !== 2, `${id}: fresh candidate must be A twice and B twice`);
  add(errors, Object.keys(unmask.assignments ?? {}).length !== 3 || Object.keys(unmask.controls ?? {}).length !== 2, "private unmask map must contain three real assignments and two controls");
  add(errors, realPairs !== EXPECTED_REAL_JUDGMENTS || controls !== EXPECTED_CONTROLS, "blind assignment count must be 12 real plus 8 controls");
  const protocol = manifest.blind_protocol ?? {};
  add(errors, protocol.judge_batches !== 4 || protocol.real_pairs_per_judge !== 3 || protocol.identical_controls_per_judge !== 2 || protocol.real_judgments_expected !== EXPECTED_REAL_JUDGMENTS || protocol.control_judgments_expected !== EXPECTED_CONTROLS || protocol.total_judgments_expected !== EXPECTED_JUDGMENTS || protocol.raw_mean_delta_threshold !== MIN_UPGRADED_MEAN_DELTA, "blind protocol scaffold drifted");
  const stop = manifest.forensic_stop_rule ?? {};
  add(errors, stop.single_final_replay !== true || stop.no_rerun !== true || stop.no_cherry_pick !== true || stop.applies_regardless_of_result !== true, "forensic single-final-replay stop rule drifted");
  return { errors, manifest, receipts, receiptBySeed, packets, schema, unmask, batches, counts: { receipts: receipts.length, real_pairs: realPairs, controls }, namespace };
}

function validateJudgments(root, namespace, base) {
  const errors = [...base.errors];
  const files = collectJudgmentFiles(root, namespace);
  const byJudge = Object.fromEntries(JUDGES.map((judge) => [judge, []]));
  for (const row of files) {
    if (row.parse_error) { errors.push(`${row.path}: invalid JSON`); continue; }
    if (!byJudge[row.judge_directory]) errors.push(`${row.path}: unexpected judge directory`);
    else byJudge[row.judge_directory].push(row.result);
    if (row.result?.judge_id !== row.judge_directory) errors.push(`${row.path}: judge directory/result judge_id mismatch`);
  }
  add(errors, files.length !== EXPECTED_JUDGMENTS, `requires exactly ${EXPECTED_JUDGMENTS} judgment files; found ${files.length}`);
  const resultIds = new Set();
  const batchErrors = {};
  for (const judge of JUDGES) {
    const batch = base.batches.find((item) => item.judge_id === judge);
    const results = byJudge[judge];
    const ids = results.map((result) => `${result?.judge_id}\0${result?.comparison_id}`);
    ids.forEach((id) => resultIds.add(id));
    batchErrors[judge] = validateJudgeBatchResults(batch ?? { judge_id: judge, items: [] }, results, base.schema, { expectedPacketId: `${base.manifest.revision_id}/${judge}` });
    errors.push(...batchErrors[judge]);
  }
  add(errors, resultIds.size !== EXPECTED_JUDGMENTS, `requires ${EXPECTED_JUDGMENTS} unique judge/comparison results; found ${resultIds.size}`);
  const allBatchesAdmissible = JUDGES.every((judge) => batchErrors[judge]?.length === 0);
  const controlsAdmissible = JUDGES.every((judge) => !(batchErrors[judge] ?? []).some((error) => error.includes("control") || error.includes("inadmissible")));
  return {
    ...base,
    errors,
    files,
    byJudge,
    batchErrors,
    allBatchesAdmissible,
    controlsAdmissible,
    counts: {
      ...base.counts,
      total_judgments: files.length,
      unique_results: resultIds.size,
      pending_judgments: Math.max(EXPECTED_JUDGMENTS - files.length, 0),
      completed_judgments: files.length,
      judgment_files: files.length,
    },
  };
}

export function validateCorrection(root = ROOT, { namespace = DEFAULT_NAMESPACE, requireCompleted = true } = {}) {
  const validation = validateJudgments(root, namespace, staticValidation(root, namespace));
  const protocol = validation.manifest.blind_protocol ?? {};
  const pendingState = protocol.pending_judgments === EXPECTED_JUDGMENTS && protocol.completed_judgments === 0 && protocol.unmasking_performed === false && protocol.synthesis_claimed === false;
  const completedState = protocol.pending_judgments === 0 && protocol.completed_judgments === EXPECTED_JUDGMENTS && protocol.unmasking_performed === true && protocol.synthesis_claimed === true && protocol.controls_admissible === true;
  add(validation.errors, requireCompleted ? !completedState : !(pendingState || completedState), requireCompleted ? "manifest must record completed validated evidence" : "manifest protocol is malformed");
  if (requireCompleted) {
    add(validation.errors, !validation.allBatchesAdmissible || !validation.controlsAdmissible, "all four judge batches must be complete and control-admissible");
    const privateFallbackRef = validation.manifest.dispatch_incident?.direct_luna_fallback_thread_id;
    const fallbackBindingMatches = privateFallbackRef === DIRECT_LUNA_FALLBACK_THREAD_ID
      || (typeof privateFallbackRef === "string" && sha(privateFallbackRef) === DIRECT_LUNA_FALLBACK_THREAD_SHA256);
    add(validation.errors, !fallbackBindingMatches, "direct Luna aggregator fallback thread binding drifted");
    if (fallbackBindingMatches) {
      validation.manifest.dispatch_incident.direct_luna_fallback_thread_id = DIRECT_LUNA_FALLBACK_THREAD_ID;
      validation.manifest.dispatch_incident.aggregator_worker_id = "redacted-dispatch-worker";
    }
    const outputs = validation.manifest.materialized_outputs ?? {};
    for (const key of ["judge_validation", "unmasked_results", "paired_aggregate", "synthesis"]) {
      const output = outputs[key];
      const path = join(root, output?.path ?? "");
      add(validation.errors, !output || !existsSync(path) || fileSha(path) !== output.sha256, `materialized ${key} artifact binding drifted`);
    }
    const unmaskedPath = join(root, outputs.unmasked_results?.path ?? "");
    if (existsSync(unmaskedPath)) {
      const unmasked = read(unmaskedPath);
      add(validation.errors, unmasked.kind !== "remediation7-v5-unmasked-real-results" || unmasked.record_count !== EXPECTED_REAL_JUDGMENTS || !Array.isArray(unmasked.records) || unmasked.records.length !== EXPECTED_REAL_JUDGMENTS, "unmasked results artifact must contain the 12 real records");
    }
    const aggregatePath = join(root, outputs.paired_aggregate?.path ?? "");
    const synthesisPath = join(root, outputs.synthesis?.path ?? "");
    if (existsSync(aggregatePath)) {
      const aggregate = read(aggregatePath);
      add(validation.errors, aggregate.unmasked_results_path !== outputs.unmasked_results?.path || aggregate.unmasked_results_sha256 !== outputs.unmasked_results?.sha256, "paired aggregate must bind the explicit unmasked results artifact");
    }
    if (existsSync(synthesisPath)) {
      const synthesis = read(synthesisPath);
      add(validation.errors, synthesis.source?.unmasked_results_path !== outputs.unmasked_results?.path || synthesis.source?.unmasked_results_sha256 !== outputs.unmasked_results?.sha256, "synthesis must bind the explicit unmasked results artifact");
    }
  }
  return validation;
}

function mean(scores) { return DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) / DIMENSIONS.length; }

function unmaskedRecords(validation) {
  const packetByJudgePair = new Map(validation.batches.flatMap((batch) => batch.items.filter((item) => item.kind === "real").map((item) => [`${batch.judge_id}/${item.comparison_id}`, item])));
  const fileByJudgePair = new Map(validation.files.filter((row) => row.result).map((row) => [`${row.judge_directory}/${row.result.comparison_id}`, row]));
  const records = [];
  for (const row of validation.files) {
    const result = row.result;
    if (!result) continue;
    const item = packetByJudgePair.get(`${result.judge_id}/${result.comparison_id}`);
    if (!item || item.kind !== "real") continue;
    const assignment = validation.unmask.assignments[result.comparison_id];
    const sources = assignment.by_judge[result.judge_id];
    const currentLabel = sources["candidate-a"] === CURRENT_SOURCE ? "candidate-a" : "candidate-b";
    const baselineLabel = currentLabel === "candidate-a" ? "candidate-b" : "candidate-a";
    const currentScores = result.dimension_scores[currentLabel];
    const baselineScores = result.dimension_scores[baselineLabel];
    const candidateMeans = Object.fromEntries(["candidate-a", "candidate-b"].map((label) => [label, round4(mean(result.dimension_scores[label]))]));
    const preferenceOutcome = result.preference === "tie" ? "tie" : sources[result.preference] === CURRENT_SOURCE ? "current_source" : "frozen_baseline";
    records.push({
      judgment_path: row.path,
      judgment_sha256: row.sha256,
      packet_id: result.packet_id,
      judge_id: result.judge_id,
      comparison_id: result.comparison_id,
      skill: assignment.skill,
      seed: assignment.seed,
      candidate_source_by_label: sources,
      preference: result.preference,
      preference_outcome: preferenceOutcome,
      dimension_scores: result.dimension_scores,
      candidate_means: candidateMeans,
      current_source_dimension_means: currentScores,
      frozen_baseline_dimension_means: baselineScores,
      current_source_mean: round4(mean(currentScores)),
      frozen_baseline_mean: round4(mean(baselineScores)),
      mean_delta: round4(mean(currentScores) - mean(baselineScores)),
      candidate_hashes: { "candidate-a": item.candidate_a.raw_output_sha256, "candidate-b": item.candidate_b.raw_output_sha256 },
    });
  }
  return records.sort((a, b) => a.skill.localeCompare(b.skill) || a.seed - b.seed || a.judge_id.localeCompare(b.judge_id));
}

function preferenceCounts(records) {
  const counts = { current_source: 0, frozen_baseline: 0, tie: 0 };
  for (const record of records) counts[record.preference_outcome] += 1;
  return counts;
}

function aggregateGroup(records, label) {
  const currentTotals = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
  const baselineTotals = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
  for (const record of records) for (const dimension of DIMENSIONS) {
    currentTotals[dimension] += record.current_source_dimension_means[dimension];
    baselineTotals[dimension] += record.frozen_baseline_dimension_means[dimension];
  }
  const judgmentCount = records.length;
  const currentScoreTotal = Object.values(currentTotals).reduce((sum, score) => sum + score, 0);
  const baselineScoreTotal = Object.values(baselineTotals).reduce((sum, score) => sum + score, 0);
  const currentDimensionMeans = judgmentCount ? Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, round4(currentTotals[dimension] / judgmentCount)])) : null;
  const baselineDimensionMeans = judgmentCount ? Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, round4(baselineTotals[dimension] / judgmentCount)])) : null;
  const currentMean = judgmentCount ? round4(currentScoreTotal / (judgmentCount * DIMENSIONS.length)) : null;
  const baselineMean = judgmentCount ? round4(baselineScoreTotal / (judgmentCount * DIMENSIONS.length)) : null;
  const rawDelta = judgmentCount ? round4((currentScoreTotal - baselineScoreTotal) / (judgmentCount * DIMENSIONS.length)) : null;
  const releaseEligible = rawDelta !== null && rawDelta >= MIN_UPGRADED_MEAN_DELTA;
  return {
    group: label,
    judgment_count: judgmentCount,
    current_source_dimension_means: currentDimensionMeans,
    frozen_baseline_dimension_means: baselineDimensionMeans,
    current_source_mean: currentMean,
    frozen_baseline_mean: baselineMean,
    mean_delta: rawDelta,
    raw_mean_delta_current_minus_baseline: rawDelta,
    threshold: MIN_UPGRADED_MEAN_DELTA,
    preference_counts: preferenceCounts(records),
    release_eligible: releaseEligible,
    verdict: releaseEligible ? "pass" : "blocked",
  };
}

export function aggregateV5(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const validation = validateCorrection(root, { namespace, requireCompleted: false });
  const valid = validation.errors.length === 0 && validation.allBatchesAdmissible && validation.controlsAdmissible && validation.files.length === EXPECTED_JUDGMENTS && validation.counts.unique_results === EXPECTED_JUDGMENTS;
  if (!valid) return { errors: validation.errors.length ? validation.errors : ["all four judge batches must be complete and admissible"], fail_closed: true, release_eligible: false, counts: validation.counts, threshold: MIN_UPGRADED_MEAN_DELTA, by_skill: {}, overall: null, records: [] };
  const records = unmaskedRecords(validation);
  const bySkill = { "spacing-system": aggregateGroup(records.filter((record) => record.skill === "spacing-system"), "spacing-system") };
  const overall = aggregateGroup(records, "overall");
  return {
    errors: [],
    fail_closed: false,
    release_eligible: bySkill["spacing-system"].release_eligible && overall.release_eligible,
    counts: validation.counts,
    threshold: MIN_UPGRADED_MEAN_DELTA,
    delta_basis: "current-source mean minus frozen-baseline mean across five dimensions; preference counts are descriptive only",
    by_skill: bySkill,
    overall,
    records,
    judgment_file_hashes: validation.files.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function synthesizeV5(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const validation = validateCorrection(root, { namespace, requireCompleted: false });
  const aggregate = aggregateV5(root, { namespace });
  const basePath = join(root, namespace);
  const blindPath = join(basePath, "blind-judge");
  const validationPath = join(blindPath, "judge-validation.json");
  const validationOutput = {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace,
    kind: "remediation7-v5-blind-judge-validation",
    status: aggregate.fail_closed ? "invalid" : "validated",
    pass: !aggregate.fail_closed,
    expected_count: EXPECTED_JUDGMENTS,
    found_count: validation.files.length,
    validated_count: aggregate.fail_closed ? 0 : EXPECTED_JUDGMENTS,
    failure_count: aggregate.errors.length,
    controls_admissible: !aggregate.fail_closed && validation.controlsAdmissible,
    all_batches_admissible: !aggregate.fail_closed && validation.allBatchesAdmissible,
    unmasking_performed: !aggregate.fail_closed,
    errors: aggregate.errors,
    per_judge: Object.fromEntries(JUDGES.map((judge) => [judge, validation.byJudge[judge].length])),
    judgment_file_hashes: validation.files.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
    provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID },
  };
  writeJson(validationPath, validationOutput);
  const unmaskedPath = join(blindPath, "unmasked-results.json");
  const unmaskedOutput = aggregate.fail_closed
    ? { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v5-unmasked-real-results", status: "blocked-invalid-evidence", record_count: 0, records: [], errors: aggregate.errors, provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID } }
    : { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v5-unmasked-real-results", status: "validated-unmasked", record_count: EXPECTED_REAL_JUDGMENTS, records: aggregate.records, judgment_file_hashes: aggregate.judgment_file_hashes, provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID } };
  writeJson(unmaskedPath, unmaskedOutput);
  const aggregatePath = join(blindPath, "paired-aggregate.json");
  const aggregateOutput = aggregate.fail_closed
    ? { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v5-paired-preference-aggregate", status: "blocked-invalid-evidence", validation_path: relative(root, validationPath), errors: aggregate.errors, fail_closed: true, release_eligible: false, counts: validation.counts, threshold: MIN_UPGRADED_MEAN_DELTA, records: [] }
    : { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v5-paired-preference-aggregate", status: "validated-aggregated", validation_path: relative(root, validationPath), validation_sha256: fileSha(validationPath), unmasked_results_path: relative(root, unmaskedPath), unmasked_results_sha256: fileSha(unmaskedPath), unmask_path: `${namespace}/blind-judge/private/unmask-assignment-map.json`, unmask_sha256: fileSha(join(basePath, "blind-judge/private/unmask-assignment-map.json")), errors: [], fail_closed: false, release_eligible: aggregate.release_eligible, counts: aggregate.counts, threshold: aggregate.threshold, delta_basis: aggregate.delta_basis, by_skill: aggregate.by_skill, overall: aggregate.overall, records: aggregate.records, judgment_file_hashes: aggregate.judgment_file_hashes, forensic_stop_rule: validation.manifest.forensic_stop_rule, provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID } };
  writeJson(aggregatePath, aggregateOutput);
  const synthesisPath = join(blindPath, "synthesis.json");
  const synthesis = aggregate.fail_closed
    ? { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "additive-remediation7-v5-synthesis", status: "blocked-invalid-evidence", release_eligible: false, verdict: "release-blocked", fail_closed: true, errors: aggregate.errors, threshold: MIN_UPGRADED_MEAN_DELTA, source: { validation_path: relative(root, validationPath), aggregate_path: relative(root, aggregatePath) }, provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID }, forensic_stop_rule: validation.manifest.forensic_stop_rule }
    : { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "additive-remediation7-v5-synthesis", status: aggregate.release_eligible ? "release-eligible" : "threshold-blocked", release_eligible: aggregate.release_eligible, verdict: aggregate.release_eligible ? "release-eligible" : "release-blocked", fail_closed: true, errors: [], threshold: MIN_UPGRADED_MEAN_DELTA, source: { validation_path: relative(root, validationPath), validation_sha256: fileSha(validationPath), unmasked_results_path: relative(root, unmaskedPath), unmasked_results_sha256: fileSha(unmaskedPath), aggregate_path: relative(root, aggregatePath), aggregate_sha256: fileSha(aggregatePath) }, provenance: { direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID }, forensic_stop_rule: validation.manifest.forensic_stop_rule, by_skill: aggregate.by_skill, overall: aggregate.overall, rule: "release eligibility is determined only by raw_mean_delta_current_minus_baseline >= +0.6 for spacing-system and overall; preference counts are descriptive" };
  writeJson(synthesisPath, synthesis);

  if (!aggregate.fail_closed) {
    const manifestPath = join(basePath, "manifest.json");
    const manifest = read(manifestPath);
    manifest.blind_protocol = { ...manifest.blind_protocol, pending_judgments: 0, completed_judgments: EXPECTED_JUDGMENTS, unmasking_performed: true, synthesis_claimed: true, controls_admissible: true, synthesis_status: synthesis.status, release_eligible: aggregate.release_eligible };
    manifest.dispatch_incident = {
      ...manifest.dispatch_incident,
      aggregator_worker_id: "redacted-dispatch-worker",
      aggregator_executor: "zai-glm",
      aggregator_worker_state: "starting-zero-tokens-zero-turns",
      aggregator_tokens_in: 0,
      aggregator_tokens_out: 0,
      aggregator_turns_taken: 0,
      direct_luna_fallback_thread_id: DIRECT_LUNA_FALLBACK_THREAD_ID,
    };
    manifest.materialized_outputs = {
      judge_validation: { path: relative(root, validationPath), sha256: fileSha(validationPath) },
      unmasked_results: { path: relative(root, unmaskedPath), sha256: fileSha(unmaskedPath) },
      paired_aggregate: { path: relative(root, aggregatePath), sha256: fileSha(aggregatePath) },
      synthesis: { path: relative(root, synthesisPath), sha256: fileSha(synthesisPath) },
    };
    writeJson(manifestPath, manifest);
  }
  return synthesis;
}

export function formatCliResult(result) {
  return {
    status: result.status ?? "validated",
    release_eligible: result.release_eligible === true,
    verdict: result.verdict ?? (result.release_eligible === true ? "release-eligible" : "validated-evidence-only"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = process.argv.includes("--synthesize") ? synthesizeV5() : validateCorrection();
  if (result.errors?.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
  else console.log(JSON.stringify(formatCliResult(result), null, 2));
}
