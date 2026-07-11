import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

import { hashBytes, hashCanonicalJson } from "./lib/evidence.mjs";
import { PUBLIC_SAFE_TEXT_PATTERN } from "./lib/public-safety.mjs";
import { validateJudgePanel, validateJudgePanelStructure as validatePanelStructure, validatePendingJudgePacket } from "./validate-judges.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const packet = readJson("evals/taste-oracle/deslop-ui-hard-001/judge-packet.json");
const unmaskMap = {
  schema_version: 2,
  kind: "taste-oracle-judge-unmask-map",
  packet_id: packet.packet_id,
  scenario_id: packet.scenario_id,
  packet_path: "evals/taste-oracle/deslop-ui-hard-001/judge-packet.json",
  packet_file_sha256: hashBytes(fs.readFileSync(path.join(root, "evals/taste-oracle/deslop-ui-hard-001/judge-packet.json"))),
  mapping: [
    { opaque_label: "option-amber", arm_id: "no-skill" },
    { opaque_label: "option-birch", arm_id: "current" },
    { opaque_label: "option-cobalt", arm_id: "frozen" },
  ],
  notice: "CONTROLLED UNMASK MATERIAL — DO NOT INCLUDE IN JUDGE INPUT",
};
const armByLabel = new Map(unmaskMap.mapping.map((entry) => [entry.opaque_label, entry.arm_id]));
const manifest = {
  schema_version: 1,
  scenario_id: packet.scenario_id,
  captured_at: "2026-07-11T20:00:00.000Z",
  runtime: { browser: "chromium", playwright: "1.61.1", platform: "darwin" },
  viewports: structuredClone(packet.viewports),
  arms: ["no-skill", "current", "frozen"],
  captures: packet.blinded_arms.flatMap((arm) => arm.artifacts.map((artifact) => ({
    arm_id: armByLabel.get(arm.opaque_label),
    viewport_id: artifact.viewport_id,
    screenshot_sha256: artifact.screenshot_sha256,
    dom_sha256: artifact.dom_sha256,
    style_sha256: artifact.style_sha256,
  }))),
};
packet.evidence_manifest.canonical_sha256 = hashCanonicalJson(manifest);
const schema = readJson("contracts/v2/taste-oracle-judge-result.schema.json");
assert.equal(schema.definitions.publicSafeText.pattern, PUBLIC_SAFE_TEXT_PATTERN, "judge schema must use the shared runtime public-safety pattern");
const validateSchema = new Ajv({ strict: true, allErrors: true }).compile(schema);
const clone = structuredClone;

function result(judgeId, family) {
  const artifactAssessments = packet.blinded_arms.flatMap((arm) => arm.artifacts.map((artifact) => ({
    opaque_label: arm.opaque_label,
    viewport_id: artifact.viewport_id,
    artifact_hashes: {
      screenshot_sha256: artifact.screenshot_sha256,
      dom_sha256: artifact.dom_sha256,
      style_sha256: artifact.style_sha256,
    },
    assessment: "The cited rendering has coherent hierarchy and legible state communication.",
    evidence_citations: [artifact.screenshot_sha256, artifact.dom_sha256],
  })));
  const labels = packet.blinded_arms.map((arm) => arm.opaque_label);
  return {
    schema_version: 2,
    kind: "taste-oracle-judge-result",
    scenario_id: "deslop-ui-hard-001",
    packet_id: packet.packet_id,
    judge_id: judgeId,
    evaluator_family: family,
    blinded: true,
    artifact_assessments: artifactAssessments,
    pairwise_preferences: packet.viewports.flatMap((viewport) => [
      [labels[0], labels[1]], [labels[0], labels[2]], [labels[1], labels[2]],
    ].map(([left, right]) => ({
      viewport_id: viewport.id,
      left,
      right,
      preference: "abstain",
      reason: "Evidence does not support a confident preference.",
      evidence_citations: artifactAssessments
        .filter((entry) => entry.viewport_id === viewport.id && [left, right].includes(entry.opaque_label))
        .map((entry) => entry.artifact_hashes.screenshot_sha256),
    }))),
    human_calibration: { claimed: false, observation_records: [] },
  };
}

