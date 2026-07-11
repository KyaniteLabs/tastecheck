#!/usr/bin/env node
/**
 * tools/evals/evaluators/paired-lift.mjs — paired A/B lift evaluator.
 *
 * For each pilot skill, compares the baseline attempt with each upgraded attempt
 * on every rubric dimension using the anchored 1-5 scale. Direct comparison is
 * diagnostic only; release acceptance requires the blinded three-judge synthesis
 * exported below.
 *
 * Usage:
 *   node tools/evals/evaluators/paired-lift.mjs <skill> <baseline-attempt.json> <upgraded-attempt.json>
 *   Or import evaluateLift() directly.
 *
 * Exit 0 = evaluation complete (result printed as JSON).
 * Exit 1 = evaluation error (missing file, schema violation, etc.).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const root = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const rubricPath = join(root, "evals/w1/rubric/anchored-rubric.json");
// Evaluator lane: gpt-5.6-luna. Production runs use gpt-5.6-terra exclusively.
const EVALUATOR_MODEL = "gpt-5.6-luna";

function loadRubric() {
  return JSON.parse(readFileSync(rubricPath, "utf8"));
}

/**
 * Score a single attempt output against the rubric dimensions.
 * Since we don't have a live model judge here, this is a deterministic
 * structural checker that scores based on observable properties.
 *
 * Returns { dimension_id: score (1-5), ... }. This structural screening never
 * substitutes for the evidence-citing blind judges.
 */
export function scoreAttempt(attempt, rubric) {
  const scores = {};
  const output = attempt.raw_output ?? "";
  const assertionsResult = attempt.assertions_result ?? [];
  const evidenceFields = attempt.evidence_fields_present ?? {};

  // domain_specificity: deterministic screen aligned to the 1-5 anchors.
  const metCount = assertionsResult.filter((a) => a.met).length;
  const totalAssertions = assertionsResult.length;
  if (totalAssertions === 0) {
    scores.domain_specificity = 1;
  } else if (metCount === totalAssertions) {
    scores.domain_specificity = output.length >= 1200 ? 4 : 3;
  } else if (metCount > 0) {
    scores.domain_specificity = 2;
  } else {
    scores.domain_specificity = 1;
  }

  // evidence_completeness: all five fields earns competent-to-strong, not an
  // automatic exceptional score (that requires a human evidence judgment).
  const evidenceCount = Object.values(evidenceFields).filter(Boolean).length;
  if (evidenceCount === 5) scores.evidence_completeness = 4;
  else if (evidenceCount >= 3) scores.evidence_completeness = 3;
  else if (evidenceCount > 0) scores.evidence_completeness = 2;
  else scores.evidence_completeness = 1;

  // fail_closed: an unsupported n/a is a material requirement failure.
  const hasNaWithoutReason = /\bn\/a\b(?!.*:.*\S)/i.test(output) && !(/subject.absent|not.present|not.applicable.because/i.test(output));
  if (attempt.status === "error") scores.fail_closed = 1;
  else if (hasNaWithoutReason) scores.fail_closed = 1;
  else if (attempt.status === "complete" && evidenceCount >= 4) scores.fail_closed = 4;
  else scores.fail_closed = 3;

  // handoff_readiness: check if handoff section is present in output
  const hasHandoff = /handoff|sends.to|downstream/i.test(output);
  if (!hasHandoff) scores.handoff_readiness = 1;
  else if (evidenceCount >= 4) scores.handoff_readiness = 4;
  else scores.handoff_readiness = 3;

  // scope_discipline: no out-of-scope work detected
  // (heuristic: output is short enough that scope drift would stand out)
  const outputLen = output.length;
  if (outputLen < 200 && attempt.status === "complete") {
    scores.scope_discipline = 1; // suspiciously short → likely incomplete
  } else if (evidenceCount >= 4 && metCount >= totalAssertions - 1) {
    scores.scope_discipline = 4;
  } else {
    scores.scope_discipline = 3;
  }

  return scores;
}

/**
 * Compute lift between baseline and upgraded scores.
 * Screening lift reports the mean per-dimension score delta. It is explicitly
 * non-release-eligible because it has no blinded preference quorum.
 */
export function computeLift(baselineScores, upgradedScores) {
  const dimensions = Object.keys(baselineScores);
  const maxPerDim = 5;
  const maxTotal = dimensions.length * maxPerDim;
  const baselineTotal = dimensions.reduce((sum, d) => sum + (baselineScores[d] ?? 0), 0);
  const upgradedTotal = dimensions.reduce((sum, d) => sum + (upgradedScores[d] ?? 0), 0);
  const totalDelta = upgradedTotal - baselineTotal;
  const meanDelta = totalDelta / Math.max(dimensions.length, 1);
  return {
    baseline_total: baselineTotal,
    upgraded_total: upgradedTotal,
    max_total: maxTotal,
    total_delta: totalDelta,
    mean_delta: parseFloat(meanDelta.toFixed(4)),
    dimension_deltas: Object.fromEntries(
      dimensions.map((d) => [d, (upgradedScores[d] ?? 0) - (baselineScores[d] ?? 0)])
    ),
    verdict: meanDelta >= 0.60 ? "screening_lift" : meanDelta < 0 ? "screening_regression" : "screening_no_material_lift",
    release_eligible: false,
  };
}

