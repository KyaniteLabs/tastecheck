#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = process.cwd();
const namespace = "evals/replays/remediation7-v3-correction-2026-07-11";
const correction = await import("./remediation7-v3-correction.mjs");

const expectedSkills = ["micro-motion", "spacing-system"];
const expectedSeeds = [101, 202, 303];
const expectedCurrentSourceGateErrors = ["design-system-interview: unaffected current source hash mismatch"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.deepEqual(correction.SKILLS, expectedSkills);
assert.deepEqual(correction.SEEDS, expectedSeeds);

const check = correction.validateCorrection(root, { namespace });
assert.deepEqual(check.errors, [], check.errors.join("\n"));
assert.equal(check.counts.fresh_terra_results, 12);
assert.equal(check.counts.historical_baseline_inputs, 6);
assert.equal(check.counts.blind_packets, 6);
assert.equal(check.counts.pending_luna_judgments, 18);
assert.equal(check.counts.v2_files_changed, 0);

const manifestPath = `${namespace}/manifest.json`;
assert(existsSync(manifestPath), "v3 manifest must exist");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.model_execution.executor, "gpt-5.6-terra");
assert.equal(manifest.model_execution.fresh_result_count, 12);
assert.equal(manifest.paired_lane.baseline_policy, "historical-hash-bound-v0.1.0-only");
assert.equal(manifest.paired_lane.threshold.min_upgraded_mean_delta, 0.6);
assert.equal(manifest.synthesis_contract.unaffected_v2.source_hash_gate, "all-bound-hashes-must-match");
assert.equal(manifest.synthesis_contract.corrected_evaluator_reclassification.policy, "current-contract-recompute-only");

const judgeSchema = JSON.parse(readFileSync(`${namespace}/blind-judge/judge-result-schema.json`, "utf8"));
assert.equal(judgeSchema.schema_version, 2);
assert.deepEqual(judgeSchema.required, ["revision_id", "packet_id", "judge_id", "preference", "dimension_scores", "reason", "evidence"]);
assert.deepEqual(judgeSchema.preference, ["candidate-a", "candidate-b", "tie"]);
assert.deepEqual(judgeSchema.dimension_scores, {
  "candidate-a": ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"],
  "candidate-b": ["domain_specificity", "evidence_completeness", "fail_closed", "handoff_readiness", "scope_discipline"],
});
assert.equal(judgeSchema.paired_release_policy.min_upgraded_mean_delta, 0.6);
assert(correction.validateJudgeResultSchema({ schema_version: 1, required: ["scores"] }).length > 0, "v1 comparison scores must fail closed");
const validAnonymousJudgment = {
  revision_id: "remediation7-v3-correction-2026-07-11",
  packet_id: "micro-motion-seed101-paired-blind-001",
  judge_id: "luna-1",
  preference: "candidate-a",
  dimension_scores: {
    "candidate-a": { domain_specificity: 4, evidence_completeness: 4, fail_closed: 5, handoff_readiness: 4, scope_discipline: 5 },
    "candidate-b": { domain_specificity: 3, evidence_completeness: 3, fail_closed: 4, handoff_readiness: 3, scope_discipline: 4 },
  },
  reason: "Candidate A gives an evidence-bound interruption rule.",
  evidence: [{ candidate: "candidate-a", quote: "Latest-request-only settlement" }],
};
assert.deepEqual(correction.validateJudgeResult(validAnonymousJudgment, judgeSchema), []);
assert(correction.validateJudgeResult({ ...validAnonymousJudgment, scores: {} }, judgeSchema).some((error) => /scores/i.test(error)), "legacy comparison-level scores must fail closed");

for (const skill of expectedSkills) {
  assert.match(manifest.source_bindings.current[skill].sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.source_bindings.baseline_v010[skill].sha256, /^[a-f0-9]{64}$/);
  for (const seed of expectedSeeds) {
    const upgraded = `${namespace}/paired/results/${skill}-upgraded-seed${seed}.json`;
    const diversity = `${namespace}/diversity/results/${skill}-diversity-seed${seed}.json`;
    const packet = `${namespace}/blind-judge/packets/${skill}-seed${seed}-paired-blind-001.json`;
    for (const path of [upgraded, diversity, packet]) assert(existsSync(path), `missing ${path}`);
    const pairedResult = JSON.parse(readFileSync(upgraded, "utf8"));
    const diversityResult = JSON.parse(readFileSync(diversity, "utf8"));
    assert.equal(pairedResult.raw_output_hash, sha256(pairedResult.raw_output));
    assert.equal(diversityResult.raw_output_hash, sha256(diversityResult.raw_output));
    assert.equal(pairedResult.executor, "gpt-5.6-terra");
    assert.equal(diversityResult.executor, "gpt-5.6-terra");
    assert(diversityResult.semantic_variation_evidence.material_axes.every((row) => diversityResult.raw_output.includes(row.evidence)));
  }
}