const codes = (errors) => errors.map((entry) => entry.code);
function reject(label, mutate, expectedCode) {
  const inputs = { packet: clone(packet), unmaskMap: clone(unmaskMap), manifest: clone(manifest), results: [result("judge-a", "family-a"), result("judge-b", "family-b")] };
  mutate(inputs);
  const errors = validatePanelStructure(inputs);
  assert.ok(errors.length > 0, `${label}: expected rejection`);
  assert.ok(codes(errors).includes(expectedCode), `${label}: expected ${expectedCode}, got ${JSON.stringify(errors)}`);
}

assert.deepEqual(validatePendingJudgePacket({ packet, unmaskMap, manifest }), []);
assert.equal(packet.status, "pending");
assert.equal(packet.release_evidence, false);
assert.ok(!JSON.stringify(packet).match(/no-skill|current|frozen/), "packet must not reveal arm IDs");
assert.throws(() => validateJudgePanel({ packet, unmaskMap, manifest, results: [] }), /file paths/, "authoritative validation must not accept in-memory objects");
assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [result("judge-a", "family-a"), result("judge-b", "family-b")] }), []);
assert.equal(validateSchema(result("judge-a", "family-a")), true, JSON.stringify(validateSchema.errors));

const disagreeingJudge = result("judge-b", "family-b");
disagreeingJudge.pairwise_preferences = disagreeingJudge.pairwise_preferences.map((entry) => ({ ...entry, preference: entry.right }));
assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [result("judge-a", "family-a"), disagreeingJudge] }), [], "disagreement must remain evidence, not a validation failure");
const tyingJudge = result("judge-b", "family-b");
tyingJudge.pairwise_preferences = tyingJudge.pairwise_preferences.map((entry) => ({ ...entry, preference: "tie" }));
assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [result("judge-a", "family-a"), tyingJudge] }), [], "ties must remain valid evidence");

