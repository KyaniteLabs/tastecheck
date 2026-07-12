#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { synthesizeW1Judgments } from "./synthesize-w1-judgments.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const sourcePacketsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-packets");
const sourceUnmaskPath = join(root, ".omx/evidence/tastecheck-v1/raw/judge-unmask.json");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}: ${error.message}`);
    failed++;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJsonDirectory(directory) {
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort()
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")));
}

function calibration() {
  return {
    passed: true,
    items_passed: 6,
    items: [
      ["cal-001-full-pass", "verdict_correct"], ["cal-001-full-pass", "total_within_threshold"],
      ["cal-002-bare-checkmark", "verdict_correct"], ["cal-002-bare-checkmark", "total_within_threshold"],
      ["cal-003-partial-evidence", "verdict_correct"], ["cal-003-partial-evidence", "total_within_threshold"],
    ].map(([calibration_id, check]) => ({ calibration_id, check, passed: true })),
  };
}

function completeResult(packet, judgeId, family) {
  const base = {
    schema_version: 1,
    result_id: `${packet.packet_id}-${judgeId}`,
    packet_id: packet.packet_id,
    evaluator_type: packet.evaluator_type,
    judge_id: judgeId,
    evaluator_family: family,
    evaluator_model: `${family}-test`,
    status: "complete",
    calibration_status: calibration(),
  };
  const labels = Object.keys(packet.candidates);
  const evidence = Object.fromEntries(labels.map((label) => [label, packet.candidates[label].raw_output.slice(0, 48)]));
  if (packet.evaluator_type === "paired_lift") {
    const dimensions = {
      domain_specificity: 4, evidence_completeness: 4, fail_closed: 4, handoff_readiness: 4, scope_discipline: 4,
    };
    return {
      ...base,
      score_scale_version: "anchored-1-5-v1",
      candidate_scores: { A: { ...dimensions, total: 20 }, B: { ...dimensions, total: 20 } },
      candidate_evidence: { A: evidence.A, B: evidence.B },
      preference: "tie",
      deltas: Object.fromEntries(Object.keys(dimensions).map((key) => [key, 0])),
      regression_flags: [],
      verdict: "tie",
      rationale: evidence.A,
      cited_evidence: [evidence.A],
    };
  }
  if (packet.evaluator_type === "diversity") {
    const pair = (left) => ({
      structural_evidence: evidence[left], aesthetic_evidence: evidence[left], voice_evidence: evidence[left],
      coherence: "pass", usability: "pass", brief_fit: "pass", accessibility: "pass", skill_requirement: "pass",
    });
    return {
      ...base,
      pair_analyses: { "C1-C2": pair("C1"), "C1-C3": pair("C1"), "C2-C3": pair("C2") },
      verdict: "pass",
      rationale: evidence.C1,
      cited_evidence: [evidence.C1],
    };
  }
  return {
    ...base,
    candidate_findings: Object.fromEntries(labels.map((label) => [label, [{
      type: "concrete evidence", quote: evidence[label], evidence: `Observed: ${evidence[label]}`,
    }]])),
    verdict: "pass",
    rationale: evidence.C1,
    cited_evidence: [evidence.C1],
  };
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tastecheck-w1-synthesis-"));
  const packetsDir = join(directory, "packets");
  const resultsDir = join(directory, "results");
  const outputDir = join(directory, "evaluators");
  mkdirSync(packetsDir);
  mkdirSync(resultsDir);
  const packets = readJsonDirectory(sourcePacketsDir);
  const mapping = clone(JSON.parse(readFileSync(sourceUnmaskPath, "utf8")));
  for (const packet of packets) {
    writeFileSync(join(packetsDir, `${packet.packet_id}.json`), `${JSON.stringify(packet, null, 2)}\n`);
    for (const [judgeId, family] of [["luna-1", "luna"], ["luna-2", "luna"], ["sonnet-1", "sonnet"]]) {
      const result = completeResult(packet, judgeId, family);
      writeFileSync(join(resultsDir, `${result.result_id}.json`), `${JSON.stringify(result, null, 2)}\n`);
    }
  }
  const unmaskPath = join(directory, "judge-unmask.json");
  writeFileSync(unmaskPath, `${JSON.stringify(mapping, null, 2)}\n`);
  return { directory, packetsDir, resultsDir, unmaskPath, evaluatorOutputsDir: outputDir, packets, mapping };
}

function run(options) {
  return synthesizeW1Judgments(options);
}

function expectBlocked(options, expected) {
  try {
    run(options);
    throw new Error("synthesis unexpectedly succeeded");
  } catch (error) {
    assert(error.message.includes(expected), `expected ${expected}; got ${error.message}`);
  }
}

function files(directory) {
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort();
}

function digestDirectory(directory) {
  return createHash("sha256").update(files(directory).map((file) => `${file}:${readFileSync(join(directory, file), "utf8")}`).join("\n")).digest("hex");
}

console.log("W1 Post-Judgment Synthesis Tests\n");

test("fails closed when a result is missing", () => {
  const f = fixture();
  try {
    rmSync(join(f.resultsDir, files(f.resultsDir)[0]));
    expectBlocked(f, "exactly 27 result files");
    assert(!readdirSync(f.directory).includes("evaluators"), "wrote artifacts before validation");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("fails closed while any result is pending", () => {
  const f = fixture();
  try {
    const path = join(f.resultsDir, files(f.resultsDir)[0]);
    const result = JSON.parse(readFileSync(path, "utf8"));
    for (const key of Object.keys(result)) if (!["schema_version", "result_id", "packet_id", "evaluator_type", "judge_id", "evaluator_family", "status"].includes(key)) delete result[key];
    result.status = "pending";
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    expectBlocked(f, "exactly 27 complete valid result files");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("fails closed for duplicate-family quorum", () => {
  const f = fixture();
  try {
    const path = join(f.resultsDir, files(f.resultsDir).find((file) => file.endsWith("-sonnet-1.json")));
    const result = JSON.parse(readFileSync(path, "utf8"));
    result.evaluator_family = "luna";
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    expectBlocked(f, "evaluator_family");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("does not read a bad unmask mapping until corpus validation succeeds", () => {
  const f = fixture();
  try {
    const mapping = JSON.parse(readFileSync(f.unmaskPath, "utf8"));
    const paired = f.packets.find((packet) => packet.evaluator_type === "paired_lift");
    mapping.packets[paired.packet_id].A.raw_output_hash = "0".repeat(64);
    writeFileSync(f.unmaskPath, `${JSON.stringify(mapping, null, 2)}\n`);
    rmSync(join(f.resultsDir, files(f.resultsDir)[0]));
    expectBlocked(f, "exactly 27 result files");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("fails closed for a wrong mapping after all results validate", () => {
  const f = fixture();
  try {
    const mapping = JSON.parse(readFileSync(f.unmaskPath, "utf8"));
    const paired = f.packets.find((packet) => packet.evaluator_type === "paired_lift");
    mapping.packets[paired.packet_id].A.raw_output_hash = "0".repeat(64);
    writeFileSync(f.unmaskPath, `${JSON.stringify(mapping, null, 2)}\n`);
    expectBlocked(f, "does not match packet candidate hash");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("writes exactly nine deterministic private artifacts without mutating inputs", () => {
  const f = fixture();
  try {
    const packetDigest = digestDirectory(f.packetsDir);
    const resultDigest = digestDirectory(f.resultsDir);
    mkdirSync(f.evaluatorOutputsDir);
    const first = run(f);
    const firstFiles = files(f.evaluatorOutputsDir);
    const firstBytes = firstFiles.map((file) => [file, readFileSync(join(f.evaluatorOutputsDir, file), "utf8")]);
    const second = run(f);
    assert(first.artifacts.length === 9 && second.artifacts.length === 9, "expected nine synthesized artifacts");
    assert(JSON.stringify(firstFiles) === JSON.stringify([
      "component-states-anti-slop.json", "component-states-diversity.json", "component-states-paired-lift.json",
      "deslop-ui-anti-slop.json", "deslop-ui-diversity.json", "deslop-ui-paired-lift.json",
      "tastecheck-pass-anti-slop.json", "tastecheck-pass-diversity.json", "tastecheck-pass-paired-lift.json",
    ]), JSON.stringify(firstFiles));
    assert(JSON.stringify(firstBytes) === JSON.stringify(files(f.evaluatorOutputsDir).map((file) => [file, readFileSync(join(f.evaluatorOutputsDir, file), "utf8")])), "outputs are not deterministic");
    assert(packetDigest === digestDirectory(f.packetsDir), "judge packets were mutated");
    assert(resultDigest === digestDirectory(f.resultsDir), "judge results were mutated");
    const artifacts = firstFiles.map((file) => readFileSync(join(f.evaluatorOutputsDir, file), "utf8")).join("\n");
    for (const privateField of ["attempt_id", "run_type", "raw_output_hash"]) assert(!artifacts.includes(privateField), `artifact exposed ${privateField}`);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
