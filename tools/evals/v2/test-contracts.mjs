import assert from "node:assert/strict";
import fixture from "../../../evals/v2/fixtures/protocol-valid.json" with { type: "json" };
import manifest, { sameLineage } from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";
import { freezeExecutionManifest, freezeProtocol, validateContract } from "./lib/contracts.mjs";

assert.equal(validateContract("protocol", fixture).valid, true);
assert.doesNotThrow(() => freezeProtocol(fixture));
assert.throws(() => freezeProtocol({ ...fixture, max_external_calls: 161 }), /160/);
assert.throws(() => freezeProtocol({ ...fixture, human_calibration: true }), /unknown|human/i);
assert.throws(() => freezeProtocol({ ...fixture, baseline_revision: "f".repeat(40) }), /baseline/);
assert.throws(() => freezeProtocol({ ...fixture, exclusions: ["unit-1"] }), /exclusions/);
assert.throws(() => freezeProtocol({ ...fixture, candidate_preference_floor: 17 }), /candidate_preference_floor/);
for (const [key, value] of Object.entries({
  candidate_revision: "f".repeat(40), scenarios_per_stratum: 3, seeds: [101, 203],
  comparison_units: 23, generation_calls: 47, production_judgments: 95,
  anchor_judgments: 15, incremental_spend_cap_usd: 1, retry_policy: "once",
  family_quorum: 1, judge_identities_per_family: 1, scenario_majority_floor: 7,
  absolute_mean_floor: 3.9, dimension_floor: 2.9, human_calibration_claimed: true
})) assert.throws(() => freezeProtocol({ ...fixture, [key]: value }), new RegExp(key));
for (const [key, value] of Object.entries({
  randomization_commitment_sha256: "c".repeat(64),
  packet_validator_version: "effectiveness-v2-packet-policy-2",
  packet_validator_sha256: "d".repeat(64)
})) assert.throws(() => freezeProtocol({ ...fixture, [key]: value }), new RegExp(key));
assert.doesNotThrow(() => freezeExecutionManifest(manifest));
assert.throws(() => freezeExecutionManifest({ ...manifest, evaluator_families: sameLineage }), /lineage/);
assert.throws(() => freezeExecutionManifest({ ...manifest, chromium_version: "latest" }), /exact version/);
assert.throws(() => freezeExecutionManifest({ ...manifest, viewports: [manifest.viewports[0], manifest.viewports[0]] }), /constant|valid item/);
for (const version of ["latest-2", "preview-2026", "stable.3", "current_4"]) {
  assert.throws(() => freezeExecutionManifest({ ...manifest, chromium_version: version }), /exact version/);
}
assert.throws(() => freezeExecutionManifest({ ...manifest, surprise: true }), /unknown|additional/i);

const h = "a".repeat(64);
const dimensions = { direction: 4, structure: 4, accessibility: 4, verbal: 4, integration: 4 };
const validContracts = {
  "historical-authority": { schema_version: 2, kind: "effectiveness-v2-historical-authority", entries: [{ authority_id: "w1", path: "evals/authority.json", sha256: h, normalized_sha256: h }] },
  "synthesis-reservation": { schema_version: 2, kind: "effectiveness-v2-synthesis-reservation", run_id: "run-1", ledger_root: h, reservation_nonce: "nonce-1" },
  "generation-receipt": { schema_version: 2, kind: "effectiveness-v2-generation-receipt", run_id: "run-1", ordinal: 1, scenario_id: "scenario-1", seed: 101, arm: "baseline", revision: "a".repeat(40), cost_classification: "flat-rate", status: "completed", turns: 1, tokens_in: 1, tokens_out: 1, artifacts: ["artifact-1"] },
  "randomization-commitment": { schema_version: 2, kind: "effectiveness-v2-randomization-commitment", domain: "effectiveness-v2", commitment_sha256: h, adapter_sha256: h },
  "render-receipt": { schema_version: 2, kind: "effectiveness-v2-render-receipt", run_id: "run-1", unit_id: "unit-1", arm: "baseline", artifact_id: "artifact-1", evidence_id: h, viewport_id: "mobile", viewport_width: 390, viewport_height: 844, artifact_sha256: h, screenshot_png_base64: "iVBORw0KGgo=", serialized_dom: "<html></html>", computed_styles: [{}], screenshot_sha256: h, dom_sha256: h, style_sha256: h, playwright_version: "1.61.1", chromium_version: "141.0.0.0", font_set_sha256: h, renderer_adapter_sha256: h, render_host_sha256: h },
  "unmask": { schema_version: 2, kind: "effectiveness-v2-unmask", run_id: "run-1", commitment_sha256: h, packet_set_sha256: h, reservation_sha256: h, ledger_predecessor: h, opening: "opening", mappings: Array.from({ length: 48 }, (_, index) => ({ unit_id: `unit-${Math.floor(index / 2)}`, opaque_slot: index % 2, arm: index % 2 ? "candidate" : "baseline", scenario_id: `scenario-${Math.floor(index / 4)}`, generation_seed: 101 + (Math.floor(index / 2) % 2) })) },
  "judge-result": { schema_version: 2, kind: "effectiveness-v2-judge-result", packet_id: "packet-1", family_id: "family-a", identity_id: "judge-1", invocation_id: "invoke-1", context_id: "context-1", packet_sha256: h, preference: "slot-1", arm_scores: [{ opaque_slot: 0, dimensions }, { opaque_slot: 1, dimensions }], hard_regressions: [], evidence_citations: [{ artifact_id: "artifact-1", opaque_slot: 1, viewport_id: "mobile", artifact_sha256: h, start_codepoint: 0, end_codepoint: 4, exact_span: "test" }] },
  "synthesis": { schema_version: 2, kind: "effectiveness-v2-synthesis", run_id: "run-1", status: "supported", families: ["a", "b"].map((family_id) => ({ family_id, preference_score: 18, scenario_majorities: 8, dimension_means: dimensions, absolute_mean: 4, passed: true })), hard_regressions: [], claim_allowed: true },
  "public-claim": { schema_version: 2, kind: "effectiveness-v2-public-claim", run_id: "run-1", status: "supported", claim: "Scoped machine-only claim" }
};
for (const [name, value] of Object.entries(validContracts)) {
  assert.equal(validateContract(name, value).valid, true, `${name} valid fixture must pass`);
  assert.equal(validateContract(name, { ...value, unknown: true }).valid, false, `${name} must reject unknown fields`);
}
assert.equal(validateContract("judge-result", { ...validContracts["judge-result"], arm_scores: [null, { evil: true }] }).valid, false);
assert.equal(validateContract("judge-result", { ...validContracts["judge-result"], evidence_citations: [null] }).valid, false);
assert.equal(validateContract("judge-result", { ...validContracts["judge-result"], arm_scores: [{ opaque_slot: 0, dimensions: { ...dimensions, verbal: 6 } }, { opaque_slot: 1, dimensions }] }).valid, false);
assert.equal(validateContract("judge-result", { ...validContracts["judge-result"], arm_scores: [{ opaque_slot: 0, dimensions }, { opaque_slot: 0, dimensions }] }).valid, false);
assert.equal(validateContract("synthesis", { ...validContracts.synthesis, families: [null, { evil: true }] }).valid, false);

console.log("effectiveness-v2 contract tests passed");
