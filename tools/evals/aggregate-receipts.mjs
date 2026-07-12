#!/usr/bin/env node
/**
 * tools/evals/aggregate-receipts.mjs — receipt aggregator.
 *
 * Collects all individual run receipts from evals/receipts/v1/ and produces:
 *   evals/receipts/v1/summary.json — 19-row coverage/lift/diversity table
 *
 * Fail-closed: exits 1 when any mandatory cell is absent or failing.
 * Never fabricates verdicts or infers missing evidence.
 *
 * The summary.json structure has three sub-tables keyed under:
 *   summary.paired    — per-skill paired coverage and lift verdict
 *   summary.diversity — per-skill upgraded run count and diversity pass status
 *   summary.corpus    — aggregate totals and release-readiness flag
 *
 * Usage:
 *   node tools/evals/aggregate-receipts.mjs
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RECEIPTS_DIR = join(root, "evals/receipts/v1");

const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
const ALL_SKILLS = manifest.skills.map((s) => s.name).sort();

function loadReceipts() {
  if (!existsSync(RECEIPTS_DIR)) return [];
  const receipts = [];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!entry.name.endsWith(".json")) continue;
      // Skip aggregated outputs we write ourselves
      if (entry.name === "summary.json" || entry.name === "check-paired.json") continue;
      try {
        const r = JSON.parse(readFileSync(full, "utf8"));
        if (r.skill && r.scenario_id && r.variant && r.verdict) receipts.push(r);
      } catch {}
    }
  }
  scan(RECEIPTS_DIR);
  return receipts;
}

const receipts = loadReceipts();
const errors = [];

// Build per-skill rows
const pairedRows = [];
const diversityRows = [];

for (const skill of ALL_SKILLS) {
  const baselineRecs = receipts.filter((r) => r.skill === skill && r.variant === "baseline");
  const upgradedRecs = receipts.filter((r) => r.skill === skill && r.variant === "upgraded");

  // Paired
  const bestVerdict = upgradedRecs.map((r) => r.verdict).includes("improved") ? "improved"
    : upgradedRecs.map((r) => r.verdict).includes("no_material_lift") ? "no_material_lift"
    : upgradedRecs.map((r) => r.verdict).includes("regressed") ? "regressed"
    : null;

  const pairedRow = {
    skill,
    baseline_count: baselineRecs.length,
    upgraded_count: upgradedRecs.length,
    paired_present: baselineRecs.length > 0 && upgradedRecs.length > 0,
    best_verdict: bestVerdict,
    lift_pass: bestVerdict === "improved",
  };
  pairedRows.push(pairedRow);
  if (!pairedRow.paired_present) errors.push(`MISSING paired evidence: ${skill}`);
  if (pairedRow.paired_present && !pairedRow.lift_pass) {
    errors.push(`${skill}: verdict="${bestVerdict}" — return to rework; no material lift or regression`);
  }

  // Diversity
  const diversityPairs = upgradedRecs.filter((r) => r.diversity_pair);
  const passedPairs = diversityPairs.filter((r) => r.diversity_pair.diversity_passed === true);
  const diversityRow = {
    skill,
    upgraded_runs: upgradedRecs.length,
    diversity_pairs: diversityPairs.length,
    diversity_passed_pairs: passedPairs.length,
    diversity_pass: upgradedRecs.length >= 3 && passedPairs.length >= 3,
  };
  diversityRows.push(diversityRow);
  if (!diversityRow.diversity_pass && upgradedRecs.length >= 3) {
    errors.push(`${skill}: diversity not fully evidenced (${passedPairs.length}/3 pairs passed)`);
  }
}

// Corpus totals
const totalBaseline = receipts.filter((r) => r.variant === "baseline").length;
const totalUpgraded = receipts.filter((r) => r.variant === "upgraded").length;
const improvedCount = pairedRows.filter((r) => r.best_verdict === "improved").length;
const liftPassCount = pairedRows.filter((r) => r.lift_pass).length;
const diversityPassCount = diversityRows.filter((r) => r.diversity_pass).length;

// Release readiness: ALL 19 skills must pass paired + lift + diversity
const releaseReady = errors.length === 0;

const summary = {
  schema_version: 1,
  skill_count: ALL_SKILLS.length,
  receipt_count: receipts.length,
  total_baseline_runs: totalBaseline,
  total_upgraded_runs: totalUpgraded,
  release_ready: releaseReady,
  errors: errors.length > 0 ? errors : null,
  paired: {
    skills_with_evidence: pairedRows.filter((r) => r.paired_present).length,
    skills_missing: pairedRows.filter((r) => !r.paired_present).map((r) => r.skill),
    rows: pairedRows,
  },
  lift: {
    improved_count: improvedCount,
    lift_pass_count: liftPassCount,
    lift_fail_skills: pairedRows.filter((r) => r.paired_present && !r.lift_pass).map((r) => ({
      skill: r.skill, verdict: r.best_verdict
    })),
  },
  diversity: {
    skills_passed: diversityPassCount,
    skills_missing: diversityRows.filter((r) => !r.diversity_pass).map((r) => r.skill),
    rows: diversityRows,
  },
};

mkdirSync(RECEIPTS_DIR, { recursive: true });
writeFileSync(join(RECEIPTS_DIR, "summary.json"), JSON.stringify(summary, null, 2));

// Print 19-row table
console.log("\n─── Coverage / Lift / Diversity (19 skills) ───");
console.log("Skill".padEnd(28) + "Paired  Verdict          Div-pairs");
for (const skill of ALL_SKILLS) {
  const p = pairedRows.find((r) => r.skill === skill);
  const d = diversityRows.find((r) => r.skill === skill);
  const pairedMark = p?.paired_present ? "✓" : "✗";
  const verdict = p?.best_verdict ?? "MISSING";
  const divMark = d?.diversity_pass ? "✓" : `${d?.diversity_passed_pairs ?? 0}/3`;
  console.log(`${skill.padEnd(28)}${pairedMark}       ${verdict.padEnd(17)}${divMark}`);
}
console.log(`\n${improvedCount}/${ALL_SKILLS.length} skills: improved verdict`);
console.log(`${diversityPassCount}/${ALL_SKILLS.length} skills: diversity passed`);
console.log(`\nWrote evals/receipts/v1/summary.json`);

if (errors.length > 0) {
  console.error(`\nBLOCKED: ${errors.length} error(s) block release:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\n✓ All mandatory evidence cells present and passing — release gate may proceed");
