import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { analyzePairedObservations, validateAnalysisResult } from "./lib/statistics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "contracts/v2/taste-oracle-analysis-result.schema.json"), "utf8"));
const observationsSchema = JSON.parse(fs.readFileSync(path.join(root, "contracts/v2/taste-oracle-observations.schema.json"), "utf8"));
const ajv = new Ajv({ strict: true, allErrors: true }); ajv.addSchema(observationsSchema);
const validate = ajv.compile(schema);
const fixture = JSON.parse(fs.readFileSync(path.join(root, "evals/taste-oracle/fixtures/observations-synthetic.json"), "utf8"));
const report = analyzePairedObservations(fixture, { seed: 7, iterations: 400 });
const firstFamily = Object.keys(report.family_statistics)[0];
assert.equal(validate(report), true, JSON.stringify(validate.errors));
assert.equal(report.schema_version, 2);
assert.equal(Object.hasOwn(report, "release_evidence_eligible"), false);
assert.equal(report.release_scope, "milestone_only");
for (const mutate of [
  (value) => { value.comparator_arm = value.target_arm; },
  (value) => { value.counts.wins += 1; },
  (value) => { value.preference_rate = 0.123; },
  (value) => { value.status = "supported"; value.family_disagreement = true; },
  (value) => { value.provenance.extra = true; },
  (value) => { value.family_disagreement = !value.family_disagreement; },
  (value) => { value.bootstrap.enough_independent_clusters = !value.bootstrap.enough_independent_clusters; },
  (value) => { value.bootstrap.interval = [0.1, 0.9]; value.status = "supported"; },
  (value) => { value.family_statistics[firstFamily].cluster_margins[0] = -1; },
  (value) => { value.family_statistics[firstFamily].analyzed_clusters += 1; },
  (value) => { value.status = "insufficient_evidence"; },
]) {
  const invalid = structuredClone(report); mutate(invalid); assert.throws(() => validateAnalysisResult(invalid));
}
console.log("taste-oracle analysis result schema test passed");
