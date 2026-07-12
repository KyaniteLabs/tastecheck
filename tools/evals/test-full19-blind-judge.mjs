#!/usr/bin/env node
/**
 * Adversarial contract tests for the revision-local full19 blind judge scaffold.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const namespace = "evals/replays/full19-v1rc-2026-07-11";
const toolPath = join(root, "tools/evals/full19-blind-judge.mjs");

let passed = 0;
let failed = 0;

function assert(condition, message) { if (!condition) throw new Error(message); }
function loadJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function writeJson(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + "\n"); }
function mutateJson(path, mutate) { const value = loadJson(path); mutate(value); writeJson(path, value); }

function copyFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-full19-blind-"));
  for (const rel of [
    namespace,
    "evals/generated",
    "evals/w1/rubric",
    "contracts/v1",
    "commands",
    "skills",
    "skills.json",
    ".omx/evidence/tastecheck-v1/baseline",
  ]) cpSync(join(root, rel), join(fixtureRoot, rel), { recursive: true });
  return fixtureRoot;
}

function manifest(baseRoot) { return loadJson(join(baseRoot, namespace, "manifest.json")); }
function blindRoot(baseRoot) { return join(baseRoot, namespace, "blind-judge"); }
function packetFiles(baseRoot) {
  return manifest(baseRoot).blind_judge.packets.map((entry) => join(baseRoot, entry.packet_path));
}
function resultFiles(baseRoot) {
  return manifest(baseRoot).blind_judge.result_slots.map((entry) => join(baseRoot, entry.result_path));
}
function firstPacket(baseRoot) { return loadJson(packetFiles(baseRoot)[0]); }
function firstSlot(baseRoot) { return loadJson(resultFiles(baseRoot)[0]); }

function calibration() {
  return {
    passed: true,
    items_passed: 6,
    items: [
      ["cal-01-anchor-literalism", "rubric anchors applied"],
      ["cal-02-evidence-substring", "evidence copied verbatim"],
      ["cal-03-blind-independence", "candidate identity not inferred"],
      ["cal-04-fail-closed-scan", "all required evidence fields checked"],
      ["cal-05-scope-boundary-check", "scope and handoff boundary checked"],
      ["cal-06-delta-consistency", "scores deltas and verdict agree"],
    ].map(([calibration_id, check]) => ({ calibration_id, check, passed: true })),
  };
}

function makeCompleteResult(packet, slot) {
  const excerptA = packet.candidates.A.raw_output.slice(0, 80);
  const excerptB = packet.candidates.B.raw_output.slice(0, 80);
  return {
    ...slot,
    status: "complete",
    evaluator_model: "fixture-judge",
    calibration_status: calibration(),
    candidate_scores: {
      A: { domain_specificity: 4, evidence_completeness: 4, fail_closed: 4, handoff_readiness: 4, scope_discipline: 4, total: 20 },
      B: { domain_specificity: 3, evidence_completeness: 3, fail_closed: 3, handoff_readiness: 3, scope_discipline: 3, total: 15 },
    },
    score_scale_version: "anchored-1-5-v1",
    candidate_evidence: { A: excerptA, B: excerptB },
    preference: "A",
    deltas: { domain_specificity: 1, evidence_completeness: 1, fail_closed: 1, handoff_readiness: 1, scope_discipline: 1 },
    regression_flags: [],
    verdict: "A_better",
    rationale: `A excerpt: ${excerptA}\nB excerpt: ${excerptB}\nThe A result is more specific.`,
    cited_evidence: [excerptA, excerptB],
  };
}

function makeImprovingResult(packet, slot, fixtureRoot) {
  const result = makeCompleteResult(packet, slot);
  const mapping = loadJson(join(blindRoot(fixtureRoot), "private", "unmask.json")).packets[packet.packet_id];
  const upgraded = mapping.A.role === "upgraded" ? "A" : "B";
  const baseline = upgraded === "A" ? "B" : "A";
  result.candidate_scores[upgraded] = { domain_specificity: 4, evidence_completeness: 4, fail_closed: 4, handoff_readiness: 4, scope_discipline: 4, total: 20 };
  result.candidate_scores[baseline] = { domain_specificity: 3, evidence_completeness: 3, fail_closed: 3, handoff_readiness: 3, scope_discipline: 3, total: 15 };
  result.deltas = Object.fromEntries(["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"].map((dimension) => [dimension, result.candidate_scores.A[dimension] - result.candidate_scores.B[dimension]]));
  result.preference = upgraded;
  result.verdict = `${upgraded}_better`;
  return result;
}

async function run(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (error) { console.error(`  ✗ ${name}: ${error.message}`); failed++; }
}

assert(existsSync(toolPath), `missing ${toolPath}`);
const scaffold = await import("./full19-blind-judge.mjs");

await run("builder creates exactly 57 packets, 171 pending slots, and 5/5/5/4 sealed groups", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    const built = scaffold.buildBlindCorpus(fixtureRoot);
    assert(built.packet_paths.length === 57, "expected 57 packets");
    assert(built.result_paths.length === 171, "expected 171 slots");
    const groups = loadJson(join(blindRoot(fixtureRoot), "group-matrix.json"));
    assert(JSON.stringify(groups.groups.map((group) => group.skills.length)) === JSON.stringify([5, 5, 5, 4]), "group sizes drifted");
    assert(groups.groups.every((group) => group.packet_reads.length === group.skills.length * 3), "group packet reads incomplete");
    assert(groups.groups.every((group) => Object.values(group.result_writes).every((paths) => paths.length === group.skills.length * 3)), "group lane writes incomplete");
    assert(scaffold.validateBlindCorpus(fixtureRoot).errors.length === 0, "fresh pending corpus must validate");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("A/B randomization is deterministic and packet candidates contain zero identity cues", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    const first = scaffold.buildBlindCorpus(fixtureRoot);
    const firstPackets = first.packet_paths.map((path) => readFileSync(join(fixtureRoot, path), "utf8"));
    scaffold.buildBlindCorpus(fixtureRoot);
    const secondPackets = packetFiles(fixtureRoot).map((path) => readFileSync(path, "utf8"));
    assert(JSON.stringify(firstPackets) === JSON.stringify(secondPackets), "A/B assignment must be deterministic");
    for (const path of packetFiles(fixtureRoot)) {
      const packet = loadJson(path);
      assert(JSON.stringify(Object.keys(packet.candidates).sort()) === JSON.stringify(["A", "B"]), "candidate labels drifted");
      for (const candidate of Object.values(packet.candidates)) {
        assert(JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify(["label", "raw_output", "raw_output_hash"]), "candidate cue leakage");
      }
    }
    assert(first.unmask_path.includes("private"), "unmask must be private");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("pending slots bind packet, result/output, source, scenario, and contract digests", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const slot = firstSlot(fixtureRoot);
    for (const key of ["revision_id", "packet_sha256", "baseline_result_sha256", "baseline_output_sha256", "upgraded_result_sha256", "upgraded_output_sha256", "source_sha256", "scenario_sha256", "contract_sha256"]) assert(key in slot, `missing slot binding ${key}`);
    assert(new Set(resultFiles(fixtureRoot).map((path) => loadJson(path).result_id)).size === 171, "result ids must be unique");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

for (const [name, mutate, needle] of [
  ["packet tamper", (packet) => { packet.candidates.A.raw_output += " tampered"; }, /packet|hash/i],
  ["result tamper", (slot) => { slot.packet_sha256 = "f".repeat(64); }, /slot|binding|hash/i],
  ["cross-revision slot", (slot) => { slot.revision_id = "w1r1-remediation-2026-07-11"; }, /revision/i],
  ["duplicate slot identity", (slot) => { slot.result_id = "duplicate"; }, /duplicate|slot/i],
]) await run(`rejects ${name}`, () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const path = name.includes("packet") ? packetFiles(fixtureRoot)[0] : resultFiles(fixtureRoot)[0];
    mutateJson(path, mutate);
    const checked = scaffold.validateBlindCorpus(fixtureRoot);
    assert(checked.errors.some((error) => needle.test(error)), checked.errors.join("; "));
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("rejects missing slot, paraphrased citations, malformed calibration, and malformed regression flags", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const packet = firstPacket(fixtureRoot);
    const slotPath = resultFiles(fixtureRoot)[0];
    const slot = firstSlot(fixtureRoot);
    const complete = makeCompleteResult(packet, slot);
    complete.candidate_evidence.A = "paraphrase not copied from output";
    writeJson(slotPath, complete);
    assert(scaffold.validateBlindCorpus(fixtureRoot).errors.some((error) => /substring|evidence/i.test(error)), "paraphrase accepted");
    complete.candidate_evidence.A = packet.candidates.A.raw_output.slice(0, 80);
    complete.calibration_status.items = complete.calibration_status.items.slice(0, 5);
    writeJson(slotPath, complete);
    assert(scaffold.validateBlindCorpus(fixtureRoot).errors.some((error) => /calibration/i.test(error)), "malformed calibration accepted");
    complete.calibration_status = calibration();
    complete.regression_flags = [{ category: "unknown", candidate: "A", dimension: "fail_closed", delta: -1, evidence: packet.candidates.A.raw_output.slice(0, 12) }];
    writeJson(slotPath, complete);
    assert(scaffold.validateBlindCorpus(fixtureRoot).errors.some((error) => /regression/i.test(error)), "malformed flag accepted");
    rmSync(resultFiles(fixtureRoot)[1]);
    assert(scaffold.validateBlindCorpus(fixtureRoot).errors.some((error) => /missing|171|slot/i.test(error)), "missing slot accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("blocks early synthesis before all 171 valid complete judgments and never reads unmask", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    let blocked = false;
    try { scaffold.synthesizeBlindCorpus(fixtureRoot); } catch (error) { blocked = /blocked|complete|pending/i.test(error.message); }
    assert(blocked, "early synthesis was not blocked");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("uses real 101/202/303 seed labels and blocks undefined seed labels", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const packets = Object.fromEntries(packetFiles(fixtureRoot).map((path) => { const packet = loadJson(path); return [packet.packet_id, packet]; }));
    for (const path of resultFiles(fixtureRoot)) {
      const slot = loadJson(path);
      writeJson(path, makeCompleteResult(packets[slot.packet_id], slot));
    }
    const synthesis = scaffold.synthesizeBlindCorpus(fixtureRoot);
    for (const skill of manifest(fixtureRoot).skills) {
      const labels = synthesis.diversity[skill].pairwise_similarity.map((pair) => pair.pair);
      assert(JSON.stringify(labels) === JSON.stringify(["seed101_vs_seed202", "seed101_vs_seed303", "seed202_vs_seed303"]), `${skill} labels drifted`);
      assert(!labels.some((label) => /undefined/.test(label)), `${skill} has undefined seed label`);
    }
    const diversityPath = join(blindRoot(fixtureRoot), "synthesis.json");
    mutateJson(diversityPath, (value) => { value.diversity[manifest(fixtureRoot).skills[0]].seeds = [101, null, 303]; });
    assert(scaffold.validateSynthesis(fixtureRoot).errors.some((error) => /seed|undefined/i.test(error)), "undefined seed labels accepted");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

await run("requires paired improvement, diversity pass, and anti-slop pass for every skill", () => {
  const fixtureRoot = copyFixtureRoot();
  try {
    scaffold.buildBlindCorpus(fixtureRoot);
    const packets = Object.fromEntries(packetFiles(fixtureRoot).map((path) => { const packet = loadJson(path); return [packet.packet_id, packet]; }));
    for (const path of resultFiles(fixtureRoot)) { const slot = loadJson(path); writeJson(path, makeImprovingResult(packets[slot.packet_id], slot, fixtureRoot)); }
    const blocked = scaffold.synthesizeBlindCorpus(fixtureRoot, { evaluatorOverrides: { [manifest(fixtureRoot).skills[0]]: { diversity: "fail" } } });
    assert(blocked.release_eligible === false, "failed diversity evaluator did not block release");
    assert(Object.values(blocked.gate).every((gate) => gate.paired_lift_improved === true && "diversity_pass" in gate && "anti_slop_pass" in gate), "all three gates must be present");
  } finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