reject("one family", ({ results }) => { results[1].evaluator_family = results[0].evaluator_family; }, "evaluator_family_quorum");
reject("duplicate identity", ({ results }) => { results[1].judge_id = results[0].judge_id; }, "duplicate_judge_identity");
reject("missing arm viewport", ({ results }) => { results[0].artifact_assessments.pop(); }, "artifact_coverage");
reject("uncited preference", ({ results }) => { results[0].pairwise_preferences[0].evidence_citations = []; }, "preference_citations");
reject("unknown hash", ({ results }) => { results[0].artifact_assessments[0].artifact_hashes.screenshot_sha256 = "f".repeat(64); }, "unknown_evidence_hash");
reject("packet hash not in manifest", ({ packet: changed }) => { changed.blinded_arms[0].artifacts[0].screenshot_sha256 = "f".repeat(64); }, "artifact_manifest_mismatch");
reject("seventh duplicate packet artifact", ({ packet: changed }) => { changed.blinded_arms[0].artifacts.push(clone(changed.blinded_arms[0].artifacts[0])); }, "artifact_coverage");
reject("collapsed packet artifact keys", ({ packet: changed }) => { changed.blinded_arms[0].artifacts[1] = clone(changed.blinded_arms[0].artifacts[0]); }, "artifact_coverage");
reject("arm label leaked", ({ packet: changed }) => { changed.blinded_arms[0].opaque_label = "current"; }, "arm_identity_leak");
reject("arm label leaked in instruction", ({ packet: changed }) => { changed.rubric.instruction = "Prefer the current arm."; }, "arm_identity_leak");
reject("uppercase arm label leaked in packet", ({ packet: changed }) => { changed.rubric.instruction = "Prefer the CURRENT arm."; }, "arm_identity_leak");
reject("Unicode-width arm label leaked in packet", ({ packet: changed }) => { changed.rubric.instruction = "Prefer ＣＵＲＲＥＮＴ variant."; }, "arm_identity_leak");
reject("zero-width arm disclosure", ({ packet: changed }) => { changed.rubric.instruction = "Prefer cur\u200Brent arm."; }, "arm_identity_leak");
reject("dash-like no-skill disclosure", ({ packet: changed }) => { changed.rubric.instruction = "The no\u2010skill\u2010arm is stronger."; }, "arm_identity_leak");
reject("minus-sign no-skill disclosure", ({ packet: changed }) => { changed.rubric.instruction = "The no\u2212skill\u2212arm is stronger."; }, "arm_identity_leak");
reject("colon-separated arm disclosure", ({ packet: changed }) => { changed.rubric.instruction = "Prefer arm: current."; }, "arm_identity_leak");
reject("parenthesized arm disclosure", ({ packet: changed }) => { changed.rubric.instruction = "Prefer current (arm)."; }, "arm_identity_leak");
reject("equals-separated candidate disclosure", ({ packet: changed }) => { changed.rubric.instruction = "candidate=current"; }, "arm_identity_leak");
reject("arm label leaked in result assessment", ({ results }) => { results[0].artifact_assessments[0].assessment = "CURRENT candidate is more coherent."; }, "result_arm_identity_leak");
reject("minus-sign disclosure in result", ({ results }) => { results[0].artifact_assessments[0].assessment = "FROZEN\u2212ARM is stronger."; }, "result_arm_identity_leak");
reject("arm label leaked in result reason", ({ results }) => { results[0].pairwise_preferences[0].reason = "The frozen arm is clearer."; }, "result_arm_identity_leak");
reject("email judge identity", ({ results }) => { results[0].judge_id = "judge@example.test"; }, "result_public_safe");
reject("local-path family identity", ({ results }) => { results[0].evaluator_family = "/Users/operator/family"; }, "result_public_safe");
reject("home-relative path in result", ({ results }) => { results[0].pairwise_preferences[0].reason = "See ~/work/notes.txt"; }, "result_public_safe");
reject("Windows user-home path in result", ({ results }) => { results[0].pairwise_preferences[0].reason = "See C:\\Users\\operator\\notes.txt"; }, "result_public_safe");
reject("slash-normalized Windows home in result", ({ results }) => { results[0].pairwise_preferences[0].reason = "See C:/Users/operator/notes.txt"; }, "result_public_safe");
reject("secret in judge prose", ({ results }) => { results[0].pairwise_preferences[0].reason = "token=not-a-real-token"; }, "result_public_safe");
reject("human claim without observations", ({ results }) => { results[0].human_calibration.claimed = true; }, "human_observation_required");
reject("non-opaque human participant", ({ results }) => {
  results[0].human_calibration = {
    claimed: true,
    observation_records: [{
      observation_id: "observation-001",
      participant_id: "Simon",
      observed_at: "2026-07-11T20:00:00.000Z",
      consent_recorded: true,
      provenance: "human_observed",
    }],
  };
}, "opaque_identifier");
reject("duplicate artifact", ({ results }) => { results[0].artifact_assessments[1] = clone(results[0].artifact_assessments[0]); }, "duplicate_artifact_assessment");
reject("missing pairwise comparison", ({ results }) => { results[0].pairwise_preferences.pop(); }, "pairwise_coverage");
reject("unknown opaque label", ({ results }) => { results[0].artifact_assessments[0].opaque_label = "option-unknown"; }, "unknown_opaque_label");
reject("packet artifact cue", ({ packet: changed }) => { changed.blinded_arms[0].artifacts[0].operator_hint = "preferred"; }, "packet_shape");
reject("unmask mapping metadata", ({ unmaskMap: changed }) => { changed.mapping[0].model_hint = "family-a"; }, "unmask_shape");
reject("malformed packet fails closed", ({ packet: changed }) => { delete changed.blinded_arms; }, "packet_shape");

const invalidExtra = result("judge-a", "family-a");
invalidExtra.extra = true;
assert.equal(validateSchema(invalidExtra), false, "schema must reject unknown keys");
const invalidHuman = result("judge-a", "family-a");
invalidHuman.human_calibration = { claimed: true, observation_records: [] };
assert.equal(validateSchema(invalidHuman), false, "schema must reject unsupported human claims");

