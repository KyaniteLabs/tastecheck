#!/usr/bin/env node
/** Validate, unmask, and aggregate the completed remediation7 v4 blind corpus. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_NAMESPACE = "evals/replays/remediation7-v4-correction-2026-07-11";
export const REVISION_ID = "remediation7-v4-correction-2026-07-11";
export const SKILLS = ["micro-motion", "spacing-system"];
export const SEEDS = [101, 202, 303];
export const JUDGES = ["luna-1", "luna-2", "luna-3", "luna-4"];
export const DIMENSIONS = ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"];
export const MIN_UPGRADED_MEAN_DELTA = 0.6;
const EXPECTED_JUDGMENTS = 32;
const EXPECTED_REAL_JUDGMENTS = 24;
const EXPECTED_CONTROLS = 8;
const V2_BASELINE = "evals/replays/remediation7-v2-2026-07-11/paired/results";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fileSha256 = (path) => sha256(readFileSync(path));
const round4 = (value) => Number(value.toFixed(4));
const mean = (scores) => DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) / DIMENSIONS.length;
const preferenceCounts = () => ({ current_source: 0, frozen_baseline: 0, tie: 0 });

function errorIf(errors, condition, message) { if (condition) errors.push(message); }

function tree(root, repoPath) {
  const rows = [];
  const walk = (at) => readdirSync(at, { withFileTypes: true }).forEach((entry) => {
    const child = join(at, entry.name);
    if (entry.isDirectory()) walk(child);
    else rows.push(`${relative(root, child)}\0${fileSha256(child)}\n`);
  });
  walk(join(root, repoPath));
  return { file_count: rows.length, tree_sha256: sha256(rows.sort().join("")) };
}

function currentBindings(root) {
  return Object.fromEntries(SKILLS.map((skill) => [skill, {
    skill_path: `skills/${skill}/SKILL.md`,
    skill_sha256: fileSha256(join(root, "skills", skill, "SKILL.md")),
    scenario_path: `evals/scenarios/${skill}.json`,
    scenario_sha256: fileSha256(join(root, "evals/scenarios", `${skill}.json`)),
  }]));
}

function validateMotionOutput(output, label) {
  const errors = [];
  const normalized = output.toLowerCase();
  const rows = ["Save", "Insertion", "Destructive confirmation", "Route", "Global reduced-motion/JS-disabled safety"];
  errorIf(errors, rows.some((row) => (output.split(`| ${row} |`).length - 1) !== 1), `${label}: motion needs exactly five distinct evidence rows`);
  for (const phrase of ["stale success", "stale error", "n+1", "single live-announcement", "component-states", "a11y-pass", "before", "prefers-reduced-motion: no-preference", "html.js"]) errorIf(errors, !normalized.includes(phrase), `${label}: missing motion evidence substring ${phrase}`);
  errorIf(errors, !normalized.includes("reject"), `${label}: component-states rejection is not explicit`);
  errorIf(errors, !(normalized.includes("opacity/transform") || (normalized.includes("opacity") && normalized.includes("transform"))), `${label}: compositor property evidence is missing`);
  errorIf(errors, (output.match(/\b\d{3}ms/g) ?? []).length < 4, `${label}: requires four concrete duration bands`);
  return errors;
}

function validateSpacingOutput(output, label) {
  const errors = [];
  const normalized = output.toLowerCase();
  for (const phrase of ["4/8/12/16/24/32/48/64/96px", "--space-section: clamp(48px, 32px + 4vw, 96px)", "attachment", "control", "task", "group", "region", "chapter", "operational", "editorial", "13px", "17px", "19px", "bare 24px", "var(--space-5)", "1em", "PENDING", "fixture", "responsive-layout"]) errorIf(errors, !normalized.includes(phrase.toLowerCase()), `${label}: missing spacing evidence substring ${phrase}`);
  errorIf(errors, !normalized.includes("reject"), `${label}: responsive-layout rejection is not explicit`);
  errorIf(errors, (output.split("Authoritative self-check").length - 1) !== 1, `${label}: requires exactly one Authoritative self-check`);
  return errors;
}

function validateCandidate(candidate, label) {
  const errors = [];
  errorIf(errors, JSON.stringify(Object.keys(candidate ?? {}).sort()) !== JSON.stringify(["raw_output", "raw_output_sha256"]), `${label}: candidate metadata breaks blindness`);
  errorIf(errors, typeof candidate?.raw_output !== "string" || candidate.raw_output.length === 0, `${label}: candidate text missing`);
  errorIf(errors, candidate?.raw_output_sha256 !== sha256(candidate?.raw_output ?? ""), `${label}: candidate text hash mismatch`);
  return errors;
}

export function validateJudgeBatchResults(batch, results, schema) {
  const errors = [];
  const items = batch?.items ?? [];
  const expectedIds = items.map((item) => item.comparison_id);
  const byId = new Map(items.map((item) => [item.comparison_id, item]));
  errorIf(errors, schema?.schema_version !== 2, `${batch?.judge_id ?? "unknown judge"}: result schema must be v2`);
  errorIf(errors, results.length !== 8, `${batch?.judge_id ?? "unknown judge"}: requires exactly eight results`);
  const seen = new Set();
  for (const result of results) {
    const id = result?.comparison_id;
    if (seen.has(id)) errors.push(`${batch.judge_id}: duplicate result ${id}`);
    seen.add(id);
    const item = byId.get(id);
    if (!item) { errors.push(`${batch.judge_id}: result targets an unknown comparison`); continue; }
    if (typeof result?.packet_id !== "string" || result.packet_id.trim().length === 0) errors.push(`${id}: packet_id must be a non-empty string`);
    if (result?.judge_id !== batch.judge_id) errors.push(`${id}: judge_id mismatch`);
    if (!["candidate-a", "candidate-b", "tie"].includes(result?.preference)) errors.push(`${id}: invalid preference`);
    for (const candidate of ["candidate-a", "candidate-b"]) {
      const scores = result?.dimension_scores?.[candidate];
      for (const dimension of DIMENSIONS) if (!Number.isInteger(scores?.[dimension]) || scores[dimension] < 1 || scores[dimension] > 5) errors.push(`${id}: invalid ${candidate} score for ${dimension}`);
    }
    if (item.kind === "identical-control") {
      const equal = JSON.stringify(result?.dimension_scores?.["candidate-a"]) === JSON.stringify(result?.dimension_scores?.["candidate-b"]);
      if (result?.preference !== "tie" || !equal) errors.push(`${batch.judge_id}: control ${id} failed; entire judge batch is inadmissible`);
    }
  }
  for (const id of expectedIds) if (!seen.has(id)) errors.push(`${batch.judge_id}: missing result ${id}`);
  return errors;
}

function collectJudgmentFiles(root, namespace) {
  const base = join(root, namespace, "blind-judge", "judgments");
  const rows = [];
  if (!existsSync(base)) return rows;
  for (const judgeId of readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const dir = join(base, judgeId);
    for (const entry of readdirSync(dir, { withFileTypes: true }).filter((item) => item.isFile() && item.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      let result;
      try { result = readJson(path); } catch (error) { rows.push({ path: relative(root, path), judge_directory: judgeId, sha256: fileSha256(path), parse_error: error.message }); continue; }
      rows.push({ path: relative(root, path), judge_directory: judgeId, sha256: fileSha256(path), result });
    }
  }
  return rows;
}

function staticValidation(root, namespace) {
  const errors = [];
  const base = join(root, namespace);
  const manifest = existsSync(join(base, "manifest.json")) ? readJson(join(base, "manifest.json")) : {};
  const receiptDocument = existsSync(join(base, "receipts.json")) ? readJson(join(base, "receipts.json")) : {};
  const packetDocument = existsSync(join(base, "blind-judge", "packets.json")) ? readJson(join(base, "blind-judge", "packets.json")) : {};
  const schema = existsSync(join(base, "blind-judge", "judge-result-schema-v2.json")) ? readJson(join(base, "blind-judge", "judge-result-schema-v2.json")) : {};
  const unmask = existsSync(join(base, "blind-judge", "private", "unmask-assignment-map.json")) ? readJson(join(base, "blind-judge", "private", "unmask-assignment-map.json")) : {};
  const receipts = receiptDocument.receipts ?? [];
  const expectedJobs = new Set(SKILLS.flatMap((skill) => SEEDS.flatMap((seed) => [`${skill}-upgraded-seed${seed}`, `${skill}-diversity-seed${seed}`])));
  const actualJobs = new Set(receipts.map((receipt) => receipt.job_id));
  errorIf(errors, receipts.length !== 12 || actualJobs.size !== 12 || [...expectedJobs].some((id) => !actualJobs.has(id)), "requires 12 distinct current-source receipts");
  errorIf(errors, new Set(receipts.map((receipt) => sha256(receipt.raw_output ?? ""))).size !== 12, "static receipts must have materially distinct output text");
  const bindings = currentBindings(root);
  const receiptByJob = new Map(receipts.map((receipt) => [receipt.job_id, receipt]));
  for (const receipt of receipts) {
    const label = receipt.job_id ?? "unknown receipt";
    const staticPath = join(base, receipt.lane ?? "", "results", `${label}.json`);
    const binding = bindings[receipt.skill];
    errorIf(errors, !existsSync(staticPath), `${label}: individual static receipt is missing`);
    if (existsSync(staticPath)) errorIf(errors, JSON.stringify(readJson(staticPath)) !== JSON.stringify(receipt), `${label}: individual static receipt diverged from ledger`);
    errorIf(errors, receipt.executor !== "gpt-5.6-terra" || receipt.status !== "complete", `${label}: must be a completed Terra static receipt`);
    errorIf(errors, !binding || receipt.skill_source_sha256 !== binding.skill_sha256 || receipt.scenario_source_sha256 !== binding.scenario_sha256, `${label}: current skill/scenario hash binding mismatch`);
    errorIf(errors, manifest.receipt_output_sha256?.[label] !== sha256(receipt.raw_output ?? ""), `${label}: output hash mismatch`);
    errors.push(...(receipt.skill === "micro-motion" ? validateMotionOutput(receipt.raw_output ?? "", label) : validateSpacingOutput(receipt.raw_output ?? "", label)));
  }
  for (const skill of SKILLS) {
    const diversity = receipts.filter((receipt) => receipt.skill === skill && receipt.lane === "diversity");
    for (const axis of Object.keys(diversity[0]?.semantic_variation_evidence ?? {})) errorIf(errors, new Set(diversity.map((receipt) => receipt.semantic_variation_evidence?.[axis])).size !== 3, `${skill}: diversity ${axis} is not materially varied`);
  }
  errorIf(errors, JSON.stringify(manifest.source_bindings) !== JSON.stringify(bindings), "manifest current-source bindings drifted");
  errorIf(errors, manifest.frozen_baseline?.release !== "v0.1.0", "frozen baseline release must remain v0.1.0");
  errorIf(errors, Object.values(manifest.frozen_baseline?.results ?? {}).reduce((sum, seeds) => sum + Object.keys(seeds).length, 0) !== 6, "requires six frozen v0.1.0 baseline inputs");
  for (const [skill, seeds] of Object.entries(manifest.frozen_baseline?.results ?? {})) for (const [seed, binding] of Object.entries(seeds)) {
    const path = join(root, binding.result_path ?? "");
    errorIf(errors, !existsSync(path) || fileSha256(path) !== binding.result_sha256, `baseline ${skill}/${seed}: result hash mismatch`);
    if (existsSync(path)) errorIf(errors, sha256(readJson(path).raw_output) !== binding.raw_output_sha256, `baseline ${skill}/${seed}: output hash mismatch`);
  }
  for (const [historical, expected] of Object.entries(manifest.historical_integrity ?? {})) {
    const actual = tree(root, `evals/replays/${historical}`);
    errorIf(errors, JSON.stringify(actual) !== JSON.stringify(expected), `${historical}: immutable evidence tree changed`);
  }
  errorIf(errors, schema.schema_version !== 2 || JSON.stringify(schema.dimension_scores?.["candidate-a"]) !== JSON.stringify(DIMENSIONS) || JSON.stringify(schema.dimension_scores?.["candidate-b"]) !== JSON.stringify(DIMENSIONS), "judge result schema must be v2 with candidate-specific scores");
  const batches = packetDocument.judge_batches ?? [];
  errorIf(errors, packetDocument.schema_version !== 2 || batches.length !== 4, "requires four schema-v2 judge batches");
  const realSides = new Map(); let realPairs = 0; let controls = 0;
  for (const batch of batches) {
    const items = batch.items ?? [];
    errorIf(errors, items.length !== 8 || new Set(items.map((item) => item.comparison_id)).size !== 8, `${batch.judge_id}: requires eight unique self-contained comparisons`);
    const real = items.filter((item) => item.kind === "real"); const control = items.filter((item) => item.kind === "identical-control");
    errorIf(errors, real.length !== 6 || control.length !== 2, `${batch.judge_id}: requires six real pairs and two controls`);
    realPairs += real.length; controls += control.length;
    for (const item of items) {
      errorIf(errors, item.candidate_payloads_embedded !== true, `${batch.judge_id}/${item.comparison_id}: packet is not self-contained`);
      errors.push(...validateCandidate(item.candidate_a, `${batch.judge_id}/${item.comparison_id}/a`), ...validateCandidate(item.candidate_b, `${batch.judge_id}/${item.comparison_id}/b`));
      if (item.kind === "identical-control") {
        const predeclared = unmask.controls?.[item.comparison_id];
        errorIf(errors, item.expected_preference !== "tie" || item.candidate_a.raw_output !== item.candidate_b.raw_output || item.candidate_a.raw_output_sha256 !== item.candidate_b.raw_output_sha256 || predeclared?.expected_preference !== "tie" || predeclared?.identical !== true || predeclared?.candidate_a_sha256 !== item.candidate_a.raw_output_sha256 || predeclared?.candidate_b_sha256 !== item.candidate_b.raw_output_sha256, `${batch.judge_id}/${item.comparison_id}: control must predeclare identical TIE candidates`);
      }
      if (item.kind !== "real") continue;
      const map = unmask.assignments?.[item.comparison_id]?.by_judge?.[batch.judge_id]; const assignment = unmask.assignments?.[item.comparison_id];
      errorIf(errors, !map, `${batch.judge_id}/${item.comparison_id}: private assignment missing`);
      for (const side of ["candidate-a", "candidate-b"]) {
        const candidate = side === "candidate-a" ? item.candidate_a : item.candidate_b; const source = map?.[side];
        const expected = source === "fresh-current-source" ? receiptByJob.get(`${assignment?.skill}-upgraded-seed${assignment?.seed}`)?.raw_output : existsSync(join(root, V2_BASELINE, `${assignment?.skill}-baseline-seed${assignment?.seed}.json`)) ? readJson(join(root, V2_BASELINE, `${assignment.skill}-baseline-seed${assignment.seed}.json`)).raw_output : undefined;
        errorIf(errors, candidate?.raw_output !== expected, `${batch.judge_id}/${item.comparison_id}/${side}: candidate does not bind to its private source`);
        const sides = realSides.get(item.comparison_id) ?? { "candidate-a": 0, "candidate-b": 0 }; if (source === "fresh-current-source") sides[side] += 1; realSides.set(item.comparison_id, sides);
      }
    }
  }
  for (const [id, sides] of realSides) errorIf(errors, sides["candidate-a"] !== 2 || sides["candidate-b"] !== 2, `${id}: current candidate must appear twice per anonymous side`);
  errorIf(errors, realPairs !== EXPECTED_REAL_JUDGMENTS || controls !== EXPECTED_CONTROLS, "blind assignment count must be 24 real plus 8 controls");
  return { errors, manifest, receiptByJob, packetDocument, schema, unmask, batches, counts: { receipts: receipts.length, real_pairs: realPairs, controls } };
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
  errorIf(errors, files.length !== EXPECTED_JUDGMENTS, `requires exactly ${EXPECTED_JUDGMENTS} judgment files; found ${files.length}`);
  const resultIds = new Set();
  for (const judge of JUDGES) {
    const batch = base.batches.find((item) => item.judge_id === judge);
    const results = byJudge[judge];
    const ids = results.map((result) => `${result?.judge_id}\0${result?.comparison_id}`);
    ids.forEach((id) => resultIds.add(id));
    errors.push(...validateJudgeBatchResults(batch ?? { judge_id: judge, items: [] }, results, base.schema));
  }
  errorIf(errors, resultIds.size !== EXPECTED_JUDGMENTS, `requires ${EXPECTED_JUDGMENTS} unique judge/comparison results; found ${resultIds.size}`);
  const controlsAdmissible = JUDGES.every((judge) => {
    const batch = base.batches.find((item) => item.judge_id === judge);
    return validateJudgeBatchResults(batch ?? { judge_id: judge, items: [] }, byJudge[judge], base.schema).filter((error) => error.includes("control") || error.includes("inadmissible")).length === 0;
  });
  return { ...base, errors, files, byJudge, controlsAdmissible, counts: { ...base.counts, total_judgments: files.length, unique_results: resultIds.size, pending_judgments: Math.max(EXPECTED_JUDGMENTS - files.length, 0), completed_judgments: files.length } };
}

export function validateCorrection(root = ROOT, { namespace = DEFAULT_NAMESPACE, requireCompleted = true } = {}) {
  const base = staticValidation(root, namespace);
  const validation = validateJudgments(root, namespace, base);
  const protocol = validation.manifest.blind_protocol ?? {};
  const expectedProtocol = requireCompleted
    ? protocol.total_judgments_expected === EXPECTED_JUDGMENTS && protocol.pending_judgments === 0 && protocol.completed_judgments === EXPECTED_JUDGMENTS && protocol.unmasking_performed === true && protocol.synthesis_claimed === true
    : [0, EXPECTED_JUDGMENTS].includes(protocol.pending_judgments) && [0, EXPECTED_JUDGMENTS].includes(protocol.completed_judgments);
  errorIf(validation.errors, !expectedProtocol, requireCompleted ? "manifest must record completed validated evidence" : "manifest protocol is malformed");
  errorIf(validation.errors, requireCompleted && !validation.controlsAdmissible, "all judge batches must be control-admissible");
  return validation;
}

function currentSourceFor(base, assignment, label) {
  return base.unmask.assignments[assignment.comparison_id].by_judge[assignment.judge_id][label];
}

function unmaskedRecords(validation) {
  const packetByJudgePair = new Map(validation.batches.flatMap((batch) => batch.items.filter((item) => item.kind === "real").map((item) => [`${batch.judge_id}/${item.comparison_id}`, item])));
  const records = [];
  for (const row of validation.files) {
    const result = row.result; const item = packetByJudgePair.get(`${result.judge_id}/${result.comparison_id}`); if (!item || item.kind !== "real") continue;
    const assignment = validation.unmask.assignments[result.comparison_id]; const pair = { ...assignment, comparison_id: result.comparison_id, judge_id: result.judge_id };
    const sources = { "candidate-a": currentSourceFor(validation, pair, "candidate-a"), "candidate-b": currentSourceFor(validation, pair, "candidate-b") };
    const candidateMeans = Object.fromEntries(["candidate-a", "candidate-b"].map((label) => [label, round4(mean(result.dimension_scores[label]))]));
    const currentLabel = sources["candidate-a"] === "fresh-current-source" ? "candidate-a" : "candidate-b";
    const baselineLabel = currentLabel === "candidate-a" ? "candidate-b" : "candidate-a";
    const preferenceOutcome = result.preference === "tie" ? "tie" : sources[result.preference] === "fresh-current-source" ? "current_source" : "frozen_baseline";
    records.push({
      judge_id: result.judge_id, comparison_id: result.comparison_id, skill: assignment.skill, seed: assignment.seed,
      candidate_source_by_label: sources, preference: result.preference, preference_outcome: preferenceOutcome,
      dimension_scores: result.dimension_scores, candidate_means: candidateMeans,
      current_source_mean: candidateMeans[currentLabel], frozen_baseline_mean: candidateMeans[baselineLabel],
      mean_delta: round4(candidateMeans[currentLabel] - candidateMeans[baselineLabel]),
      candidate_hashes: { "candidate-a": item.candidate_a.raw_output_sha256, "candidate-b": item.candidate_b.raw_output_sha256 },
    });
  }
  return records.sort((a, b) => a.skill.localeCompare(b.skill) || a.seed - b.seed || a.judge_id.localeCompare(b.judge_id));
}

function aggregateGroup(records, label) {
  const votes = preferenceCounts(); for (const record of records) votes[record.preference_outcome] += 1;
  const meanDelta = records.length ? round4(records.reduce((sum, record) => sum + record.mean_delta, 0) / records.length) : null;
  const eligible = meanDelta !== null && meanDelta >= MIN_UPGRADED_MEAN_DELTA;
  return { group: label, judgment_count: records.length, mean_delta: meanDelta, threshold: MIN_UPGRADED_MEAN_DELTA, preference_counts: votes, release_eligible: eligible, verdict: eligible ? "pass" : "blocked" };
}

export function aggregateV4(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const validation = validateCorrection(root, { namespace, requireCompleted: false });
  if (validation.errors.length > 0 || !validation.controlsAdmissible || validation.files.length !== EXPECTED_JUDGMENTS) return { errors: validation.errors.length ? validation.errors : ["judge batches are not admissible"], fail_closed: true, release_eligible: false, counts: validation.counts, by_skill: {}, overall: null, records: [] };
  const records = unmaskedRecords(validation);
  const bySkill = Object.fromEntries(SKILLS.map((skill) => [skill, aggregateGroup(records.filter((record) => record.skill === skill), skill)]));
  const overall = aggregateGroup(records, "overall");
  return { errors: [], fail_closed: false, release_eligible: Object.values(bySkill).every((row) => row.release_eligible) && overall.release_eligible, counts: validation.counts, threshold: MIN_UPGRADED_MEAN_DELTA, delta_basis: "current-source mean minus frozen-baseline mean across five dimensions; preference counts are descriptive only", by_skill: bySkill, overall, records, judgment_file_hashes: validation.files.map(({ path, sha256: hash }) => ({ path, sha256: hash })) };
}

function writeJson(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }

export function synthesizeV4(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const base = validateCorrection(root, { namespace, requireCompleted: false });
  const aggregate = aggregateV4(root, { namespace });
  const basePath = join(root, namespace); const blindPath = join(basePath, "blind-judge");
  const validationOutput = {
    schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v4-blind-judge-validation",
    status: aggregate.fail_closed ? "invalid" : "validated", pass: !aggregate.fail_closed,
    expected_count: EXPECTED_JUDGMENTS, found_count: base.files.length, validated_count: aggregate.fail_closed ? 0 : EXPECTED_JUDGMENTS,
    failure_count: aggregate.errors.length, controls_admissible: !aggregate.fail_closed && base.controlsAdmissible,
    unmasking_performed: false, errors: aggregate.errors, per_judge: Object.fromEntries(JUDGES.map((judge) => [judge, base.byJudge[judge].length])),
    judgment_file_hashes: base.files.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
  };
  const validationPath = join(blindPath, "judge-validation.json"); writeJson(validationPath, validationOutput);
  if (aggregate.fail_closed) {
    const failedAggregate = { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v4-paired-preference-aggregate", status: "blocked-invalid-evidence", validation_path: relative(root, validationPath), errors: aggregate.errors, fail_closed: true, release_eligible: false, threshold: MIN_UPGRADED_MEAN_DELTA, records: [] };
    const aggregatePath = join(blindPath, "paired-aggregate.json"); writeJson(aggregatePath, failedAggregate);
    const synthesis = { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "additive-remediation7-v4-synthesis", status: "blocked-invalid-evidence", release_eligible: false, verdict: "release-blocked", fail_closed: true, errors: aggregate.errors, threshold: MIN_UPGRADED_MEAN_DELTA, source: { validation_path: relative(root, validationPath), aggregate_path: relative(root, aggregatePath) } };
    writeJson(join(blindPath, "synthesis.json"), synthesis); return synthesis;
  }
  validationOutput.unmasking_performed = true; validationOutput.status = "validated"; writeJson(validationPath, validationOutput);
  const aggregateOutput = { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "remediation7-v4-paired-preference-aggregate", status: "validated-aggregated", validation_path: relative(root, validationPath), unmask_path: `${namespace}/blind-judge/private/unmask-assignment-map.json`, unmask_sha256: fileSha256(join(basePath, "blind-judge/private/unmask-assignment-map.json")), errors: [], fail_closed: false, release_eligible: aggregate.release_eligible, counts: aggregate.counts, threshold: aggregate.threshold, delta_basis: aggregate.delta_basis, by_skill: aggregate.by_skill, overall: aggregate.overall, records: aggregate.records, judgment_file_hashes: aggregate.judgment_file_hashes };
  const aggregatePath = join(blindPath, "paired-aggregate.json"); writeJson(aggregatePath, aggregateOutput);
  const synthesis = { schema_version: 1, revision_id: REVISION_ID, namespace, kind: "additive-remediation7-v4-synthesis", status: aggregate.release_eligible ? "release-eligible" : "threshold-blocked", release_eligible: aggregate.release_eligible, verdict: aggregate.release_eligible ? "release-eligible" : "release-blocked", fail_closed: true, errors: [], threshold: MIN_UPGRADED_MEAN_DELTA, source: { validation_path: relative(root, validationPath), validation_sha256: fileSha256(validationPath), aggregate_path: relative(root, aggregatePath), aggregate_sha256: fileSha256(aggregatePath) }, by_skill: aggregate.by_skill, overall: aggregate.overall, rule: "release eligibility is determined only by mean_delta >= +0.6 for every skill and overall; preference counts are descriptive" };
  const synthesisPath = join(blindPath, "synthesis.json"); writeJson(synthesisPath, synthesis);
  const manifestPath = join(basePath, "manifest.json"); const manifest = readJson(manifestPath);
  manifest.blind_protocol = { ...manifest.blind_protocol, pending_judgments: 0, completed_judgments: EXPECTED_JUDGMENTS, unmasking_performed: true, synthesis_claimed: true, controls_admissible: true, synthesis_status: synthesis.status };
  manifest.dispatch_incident = { ...manifest.dispatch_incident, aggregator_worker_id: "redacted-dispatch-worker", aggregator_worker_state: "exit-0-no-worker", direct_luna_fallback_thread_id: "redacted-local-evaluator-session" };
  manifest.materialized_outputs = { judge_validation: { path: relative(root, validationPath), sha256: fileSha256(validationPath) }, paired_aggregate: { path: relative(root, aggregatePath), sha256: fileSha256(aggregatePath) }, synthesis: { path: relative(root, synthesisPath), sha256: fileSha256(synthesisPath) } };
  writeJson(manifestPath, manifest);
  return synthesis;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = process.argv.includes("--synthesize") ? synthesizeV4() : validateCorrection();
  if (result.errors?.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
  else console.log(JSON.stringify({ status: result.status ?? "validated", release_eligible: result.release_eligible ?? true, verdict: result.verdict ?? "validated" }, null, 2));
}
