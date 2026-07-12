#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  auditReplay,
  validateJudgeResultAgainstPacket,
} from "./remediation7-audit.mjs";

const root = process.cwd();
const namespace = "evals/replays/remediation7-v2-2026-07-11";
const audit = auditReplay(root, { namespace });

assert.equal(audit.blind.judge_validation.expected_count, 63);
assert.equal(audit.blind.judge_validation.found_count, 63);
assert.equal(audit.blind.judge_validation.validated_count, 63);
assert.equal(audit.blind.judge_validation.evidence_verified_count, 63);
assert.equal(audit.blind.judge_validation.failure_count, 0);
assert.equal(audit.blind.judge_validation.by_skill.length, 7);
assert.deepEqual(audit.blind.judge_validation.by_skill.map((item) => [item.skill, item.expected_count, item.found_count, item.validated_count, item.failure_count]), [
  ["a11y-pass", 9, 9, 9, 0],
  ["responsive-layout", 9, 9, 9, 0],
  ["component-states", 9, 9, 9, 0],
  ["micro-motion", 9, 9, 9, 0],
  ["spacing-system", 9, 9, 9, 0],
  ["design-system-interview", 9, 9, 9, 0],
  ["tastecheck-pass", 9, 9, 9, 0],
]);
assert.equal(audit.paired_preferences.expected_judgment_count, 63);
assert.equal(audit.paired_preferences.completed_judgment_count, 63);
assert.equal(audit.paired_preferences.status, "validated-aggregated");
assert.equal(audit.paired_preferences.by_skill.length, 7);
assert.equal(audit.release_gate.by_skill.length, 7);
assert.equal(audit.release_gate.verdict, "release-blocked");

const packet = JSON.parse(readFileSync(
  `${namespace}/blind-judge/packets/a11y-pass-seed101-paired-blind-001.json`,
  "utf8",
));
const schema = JSON.parse(readFileSync(`${namespace}/blind-judge/judge-result-schema.json`, "utf8"));
const result = JSON.parse(readFileSync(
  `${namespace}/blind-judge/results/independent-1/a11y-pass-seed101-paired-blind-001.json`,
  "utf8",
));
assert.deepEqual(validateJudgeResultAgainstPacket(result, packet, schema), []);

const tampered = {
  ...result,
  evidence: [{ candidate: "A", quote: "this quote is not in candidate A" }],
};
const tamperErrors = validateJudgeResultAgainstPacket(tampered, packet, schema);
assert(tamperErrors.some((error) => /exact candidate substring/i.test(error)), JSON.stringify(tamperErrors));

console.log("remediation7 blind-judge tests: 63 files validated, exact evidence binding, unmask aggregation, and release-gate synthesis passed");