/**
 * Synthesize exactly three validated blind paired judgments after a private
 * unmasking step reveals which opaque label is upgraded. This is the only paired
 * result shape eligible for a release claim.
 */
export function synthesizePairedJudgments(packet, judgments, upgradedLabel) {
  const dimensions = Object.keys(judgments[0]?.candidate_scores?.["A"] ?? {} ).filter((key) => key !== "total");
  const baselineLabel = upgradedLabel === "A" ? "B" : "A";
  const preferenceVotes = { A: 0, B: 0, tie: 0 };
  const dimensionMeanDeltas = Object.fromEntries(dimensions.map((dimension) => [dimension, 0]));
  const hardRegressionFlags = [];
  for (const judgment of judgments) {
    if (preferenceVotes[judgment.preference] !== undefined) preferenceVotes[judgment.preference]++;
    for (const dimension of dimensions) {
      dimensionMeanDeltas[dimension] += (judgment.candidate_scores?.[upgradedLabel]?.[dimension] ?? 0)
        - (judgment.candidate_scores?.[baselineLabel]?.[dimension] ?? 0);
    }
    for (const flag of judgment.regression_flags ?? []) {
      if (flag.candidate === upgradedLabel && ["safety", "accessibility", "contract"].includes(flag.category)) hardRegressionFlags.push(flag);
    }
  }
  for (const dimension of dimensions) dimensionMeanDeltas[dimension] /= Math.max(judgments.length, 1);
  const meanDelta = dimensions.reduce((sum, dimension) => sum + dimensionMeanDeltas[dimension], 0) / Math.max(dimensions.length, 1);
  const preferenceCount = preferenceVotes[upgradedLabel];
  const mandatoryRegressions = Object.entries(dimensionMeanDeltas)
    .filter(([, delta]) => delta < -0.25)
    .map(([dimension, delta]) => ({ dimension, mean_delta: Number(delta.toFixed(4)) }));
  const meetsLift = meanDelta >= 0.60;
  const meetsPreference = preferenceCount >= 2;
  const noMandatoryRegression = mandatoryRegressions.length === 0;
  const noHardRegression = hardRegressionFlags.length === 0;
  const improved = judgments.length === 3 && meetsLift && meetsPreference && noMandatoryRegression && noHardRegression;
  return {
    schema_version: 1,
    evaluator: "paired-lift",
    release_eligible: improved,
    upgraded_label: upgradedLabel,
    baseline_label: baselineLabel,
    judgment_count: judgments.length,
    preference_votes: preferenceVotes,
    upgraded_preference_count: preferenceCount,
    dimension_mean_deltas: Object.fromEntries(Object.entries(dimensionMeanDeltas).map(([key, value]) => [key, Number(value.toFixed(4))])),
    mean_delta: Number(meanDelta.toFixed(4)),
    mandatory_dimension_regressions: mandatoryRegressions,
    hard_regression_flags: hardRegressionFlags,
    thresholds: { mean_delta: 0.60, upgraded_preference_count: 2, mandatory_dimension_floor: -0.25 },
    verdict: improved ? "improved" : (!noMandatoryRegression || !noHardRegression) ? "regressed" : "no_material_lift",
  };
}

/**
 * Full paired lift evaluation.
 */
export function evaluateLift(baselineAttempt, upgradedAttempt) {
  const rubric = loadRubric();
  const baselineScores = scoreAttempt(baselineAttempt, rubric);
  const upgradedScores = scoreAttempt(upgradedAttempt, rubric);
  const lift = computeLift(baselineScores, upgradedScores);
  return {
    schema_version: 1,
    evaluator: "paired-lift",
    evaluator_model: EVALUATOR_MODEL,
    baseline_job_id: baselineAttempt.job_id,
    upgraded_job_id: upgradedAttempt.job_id,
    skill: baselineAttempt.skill,
    scenario_id: baselineAttempt.scenario_id,
    seed: upgradedAttempt.requested_seed ?? upgradedAttempt.seed ?? null,
    baseline_scores: baselineScores,
    upgraded_scores: upgradedScores,
    ...lift,
  };
}

// CLI mode
if (process.argv[1] && process.argv[1].endsWith("paired-lift.mjs")) {
  const [,, skill, baselinePath, upgradedPath] = process.argv;
  if (!skill || !baselinePath || !upgradedPath) {
    console.error("Usage: node tools/evals/evaluators/paired-lift.mjs <skill> <baseline.json> <upgraded.json>");
    process.exit(1);
  }
  let baseline, upgraded;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
    upgraded = JSON.parse(readFileSync(upgradedPath, "utf8"));
  } catch (e) {
    console.error("Cannot read attempt file:", e.message);
    process.exit(1);
  }
  const result = evaluateLift(baseline, upgraded);
  console.log(JSON.stringify(result, null, 2));
}
