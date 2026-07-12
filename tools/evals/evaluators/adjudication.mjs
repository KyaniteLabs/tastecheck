#!/usr/bin/env node
/**
 * tools/evals/evaluators/adjudication.mjs — evaluator disagreement handler.
 *
 * When paired-lift, diversity, and anti-slop verdicts conflict for a skill,
 * this module applies the adjudication protocol:
 *   1. Majority vote (2/3 agreement → accept majority verdict).
 *   2. If 1-1-1 split or a critical evaluator fails → escalate to human.
 *   3. Release gate is blocked until adjudication is resolved.
 *
 * Usage:
 *   node tools/evals/evaluators/adjudication.mjs <paired-lift.json> <diversity.json> <anti-slop.json>
 *   Or import adjudicate() directly.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");

/**
 * Determine a boolean pass/fail for each evaluator's result.
 */
function extractVerdict(result) {
  if (!result) return null;
  const ev = result.evaluator;
  if (ev === "paired-lift") return result.verdict !== "regressed";
  if (ev === "diversity") return result.overall_pass === true;
  if (ev === "anti-slop") return result.pass === true;
  return null;
}

/**
 * Adjudicate a set of evaluator results for one skill.
 */
export function adjudicate(liftResult, diversityResult, antiSlopResult) {
  const skill = liftResult?.skill ?? diversityResult?.skill ?? antiSlopResult?.skill ?? "unknown";

  const verdicts = {
    "paired-lift": extractVerdict(liftResult),
    "diversity": extractVerdict(diversityResult),
    "anti-slop": extractVerdict(antiSlopResult),
  };

  const presentVerdicts = Object.entries(verdicts).filter(([, v]) => v !== null);
  if (presentVerdicts.length === 0) {
    return {
      schema_version: 1,
      evaluator: "adjudication",
      skill,
      verdicts,
      result: "blocked",
      requires_human: true,
      reason: "No evaluator results provided — cannot adjudicate.",
    };
  }

  const passCount = presentVerdicts.filter(([, v]) => v === true).length;
  const failCount = presentVerdicts.filter(([, v]) => v === false).length;
  const total = presentVerdicts.length;

  // Majority vote
  if (passCount > failCount && passCount > total / 2) {
    return {
      schema_version: 1,
      evaluator: "adjudication",
      skill,
      verdicts,
      result: "pass",
      requires_human: false,
      method: "majority-vote",
      pass_count: passCount,
      fail_count: failCount,
    };
  }

  if (failCount > passCount && failCount > total / 2) {
    return {
      schema_version: 1,
      evaluator: "adjudication",
      skill,
      verdicts,
      result: "fail",
      requires_human: false,
      method: "majority-vote",
      pass_count: passCount,
      fail_count: failCount,
    };
  }

  // Perfect split or no majority → escalate
  return {
    schema_version: 1,
    evaluator: "adjudication",
    skill,
    verdicts,
    result: "escalate",
    requires_human: true,
    method: "no-majority",
    pass_count: passCount,
    fail_count: failCount,
    reason: `Evaluator verdicts are split ${passCount}/${failCount}/${total - passCount - failCount} (pass/fail/null). Human adjudication required before release.`,
  };
}

// CLI mode
if (process.argv[1] && process.argv[1].endsWith("adjudication.mjs")) {
  const [,, liftPath, diversityPath, antiSlopPath] = process.argv;
  if (!liftPath || !diversityPath || !antiSlopPath) {
    console.error("Usage: node tools/evals/evaluators/adjudication.mjs <lift.json> <diversity.json> <anti-slop.json>");
    process.exit(1);
  }
  let lift, diversity, antiSlop;
  try {
    lift = JSON.parse(readFileSync(liftPath, "utf8"));
    diversity = JSON.parse(readFileSync(diversityPath, "utf8"));
    antiSlop = JSON.parse(readFileSync(antiSlopPath, "utf8"));
  } catch (e) {
    console.error("Cannot read evaluator file:", e.message);
    process.exit(1);
  }
  const result = adjudicate(lift, diversity, antiSlop);
  console.log(JSON.stringify(result, null, 2));
  if (result.result === "fail" || result.result === "escalate") process.exit(1);
}
