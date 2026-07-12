#!/usr/bin/env node
/**
 * tools/evals/test-w1-infra.mjs — deterministic W1 infrastructure validation tests.
 *
 * Tests:
 *   1. Operational matrix has 12 total jobs across 3 pilot skills (4 each).
 *   2. Job manifest has exactly 12 jobs with correct run_type distribution (3×1 baseline + 3×3 upgraded).
 *   3. Every job has a corresponding prompt packet file.
 *   4. Scenario registry has 20 scenarios, all 19 skills covered, no missing_skills.
 *   5. No scenario has both id and scenario_id fields (canonical drift).
 *   6. Context budget passes (overall_pass=true).
 *   7. Greenfield contract has art-direction and micro-motion in downstream.
 *   8. A/B blind map has all 3 pilot skills, each assigned distinct A/B labels.
 *   9. Anti-slop evaluator correctly flags slop patterns in a synthetic test.
 *  10. Diversity evaluator: identical outputs score < diversity threshold.
 *  11. Adjudication: 2-pass/1-fail → majority pass; 1-pass/2-fail → majority fail.
 *  12. Aggregate-receipts exits 1 when jobs are pending (release-blocking check).
 *  13. Sanitizer rejects leaky-path, leaky-email, and leaky-token fixtures.
 *  14. Sanitizer accepts clean-receipt fixture.
 *
 * Exit 0 = all tests pass. Exit 1 = one or more failures.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateW1EvaluatorGate } from "./lib/w1-evaluator-gate.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      failed++;
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

console.log("W1 Infrastructure Tests\n");

// 1. Operational matrix job count
test("operational-matrix: 12 total jobs, 3 pilot skills", () => {
  const m = load("evals/w1/operational-matrix.json");
  assert(m.total_jobs === 12, `total_jobs expected 12, got ${m.total_jobs}`);
  assert(m.pilot_skills.length === 3, `expected 3 pilot skills, got ${m.pilot_skills.length}`);
  assert(m.pilot_skills.every((s) => s.total_jobs === 4), "each skill must have 4 total jobs");
});

// 2. Job manifest distribution
test("job-manifest: 12 jobs with correct run_type distribution", () => {
  const m = load("evals/w1/job-manifest.json");
  assert(m.jobs.length === 12, `expected 12 jobs, got ${m.jobs.length}`);
  const baseline = m.jobs.filter((j) => j.run_type === "baseline");
  const upgraded = m.jobs.filter((j) => j.run_type === "upgraded");
  assert(baseline.length === 3, `expected 3 baseline jobs, got ${baseline.length}`);
  assert(upgraded.length === 9, `expected 9 upgraded jobs, got ${upgraded.length}`);
  const upgradedSeeds = new Set(upgraded.map((j) => j.requested_seed));
  assert(upgradedSeeds.has(101) && upgradedSeeds.has(202) && upgradedSeeds.has(303), "upgraded must cover seeds 101, 202, 303");
});

// 3. Prompt packets exist
test("prompt packets: all 12 packet files exist", () => {
  const m = load("evals/w1/job-manifest.json");
  for (const job of m.jobs) {
    const exists = existsSync(join(root, job.prompt_packet_ref));
    assert(exists, `Missing packet: ${job.prompt_packet_ref}`);
  }
});

// 4. Scenario registry
test("scenario-registry: 20 scenarios, 19 skills, no missing_skills", () => {
  const r = load("evals/generated/scenario-registry.json");
  assert(r.scenario_count === 20, `expected 20 scenarios, got ${r.scenario_count}`);
  assert(r.skills_covered.length === 19, `expected 19 skills, got ${r.skills_covered.length}`);
  assert(r.missing_skills.length === 0, `missing skills: ${r.missing_skills.join(", ")}`);
});

// 5. No scenario has both id and scenario_id
test("scenario-registry: no scenario has both id and scenario_id", () => {
  const r = load("evals/generated/scenario-registry.json");
  for (const s of r.scenarios) {
    assert(!("scenario_id" in s), `Scenario ${s.id} still has legacy scenario_id field`);
    assert("id" in s, `Scenario missing id field: ${JSON.stringify(s).slice(0, 60)}`);
  }
});

// 6. Context budget overall_pass
test("context-budget: overall_pass=true", () => {
  const b = load("evals/receipts/v1/context-budget.json");
  assert(b.overall_pass === true, `overall_pass is ${b.overall_pass}; failing skills: ${b.skills.filter((s) => !s.pass).map((s) => s.skill).join(", ")}`);
});

// 7. Greenfield contract has art-direction and micro-motion
test("greenfield contract: art-direction and micro-motion in downstream", () => {
  const g = load("contracts/v1/interviews/greenfield.json");
  const downstream = g.handoff.downstream;
  assert(downstream.includes("art-direction"), "art-direction missing from greenfield downstream");
  assert(downstream.includes("micro-motion"), "micro-motion missing from greenfield downstream");
});

// 8. A/B blind map
test("ab-map: 3 pilot skills with distinct A/B labels", () => {
  const m = load("evals/w1/blind-map/ab-map.json");
  const skills = ["component-states", "deslop-ui", "tastecheck-pass"];
  assert(skills.every((s) => s in m.assignments), "missing skill in ab-map");
  for (const skill of skills) {
    const a = m.assignments[skill];
    assert("A" in a, `Missing A label for ${skill}`);
    assert("B" in a, `Missing B label for ${skill}`);
    assert(!("job_ids" in a), `Public ab-map must not expose job_ids for ${skill}`);
  }
});

// 9. Anti-slop: detects slop in synthetic input
test("anti-slop evaluator: flags slop patterns in synthetic output", async () => {
  const { evaluateAntiSlop } = await import(join(root, "tools/evals/evaluators/anti-slop.mjs"));
  const slopAttempt = {
    job_id: "component-states-upgraded-seed101",
    skill: "component-states",
    scenario_id: "component-states-async-destructive-control",
    run_type: "upgraded",
    seed: 101,
    status: "complete",
    raw_output: "In conclusion, we need to ensure leveraging robust and seamless transitions. Generally speaking, the system should utilize modern, intuitive controls. In essence, this approach leverages scalable synergy.",
    assertions_result: [],
    evidence_fields_present: { status: false, reason: false, remediation: false, evidence: false, provenance: false },
  };
  const result = evaluateAntiSlop(slopAttempt);
  assert(!result.pass, `Expected slop to be detected, got pass=true (score=${result.slop_score})`);
  assert(result.slop_score >= 5, `Slop score ${result.slop_score} should be >= 5`);
});

// 10. Diversity: identical outputs score not-diverse
test("diversity evaluator: identical outputs are not diverse", async () => {
  const { evaluateDiversity } = await import(join(root, "tools/evals/evaluators/diversity.mjs"));
  const output = "The state contract must handle loading and error. Use aria-busy. Focus is managed.";
  const attempts = [101, 202, 303].map((seed) => ({
    job_id: `component-states-upgraded-seed${seed}`,
    skill: "component-states",
    scenario_id: "component-states-async-destructive-control",
    run_type: "upgraded",
    seed,
    raw_output: output,
  }));
  const result = evaluateDiversity(attempts);
  assert(result.overall_pass === false, "Identical outputs should fail diversity");
});

// 10b. Diversity: cosmetic headings do not create a new response architecture.
test("diversity evaluator: heading-only variation is not diverse", async () => {
  const { evaluateDiversity } = await import(join(root, "tools/evals/evaluators/diversity.mjs"));
  const body = "\n\n| check | status | reason | remediation | evidence | provenance |\n| contrast | fail | missing ratio | measure it | no pair | scenario |\n\nThe gate fails closed.";
  const attempts = ["Evidence sequence", "Release memo", "Contradiction memo"].map((heading, index) => ({
    job_id: `tastecheck-pass-upgraded-seed${[101, 202, 303][index]}`,
    skill: "tastecheck-pass",
    scenario_id: "tastecheck-pass-dishonest-evidence-bundle",
    run_type: "upgraded",
    seed: [101, 202, 303][index],
    raw_output: `# ${heading}${body}`,
  }));
  const result = evaluateDiversity(attempts);
  assert(result.overall_pass === false, "Heading-only variation should fail diversity");
  assert(result.axis_results.structure === false, "Heading-only variation must not count as structural diversity");
});

// 11. Adjudication: majority logic
test("adjudication: 2-pass/1-fail → pass; 1-pass/2-fail → fail", async () => {
  const { adjudicate } = await import(join(root, "tools/evals/evaluators/adjudication.mjs"));
  const makeResult = (evaluator, passField, passValue) => {
    const r = { evaluator, skill: "component-states" };
    r[passField] = passValue;
    if (evaluator === "paired-lift") r.verdict = passValue ? "improved" : "regressed";
    return r;
  };
  const r1 = adjudicate(
    makeResult("paired-lift", "verdict_pass", true),
    { evaluator: "diversity", skill: "component-states", overall_pass: true },
    { evaluator: "anti-slop", skill: "component-states", pass: false }
  );
  assert(r1.result === "pass", `Expected pass on 2-pass/1-fail, got ${r1.result}`);

  const r2 = adjudicate(
    makeResult("paired-lift", "verdict_pass", false),
    { evaluator: "diversity", skill: "component-states", overall_pass: false },
    { evaluator: "anti-slop", skill: "component-states", pass: true }
  );
  assert(r2.result === "fail", `Expected fail on 1-pass/2-fail, got ${r2.result}`);
});

// 12. Strict aggregate reports a release block for the current invalid gate state.
test("aggregate-receipts: exits 1 when the release gate is blocked", () => {
  const result = spawnSync("node", [join(root, "tools/evals/aggregate-w1-receipts.mjs")], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  });
  assert(result.status === 1, `Expected exit 1 for incomplete W1, got ${result.status}`);
  assert(result.stderr.includes("RELEASE BLOCKED"), "Expected RELEASE BLOCKED in stderr");
});

test("aggregate evaluator gate: failed-but-present artifacts never unblock release", () => {
  const failedArtifacts = Object.fromEntries(["component-states", "deslop-ui", "tastecheck-pass"].map((skill) => [skill, {
    paired_lift: { release_eligible: false, verdict: "regressed" },
    diversity: { overall_pass: false, verdict: "fail" },
    anti_slop: { pass: true, verdict: "pass" },
  }]));
  const gate = evaluateW1EvaluatorGate(failedArtifacts);
  assert(gate.pass === false, "failed artifacts must not satisfy the evaluator gate");
  for (const skill of Object.keys(failedArtifacts)) {
    assert(gate.failures.includes(`${skill}/paired-lift: release_eligible=false, verdict=regressed`), `missing paired failure for ${skill}`);
    assert(gate.failures.includes(`${skill}/diversity: overall_pass=false, verdict=fail`), `missing diversity failure for ${skill}`);
  }
});

test("aggregate evaluator gate: only all three passing evaluator artifacts unblock", () => {
  const passingArtifacts = Object.fromEntries(["component-states", "deslop-ui", "tastecheck-pass"].map((skill) => [skill, {
    paired_lift: { release_eligible: true, verdict: "improved" },
    diversity: { overall_pass: true, verdict: "pass" },
    anti_slop: { pass: true, verdict: "pass" },
  }]));
  const gate = evaluateW1EvaluatorGate(passingArtifacts);
  assert(gate.pass === true, gate.failures.join("; "));
});

// 13. Sanitizer rejects leaky fixtures
test("sanitizer: rejects leaky-path fixture", async () => {
  const { sanitizeReceipt } = await import(join(root, "tools/evals/sanitize-receipts.mjs"));
  const leaky = JSON.parse(readFileSync(join(root, "evals/fixtures/sanitizer/leaky-path.json"), "utf8"));
  let threw = false;
  try { sanitizeReceipt(leaky); } catch { threw = true; }
  assert(threw, "sanitizeReceipt should throw on absolute path");
});

test("sanitizer: rejects leaky-email fixture", async () => {
  const { sanitizeReceipt } = await import(join(root, "tools/evals/sanitize-receipts.mjs"));
  const leaky = JSON.parse(readFileSync(join(root, "evals/fixtures/sanitizer/leaky-email.json"), "utf8"));
  let threw = false;
  try { sanitizeReceipt(leaky); } catch { threw = true; }
  assert(threw, "sanitizeReceipt should throw on email address");
});

test("sanitizer: rejects leaky-token fixture", async () => {
  const { sanitizeReceipt } = await import(join(root, "tools/evals/sanitize-receipts.mjs"));
  const leaky = JSON.parse(readFileSync(join(root, "evals/fixtures/sanitizer/leaky-token.json"), "utf8"));
  let threw = false;
  try { sanitizeReceipt(leaky); } catch { threw = true; }
  assert(threw, "sanitizeReceipt should throw on secret token pattern");
});

// 14. Sanitizer accepts clean receipt
test("sanitizer: accepts clean-receipt fixture", async () => {
  const { sanitizeReceipt } = await import(join(root, "tools/evals/sanitize-receipts.mjs"));
  const clean = JSON.parse(readFileSync(join(root, "evals/fixtures/sanitizer/clean-receipt.json"), "utf8"));
  let result;
  try { result = sanitizeReceipt(clean); } catch (e) { throw new Error(`Unexpected throw: ${e.message}`); }
  assert(result !== null, "sanitizeReceipt should return the cleaned receipt");
});

await runTests();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
