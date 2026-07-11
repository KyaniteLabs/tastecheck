#!/usr/bin/env node
/**
 * tools/evals/validate-w1-outputs.mjs — validate all W1 output files.
 *
 * Scans .omx/evidence/tastecheck-v1/raw/ for attempt JSON files
 * (pattern: <job_id>-attempt-<n>.json) and validates each against the
 * canonical w1-attempt-validator library. Prints findings and exits 1
 * if any fail.
 *
 * Usage: node tools/evals/validate-w1-outputs.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateAttempt, loadPacket } from "./lib/w1-attempt-validator.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
// Raw outputs live exclusively under .omx — never under evals/
const outputsDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const requestedAttemptIndex = process.argv.includes("--attempt-index")
  ? Number(process.argv[process.argv.indexOf("--attempt-index") + 1])
  : null;

if (!existsSync(outputsDir)) {
  console.log(".omx/evidence/tastecheck-v1/raw/ does not exist — no output files to validate");
  process.exit(0);
}

// Scan only attempt filenames — <job_id>-attempt-<n>.json
const attemptRe = /^[a-z][a-z0-9-]+-(?:baseline|upgraded)-seed\d+-attempt-\d+\.json$/;
const files = readdirSync(outputsDir).filter((f) => attemptRe.test(f))
  .filter((file) => requestedAttemptIndex === null || file.endsWith(`-attempt-${requestedAttemptIndex}.json`))
  .sort();

if (files.length === 0) {
  console.log("No attempt files found in .omx/evidence/tastecheck-v1/raw/");
  process.exit(0);
}

let errorCount = 0;
let validCount = 0;

for (const file of files) {
  const filePath = join(outputsDir, file);
  let attempt;
  try {
    attempt = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`FAIL [${file}]: invalid JSON — ${e.message}`);
    errorCount++;
    continue;
  }

  const packet = loadPacket(root, attempt.job_id, attempt.attempt_id);
  if (!packet) {
    console.error(`FAIL [${file}]: no job packet found for job_id="${attempt.job_id}"`);
    errorCount++;
    continue;
  }

  const errors = validateAttempt(attempt, packet, root);
  if (errors.length > 0) {
    console.error(`FAIL [${file}]:`);
    for (const e of errors) console.error(`  - ${e}`);
    errorCount++;
  } else {
    console.log(`  ok [${file}]`);
    validCount++;
  }
}

console.log(`\nvalidate-w1-outputs: ${validCount} valid, ${errorCount} failed`);
if (errorCount > 0) process.exit(1);
