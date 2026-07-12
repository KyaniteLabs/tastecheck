#!/usr/bin/env node
/**
 * tools/evals/test-sanitizer-fixtures.mjs — proves sanitizer catches leaks and passes clean input.
 *
 * Required by test spec: "A secret scanner and dedicated leakage fixture must pass
 * before a public receipt is written. Diagnostics stay in ignored private storage.
 *
 * Fixture specs:
 *   clean/sample.json             → expect: pass (no leaks)
 *   leak-absolute-path/sample.json → expect: fail (absolute Unix path)
 *   leak-email/sample.json        → expect: fail (email address)
 *   leak-token/sample.json        → expect: fail (api key token)
 *
 * Writes: .omx/evidence/tastecheck-v1/test-receipts/sanitizer-fixtures.json
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeReceipt } from "./sanitize-receipts.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const FIXTURES_DIR = join(root, "evals/fixtures/sanitizer");

const FIXTURE_SPECS = [
  {
    name: "clean",
    dir: join(FIXTURES_DIR, "clean"),
    file: "sample.json",
    expect: "pass",
    description: "Clean receipt with no banned patterns passes sanitization",
  },
  {
    name: "leak-absolute-path",
    dir: join(FIXTURES_DIR, "leak-absolute-path"),
    file: "sample.json",
    expect: "fail",
    description: "Absolute Unix path in evidence field is rejected",
  },
  {
    name: "leak-email",
    dir: join(FIXTURES_DIR, "leak-email"),
    file: "sample.json",
    expect: "fail",
    description: "Email address in reviewer field is rejected",
  },
  {
    name: "leak-token",
    dir: join(FIXTURES_DIR, "leak-token"),
    file: "sample.json",
    expect: "fail",
    description: "API key token pattern in evidence field is rejected",
  },
];

const results = [];
let allPassed = true;

for (const spec of FIXTURE_SPECS) {
  const filePath = join(spec.dir, spec.file);
  if (!existsSync(filePath)) {
    console.error(`✗ [${spec.name}] MISSING fixture file: ${filePath}`);
    allPassed = false;
    results.push({ fixture: spec.name, test_pass: false, notes: `Fixture file missing: ${spec.file}` });
    continue;
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    const note = `Cannot parse fixture: ${e.message}`;
    console.error(`✗ [${spec.name}] ${note}`);
    allPassed = false;
    results.push({ fixture: spec.name, test_pass: false, notes: note });
    continue;
  }

  let sanitized = null;
  let rejectionCode = null;
  try {
    sanitized = sanitizeReceipt(raw);
  } catch (e) {
    rejectionCode = e.code ?? "INVALID_RECEIPT";
  }

  let testPass;
  let notes = "";
  if (spec.expect === "pass") {
    testPass = rejectionCode === null;
    if (!testPass) notes = `Expected sanitization to pass but got rejection code: ${rejectionCode}`;
  } else {
    testPass = rejectionCode !== null;
    if (!testPass) notes = "Expected sanitization to reject (leak detected) but it passed — red fixture is not red";
    else notes = `Correctly rejected: ${rejectionCode}`;
  }

  if (!testPass) allPassed = false;

  const icon = testPass ? "✓" : "✗";
  console.log(`${icon} [${spec.name}] ${spec.description}`);
  if (!testPass) console.error(`  FAIL: ${notes}`);
  else if (spec.expect === "fail") console.log(`  Rejection: ${notes}`);

  results.push({
    fixture: spec.name,
    description: spec.description,
    expect: spec.expect,
    test_pass: testPass,
    rejection_code: rejectionCode,
  });
}

const receipt = {
  schema_version: 1,
  test: "sanitizer-leak-fixtures",
  fixture_count: FIXTURE_SPECS.length,
  all_passed: allPassed,
  results,
  date_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
};

const receiptsDir = join(root, ".omx/evidence/tastecheck-v1/test-receipts");
mkdirSync(receiptsDir, { recursive: true });
writeFileSync(join(receiptsDir, "sanitizer-fixtures.json"), JSON.stringify(receipt, null, 2));
console.log("\nWrote private sanitizer fixture diagnostic");

if (!allPassed) {
  console.error("\nFAIL: sanitizer fixture tests did not produce expected results");
  process.exit(1);
} else {
  console.log("\n✓ All sanitizer fixture tests passed");
}
