#!/usr/bin/env node
/**
 * tools/evals/aggregate-w1-receipts.mjs — W1 receipt aggregator.
 *
 * Reads the raw-attempt ledger and evaluator outputs, produces a W1 pilot receipt,
 * and writes it to evals/receipts/v1/w1/w1-pilot-receipt.json.
 *
 * RELEASE-BLOCKING: exits 1 if any of the 12 required pilot jobs lack a complete attempt.
 * This ensures the release gate cannot be passed with missing evidence.
 *
 * Usage: node tools/evals/aggregate-w1-receipts.mjs [--allow-incomplete]
 *   --allow-incomplete: generate a partial receipt without failing (for mid-run status checks)
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateJudgeCorpus } from "./validate-judge-packets.mjs";
import { evaluateW1EvaluatorGate } from "./lib/w1-evaluator-gate.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const manifestPath = join(root, "evals/w1/job-manifest.json");
// Raw ledger and evaluator outputs live exclusively under .omx — never under evals/
const ledgerPath = join(root, ".omx/evidence/tastecheck-v1/raw/ledger.jsonl");
const evaluatorOutputsDir = join(root, ".omx/evidence/tastecheck-v1/raw/evaluators");
const judgePacketsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-packets");
const judgeResultsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-results");
const receiptDir = join(root, "evals/receipts/v1/w1");
const receiptPath = join(receiptDir, "w1-pilot-receipt.json");

const allowIncomplete = process.argv.includes("--allow-incomplete");

function readJsonDirectory(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort().flatMap((file) => {
    try { return [JSON.parse(readFileSync(join(directory, file), "utf8"))]; }
    catch { return []; }
  });
}

// Load job manifest
if (!existsSync(manifestPath)) {
  console.error("BLOCKED: job-manifest.json not found");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Load ledger entries
const ledgerEntries = [];
if (existsSync(ledgerPath)) {
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim());
  for (const line of lines) {
    try { ledgerEntries.push(JSON.parse(line)); }
    catch { /* skip malformed lines */ }
  }
}

// Build job status map from ledger
const completedJobs = new Set(
  ledgerEntries.filter((e) => e.status === "complete").map((e) => e.job_id)
);

