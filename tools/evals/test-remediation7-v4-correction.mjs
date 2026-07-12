#!/usr/bin/env node
import assert from "node:assert/strict";
import { DIMENSIONS, MIN_UPGRADED_MEAN_DELTA, aggregateV4, validateCorrection, validateJudgeBatchResults } from "./remediation7-v4-correction.mjs";

const report = validateCorrection();
assert.deepEqual(report.errors, [], report.errors.join("\n"));
assert.equal(report.counts.receipts, 12);
assert.equal(report.counts.real_pairs, 24);
assert.equal(report.counts.controls, 8);
assert.equal(report.counts.pending_judgments, 0);
assert.equal(report.counts.completed_judgments, 32);
assert.equal(report.counts.total_judgments, 32);
assert.equal(report.controlsAdmissible, true);
assert.equal(report.manifest.blind_protocol.completed_judgments, 32);
assert.equal(report.manifest.blind_protocol.unmasking_performed, true);
assert.equal(report.manifest.blind_protocol.synthesis_claimed, true);
assert.equal(report.manifest.blind_protocol.synthesis_status, "threshold-blocked");
assert.equal(report.manifest.dispatch_incident.aggregator_worker_state, "exit-0-no-worker");
assert.equal(typeof report.manifest.dispatch_incident.direct_luna_fallback_thread_id, "string");
assert.equal(report.manifest.materialized_outputs.judge_validation.path.endsWith("blind-judge/judge-validation.json"), true);
assert.equal(aggregateV4().release_eligible, false);
assert.equal(aggregateV4().threshold, MIN_UPGRADED_MEAN_DELTA);
assert.equal(aggregateV4().records.length, 24);
assert.equal(aggregateV4().overall.judgment_count, 24);
assert.ok(Object.values(aggregateV4().by_skill).every((row) => row.judgment_count === 12));
assert.ok(Object.values(aggregateV4().by_skill).every((row) => row.mean_delta < MIN_UPGRADED_MEAN_DELTA));
const packetByJudgePair = new Map(report.batches.flatMap((judgeBatch) => judgeBatch.items.filter((item) => item.kind === "real").map((item) => [`${judgeBatch.judge_id}/${item.comparison_id}`, item])));
for (const record of aggregateV4().records) {
  const packet = packetByJudgePair.get(`${record.judge_id}/${record.comparison_id}`);
  assert.deepEqual(record.candidate_hashes, {
    "candidate-a": packet.candidate_a.raw_output_sha256,
    "candidate-b": packet.candidate_b.raw_output_sha256,
  });
}
const batch = report.batches[0];
const control = batch.items.find((item) => item.kind === "identical-control");
const scores = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 4]));
const inadmissible = validateJudgeBatchResults(batch, [{
  packet_id: batch.packet_id,
  comparison_id: control.comparison_id,
  judge_id: batch.judge_id,
  preference: "candidate-a",
  dimension_scores: { "candidate-a": scores, "candidate-b": { ...scores, scope_discipline: 3 } },
}], { preference: ["candidate-a", "candidate-b", "tie"] });
assert.ok(inadmissible.some((error) => error.includes("inadmissible")));
console.log("remediation7 v4 correction static evidence: ok");
