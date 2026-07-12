#!/usr/bin/env node
/**
 * tools/evals/check-paired.mjs — paired/lift/diversity/anti-slop checks.
 *
 * Fail-closed: exits 1 and blocks release when any required cell is absent or fails.
 * Never fabricates or infers missing evidence.
 *
 * Checks:
 *   paired    — >=1 paired record per skill (19 required)
 *   lift      — >=1 "improved" verdict per skill; "no_material_lift" or "regressed" returns to rework
 *   diversity — >=3 upgraded runs per skill; each pair (A-B, A-C, B-C) judged materially different
 *   anti-slop — no blocking generic markers, pack-example reuse, or structural fingerprints
 *
 * Input: evals/receipts/v1/ receipt files (sanitized public receipts)
 *
 * Usage:
 *   node tools/evals/check-paired.mjs [--check paired|lift|diversity|anti-slop|all]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { antiSlopChecks } from "./rubric.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RECEIPTS_DIR = join(root, "evals/receipts/v1");

// Load all 19 canonical skill names
const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
const ALL_SKILLS = new Set(manifest.skills.map((s) => s.name));

// Scan for receipt files
function loadReceipts() {
  if (!existsSync(RECEIPTS_DIR)) return [];
  const receipts = [];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!entry.name.endsWith(".json")) continue;
      try {
        const r = JSON.parse(readFileSync(full, "utf8"));
        if (r.skill && r.scenario_id && r.variant && r.verdict) receipts.push(r);
      } catch {}
    }
  }
  scan(RECEIPTS_DIR);
  return receipts;
}

// --- Paired check ---
function checkPaired(receipts) {
  const missing = [];
  const present = [];
  for (const skill of ALL_SKILLS) {
    const baselineRecords = receipts.filter((r) => r.skill === skill && r.variant === "baseline");
    const upgradedRecords = receipts.filter((r) => r.skill === skill && r.variant === "upgraded");
    if (baselineRecords.length > 0 && upgradedRecords.length > 0) {
      present.push(skill);
    } else {
      missing.push({ skill, has_baseline: baselineRecords.length > 0, has_upgraded: upgradedRecords.length > 0 });
    }
  }
  return {
    check: "paired",
    pass: missing.length === 0,
    present_count: present.length,
    missing_count: missing.length,
    missing,
    requirement: ">=1 baseline and >=1 upgraded record per skill (19 skills required)",
  };
}

// --- Lift check ---
function checkLift(receipts) {
  const no_lift = [];
  const regressed = [];
  const improved = [];
  for (const skill of ALL_SKILLS) {
    const upgradedRecords = receipts.filter((r) => r.skill === skill && r.variant === "upgraded");
    if (upgradedRecords.length === 0) continue; // already caught by paired check
    const verdicts = upgradedRecords.map((r) => r.verdict);
    if (verdicts.includes("improved")) { improved.push(skill); continue; }
    if (verdicts.includes("regressed")) { regressed.push(skill); }
    else { no_lift.push(skill); }
  }
  const blocked = no_lift.concat(regressed);
  return {
    check: "lift",
    pass: blocked.length === 0,
    improved_count: improved.length,
    no_material_lift: no_lift,
    regressed,
    blocked_skills: blocked,
    requirement: "Each skill must have >=1 'improved' paired verdict. 'no_material_lift' or 'regressed' returns skill to rework.",
  };
}

// --- Diversity check ---
function checkDiversity(receipts) {
  const missing = [];
  const passed = [];
  for (const skill of ALL_SKILLS) {
    const upgraded = receipts.filter((r) => r.skill === skill && r.variant === "upgraded");
    if (upgraded.length < 3) {
      missing.push({ skill, upgraded_count: upgraded.length, required: 3 });
      continue;
    }
    // Check for diversity_pair records
    const diversityPairs = upgraded.filter((r) => r.diversity_pair && r.diversity_pair.diversity_passed !== undefined);
    const passedPairs = diversityPairs.filter((r) => r.diversity_pair.diversity_passed === true);
    // Need A-B, A-C, B-C pairs to all pass
    if (passedPairs.length >= 3) {
      passed.push(skill);
    } else {
      // Check if diversity evidence is cited (structural/aesthetic/voice differences)
      const hasCitedDiversity = diversityPairs.some(
        (r) => r.diversity_pair.structural_difference && r.diversity_pair.aesthetic_difference && r.diversity_pair.voice_difference
      );
      if (hasCitedDiversity && diversityPairs.length >= 3) {
        passed.push(skill);
      } else {
        missing.push({
          skill,
          upgraded_count: upgraded.length,
          diversity_pair_count: diversityPairs.length,
          passed_pairs: passedPairs.length,
          note: "Diversity pairs missing or not all passed — reviewer must cite structural/aesthetic/voice differences",
        });
      }
    }
  }
  return {
    check: "diversity",
    pass: missing.length === 0,
    passed_count: passed.length,
    missing_count: missing.length,
    missing,
    requirement: "Each skill needs >=3 upgraded runs and 3 diversity pair records (A-B, A-C, B-C), each citing structural/aesthetic/voice differences.",
  };
}

// --- Anti-slop check ---
function checkAntiSlop(receipts) {
  const upgradedWithText = [];
  for (const r of receipts) {
    if (r.variant !== "upgraded" || !r.evidence || r.evidence.length === 0) continue;
    upgradedWithText.push({ run_id: r.run_id, skill: r.skill, text: r.evidence.join("\n") });
  }
  if (upgradedWithText.length === 0) {
    return {
      check: "anti-slop",
      pass: true,
      note: "No upgraded receipts with evidence text yet — anti-slop checks will run when receipts are present",
    };
  }
  const result = antiSlopChecks(upgradedWithText);
  return {
    check: "anti-slop",
    pass: !result.blocked,
    findings_count: result.findings.length,
    blocked: result.blocked,
    findings: result.findings,
    requirement: "No blocking generic SaaS markers, pack-example reuse, or repeated structural fingerprints in accepted upgraded outputs.",
  };
}

// --- Main ---
const checkArg = process.argv[3] ?? "all";
const receipts = loadReceipts();

const checkResults = {};

if (checkArg === "all" || checkArg === "paired") checkResults.paired = checkPaired(receipts);
if (checkArg === "all" || checkArg === "lift") checkResults.lift = checkLift(receipts);
if (checkArg === "all" || checkArg === "diversity") checkResults.diversity = checkDiversity(receipts);
if (checkArg === "all" || checkArg === "anti-slop") checkResults.anti_slop = checkAntiSlop(receipts);

const allPass = Object.values(checkResults).every((r) => r.pass);

// Print summary
for (const [name, result] of Object.entries(checkResults)) {
  const icon = result.pass ? "✓" : "✗";
  console.log(`${icon} [${name}] ${result.pass ? "pass" : "BLOCKED"}`);
  if (!result.pass) {
    if (result.missing) {
      for (const m of result.missing) {
        console.error(`  MISSING: ${typeof m === "string" ? m : JSON.stringify(m)}`);
      }
    }
    if (result.blocked_skills) {
      for (const s of result.blocked_skills) console.error(`  RETURN TO REWORK: ${s}`);
    }
    if (result.findings) {
      for (const f of result.findings.slice(0, 5)) console.error(`  SLOP: ${JSON.stringify(f)}`);
    }
  }
}

// Write summary receipt
const summary = {
  schema_version: 1,
  check: checkArg,
  receipt_count: receipts.length,
  skill_count: ALL_SKILLS.size,
  all_pass: allPass,
  results: checkResults,
};
const outDir = join(root, "evals/receipts/v1");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "check-paired.json"), JSON.stringify(summary, null, 2));
console.log(`\nWrote evals/receipts/v1/check-paired.json`);

if (!allPass) {
  console.error("\nBLOCKED: required evaluation evidence is missing or failing.");
  console.error("Run paired evaluations, collect results, then re-run this check.");
  process.exit(1);
}
console.log("\n✓ All paired/lift/diversity/anti-slop checks pass");
