#!/usr/bin/env node
/**
 * tools/evals/test-lint-fixtures.mjs — proves red fixtures fail and green pass.
 *
 * Uses tools/lib/skill-lint.mjs on isolated fixture directories.
 * Part of W0 gate: dead-reference linting semantics proven.
 * Writes result to evals/receipts/v1/contracts/dead-references.json
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const fixturesDir = join(root, "evals/fixtures/lint");

// Import library functions
import { KNOWN_STALE, EXTERNAL_OK, CSS_LIKE_EXEMPT, CANONICAL_TOKEN_PATTERNS, collectFiles } from "../lib/skill-lint.mjs";

function sha256(s) { return createHash("sha256").update(s).digest("hex"); }

// Load the real skill set from the repo so valid skill names are recognised
const skillSet = new Set(
  readdirSync(join(root, "skills"))
    .filter((name) => statSync(join(root, "skills", name)).isDirectory())
);

const kebab = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g;

function lintFile(absPath) {
  const text = readFileSync(absPath, "utf8");
  const findings = [];
  for (const [, token] of text.matchAll(kebab)) {
    if (KNOWN_STALE.has(token)) {
      findings.push({ token, reason: "known_stale" });
      continue;
    }
    // Known current skills, external-ok, and CSS-like tokens are always allowed
    if (skillSet.has(token) || EXTERNAL_OK.has(token) || CSS_LIKE_EXEMPT.has(token)) continue;
    if (CANONICAL_TOKEN_PATTERNS.some((re) => re.test(token))) continue;

    const looksLikeSkillName = token.length > 3
      && !token.startsWith("btn-")
      && !/^(flex|grid|gap|col|row|sm|md|lg|xl|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|w-|h-|z-|sr-)/.test(token);

    if (looksLikeSkillName) {
      findings.push({ token, reason: "unknown_skill_like" });
    }
  }
  return findings;
}

const FIXTURE_SPECS = [
  {
    name: "valid-internal",
    dir: join(fixturesDir, "valid-internal"),
    expect: "pass",
    description: "Current skill names and exempt external skills pass without findings",
  },
  {
    name: "css-like",
    dir: join(fixturesDir, "css-like"),
    expect: "pass",
    description: "CSS pseudo-classes and HTML attribute tokens do not false-positive",
  },
  {
    name: "known-stale",
    dir: join(fixturesDir, "known-stale"),
    expect: "fail",
    description: "Known-stale skill references produce findings",
    expected_reasons: ["known_stale"],
  },
  {
    name: "unknown-ref",
    dir: join(fixturesDir, "unknown-ref"),
    expect: "fail",
    description: "Previously unseen unknown skill-like references produce findings (P0-2 fix)",
    expected_reasons: ["unknown_skill_like"],
  },
];

const results = [];
let allPassed = true;

for (const spec of FIXTURE_SPECS) {
  const mdFiles = collectFiles(spec.dir, [".md"]);
  const allFindings = [];
  for (const file of mdFiles) {
    const findings = lintFile(file);
    allFindings.push(...findings);
  }

  const hasFail = allFindings.length > 0;
  let testPass;
  let notes = "";

  if (spec.expect === "pass") {
    testPass = !hasFail;
    if (!testPass) {
      notes = `Expected no findings but got: ${allFindings.map((f) => `\`${f.token}\` (${f.reason})`).join(", ")}`;
    }
  } else {
    testPass = hasFail;
    if (!testPass) {
      notes = "Expected findings but none were produced — red fixture is not red";
    } else {
      const reasons = new Set(allFindings.map((f) => f.reason));
      const expectedReasons = new Set(spec.expected_reasons ?? []);
      const missingReasons = [...expectedReasons].filter((r) => !reasons.has(r));
      if (missingReasons.length) {
        testPass = false;
        notes = `Missing expected finding reasons: ${missingReasons.join(", ")}. Got: ${[...reasons].join(", ")}`;
      }
    }
  }

  if (!testPass) allPassed = false;

  const result = {
    fixture: spec.name,
    description: spec.description,
    expect: spec.expect,
    findings: allFindings,
    test_pass: testPass,
    notes,
  };
  results.push(result);

  const status = testPass ? "✓" : "✗";
  console.log(`${status} [${spec.name}] ${spec.description}`);
  if (!testPass) console.error(`  FAIL: ${notes}`);
  if (allFindings.length > 0) {
    for (const f of allFindings) console.log(`    finding: \`${f.token}\` (${f.reason})`);
  }
}

const receipt = {
  schema_version: 1,
  test: "dead-reference-lint-fixtures",
  fixture_count: FIXTURE_SPECS.length,
  all_passed: allPassed,
  results,
  date_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
};

const receiptsDir = join(root, "evals/receipts/v1/contracts");
mkdirSync(receiptsDir, { recursive: true });
writeFileSync(join(receiptsDir, "dead-references.json"), JSON.stringify(receipt, null, 2));
console.log(`\nWrote evals/receipts/v1/contracts/dead-references.json`);

if (!allPassed) {
  console.error("\nFAIL: some lint fixture tests did not produce expected results");
  process.exit(1);
} else {
  console.log("\n✓ All lint fixture tests passed");
}
