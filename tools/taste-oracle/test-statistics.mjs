import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzePairedObservations as analyzeAuthoritativeObservations,
  analyzeStructuralObservations,
  validateObservationSet,
} from "./lib/statistics.mjs";

const analyzePairedObservations = analyzeStructuralObservations;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function observation(id, family, preference) {
  const cluster = id.endsWith("01") || id.endsWith("02") ? "1" : "2";
  return {
    observation_id: id.startsWith("observation-") ? id : `observation-${id}`,
    evaluator_family: family,
    result_id: `result-${family.endsWith("a") ? "a" : "b"}${cluster}`,
    viewport_id: id.endsWith("1") || id.endsWith("3") ? "mobile" : "desktop",
    preference,
    evidence_citations: ["8".repeat(64), "9".repeat(64)],
  };
}

function dataset(observations, overrides = {}) {
  return {
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
      manifest: {
        path: ".omx/taste-oracle/run-001/manifest.json",
        file_sha256: "e".repeat(64),
        canonical_sha256: "3".repeat(64),
      },
      results: [
        { result_id: "result-a1", path: ".omx/taste-oracle/result-a1.json", judge_id: "judge-a1", evaluator_family: "family-a", file_sha256: "4".repeat(64), canonical_sha256: "5".repeat(64) },
        { result_id: "result-a2", path: ".omx/taste-oracle/result-a2.json", judge_id: "judge-a2", evaluator_family: "family-a", file_sha256: "6".repeat(64), canonical_sha256: "7".repeat(64) },
        { result_id: "result-b1", path: ".omx/taste-oracle/result-b1.json", judge_id: "judge-b1", evaluator_family: "family-b", file_sha256: "a".repeat(64), canonical_sha256: "b".repeat(64) },
        { result_id: "result-b2", path: ".omx/taste-oracle/result-b2.json", judge_id: "judge-b2", evaluator_family: "family-b", file_sha256: "c".repeat(64), canonical_sha256: "d".repeat(64) },
      ],
    },
    observations,
    ...overrides,
  };
}

const decisive = dataset([
  observation("a-01", "family-a", "current"),
  observation("a-02", "family-a", "current"),
  observation("a-03", "family-a", "current"),
  observation("a-04", "family-a", "current"),
  observation("b-01", "family-b", "current"),
  observation("b-02", "family-b", "current"),
  observation("b-03", "family-b", "current"),
  observation("b-04", "family-b", "tie"),
]);

const options = { seed: 246813579, iterations: 2000 };
const first = analyzePairedObservations(decisive, options);
const second = analyzePairedObservations(decisive, options);
assert.deepEqual(first, second, "seeded analysis must be deterministic");
assert.deepEqual(first.counts, { samples: 8, analyzed: 8, families: 2, wins: 7, losses: 0, ties: 1, abstentions: 0 });
assert.equal(first.preference_rate, 1);
assert.equal(first.tie_rate, 0.125);
assert.equal(first.preference_margin, 0.875);
assert.equal(first.status, "supported");
assert.equal(first.bootstrap.method, "family_balanced_cluster_percentile");
assert.equal(first.bootstrap.enough_independent_clusters, true);
assert.equal(first.family_disagreement, false);
assert.equal(first.family_statistics["family-a"].clusters, 2);
assert.deepEqual(first.family_statistics["family-a"].cluster_margins, [1, 1]);
assert.equal(first.bootstrap.confidence_level, 0.95);
assert.equal(first.bootstrap.seed, 246813579);
assert.equal(first.bootstrap.iterations, 2000);
assert.equal(first.bootstrap.interval.length, 2);
assert.ok(first.bootstrap.interval[0] > 0 && first.bootstrap.interval[1] <= 1);

const reordered = structuredClone(decisive);
reordered.observations.reverse();
assert.deepEqual(
  analyzePairedObservations(reordered, options),
  first,
  "analysis must not depend on observation input order",
);

const opposed = dataset([
  observation("a-01", "family-a", "frozen"),
  observation("a-02", "family-a", "frozen"),
  observation("a-03", "family-a", "frozen"),
  observation("a-04", "family-a", "frozen"),
  observation("b-01", "family-b", "frozen"),
  observation("b-02", "family-b", "frozen"),
  observation("b-03", "family-b", "frozen"),
  observation("b-04", "family-b", "tie"),
]);
assert.equal(analyzePairedObservations(opposed, options).status, "not_supported");

const ambiguous = dataset([
  observation("a-01", "family-a", "current"),
  observation("a-02", "family-a", "current"),
  observation("a-03", "family-a", "frozen"),
  observation("a-04", "family-a", "tie"),
  observation("b-01", "family-b", "current"),
  observation("b-02", "family-b", "frozen"),
  observation("b-03", "family-b", "frozen"),
  observation("b-04", "family-b", "tie"),
]);
const uncertain = analyzePairedObservations(ambiguous, options);
assert.ok(uncertain.bootstrap.interval[0] <= 0 && uncertain.bootstrap.interval[1] >= 0);
assert.equal(uncertain.status, "insufficient_evidence", "a CI crossing zero must not pass");

