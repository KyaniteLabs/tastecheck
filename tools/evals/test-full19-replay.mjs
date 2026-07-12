#!/usr/bin/env node
/**
 * Test-first adversarial coverage for the full 19-skill production corpus scaffold.
 *
 * The fixture root is copied before mutation. No checked-in result path, W1/W1R1
 * evidence, or product source is written by these tests.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const namespace = "evals/replays/full19-v1rc-2026-07-11";
const toolPath = join(root, "tools/evals/full19-replay.mjs");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadManifest(baseRoot = root) {
  return readJson(join(baseRoot, namespace, "manifest.json"));
}

function makeFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-full19-"));
  cpSync(join(root, namespace), join(fixtureRoot, namespace), { recursive: true });
  rmSync(join(fixtureRoot, namespace, "results"), { recursive: true, force: true });
  for (const relativePath of [
    "skills",
    "skills.json",
    "commands",
    "evals/scenarios",
    "evals/generated/scenario-registry.json",
    "contracts/v1",
    ".omx/evidence/tastecheck-v1/baseline/v0.1.0",
    "evals/replays/w1r1-remediation-2026-07-11",
    ".omx/evidence/tastecheck-v1/raw",
    "evals/receipts/v1/w1",
  ]) {
    const source = join(root, relativePath);
    if (existsSync(source)) cpSync(source, join(fixtureRoot, relativePath), { recursive: true });
  }
  return fixtureRoot;
}

function makeResult(manifest, job) {
  const rawOutput = `Fresh Terra output for ${job.job_id}`;
  return {
    schema_version: 1,
    revision_id: manifest.revision_id,
    namespace: manifest.namespace,
    result_path: job.result_path,
    job_id: job.job_id,
    attempt_id: `${job.job_id}-fresh-1`,
    executor: manifest.executor,
    fresh_context: true,
    requested_seed: job.requested_seed,
    observed_seed: null,
    requested_temperature: job.requested_temperature,
    observed_temperature: null,
    skill_source_kind: job.skill_source_kind,
    skill_source_path: job.skill_source_path,
    skill_source_sha256: job.skill_source_sha256,
    skill: job.skill,
    scenario_id: job.scenario_id,
    scenario_registry_entry_sha256: job.scenario_registry_entry_sha256,
    contract_projection_sha256: job.contract_projection_sha256,
    run_type: job.run_type,
    skill_version: job.skill_version,
    prompt_packet_ref: job.prompt_packet_ref,
    prompt_packet_sha256: job.prompt_packet_sha256,
    status: "complete",
    raw_output: rawOutput,
    raw_output_hash: sha256(rawOutput),
    assertions_result: job.assertions.map((assertion_text, assertion_index) => ({
      assertion_index,
      assertion_text,
      met: true,
      evidence: `Evidence for assertion ${assertion_index + 1}`,
      notes: "Fresh-context result fixture",
    })),
    evidence_fields_present: Object.fromEntries(job.expected_evidence_fields.map((field) => [field, true])),
    self_check_shape_observed: job.contract_projection?.self_check_shape ?? "ledger_with_verdict",
    external_source: true,
    external_source_lane: "terra",
    token_usage: { input_tokens: null, output_tokens: null, total_tokens: null, reason: "Terra result fixture does not expose usage." },
    cost: { amount: null, currency: null, reason: "Terra result fixture does not expose billing." },
    date_utc: "2026-07-11T00:00:00Z",
  };
}

function writeResults(baseRoot, mutate = () => {}) {
  const manifest = loadManifest(baseRoot);
  const dir = join(baseRoot, "external-results");
  mkdirSync(dir, { recursive: true });
  return manifest.jobs.map((job, index) => {
    const result = makeResult(manifest, job);
    mutate(result, job, index);
    const path = join(dir, `${job.job_id}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
    return path;
  });
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}: ${error.message}`);
    failed++;
  }
}

console.log("Full19 production corpus scaffold tests\n");

if (!existsSync(toolPath)) {
  console.error(`  ✗ scaffold command exists: missing ${toolPath}`);
  process.exit(1);
}

const { validatePackage, validateResultSet, collectResults } = await import("./full19-replay.mjs");

await run("package has exactly 76 cells, 76 packets, and 76 isolated result paths", () => {
  const manifest = loadManifest();
  assert(manifest.status === "pending", "manifest must start pending");
  assert(manifest.jobs.length === 76, `expected 76 jobs, got ${manifest.jobs.length}`);
  assert(new Set(manifest.jobs.map((job) => job.prompt_packet_ref)).size === 76, "packet refs must be unique");
  assert(new Set(manifest.jobs.map((job) => job.result_path)).size === 76, "result refs must be unique");
  assert(manifest.jobs.filter((job) => job.run_type === "baseline").length === 19, "expected 19 baseline jobs");
  assert(manifest.jobs.filter((job) => job.run_type === "upgraded").length === 57, "expected 57 upgraded jobs");
  assert(validatePackage(root).errors.length === 0, validatePackage(root).errors.join("; "));
});

await run("accepts exactly 76 valid fresh Terra results", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.length === 0, checked.errors.join("; "));
    assert(checked.results.length === 76, "validator must accept all 76 cells");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

for (const [name, mutate, needle] of [
  ["a baseline/current source swap", (result, job) => {
    if (job.run_type === "baseline") {
      result.skill_source_path = job.current_skill_source_path;
      result.skill_source_sha256 = job.current_skill_source_sha256;
    }
  }, "baseline source"],
  ["a stale digest", (result) => { result.skill_source_sha256 = "0".repeat(64); }, "digest"],
  ["a wrong revision", (result) => { result.revision_id = "w1r1-remediation-2026-07-11"; }, "revision"],
  ["a wrong result path", (result, job) => { result.result_path = `evals/replays/w1r1-remediation-2026-07-11/results/${job.job_id}.json`; }, "result_path"],
  ["a wrong seed", (result) => { result.requested_seed = 999; }, "seed"],
  ["a wrong model", (result) => { result.executor = "gpt-4o"; }, "executor"],
  ["wrong assertion text", (result) => { result.assertions_result[0].assertion_text = "not the packet assertion"; }, "assertion"],
  ["a wrong output hash", (result) => { result.raw_output_hash = "f".repeat(64); }, "raw_output_hash"],
  ["missing token/cost reason", (result) => { result.token_usage.reason = null; }, "token_usage"],
]) {
  await run(`rejects ${name}`, () => {
    const fixtureRoot = makeFixtureRoot();
    try {
      const paths = writeResults(fixtureRoot, (result, job, index) => { if (index === 0) mutate(result, job); });
      const checked = validateResultSet(fixtureRoot, paths);
      assert(checked.errors.some((error) => error.toLowerCase().includes(needle.toLowerCase())), `did not report ${needle}: ${checked.errors.join("; ")}`);
    } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
  });
}

await run("rejects missing, extra, and duplicate cells", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    assert(validateResultSet(fixtureRoot, paths.slice(1)).errors.some((error) => error.includes("exactly 76")), "missing cell accepted");
    const extra = join(fixtureRoot, "external-results/extra.json");
    writeFileSync(extra, readFileSync(paths[0]));
    assert(validateResultSet(fixtureRoot, [...paths, extra]).errors.some((error) => error.includes("exactly 76")), "extra cell accepted");
    assert(validateResultSet(fixtureRoot, [paths[0], ...paths]).errors.some((error) => error.includes("exactly 76")), "duplicate cell accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("rejects old W1/W1R1 evidence as current input", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    paths[0] = join(fixtureRoot, "evals/replays/w1r1-remediation-2026-07-11/results/component-states-upgraded-seed101.json");
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.some((error) => error.toLowerCase().includes("historical") || error.toLowerCase().includes("revision")), "historical result accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("rejects current source drift after packaging", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const source = join(fixtureRoot, "skills/a11y-pass/SKILL.md");
    writeFileSync(source, readFileSync(source, "utf8") + "\nDrift introduced after packaging.\n");
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.some((error) => error.toLowerCase().includes("live source") || error.toLowerCase().includes("drift")), "current source drift accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("collector is all-or-nothing and never overwrites completed results", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const first = collectResults(fixtureRoot, paths);
    assert(first.errors.length === 0 && first.written.length === 76, "first collection did not write 76 results");
    const second = collectResults(fixtureRoot, paths);
    assert(second.errors.length === 76 && second.written.length === 0, "collector overwrote completed results");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
