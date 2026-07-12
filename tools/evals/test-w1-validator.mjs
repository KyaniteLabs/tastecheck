#!/usr/bin/env node
/**
 * tools/evals/test-w1-validator.mjs — canonical W1 validator unit tests.
 *
 * Tests:
 *  Red fixtures (must be rejected):
 *   1.  wrong-run-type     — run_type "upgraded" on a baseline packet
 *   2.  wrong-source-path  — skill_source_path points to upgraded path on a baseline packet
 *   3.  wrong-source-digest — skill_source_sha256 is all-zeros (packet mismatch)
 *   4.  wrong-job-seed     — requested_seed 202 on a seed-101 packet
 *   5.  wrong-executor     — executor "gpt-4o" instead of "gpt-5.6-terra"
 *   6.  wrong-output-hash  — raw_output_hash does not match raw_output
 *   7.  extra-property     — contains an unknown field
 *
 *  Green pass (must validate cleanly):
 *   8. valid-baseline fixture
 *
 * Exit 0 = all tests pass. Exit 1 = one or more failures.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateAttempt, loadPacket } from "./lib/w1-attempt-validator.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const fixtureDir = join(root, "evals/fixtures/w1-validator");
const outputsDir = join(root, ".omx/evidence/tastecheck-v1/raw");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function loadFixture(filename) {
  return JSON.parse(readFileSync(join(fixtureDir, filename), "utf8"));
}

function runOnFixture(filename) {
  const attempt = loadFixture(filename);
  const packet = loadPacket(root, attempt.job_id);
  assert(packet !== null, `Packet not found for job_id: ${attempt.job_id}`);
  return validateAttempt(attempt, packet, root);
}

console.log("W1 Validator Tests\n");

// — Red fixtures: must all be rejected —

const RED_FIXTURES = [
  ["wrong-run-type.json",      "run_type mismatch vs packet"],
  ["wrong-source-path.json",   "skill_source_path mismatch vs packet"],
  ["wrong-source-digest.json", "skill_source_sha256 mismatch vs packet and live file"],
  ["wrong-job-seed.json",      "requested_seed mismatch vs packet"],
  ["wrong-executor.json",      "executor is not gpt-5.6-terra"],
  ["wrong-output-hash.json",   "raw_output_hash does not match raw_output"],
  ["extra-property.json",      "undocumented_field not in schema"],
];

console.log("Red fixtures (must reject):");
for (const [filename, reason] of RED_FIXTURES) {
  test(`rejects ${filename} — ${reason}`, () => {
    const errors = runOnFixture(filename);
    assert(errors.length > 0, `Expected validation errors for ${filename}, but got none`);
  });
}

// — Green fixtures: must all pass —

console.log("\nGreen fixtures (must accept):");
test("accepts valid-baseline.json", () => {
  const errors = runOnFixture("valid-baseline.json");
  assert(
    errors.length === 0,
    `Expected valid-baseline.json to pass, got:\n${errors.map((e) => "  - " + e).join("\n")}`
  );
});

test("rejects cross-revision packet substitution", () => {
  const historical = JSON.parse(readFileSync(join(outputsDir, "component-states-upgraded-seed101-attempt-1.json"), "utf8"));
  const current = JSON.parse(readFileSync(join(outputsDir, "component-states-upgraded-seed101-attempt-2.json"), "utf8"));
  const currentPacket = loadPacket(root, historical.job_id);
  const archivedPacket = loadPacket(root, historical.job_id, historical.attempt_id);
  assert(archivedPacket?.source_revision?.validation === "archived", "missing archived packet revision");
  assert(validateAttempt(historical, currentPacket, root).length > 0, "attempt-1 accepted against live packet");
  assert(validateAttempt(current, archivedPacket, root).length > 0, "attempt-2 accepted against archived packet");
});

test("attempt-3 fails closed when its active source digest drifts", () => {
  const current = JSON.parse(readFileSync(join(outputsDir, "component-states-upgraded-seed101-attempt-3.json"), "utf8"));
  current.skill_source_sha256 = `0${current.skill_source_sha256.slice(1)}`;
  const packet = loadPacket(root, current.job_id, current.attempt_id);
  const errors = validateAttempt(current, packet, root);
  assert(errors.some((error) => error.includes("live file")), `live source drift was accepted: ${errors.join("; ")}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
