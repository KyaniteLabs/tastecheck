import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

import { validateObservationSet } from "./lib/statistics.mjs";
import { PUBLIC_SAFE_TEXT_PATTERN } from "./lib/public-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(fs.readFileSync(
  path.join(root, "contracts/v2/taste-oracle-observations.schema.json"),
  "utf8",
));
const validateSchema = new Ajv({ strict: true, allErrors: true }).compile(schema);
assert.equal(schema.definitions.publicSafeText.pattern, PUBLIC_SAFE_TEXT_PATTERN, "observation schema must use the shared runtime public-safety pattern");

function observation(id, family, preference = "current") {
  return {
    observation_id: id.startsWith("observation-") ? id : `observation-${id}`,
    evaluator_family: family,
    result_id: family === "family-a" ? "result-001" : "result-002",
    viewport_id: id.endsWith("1") || id.endsWith("3") ? "mobile" : "desktop",
    preference,
    evidence_citations: ["8".repeat(64), "9".repeat(64)],
  };
}

const canonical = {
  schema_version: 2,
  kind: "taste-oracle-paired-observations",
  scenario_id: "deslop-ui-hard-001",
  target_arm: "current",
  comparator_arm: "frozen",
  release_scope: "milestone_only",
  provenance: {
    kind: "validated_judge_panel",
    packet: { packet_id: "packet-001", path: "evals/taste-oracle/packet.json", file_sha256: "f".repeat(64), canonical_sha256: "1".repeat(64) },
    unmask: { path: ".omx/taste-oracle/unmask.json", file_sha256: "2".repeat(64) },
    manifest: { path: ".omx/taste-oracle/run-001/manifest.json", file_sha256: "2".repeat(64), canonical_sha256: "3".repeat(64) },
    results: [
      { result_id: "result-001", path: ".omx/taste-oracle/result-a.json", judge_id: "judge-a", evaluator_family: "family-a", file_sha256: "4".repeat(64), canonical_sha256: "5".repeat(64) },
      { result_id: "result-002", path: ".omx/taste-oracle/result-b.json", judge_id: "judge-b", evaluator_family: "family-b", file_sha256: "6".repeat(64), canonical_sha256: "7".repeat(64) },
    ],
  },
  observations: [
    observation("a-01", "family-a"),
    observation("a-02", "family-a"),
    observation("a-03", "family-a"),
    observation("a-04", "family-a", "tie"),
    observation("b-01", "family-b"),
    observation("b-02", "family-b"),
    observation("b-03", "family-b", "frozen"),
    observation("b-04", "family-b", "tie"),
  ],
};

function runtimeAccepts(value) {
  try {
    validateObservationSet(value);
    return true;
  } catch {
    return false;
  }
}

function assertParity(label, value, expected) {
  const schemaAccepted = validateSchema(value);
  const runtimeAccepted = runtimeAccepts(value);
  assert.equal(schemaAccepted, expected, `${label}: schema acceptance mismatch: ${JSON.stringify(validateSchema.errors)}`);
  assert.equal(runtimeAccepted, expected, `${label}: runtime acceptance mismatch`);
  assert.equal(schemaAccepted, runtimeAccepted, `${label}: schema and runtime must agree`);
}

assertParity("canonical collected input", canonical, true);
assertParity("prototype-like family", {
  ...canonical,
  provenance: {
    ...canonical.provenance,
    results: canonical.provenance.results.map((entry, index) => index === 0 ? { ...entry, evaluator_family: "family-proto" } : entry),
  },
  observations: canonical.observations.map((entry, index) => (
    index < 4 ? { ...entry, evaluator_family: "family-proto" } : entry
  )),
}, true);
assertParity("caller-authored collected flag forbidden", { ...canonical, provenance: "collected" }, false);
assertParity("release evidence field forbidden", { ...canonical, release_evidence: false }, false);

for (const [label, field, value] of [
  ["blank observation ID", "observation_id", "   "],
  ["leading-space observation ID", "observation_id", " a-01"],
  ["trailing-space observation ID", "observation_id", "a-01 "],
  ["blank evaluator family", "evaluator_family", "\t"],
  ["leading-space evaluator family", "evaluator_family", " family-a"],
  ["trailing-space evaluator family", "evaluator_family", "family-a\n"],
]) {
  const observations = structuredClone(canonical.observations);
  observations[0][field] = value;
  assertParity(label, { ...canonical, observations }, false);
}

const synthetic = JSON.parse(fs.readFileSync(
  path.join(root, "evals/taste-oracle/fixtures/observations-synthetic.json"),
  "utf8",
));
assertParity("canonical synthetic fixture", synthetic, true);
assertParity("synthetic fixture missing notice", { ...synthetic, provenance: { kind: "synthetic_fixture" } }, false);
assertParity("synthetic fixture marked release evidence", { ...synthetic, release_evidence: true }, false);

for (const unsafe of ["_a@b.com_", "/Users/operator/note", "family-alice@example.test"]) {
  const changed = structuredClone(canonical);
  changed.observations[0].evaluator_family = unsafe;
  assertParity(`unsafe observation ${unsafe}`, changed, false);
}

console.log("taste-oracle observation schema/runtime parity tests passed");