for (const [name, invalid, pattern] of [
  ["empty", dataset([]), /at least 8 observations/],
  ["too small", dataset(decisive.observations.slice(0, 7)), /at least 8 observations/],
  ["single family", dataset(decisive.observations.map((entry) => ({ ...entry, evaluator_family: "family-a" }))), /matching validated result|at least 2 evaluator families/],
  ["invalid target", dataset(decisive.observations, { target_arm: "challenger" }), /target_arm/],
  ["invalid comparator", dataset(decisive.observations, { comparator_arm: "baseline" }), /comparator_arm/],
  ["same arms", dataset(decisive.observations, { comparator_arm: "current" }), /must be distinct/],
  ["invalid preference", dataset(decisive.observations.map((entry, index) => index === 0 ? { ...entry, preference: "left" } : entry)), /preference/],
  ["duplicate ID", dataset(decisive.observations.map((entry, index) => index === 1 ? { ...entry, observation_id: "observation-a-01" } : entry)), /observation_id must be unique/],
  ["unknown field", { ...decisive, verdict: "pass" }, /verdict is not allowed/],
]) {
  assert.throws(() => analyzePairedObservations(invalid, options), pattern, `${name} must fail closed`);
}

assert.throws(() => analyzePairedObservations(decisive, { seed: -1, iterations: 2000 }), /seed/);
assert.throws(() => analyzePairedObservations(decisive, { seed: 1, iterations: 199 }), /iterations/);

const synthetic = dataset(decisive.observations, {
  provenance: { kind: "synthetic_fixture", notice: "SYNTHETIC FIXTURE — NOT RELEASE EVIDENCE" },
  observations: decisive.observations.map(({ observation_id, evaluator_family, result_id, preference }) => ({ observation_id, evaluator_family, result_id, preference })),
});
const syntheticReport = analyzePairedObservations(synthetic, options);
assert.equal(syntheticReport.provenance.kind, "synthetic_fixture");
assert.equal(syntheticReport.release_scope, "milestone_only");
assert.equal(Object.hasOwn(syntheticReport, "release_evidence_eligible"), false);
assert.equal(syntheticReport.schema_version, 2);
assert.equal(syntheticReport.kind, "taste-oracle-analysis-result");
assert.equal(syntheticReport.evidence_notice, "SYNTHETIC FIXTURE — NOT RELEASE EVIDENCE");
assert.throws(
  () => validateObservationSet({ ...synthetic, release_evidence: true }),
  /release_evidence is not allowed/,
);

const fixture = JSON.parse(fs.readFileSync(path.join(root, "evals/taste-oracle/fixtures/observations-synthetic.json"), "utf8"));
assert.equal(fixture.provenance.kind, "synthetic_fixture");
assert.ok(fixture.provenance.notice.includes("SYNTHETIC"));
assert.equal(Object.hasOwn(analyzePairedObservations(fixture, options), "release_evidence_eligible"), false);

const abstaining = dataset(decisive.observations.map((entry, index) => index < 2 ? { ...entry, preference: "abstain" } : entry));
const abstainingReport = analyzePairedObservations(abstaining, options);
assert.equal(abstainingReport.counts.abstentions, 2);
assert.equal(abstainingReport.counts.analyzed, 6);

const oneClusterPerFamily = dataset(decisive.observations.map((entry) => ({ ...entry, result_id: entry.evaluator_family === "family-a" ? "result-a1" : "result-b1" })));
assert.equal(analyzePairedObservations(oneClusterPerFamily, options).status, "insufficient_evidence");
assert.equal(analyzePairedObservations(oneClusterPerFamily, options).bootstrap.enough_independent_clusters, false);
assert.equal(uncertain.family_disagreement, true, "opposed family margins must remain visible");

assert.throws(
  () => validateObservationSet({ ...decisive, provenance: "collected" }),
  /provenance must be an object/,
  "caller-authored collected flags must not confer authority",
);
assert.throws(
  () => analyzeAuthoritativeObservations(decisive, options),
  /authoritative collected analysis requires a file-backed certified receipt/,
  "structural library input must not self-certify collected evidence",
);

for (const unsafe of ["_a@b.com_", "/Users/operator/note", "observation-alice@example.test"]) {
  const changed = structuredClone(decisive);
  changed.observations[0].observation_id = unsafe;
  assert.throws(() => validateObservationSet(changed), /public-safe|opaque/i, unsafe);
}

console.log("taste-oracle statistics tests passed");
