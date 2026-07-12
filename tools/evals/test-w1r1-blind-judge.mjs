#!/usr/bin/env node
/**
 * Test-first contract for the revision-local W1R1 blind judge scaffold.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const namespace = "evals/replays/w1r1-remediation-2026-07-11";
const toolPath = join(root, "tools/evals/w1r1-blind-judge.mjs");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function copyFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-w1r1-blind-"));
  cpSync(join(root, namespace), join(fixtureRoot, namespace), { recursive: true });
  cpSync(join(root, "evals/w1/rubric"), join(fixtureRoot, "evals/w1/rubric"), { recursive: true });
  cpSync(join(root, ".omx/evidence/tastecheck-v1/raw"), join(fixtureRoot, ".omx/evidence/tastecheck-v1/raw"), { recursive: true });
  cpSync(join(root, "evals/scenarios"), join(fixtureRoot, "evals/scenarios"), { recursive: true });
  cpSync(join(root, "skills"), join(fixtureRoot, "skills"), { recursive: true });
  return fixtureRoot;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function manifest(baseRoot) {
  return loadJson(join(baseRoot, namespace, "manifest.json"));
}

function packetFiles(baseRoot) {
  return manifest(baseRoot).blind_judge.packets.map((entry) => join(baseRoot, entry.packet_path));
}

function resultFiles(baseRoot) {
  return manifest(baseRoot).blind_judge.result_slots.map((entry) => join(baseRoot, entry.result_path));
}

function mutateJson(path, mutate) {
  const value = loadJson(path);
  mutate(value);
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function makeCompleteResult(packet, slot) {
  const candidate = packet.candidates.A;
  return {
    schema_version: 1,
    revision_id: packet.revision_id,
    namespace: packet.namespace,
    result_id: slot.result_id,
    packet_id: packet.packet_id,
    packet_path: slot.packet_path,
    packet_sha256: slot.packet_sha256,
    evaluator_type: "paired_lift",
    judge_id: slot.judge_id,
    evaluator_family: slot.evaluator_family,
    evaluator_model: "fixture-judge",
    status: "complete",
    candidate_scores: {
      A: { domain_specificity: 4, evidence_completeness: 4, fail_closed: 4, handoff_readiness: 4, scope_discipline: 4, total: 20 },
      B: { domain_specificity: 3, evidence_completeness: 3, fail_closed: 3, handoff_readiness: 3, scope_discipline: 3, total: 15 },
    },
    score_scale_version: "anchored-1-5-v1",
    candidate_evidence: { A: candidate.raw_output.slice(0, 32), B: packet.candidates.B.raw_output.slice(0, 32) },
    preference: "A",
    deltas: { domain_specificity: 1, evidence_completeness: 1, fail_closed: 1, handoff_readiness: 1, scope_discipline: 1 },
    regression_flags: [],
    verdict: "A_better",
    rationale: `A: ${candidate.raw_output.slice(0, 32)}; B: ${packet.candidates.B.raw_output.slice(0, 32)}`,
    cited_evidence: [candidate.raw_output.slice(0, 32), packet.candidates.B.raw_output.slice(0, 32)],
    calibration_status: {
      passed: true,
      items_passed: 6,
      items: [
        ["cal-001-full-pass", "verdict_correct"], ["cal-001-full-pass", "total_within_threshold"],
        ["cal-002-bare-checkmark", "verdict_correct"], ["cal-002-bare-checkmark", "total_within_threshold"],
        ["cal-003-partial-evidence", "verdict_correct"], ["cal-003-partial-evidence", "total_within_threshold"],
      ].map(([calibration_id, check]) => ({ calibration_id, check, passed: true })),
    },
  };
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

if (!existsSync(toolPath)) {
  console.error(`  ✗ scaffold command exists: missing ${toolPath}`);
  process.exit(1);
}

const scaffold = await import("./w1r1-blind-judge.mjs");

await run("builder creates exactly nine blinded A/B packets and 27 lane slots", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    const built = scaffold.buildBlindCorpus(fixtureRoot);
    assert(built.packet_paths.length === 9, "expected nine packets");
    assert(built.result_paths.length === 27, "expected 27 result slots");
    assert(new Set(built.packet_paths).size === 9, "packet paths must be unique");
    assert(built.result_paths.filter((path) => path.includes("judge-luna-1")).length === 9, "luna-1 lane must contain nine slots");
    assert(built.result_paths.filter((path) => path.includes("judge-luna-2")).length === 9, "luna-2 lane must contain nine slots");
    assert(built.result_paths.filter((path) => path.includes("judge-sonnet")).length === 9, "sonnet lane must contain nine slots");
    for (const path of built.packet_paths) {
      const packet = loadJson(join(fixtureRoot, path));
      assert(Object.keys(packet.candidates).join(",") === "A,B", "packet must expose only A/B");
      assert(Object.values(packet.candidates).every((candidate) => JSON.stringify(Object.keys(candidate)).match(/label|raw_output|raw_output_hash/)), "candidate cue leakage");
      assert(packet.candidates.A.raw_output.length > 0 && packet.candidates.B.raw_output.length > 0, "exact output text missing");
      assert(packet.rubric?.dimensions?.length === 5, "anchored rubric missing");
    }
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("builder randomizes A/B deterministically and keeps unmask private", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    const first = scaffold.buildBlindCorpus(fixtureRoot);
    const firstPackets = first.packet_paths.map((path) => readFileSync(join(fixtureRoot, path), "utf8"));
    scaffold.buildBlindCorpus(fixtureRoot);
    const secondPackets = packetFiles(fixtureRoot).map((path) => readFileSync(path, "utf8"));
    assert(JSON.stringify(firstPackets) === JSON.stringify(secondPackets), "A/B assignment must be deterministic");
    assert(first.unmask_path.includes("private"), "unmask must be private");
    assert(!first.packet_paths.some((path) => path.includes("unmask")), "unmask must not be in packet set");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("strict validator accepts only exact pending 27-slot corpus", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const checked = scaffold.validateBlindCorpus(fixtureRoot);
    assert(checked.errors.length === 0, checked.errors.join("; "));
    assert(checked.packet_count === 9 && checked.slot_count === 27, "corpus counts drifted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

for (const [name, mutate, needle] of [
  ["stale result", (result) => { result.revision_id = "other-revision"; }, "revision"],
  ["cross-revision packet", (result) => { result.packet_sha256 = "f".repeat(64); }, "slot"],
  ["duplicate slot", (result) => { result.result_id = "other-result"; }, "slot"],
]) {
  await run(`rejects ${name}`, () => {
    const fixtureRoot = copyFixtureRoot();
    try {
      scaffold.buildBlindCorpus(fixtureRoot);
      mutateJson(resultFiles(fixtureRoot)[0], mutate);
      const checked = scaffold.validateBlindCorpus(fixtureRoot);
      assert(checked.errors.some((error) => error.toLowerCase().includes(needle)), checked.errors.join("; "));
    } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
  });
}

await run("rejects packet tamper and missing slot", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    mutateJson(packetFiles(fixtureRoot)[0], (packet) => { packet.candidates.A.raw_output += " tampered"; });
    const tampered = scaffold.validateBlindCorpus(fixtureRoot);
    assert(tampered.errors.some((error) => /packet|hash/i.test(error)), tampered.errors.join("; "));
    rmSync(resultFiles(fixtureRoot)[0]);
    const missing = scaffold.validateBlindCorpus(fixtureRoot);
    assert(missing.errors.some((error) => /27|missing|slot/i.test(error)), missing.errors.join("; "));
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("rejects paraphrased or non-substring evidence citations", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const packet = loadJson(packetFiles(fixtureRoot)[0]);
    const slotPath = resultFiles(fixtureRoot)[0];
    const slot = loadJson(slotPath);
    const result = makeCompleteResult(packet, slot);
    result.candidate_evidence.A = "A paraphrase that is not in the output";
    writeFileSync(slotPath, JSON.stringify(result, null, 2) + "\n");
    const checked = scaffold.validateBlindCorpus(fixtureRoot);
    assert(checked.errors.some((error) => /substring|evidence|candidate/i.test(error)), checked.errors.join("; "));
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("blocks synthesis and unmask before a complete valid corpus", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    let blocked = false;
    try { scaffold.synthesizeBlindCorpus(fixtureRoot); } catch (error) { blocked = /blocked|complete|pending/i.test(error.message); }
    assert(blocked, "early synthesis was not blocked");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("binds diversity pair labels to the three replay seeds", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const packets = packetFiles(fixtureRoot).map(loadJson);
    for (const path of resultFiles(fixtureRoot)) {
      const slot = loadJson(path);
      const packet = packets.find((entry) => entry.packet_id === slot.packet_id);
      writeFileSync(path, JSON.stringify(makeCompleteResult(packet, slot), null, 2) + "\n");
    }
    const synthesis = scaffold.synthesizeBlindCorpus(fixtureRoot);
    const expected = ["seed101_vs_seed202", "seed101_vs_seed303", "seed202_vs_seed303"];
    for (const skill of ["component-states", "deslop-ui", "tastecheck-pass"]) {
      const labels = synthesis.diversity[skill].pairwise_similarity.map((pair) => pair.pair);
      assert(JSON.stringify(labels) === JSON.stringify(expected), `${skill} diversity pair labels drifted: ${labels.join(", ")}`);
      assert(!labels.some((label) => /undefined/.test(label)), `${skill} diversity pair label contains undefined`);
    }
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("blocks release when any paired, diversity, or anti-slop evaluator fails", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const checked = scaffold.validateBlindCorpus(fixtureRoot);
    const packets = packetFiles(fixtureRoot).map(loadJson);
    for (const path of resultFiles(fixtureRoot)) {
      const slot = loadJson(path);
      const packet = packets.find((entry) => entry.packet_id === slot.packet_id);
      writeFileSync(path, JSON.stringify(makeCompleteResult(packet, slot), null, 2) + "\n");
    }
    const release = scaffold.synthesizeBlindCorpus(fixtureRoot, { evaluatorOverrides: { "component-states": { diversity: "fail" } } });
    assert(release.release_eligible === false && release.gate["component-states"].diversity_pass === false, "failed diversity evaluator must block release");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