// Check for evaluator output files (optional — may not exist yet)
function loadEvaluatorResult(skill, evaluator) {
  if (!existsSync(evaluatorOutputsDir)) return null;
  const path = join(evaluatorOutputsDir, `${skill}-${evaluator}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { return null; }
}

// Build per-skill summaries
const pilotSkills = ["component-states", "deslop-ui", "tastecheck-pass"];
const skillSummaries = [];

for (const skill of pilotSkills) {
  const skillJobs = manifest.jobs.filter((j) => j.skill === skill);
  const baselineJob = skillJobs.find((j) => j.run_type === "baseline");
  const upgradedJobs = skillJobs.filter((j) => j.run_type === "upgraded");

  const baselineComplete = baselineJob ? completedJobs.has(baselineJob.job_id) : false;
  const upgradedComplete = upgradedJobs.every((j) => completedJobs.has(j.job_id));
  const upgradedSeedsComplete = upgradedJobs
    .filter((j) => completedJobs.has(j.job_id))
    .map((j) => j.requested_seed);

  // Load evaluator results
  const liftResult = loadEvaluatorResult(skill, "paired-lift");
  const diversityResult = loadEvaluatorResult(skill, "diversity");
  const antiSlopResult = loadEvaluatorResult(skill, "anti-slop");

  const diversityPass = diversityResult !== null ? diversityResult.overall_pass : null;
  const antiSlopPass = antiSlopResult !== null ? antiSlopResult.pass : null;
  const liftScore = liftResult !== null ? liftResult.lift : null;
  const adjudicationNeeded =
    liftResult !== null && diversityResult !== null && antiSlopResult !== null &&
    [liftResult.verdict !== "regressed", diversityResult.overall_pass, antiSlopResult.pass].filter(Boolean).length === 1;

  skillSummaries.push({
    skill,
    baseline_complete: baselineComplete,
    upgraded_complete: upgradedComplete,
    upgraded_seeds_complete: upgradedSeedsComplete,
    diversity_pass: diversityPass,
    anti_slop_pass: antiSlopPass,
    lift_score: liftScore,
    adjudication_needed: adjudicationNeeded,
  });
}

// Compute overall status
const allJobIds = manifest.jobs.map((j) => j.job_id);
const missingJobs = allJobIds.filter((id) => !completedJobs.has(id));
const allRequiredComplete = missingJobs.length === 0;
const completeCount = allJobIds.length - missingJobs.length;
// Derive pending and error from real ledger status, not manifest defaults.
const pendingCount = missingJobs.length;
const errorCount = ledgerEntries.filter((e) => e.status === "error").length;
const judgeCorpus = validateJudgeCorpus(
  readJsonDirectory(judgePacketsDir),
  readJsonDirectory(judgeResultsDir),
);

const evaluatorArtifactsBySkill = Object.fromEntries(pilotSkills.map((skill) => [skill, {
  paired_lift: loadEvaluatorResult(skill, "paired-lift"),
  diversity: loadEvaluatorResult(skill, "diversity"),
  anti_slop: loadEvaluatorResult(skill, "anti-slop"),
}]));
const evaluatorGate = evaluateW1EvaluatorGate(evaluatorArtifactsBySkill, pilotSkills);
const evaluatorVerdicts = {
  paired_lift: { summary: evaluatorGate.summaries.paired_lift },
  diversity: { summary: evaluatorGate.summaries.diversity },
  anti_slop: { summary: evaluatorGate.summaries.anti_slop },
};

const receipt = {
  schema_version: 1,
  wave: "W1",
  total_jobs: 12,
  complete: completeCount,
  pending: pendingCount,
  error: errorCount,
  all_required_complete: allRequiredComplete,
  missing_jobs: missingJobs,
  skill_summaries: skillSummaries,
  evaluator_verdicts: evaluatorVerdicts,
  judge_corpus: {
    packets: 9,
    result_slots: 27,
    valid_complete_judgments: judgeCorpus.valid_complete_judgments,
    synthesized_ready_packets: judgeCorpus.synthesized_ready_packets,
    valid: judgeCorpus.errors.length === 0,
  },
  date_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
};

mkdirSync(receiptDir, { recursive: true });
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
console.log("Wrote evals/receipts/v1/w1/w1-pilot-receipt.json");
console.log(`W1: ${completeCount}/12 complete, ${missingJobs.length} missing`);

// Check for required evaluator output files (9 total: 3 skills × 3 evaluators).
const requiredEvaluatorFiles = pilotSkills.flatMap((s) => [
  `${s}-paired-lift.json`,
  `${s}-diversity.json`,
  `${s}-anti-slop.json`,
]);
const missingEvaluatorFiles = requiredEvaluatorFiles.filter(
  (f) => !existsSync(join(evaluatorOutputsDir, f))
);
const allEvaluatorOutputsPresent = missingEvaluatorFiles.length === 0;
const strictJudgeQuorum = judgeCorpus.errors.length === 0
  && judgeCorpus.valid_complete_judgments === 27
  && judgeCorpus.synthesized_ready_packets === 9;
const strictEvaluatorGate = evaluatorGate.pass;

// Release-blocking check: attempts, calibrated judge quorum, and synthesized
// artifacts must all pass their evaluator-specific verdict gates. Pending slots
// and presence-only artifacts never count as release evidence.
if (!allRequiredComplete || !strictJudgeQuorum || !allEvaluatorOutputsPresent || !strictEvaluatorGate) {
  if (!allRequiredComplete) {
    console.error("\nRELEASE BLOCKED: missing evidence for required W1 pilot jobs:");
    for (const id of missingJobs) console.error("  -", id);
  }
  if (!allEvaluatorOutputsPresent) {
    console.error("\nRELEASE BLOCKED: fewer than 9 synthesized artifacts are present:");
    for (const f of missingEvaluatorFiles) console.error("  -", join(evaluatorOutputsDir, f));
  }
  if (!strictJudgeQuorum) {
    console.error(`\nRELEASE BLOCKED: requires 27 valid complete judgments across 9 packets; found ${judgeCorpus.valid_complete_judgments}.`);
    console.error(`RELEASE BLOCKED: requires 9 synthesized artifacts; ${judgeCorpus.synthesized_ready_packets} packet(s) have a valid three-judge quorum.`);
    const invalid = judgeCorpus.errors.filter((error) => !error.includes("quorum requires exactly 3 valid complete results"));
    for (const error of invalid.slice(0, 5)) console.error(`  - ${error}`);
  }
  if (!strictEvaluatorGate) {
    console.error("\nRELEASE BLOCKED: evaluator verdict gates failed:");
    for (const failure of evaluatorGate.failures) console.error(`  - ${failure}`);
  }
  if (allowIncomplete) {
    console.warn("\nPARTIAL STATUS ONLY: release remains blocked; no pending slot or partial artifact counts as evidence.");
  } else {
    console.error('\nRun with --allow-incomplete for a partial status receipt.');
    process.exit(1);
  }
}

if (allRequiredComplete && strictJudgeQuorum && allEvaluatorOutputsPresent && strictEvaluatorGate) {
  console.log("\n✓ All 12 W1 pilot jobs, 27 valid judgments, and 9 passing synthesized artifacts are present — release gate unblocked");
}
