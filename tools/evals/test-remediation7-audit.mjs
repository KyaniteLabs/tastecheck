#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  auditReplay,
  PAIRED_RELEASE_POLICY,
  parseTastecheckGateEvidence,
  releaseGateSummary,
  summarizePreferenceRows,
} from "./remediation7-audit.mjs";

const root = process.cwd();
const namespace = "evals/replays/remediation7-v2-2026-07-11";
const audit = auditReplay(root, { namespace });

assert.equal(audit.validation.expected_count, 63);
assert.equal(audit.validation.found_count, 63);
assert.equal(audit.validation.validated_count, 0, "immutable v2 is blocked by current-source rework");
assert.equal(audit.validation.failure_count, 63);
const expectedImmutableDrift = [
  ...["design-system-interview", "micro-motion", "spacing-system"].flatMap((skill) => [
    `${skill}-upgraded-seed101: source missing or digest drifted`,
    `${skill}-upgraded-seed202: source missing or digest drifted`,
    `${skill}-upgraded-seed303: source missing or digest drifted`,
    `${skill}-diversity-seed101: source missing or digest drifted`,
    `${skill}-diversity-seed202: source missing or digest drifted`,
    `${skill}-diversity-seed303: source missing or digest drifted`,
  ]),
];
const observedImmutableDrift = [...new Set(audit.validation.failures.flatMap((failure) => failure.errors))].sort();
assert.deepEqual(observedImmutableDrift, [...expectedImmutableDrift].sort(), "only the 18 expected current-source drift messages may block immutable v2");
assert(audit.validation.failures.every((failure) => JSON.stringify([...failure.errors].sort()) === JSON.stringify([...expectedImmutableDrift].sort())), "every immutable v2 record must carry the same bounded drift receipt");
assert.equal(audit.fixture_receipts.expected_receipt_result_count, 27);
assert.equal(audit.fixture_receipts.verified_receipt_result_count, 0, "source-bound validation blocks fixture receipts with immutable v2");
assert.equal(audit.fixture_receipts.expected_receipt_count, 81);
assert.equal(audit.fixture_receipts.verified_receipt_count, 81, "fixture receipt bindings remain intact even while package source validation is blocked");
assert.equal(audit.diversity.by_skill.length, 7);
assert.equal(audit.anti_slop.by_lane_skill.length, 14);
assert.equal(audit.deterministic_gate.release_eligible, true);
assert.equal(audit.blind.packet_count, 21);
assert.equal(audit.blind.expected_judgment_count, 63);

const tastecheckAggregate = audit.paired_preferences.by_skill.find((item) => item.skill === "tastecheck-pass");
assert.equal(tastecheckAggregate.mean_delta, 0.2222, "receipt should retain the actual five-dimension mean delta");
assert.equal(tastecheckAggregate.upgraded_preference_count, 9, "all nine upgraded preferences remain diagnostic evidence");
assert.equal(PAIRED_RELEASE_POLICY.min_upgraded_mean_delta, 0.6, "paired threshold must not be lowered");
assert.deepEqual(PAIRED_RELEASE_POLICY.score_scale, { min: 1, max: 5, dimensions: 5 });
assert.equal(PAIRED_RELEASE_POLICY.min_upgraded_mean_delta_full_range_fraction, 0.15, "0.6 is 15% of the four-point 1-5 score-delta range");

const calibrationRows = Array.from({ length: 9 }, () => ({
  preference_class: "upgraded",
  dimension_deltas: Object.fromEntries(PAIRED_RELEASE_POLICY.dimensions.map((dimension) => [dimension, 1])),
}));
const calibration = summarizePreferenceRows(calibrationRows);
assert.equal(calibration.mean_delta, 1, "mean delta must average all five raw 1-5 dimension deltas");
assert(PAIRED_RELEASE_POLICY.min_upgraded_mean_delta > 0 && PAIRED_RELEASE_POLICY.min_upgraded_mean_delta <= 4, "threshold must remain within the raw 1-5 delta range");

const tastecheckRelease = audit.release_gate.by_skill.find((item) => item.skill === "tastecheck-pass");
assert.equal(tastecheckRelease.release_eligible, true, "deterministic tastecheck contract must control release eligibility");
assert.equal(tastecheckRelease.paired_preference.required_for_release, false, "paired preference lift is diagnostic for deterministic tastecheck");
assert.equal(tastecheckRelease.paired_preference.diagnostic_only, true);
assert.equal(tastecheckRelease.blocking_reasons.includes("paired_preference_gate_failed"), false);

const genericContractGate = releaseGateSummary(
  audit.paired_preferences,
  audit.diversity,
  audit.anti_slop,
  { "a11y-pass": { applicable: true, release_eligible: true, verdict: "correct-and-invariant", preference_lift_required: false } },
  audit.blind.judge_validation,
);
const genericRelease = genericContractGate.by_skill.find((item) => item.skill === "a11y-pass");
assert.equal(genericRelease.paired_preference.diagnostic_only, true, "deterministic exemption must be contract-driven, not skill-name-driven");
const noGateRelease = releaseGateSummary(audit.paired_preferences, audit.diversity, audit.anti_slop, {}, audit.blind.judge_validation);
assert.equal(noGateRelease.by_skill.find((item) => item.skill === "tastecheck-pass").paired_preference.required_for_release, true, "missing deterministic gate must retain paired threshold");

const gateResult = JSON.parse(readFileSync(
  "evals/replays/remediation7-v2-2026-07-11/paired/results/tastecheck-pass-upgraded-seed101.json",
  "utf8",
));
const parsed = parseTastecheckGateEvidence(gateResult.raw_output, {
  expected_verdict: "FAIL",
  required_ledger_ids: [
    "contrast:body-on-surface",
    "cold-load:initial-render",
    "error-state:invalid-skip",
    "a11y:hidden-error",
    "structural:equal-card-grid",
  ],
  required_evidence_fields: ["status", "reason", "remediation", "evidence", "provenance"],
});
assert.equal(parsed.gate_evidence.verdict, "FAIL");
assert.equal(parsed.assertions_result.every((item) => item.met), true);
assert.equal(Object.values(parsed.evidence_fields_present).every(Boolean), true);

console.log("remediation7 audit tests: 63-result receipts, gate parsing, calibration, and deterministic release policy passed");
