#!/usr/bin/env node
/**
 * W1 blind-judge contract tests.
 *
 * The corpus is intentionally lane-agnostic: nine packets and three independent
 * result slots per packet. Pending slots are records of missing work, never
 * evidence of a completed judgment.
 */
import { readFileSync, readdirSync, existsSync, mkdtempSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  validateJudgePacket,
  validateJudgeResult,
  validateJudgeCorpus,
} from "./validate-judge-packets.mjs";
import { synthesizePairedJudgments } from "./evaluators/paired-lift.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const packetsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-packets");
const resultsDir = join(root, ".omx/evidence/tastecheck-v1/raw/judge-results");
const unmaskPath = join(root, ".omx/evidence/tastecheck-v1/raw/judge-unmask.json");

let passed = 0;
let failed = 0;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function packets() {
  return readdirSync(packetsDir).filter((file) => file.endsWith(".json")).sort()
    .map((file) => JSON.parse(readFileSync(join(packetsDir, file), "utf8")));
}

function results() {
  return readdirSync(resultsDir).filter((file) => file.endsWith(".json")).sort()
    .map((file) => JSON.parse(readFileSync(join(resultsDir, file), "utf8")));
}

function unmask() {
  return JSON.parse(readFileSync(unmaskPath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function calibration() {
  return {
    passed: true,
    items_passed: 6,
    items: [
      ["cal-001-full-pass", "verdict_correct"],
      ["cal-001-full-pass", "total_within_threshold"],
      ["cal-002-bare-checkmark", "verdict_correct"],
      ["cal-002-bare-checkmark", "total_within_threshold"],
      ["cal-003-partial-evidence", "verdict_correct"],
      ["cal-003-partial-evidence", "total_within_threshold"],
    ].map(([calibration_id, check]) => ({ calibration_id, check, passed: true })),
  };
}

function completePaired(packet, judgeId, family) {
  const [a, b] = [packet.candidates.A.raw_output, packet.candidates.B.raw_output];
  const dimensions = {
    domain_specificity: 3,
    evidence_completeness: 3,
    fail_closed: 3,
    handoff_readiness: 3,
    scope_discipline: 3,
  };
  return {
    schema_version: 1,
    result_id: `${packet.packet_id}-${judgeId}`,
    packet_id: packet.packet_id,
    evaluator_type: "paired_lift",
    judge_id: judgeId,
    evaluator_family: family,
    evaluator_model: `${family}-test`,
    status: "complete",
    calibration_status: calibration(),
    score_scale_version: "anchored-1-5-v1",
    candidate_scores: {
      A: { ...dimensions, total: 15 },
      B: { ...dimensions, total: 15 },
    },
    candidate_evidence: { A: a.slice(0, 40), B: b.slice(0, 40) },
    preference: "tie",
    deltas: Object.fromEntries(Object.keys(dimensions).map((key) => [key, 0])),
    regression_flags: [],
    verdict: "tie",
    rationale: a.slice(0, 40),
    cited_evidence: [a.slice(0, 40)],
  };
}

const PENDING_RESULT_FIELDS = new Set([
  "schema_version", "result_id", "packet_id", "evaluator_type", "judge_id", "evaluator_family", "status",
]);

function pendingResult(result) {
  const pending = clone(result);
  for (const field of Object.keys(pending)) {
    if (!PENDING_RESULT_FIELDS.has(field)) delete pending[field];
  }
  pending.status = "pending";
  return pending;
}

const AGGREGATE_SANDBOX_INPUTS = [
  "tools/evals/aggregate-w1-receipts.mjs",
  "tools/evals/validate-judge-packets.mjs",
  "tools/evals/lib/w1-evaluator-gate.mjs",
  "evals/w1/job-manifest.json",
  ".omx/evidence/tastecheck-v1/raw/ledger.jsonl",
  ".omx/evidence/tastecheck-v1/raw/evaluators",
  ".omx/evidence/tastecheck-v1/raw/judge-packets",
  ".omx/evidence/tastecheck-v1/raw/judge-results",
];

function runAggregate(args = []) {
  const sandbox = mkdtempSync(join(tmpdir(), "tastecheck-w1-aggregate-"));
  try {
    for (const relativePath of AGGREGATE_SANDBOX_INPUTS) {
      const source = join(root, relativePath);
      const target = join(sandbox, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target, { recursive: true });
    }
    return spawnSync(process.execPath, [join(sandbox, "tools/evals/aggregate-w1-receipts.mjs"), ...args], {
      cwd: sandbox,
      encoding: "utf8",
    });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

function aggregateOutput(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function releaseBlockerLines(output) {
  return output.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("RELEASE BLOCKED:") || line.startsWith("- "));
}

console.log("W1 Blind Judge Tests\n");

test("corpus has exactly nine lane-agnostic packets and 27 result slots", () => {
  assert(existsSync(packetsDir), "judge packets directory missing");
  assert(existsSync(resultsDir), "judge results directory missing");
  const corpusPackets = packets();
  const corpusResults = results();
  assert(corpusPackets.length === 9, `expected 9 packets, got ${corpusPackets.length}`);
  assert(corpusResults.length === 27, `expected 27 result slots, got ${corpusResults.length}`);
  assert(corpusResults.every((result) => ["pending", "complete"].includes(result.status)), "result slots have an invalid status");
  for (const [packetId, bindings] of Object.entries(unmask().packets)) {
    const attemptIds = Object.values(bindings).map((binding) => binding.attempt_id);
    assert(attemptIds.every((attemptId) => !attemptId.endsWith("-attempt-2")), `${packetId} includes attempt-2`);
    if (packetId.includes("-paired-lift-")) {
      assert(attemptIds.some((attemptId) => attemptId.includes("-baseline-seed101-attempt-1")), `${packetId} lacks baseline attempt-1`);
      assert(attemptIds.some((attemptId) => attemptId.includes("-upgraded-seed101-attempt-3")), `${packetId} lacks upgraded attempt-3`);
    } else {
      assert(attemptIds.every((attemptId) => attemptId.includes("-upgraded-seed") && attemptId.endsWith("-attempt-3")), `${packetId} must contain only upgraded attempt-3 candidates`);
    }
  }
});

test("judge-visible candidates contain exactly opaque label, raw output, and hash", () => {
  const forbidden = ["attempt_id", "job_id", "run_type", "source", "version", "lane", "family", "model"];
  for (const packet of packets()) {
    for (const [label, candidate] of Object.entries(packet.candidates)) {
      assert(JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify(["label", "raw_output", "raw_output_hash"]),
        `${packet.packet_id}/${label} exposes fields other than label/raw_output/raw_output_hash`);
      for (const field of forbidden) assert(!(field in candidate), `${packet.packet_id}/${label} leaks ${field}`);
    }
  }
});

test("packet validator accepts the seeded pending corpus", () => {
  for (const packet of packets()) {
    const { errors } = validateJudgePacket(packet);
    assert(errors.length === 0, `${packet.packet_id}: ${errors.join("; ")}`);
  }
});

test("a pending result slot validates but does not count as complete", () => {
  const packetById = new Map(packets().map((packet) => [packet.packet_id, packet]));
  const result = clone(results()[0]);
  for (const field of Object.keys(result)) {
    if (!["schema_version", "result_id", "packet_id", "evaluator_type", "judge_id", "evaluator_family", "status"].includes(field)) delete result[field];
  }
  result.status = "pending";
  const { errors, complete } = validateJudgeResult(result, packetById.get(result.packet_id));
  assert(errors.length === 0, `${result.result_id}: ${errors.join("; ")}`);
  assert(complete === false, `${result.result_id} pending slot counted as complete`);
});

test("cue leakage through attempt_id fails closed", () => {
  const packet = clone(packets()[0]);
  packet.candidates[Object.keys(packet.candidates)[0]].attempt_id = "baseline-seed101";
  const { errors } = validateJudgePacket(packet);
  assert(errors.some((error) => error.includes("attempt_id")), `missing attempt_id cue error: ${errors.join("; ")}`);
});

test("cue leakage through source, version, lane, family, and model fields fails closed", () => {
  const packet = clone(packets()[0]);
  Object.assign(packet.candidates[Object.keys(packet.candidates)[0]], {
    source: "internal", version: "v1", lane: "luna", family: "sonnet", model: "cue-model",
  });
  const { errors } = validateJudgePacket(packet);
  for (const field of ["source", "version", "lane", "family", "model"]) {
    assert(errors.some((error) => error.includes(field)), `missing ${field} cue error: ${errors.join("; ")}`);
  }
});

test("duplicate, wrong-family, and incomplete calibration results fail quorum", () => {
  const packet = packets().find((entry) => entry.evaluator_type === "paired_lift");
  const complete = [
    completePaired(packet, "luna-1", "luna"),
    completePaired(packet, "luna-2", "luna"),
    completePaired(packet, "sonnet-1", "sonnet"),
  ];
  complete[1].judge_id = "luna-1";
  complete[1].result_id = `${packet.packet_id}-luna-1`;
  complete[2].calibration_status.items[0].passed = false;
  complete[2].calibration_status.items_passed = 5;
  complete[2].calibration_status.passed = false;
  const { errors } = validateJudgeCorpus([packet], complete);
  assert(errors.some((error) => error.includes("duplicate judge_id")), errors.join("; "));
  assert(errors.some((error) => error.includes("calibration")), errors.join("; "));
  assert(errors.some((error) => error.includes("quorum")), errors.join("; "));
});

test("pending slots never satisfy a three-result quorum", () => {
  const corpusPackets = packets().map(clone);
  const packet = corpusPackets.find((entry) => entry.evaluator_type === "paired_lift");
  const oneComplete = completePaired(packet, "luna-1", "luna");
  const corpusResults = results().map((result) => {
    if (result.packet_id !== packet.packet_id) return clone(result);
    return result.judge_id === "luna-1" ? oneComplete : pendingResult(result);
  });
  const { errors } = validateJudgeCorpus(corpusPackets, corpusResults);
  assert(!errors.some((error) => error.startsWith("corpus must contain exactly")), `test corpus was incomplete: ${errors.join("; ")}`);
  assert(errors.some((error) => error.includes(`${packet.packet_id}: quorum`)), `pending results were counted: ${errors.join("; ")}`);
});

test("fabricated paired evidence fails closed", () => {
  const packet = packets().find((entry) => entry.evaluator_type === "paired_lift");
  const result = completePaired(packet, "luna-1", "luna");
  result.candidate_evidence.A = "invented evidence that is absent from the candidate";
  result.cited_evidence = ["invented evidence that is absent from the candidate"];
  const { errors } = validateJudgeResult(result, packet);
  assert(errors.some((error) => error.includes("fabricated")), errors.join("; "));
});

test("paired results reject an obsolete 0-2 fixture without the explicit 1-5 scale contract", () => {
  const packet = packets().find((entry) => entry.evaluator_type === "paired_lift");
  const result = completePaired(packet, "luna-1", "luna");
  for (const label of ["A", "B"]) {
    for (const dimension of Object.keys(result.candidate_scores[label]).filter((key) => key !== "total")) {
      result.candidate_scores[label][dimension] = 2;
    }
    result.candidate_scores[label].total = 10;
  }
  delete result.score_scale_version;
  const { errors } = validateJudgeResult(result, packet);
  assert(errors.some((error) => error.includes("score_scale_version")), `legacy 0-2 fixture accepted without an explicit scale contract: ${errors.join("; ")}`);
});

test("paired synthesis enforces lift, preference, mandatory-dimension, and hard-regression gates", () => {
  const packet = packets().find((entry) => entry.evaluator_type === "paired_lift");
  const strong = ["luna-1", "luna-2", "sonnet-1"].map((judgeId) => {
    const result = completePaired(packet, judgeId, judgeId.startsWith("sonnet") ? "sonnet" : "luna");
    for (const dimension of Object.keys(result.candidate_scores.A).filter((key) => key !== "total")) {
      result.candidate_scores.A[dimension] = 4;
      result.candidate_scores.B[dimension] = 3;
      result.deltas[dimension] = 1;
    }
    result.candidate_scores.A.total = 20;
    result.candidate_scores.B.total = 15;
    result.preference = "A";
    result.verdict = "A_better";
    return result;
  });
  const pass = synthesizePairedJudgments(packet, strong, "A");
  assert(pass.verdict === "improved" && pass.release_eligible === true, JSON.stringify(pass));

  const hardRegression = structuredClone(strong);
  hardRegression[0].regression_flags = [{
    category: "accessibility", candidate: "A", dimension: "fail_closed", delta: -1,
    evidence: packet.candidates.A.raw_output.slice(0, 40),
  }];
  const blocked = synthesizePairedJudgments(packet, hardRegression, "A");
  assert(blocked.verdict === "regressed" && blocked.release_eligible === false, JSON.stringify(blocked));
});

test("wrong packet and result counts fail closed", () => {
  const corpusPackets = packets();
  const corpusResults = results();
  assert(validateJudgeCorpus(corpusPackets.slice(0, 8), corpusResults).errors.some((error) => error.includes("exactly 9")), "eight packets accepted");
  assert(validateJudgeCorpus(corpusPackets, corpusResults.slice(0, 26)).errors.some((error) => error.includes("exactly 27")), "26 result slots accepted");
});

test("strict W1 aggregate stays blocked before 27 valid judgments and nine synthesized artifacts", () => {
  const aggregate = runAggregate();
  const output = aggregateOutput(aggregate);
  assert(aggregate.status === 1, `strict aggregate unexpectedly exited ${aggregate.status}`);
  assert(releaseBlockerLines(output).length > 0, `strict aggregate did not report its active release blocker: ${output}`);
});

test("partial W1 aggregate exits zero but explicitly reports the same release block", () => {
  const strict = runAggregate();
  const partial = runAggregate(["--allow-incomplete"]);
  const strictOutput = aggregateOutput(strict);
  const output = aggregateOutput(partial);
  const strictBlockers = releaseBlockerLines(strictOutput);
  const partialBlockers = releaseBlockerLines(output);
  assert(strict.status === 1, `strict aggregate unexpectedly exited ${strict.status}: ${strictOutput}`);
  assert(strictBlockers.length > 0, `strict aggregate did not report its active release blocker: ${strictOutput}`);
  assert(partial.status === 0, `partial aggregate exited ${partial.status}: ${output}`);
  assert(output.includes("RELEASE BLOCKED"), `partial aggregate hid the release block: ${output}`);
  assert(JSON.stringify(partialBlockers) === JSON.stringify(strictBlockers),
    `partial aggregate reported a different blocker:\nstrict=${strictBlockers.join(" | ")}\npartial=${partialBlockers.join(" | ")}`);
  assert(output.includes("PARTIAL STATUS ONLY"), `partial aggregate omitted its partial-status boundary: ${output}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