for (const [label, mutate, publicUnsafe = true] of [
  ["email judge ID", (value) => { value.judge_id = "judge@example.test"; }],
  ["local family path", (value) => { value.evaluator_family = "/Users/operator/family"; }],
  ["generic judge identity", (value) => { value.judge_id = "alice"; }, false],
  ["home-relative rationale", (value) => { value.pairwise_preferences[0].reason = "See ~/work/notes.txt"; }],
  ["Windows user-home rationale", (value) => { value.pairwise_preferences[0].reason = "See C:\\Users\\operator\\notes.txt"; }],
  ["uppercase Documents and Settings home", (value) => { value.pairwise_preferences[0].reason = "See C:\\DOCUMENTS AND SETTINGS\\OPERATOR\\notes.txt"; }],
  ["slash-normalized Windows rationale", (value) => { value.pairwise_preferences[0].reason = "See C:/Users/operator/notes.txt"; }],
  ["secret-like rationale", (value) => { value.pairwise_preferences[0].reason = "token=not-a-real-token"; }],
]) {
  const value = result("judge-a", "family-a");
  mutate(value);
  assert.equal(validateSchema(value), false, `${label}: schema must reject public-safety violation`);
  const runtimeErrors = validatePanelStructure({ packet, unmaskMap, manifest, results: [value, result("judge-b", "family-b")] });
  if (publicUnsafe) assert.ok(codes(runtimeErrors).includes("result_public_safe"), `${label}: runtime must reject public-safety violation`);
}

const syntheticHuman = result("judge-a", "family-a");
syntheticHuman.human_calibration = {
  claimed: true,
  observation_records: [{
    observation_id: "observation-001",
    participant_id: "participant-001",
    observed_at: "2026-07-11T20:00:00.000Z",
    consent_recorded: true,
    provenance: "human_observed",
  }],
};
assert.equal(validateSchema(syntheticHuman), true, JSON.stringify(validateSchema.errors));
assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [syntheticHuman, result("judge-b", "family-b")] }), [], "synthetic human fixture must preserve schema/runtime parity");

const genericParticipant = clone(syntheticHuman);
genericParticipant.human_calibration.observation_records[0].participant_id = "Simon";
assert.equal(validateSchema(genericParticipant), false, "schema must require opaque participant IDs");
assert.ok(validatePanelStructure({ packet, unmaskMap, manifest, results: [genericParticipant, result("judge-b", "family-b")] }).some((entry) => entry.code === "opaque_identifier"));

const ordinaryCurrentPacket = clone(packet);
ordinaryCurrentPacket.rubric.instruction = "Assess the current visual hierarchy and responsive composition.";
const ordinaryCurrentResult = result("judge-a", "family-a");
ordinaryCurrentResult.artifact_assessments[0].assessment = "The current visual hierarchy is coherent.";
assert.deepEqual(validatePanelStructure({ packet: ordinaryCurrentPacket, unmaskMap, manifest, results: [ordinaryCurrentResult, result("judge-b", "family-b")] }), [], "ordinary current prose must not be treated as arm disclosure");

const atTwoX = result("judge-a", "family-a");
atTwoX.pairwise_preferences[0].reason = "Rendered @ 2x for inspection.";
assert.equal(validateSchema(atTwoX), true, JSON.stringify(validateSchema.errors));
assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [atTwoX, result("judge-b", "family-b")] }), [], "ordinary at-sign prose must pass schema and runtime");

for (const [label, reason] of [
  ["embedded token word", "mytoken=value is a harmless identifier"],
]) {
  const value = result("judge-a", "family-a");
  value.pairwise_preferences[0].reason = reason;
  assert.equal(validateSchema(value), true, `${label}: schema must accept boundary-safe prose: ${JSON.stringify(validateSchema.errors)}`);
  assert.deepEqual(validatePanelStructure({ packet, unmaskMap, manifest, results: [value, result("judge-b", "family-b")] }), [], `${label}: runtime must accept boundary-safe prose`);
}

const underscoredEmail = result("judge-a", "family-a");
underscoredEmail.pairwise_preferences[0].reason = "Literal _a@b.com_ must remain private.";
assert.equal(validateSchema(underscoredEmail), false, "email-shaped text inside underscores must fail schema");
assert.ok(validatePanelStructure({ packet, unmaskMap, manifest, results: [underscoredEmail, result("judge-b", "family-b")] }).some((entry) => entry.code === "result_public_safe"), "email-shaped text inside underscores must fail runtime");

const uppercasePassword = result("judge-a", "family-a");
uppercasePassword.pairwise_preferences[0].reason = "PASSWORD=not-a-real-value";
assert.equal(validateSchema(uppercasePassword), false, "uppercase secret assignment must fail schema");
assert.ok(validatePanelStructure({ packet, unmaskMap, manifest, results: [uppercasePassword, result("judge-b", "family-b")] }).some((entry) => entry.code === "result_public_safe"), "uppercase secret assignment must fail runtime");

console.log("taste-oracle judge quorum tests passed");