for (const packetName of [
  "micro-motion-seed101-paired-blind-001.json",
  "micro-motion-seed202-paired-blind-001.json",
  "micro-motion-seed303-paired-blind-001.json",
  "spacing-system-seed101-paired-blind-001.json",
  "spacing-system-seed202-paired-blind-001.json",
  "spacing-system-seed303-paired-blind-001.json",
]) {
  const packet = JSON.parse(readFileSync(`${namespace}/blind-judge/packets/${packetName}`, "utf8"));
  for (const candidate of [packet.candidate_a, packet.candidate_b]) {
    assert.equal(typeof candidate.raw_output, "string", `${packetName}: candidate raw_output is required`);
    assert(candidate.raw_output.length > 0, `${packetName}: candidate raw_output cannot be empty`);
    assert.equal(candidate.raw_output_sha256, sha256(candidate.raw_output), `${packetName}: candidate raw_output hash must match`);
  }
}

assert(correction.validateBlindPacket({ candidate_a: { result_ref: "historical.json" }, candidate_b: { result_ref: "fresh.json" } })
  .some((error) => /raw_output/i.test(error)), "reference-only candidates must fail closed");

const corpus = correction.collectV3Judgments(root, { namespace });
const packets = correction.collectV3Packets(root, { namespace });
const schema = JSON.parse(readFileSync(`${namespace}/blind-judge/judge-result-schema.json`, "utf8"));
const corpusInput = { judgments: corpus.records, packets: packets.records, schema };
const validCorpus = correction.validateJudgmentCorpus(corpusInput);
assert.deepEqual(validCorpus.errors, [], validCorpus.errors.join("\n"));
assert.equal(validCorpus.counts.judgments, 18);
assert.equal(validCorpus.counts.judges, 3);
assert.deepEqual(validCorpus.counts.per_judge, { "luna-final-1": 6, "luna-final-2": 6, "luna-final-3": 6 });

const malformed = structuredClone(corpus.records[0]);
malformed.result.evidence = [];
assert(correction.validateJudgmentCorpus({ ...corpusInput, judgments: [malformed, ...corpus.records.slice(1)] }).errors.some((error) => /evidence/i.test(error)), "empty evidence must fail closed");

assert(correction.validateJudgmentCorpus({ ...corpusInput, judgments: corpus.records.slice(0, -1) }).errors.some((error) => /exactly 18|count/i.test(error)), "missing judgment must fail closed");
assert(correction.validateJudgmentCorpus({ ...corpusInput, judgments: [...corpus.records.slice(0, -1), structuredClone(corpus.records[0])] }).errors.some((error) => /duplicate|six packets|unique/i.test(error)), "duplicate judgment must fail closed");

const wrongShape = structuredClone(corpus.records[0]);
wrongShape.result.dimension_scores["candidate-a"] = { domain_specificity: 4 };
assert(correction.validateJudgmentCorpus({ ...corpusInput, judgments: [wrongShape, ...corpus.records.slice(1)] }).errors.some((error) => /score|dimension/i.test(error)), "wrong score shape must fail closed");

const v3Validation = correction.validateV3Judgments(root, { namespace });
assert.deepEqual(v3Validation.errors, expectedCurrentSourceGateErrors, v3Validation.errors.join("\n"));
assert.equal(v3Validation.counts.judgments, 18);
assert.equal(v3Validation.counts.packet_count, 6);
assert.equal(v3Validation.counts.evidence_verified, 18);

const aggregate = correction.aggregateV3(root, { namespace });
assert.deepEqual(aggregate.errors, expectedCurrentSourceGateErrors, aggregate.errors.join("\n"));
assert.equal(aggregate.fail_closed, true);
assert.equal(aggregate.counts.judgments, 18);
assert.equal(aggregate.release_eligible, false);

// These fixture assertions remain available for a current-valid replay; this
// live-source drift must fail closed before decisions can be aggregated.
if (aggregate.errors.length === 0) {
  assert.equal(aggregate.by_skill["micro-motion"].release_eligible, false);
  assert.equal(aggregate.by_skill["spacing-system"].release_eligible, false);
  assert.equal(aggregate.by_skill["micro-motion"].preference_votes.upgraded, 4, "votes are transparent but do not override delta gate");
  assert.equal(aggregate.by_skill["micro-motion"].mean_delta, 0);
  assert.equal(aggregate.by_skill["spacing-system"].mean_delta, -0.2);
}

const synthesis = correction.synthesizeV3(root, { namespace });
assert.deepEqual(synthesis.errors, [...expectedCurrentSourceGateErrors, ...expectedCurrentSourceGateErrors], synthesis.errors.join("\n"));
assert.equal(synthesis.status, "blocked-invalid-evidence");
assert.equal(synthesis.release_eligible, false);
assert.equal(synthesis.fail_closed, true);
assert.equal(synthesis.unaffected_v2.preserved, false);
assert.equal(synthesis.corrected_evaluator_reclassification.policy, "current-contract-recompute-only");
assert.deepEqual(synthesis.source.current_source_bindings, manifest.source_bindings.current);

console.log("remediation7 v3 correction: validation, unmask aggregation, and fail-closed synthesis passed");
