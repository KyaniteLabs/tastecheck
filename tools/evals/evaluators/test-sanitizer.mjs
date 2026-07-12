#!/usr/bin/env node
/**
 * tools/evals/evaluators/test-sanitizer.mjs — proves the sanitizer catches leakage.
 *
 * Tests every case in evals/fixtures/sanitizer/leakage.json against sanitizeReceipt().
 * All "rejected" cases must throw; any case that passes is a sanitizer failure.
 *
 * Writes: .omx/evidence/tastecheck-v1/test-receipts/sanitizer.json
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeReceipt } from "../sanitize-receipts.mjs";

const root = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const fixturePath = join(root, "evals/fixtures/sanitizer/leakage.json");

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const cases = fixture.cases;

const results = [];
let allPassed = true;

for (const c of cases) {
  if (c.expected !== "rejected") continue;

  // Build a minimal receipt-shaped object with the banned value in the relevant field
  const testPayload = {
    schema_version: 1,
    skill: "test",
    scenario_id: "test-case",
    variant: "upgraded",
    run_id: "test-run-001",
    prompt_hash: "a".repeat(64),
    context_hash: "b".repeat(64),
    tool_policy: "read-only",
    model_runtime: "claude-sonnet-4-6",
    output_ref: "sha256:" + "c".repeat(64),
    rubric: { brief_fit: 3, specificity: 3, actionability: 3, coherence: 3, usability: 3, non_generic_judgment: 3, skill_requirements: 3 },
    verdict: "improved",
    [c.field]: c.banned_value,
  };

  let caught = false;
  let rejectionCode = null;
  try {
    sanitizeReceipt(testPayload);
  } catch (e) {
    caught = true;
    rejectionCode = e.code ?? "INVALID_RECEIPT";
  }

  const testPass = caught; // we expect rejection
  if (!testPass) allPassed = false;

  const status = testPass ? "✓" : "✗";
  console.log(`${status} [${c.id}] ${c.field} — ${testPass ? "correctly rejected" : "LEAK NOT DETECTED — sanitizer failure"}`);
  if (!testPass) console.error(`  FAIL: banned value was not caught for field "${c.field}"`);

  results.push({ id: c.id, field: c.field, expected: c.expected, test_pass: testPass, rejection_code: rejectionCode });
}

const receipt = {
  schema_version: 1,
  test: "sanitizer-leakage-fixture",
  fixture: "evals/fixtures/sanitizer/leakage.json",
  case_count: results.length,
  all_passed: allPassed,
  results,
  date_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
};

const receiptsDir = join(root, ".omx/evidence/tastecheck-v1/test-receipts");
mkdirSync(receiptsDir, { recursive: true });
writeFileSync(join(receiptsDir, "sanitizer.json"), JSON.stringify(receipt, null, 2));
console.log("\nWrote private sanitizer diagnostic");

if (!allPassed) {
  console.error("\nFAIL: sanitizer did not reject all banned patterns — leakage is possible");
  process.exit(1);
} else {
  console.log("\n✓ Sanitizer correctly rejected all banned leakage patterns");
}
