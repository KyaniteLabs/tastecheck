#!/usr/bin/env node
/**
 * Adversarial tests for the revision-safe W1 remediation replay scaffold.
 *
 * These tests intentionally operate on copied replay inputs so they never write
 * to the historical W1 evidence or to the checked-in fresh-attempt namespace.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const namespace = "evals/replays/w1r1-remediation-2026-07-11";
const toolPath = join(root, "tools/evals/remediation-replay.mjs");
const oldAttempt3 = join(root, ".omx/evidence/tastecheck-v1/raw/component-states-upgraded-seed101-attempt-3.json");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function loadManifest(baseRoot = root) {
  return JSON.parse(readFileSync(join(baseRoot, namespace, "manifest.json"), "utf8"));
}

function packetPath(baseRoot, job) {
  return join(baseRoot, job.prompt_packet_ref);
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
    executor: "gpt-5.6-terra",
    requested_seed: job.requested_seed,
    observed_seed: null,
    requested_temperature: job.requested_temperature,
    observed_temperature: null,
    skill_source_path: job.skill_source_path,
    skill_source_sha256: job.skill_source_sha256,
    skill: job.skill,
    scenario_id: job.scenario_id,
    run_type: "upgraded",
    skill_version: "current",
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
    self_check_shape_observed: "ledger_with_verdict",
    external_source: true,
    external_source_lane: "terra",
    date_utc: "2026-07-11T00:00:00Z",
  };
}

function makeFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-w1r1-"));
  cpSync(join(root, namespace), join(fixtureRoot, namespace), { recursive: true });
  // The checked-in namespace may contain completed results. Keep the fixture's
  // bound destinations empty so collection exercises the pre-result state.
  rmSync(join(fixtureRoot, namespace, "results"), { recursive: true, force: true });
  for (const skill of ["component-states", "deslop-ui", "tastecheck-pass"]) {
    mkdirSync(join(fixtureRoot, "skills", skill), { recursive: true });
    cpSync(join(root, "skills", skill, "SKILL.md"), join(fixtureRoot, "skills", skill, "SKILL.md"));
    mkdirSync(join(fixtureRoot, "evals/scenarios"), { recursive: true });
    cpSync(join(root, "evals/scenarios", `${skill}.json`), join(fixtureRoot, "evals/scenarios", `${skill}.json`));
  }
  return fixtureRoot;
}

function writeResults(baseRoot, mutate = () => {}) {
  const manifest = loadManifest(baseRoot);
  const dir = join(baseRoot, "external-results");
  mkdirSync(dir, { recursive: true });
  const paths = manifest.jobs.map((job, index) => {
    const result = makeResult(manifest, job);
    mutate(result, job, index);
    const path = join(dir, `${job.job_id}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
    return path;
  });
  return paths;
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

console.log("W1 remediation replay tests\n");

if (!existsSync(toolPath)) {
  console.error(`  ✗ scaffold command exists: missing ${toolPath}`);
  process.exit(1);
}

const { validatePackage, validateResultSet, collectResults } = await import("./remediation-replay.mjs");

await run("package has exactly nine upgraded cells and nine packet files", () => {
  const manifest = loadManifest();
  const expected = new Set([101, 202, 303]);
  assert(manifest.status === "pending", "manifest must start pending");
  assert(manifest.jobs.length === 9, `expected 9 jobs, got ${manifest.jobs.length}`);
  assert(manifest.jobs.every((job) => job.run_type === "upgraded"), "all jobs must be upgraded");
  assert(manifest.jobs.every((job) => expected.has(job.requested_seed)), "seed set drifted");
  assert(new Set(manifest.jobs.map((job) => job.prompt_packet_ref)).size === 9, "packet refs must be unique");
  assert(validatePackage(root).errors.length === 0, "checked-in package must validate");
});

await run("accepts exactly nine valid fresh Terra results", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.length === 0, checked.errors.join("; "));
    assert(checked.results.length === 9, "collector must validate nine results");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

await run("rejects a missing job", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot).slice(1);
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.some((error) => error.includes("exactly 9")), "missing job was not rejected");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("rejects an extra job", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const extra = join(fixtureRoot, "external-results/extra.json");
    writeFileSync(extra, readFileSync(paths[0]));
    const checked = validateResultSet(fixtureRoot, [...paths, extra]);
    assert(checked.errors.some((error) => error.includes("exactly 9")), "extra job was not rejected");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

for (const [name, mutate, needle] of [
  ["stale source digest", (result) => { result.skill_source_sha256 = "0".repeat(64); }, "source digest"],
  ["wrong revision", (result) => { result.revision_id = "attempt-3-live"; }, "revision_id"],
  ["wrong namespace/path", (result, job) => { result.namespace = "evals/w1"; result.result_path = `evals/w1/${job.job_id}.json`; }, "namespace"],
  ["wrong model", (result) => { result.executor = "gpt-4o"; }, "executor"],
  ["wrong seed", (result) => { result.requested_seed = 999; }, "requested_seed"],
  ["wrong assertion text", (result) => { result.assertions_result[0].assertion_text = "not the packet assertion"; }, "assertions_result"],
  ["wrong output hash", (result) => { result.raw_output_hash = "f".repeat(64); }, "raw_output_hash"],
]) {
  await run(`rejects ${name}`, () => {
    const fixtureRoot = makeFixtureRoot();
    try {
      const paths = writeResults(fixtureRoot, (result, job, index) => { if (index === 0) mutate(result, job); });
      const checked = validateResultSet(fixtureRoot, paths);
      assert(checked.errors.some((error) => error.includes(needle)), `did not report ${needle}: ${checked.errors.join("; ")}`);
    } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
  });
}

await run("rejects current-source drift after package creation", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const source = join(fixtureRoot, "skills/component-states/SKILL.md");
    writeFileSync(source, readFileSync(source, "utf8") + "\nDrift introduced after packaging.\n");
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.some((error) => error.includes("live source")), "source drift was accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("never treats an old attempt-3 file as current evidence", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    paths[0] = oldAttempt3;
    const checked = validateResultSet(fixtureRoot, paths);
    assert(checked.errors.length > 0, "old attempt-3 was accepted");
    assert(!checked.results.some((result) => result.attempt_id?.includes("attempt-3")), "old attempt-3 entered results");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("collector writes only the nine bound result paths and never overwrites", () => {
  const fixtureRoot = makeFixtureRoot();
  try {
    const paths = writeResults(fixtureRoot);
    const collected = collectResults(fixtureRoot, paths);
    assert(collected.written.length === 9, `expected 9 writes, got ${collected.written.length}`);
    const second = collectResults(fixtureRoot, paths);
    assert(second.errors.length === 9, "collector overwrote existing results");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
