#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  DIMENSIONS,
  MIN_UPGRADED_MEAN_DELTA,
  aggregateV5,
  validateCorrection,
  validateJudgeBatchResults,
} from "./remediation7-v5-spacing-final.mjs";

const report = validateCorrection();
assert.deepEqual(report.errors, [], report.errors.join("\n"));
assert.equal(report.counts.receipts, 3);
assert.equal(report.counts.real_pairs, 12);
assert.equal(report.counts.controls, 8);
assert.equal(report.counts.pending_judgments, 0);
assert.equal(report.counts.completed_judgments, 20);
assert.equal(report.counts.total_judgments, 20);
assert.equal(report.counts.unique_results, 20);
assert.equal(report.counts.judgment_files, 20);
assert.equal(report.controlsAdmissible, true);
assert.equal(report.manifest.blind_protocol.unmasking_performed, true);
assert.equal(report.manifest.blind_protocol.synthesis_claimed, true);
assert.equal(report.manifest.blind_protocol.synthesis_status, "threshold-blocked");
assert.equal(report.manifest.dispatch_incident.aggregator_worker_id, "redacted-dispatch-worker");
assert.equal(report.manifest.dispatch_incident.direct_luna_fallback_thread_id, "redacted-local-evaluator-session");
assert.deepEqual(Object.keys(report.manifest.historical_integrity).sort(), [
  "remediation7-v2-2026-07-11",
  "remediation7-v3-correction-2026-07-11",
  "remediation7-v4-correction-2026-07-11",
]);
assert.ok(report.manifest.materialized_outputs?.unmasked_results, "manifest must bind explicit unmasked results");

const aggregate = aggregateV5();
assert.equal(aggregate.fail_closed, false);
assert.equal(aggregate.release_eligible, false);
assert.equal(aggregate.threshold, MIN_UPGRADED_MEAN_DELTA);
assert.equal(aggregate.records.length, 12);
assert.equal(aggregate.overall.judgment_count, 12);
assert.equal(aggregate.overall.current_source_mean, 4.9333);
assert.equal(aggregate.overall.frozen_baseline_mean, 4.6333);
assert.equal(aggregate.overall.raw_mean_delta_current_minus_baseline, 0.3);
assert.deepEqual(aggregate.overall.preference_counts, { current_source: 11, frozen_baseline: 1, tie: 0 });
assert.equal(aggregate.by_skill["spacing-system"].judgment_count, 12);

const packetByJudgePair = new Map(report.batches.flatMap((batch) => batch.items.filter((item) => item.kind === "real").map((item) => [`${batch.judge_id}/${item.comparison_id}`, item])));
for (const record of aggregate.records) {
  const packet = packetByJudgePair.get(`${record.judge_id}/${record.comparison_id}`);
  assert.deepEqual(record.candidate_hashes, {
    "candidate-a": packet.candidate_a.raw_output_sha256,
    "candidate-b": packet.candidate_b.raw_output_sha256,
  });
}

const batch = report.batches[0];
const control = batch.items.find((item) => item.kind === "identical-control");
const scores = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 4]));
const validResults = report.byJudge[batch.judge_id];
assert.deepEqual(validateJudgeBatchResults(batch, validResults, report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` }), []);

const brokenControl = validResults.map((result) => result.comparison_id === control.comparison_id ? {
  ...result,
  preference: "candidate-a",
  dimension_scores: { "candidate-a": scores, "candidate-b": { ...scores, scope_discipline: 3 } },
} : result);
const invalid = validateJudgeBatchResults(batch, brokenControl, report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(invalid.some((error) => error.includes("entire judge batch is inadmissible")));

const missing = validateJudgeBatchResults(batch, validResults.slice(0, -1), report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(missing.some((error) => error.includes("missing result")));

const duplicate = validateJudgeBatchResults(batch, [...validResults.slice(0, -1), validResults[0]], report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(duplicate.some((error) => error.includes("duplicate result")));
assert.ok(duplicate.some((error) => error.includes("missing result")));

const mismatched = validateJudgeBatchResults(batch, validResults.map((result, index) => index === 0 ? {
  ...result,
  judge_id: "luna-4",
} : result), report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(mismatched.some((error) => error.includes("judge_id mismatch")));

const malformed = validateJudgeBatchResults(batch, validResults.map((result, index) => index === 0 ? {
  ...result,
  reason: " ",
  evidence: [],
  dimension_scores: { "candidate-a": { ...scores, fail_closed: 6 }, "candidate-b": scores },
} : result), report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(malformed.some((error) => error.includes("reason must be non-empty")));
assert.ok(malformed.some((error) => error.includes("evidence must be non-empty")));
assert.ok(malformed.some((error) => error.includes("invalid candidate-a score")));

const packetless = validateJudgeBatchResults(batch, [{
  comparison_id: control.comparison_id,
  judge_id: batch.judge_id,
  preference: "candidate-a",
  dimension_scores: { "candidate-a": scores, "candidate-b": scores },
  reason: "control",
  evidence: ["control"],
}], report.schema, { expectedPacketId: `${report.manifest.revision_id}/${batch.judge_id}` });
assert.ok(packetless.some((error) => error.includes("packet_id must be a non-empty string")));
console.log("remediation7 v5 spacing final: ok");
