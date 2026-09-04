#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateTastecheckGate } from "./evaluators/tastecheck-gate.mjs";
import {
  CATALOG_PATH,
  ROOT,
  evaluateReleaseGate,
  hashEvidence,
  hashProvenance,
  inspectArtifact,
  loadCheckCatalog,
} from "../../skills/tastecheck-pass/assets/release-gate.mjs";

const contract = {
  expected_verdict: "FAIL",
  required_ledger_ids: ["contrast:body-on-surface", "cold-load:initial-render", "error-state:invalid-skip"],
  required_evidence_fields: ["status", "reason", "remediation", "evidence", "provenance"],
  preference_lift_required: false,
};

function run(seed, architecture) {
  return {
    seed,
    raw_output: `FAIL ${architecture}`,
    assertions_result: [{ met: true }],
    evidence_fields_present: Object.fromEntries(contract.required_evidence_fields.map((field) => [field, true])),
    gate_evidence: {
      verdict: "FAIL",
      ledger_ids: contract.required_ledger_ids,
      canonical_facts: { hidden_error: true, equal_card_grid: true, contrast_measured: false, cold_load_trace: false },
      presentation_architecture: architecture,
    },
  };
}

const passing = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  run(202, "evidence trace"),
  run(303, "release decision memo"),
], contract);
assert.equal(passing.release_eligible, true, passing.notes);
assert.equal(passing.verdict, "correct-and-invariant");
assert.equal(passing.preference_lift_required, false);

const missingRow = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  { ...run(202, "evidence trace"), gate_evidence: { ...run(202, "evidence trace").gate_evidence, ledger_ids: contract.required_ledger_ids.slice(1) } },
  run(303, "release decision memo"),
], contract);
assert.equal(missingRow.release_eligible, false, "missing canonical row must block");

const missingContract = evaluateTastecheckGate([run(101, "failure-first queue"), run(202, "evidence trace"), run(303, "release decision memo")]);
assert.equal(missingContract.release_eligible, false, "missing deterministic contract must block");

const missingLiftPolicy = evaluateTastecheckGate([
  run(101, "failure-first queue"),
  run(202, "evidence trace"),
  run(303, "release decision memo"),
], { ...contract, preference_lift_required: undefined });
assert.equal(missingLiftPolicy.release_eligible, false, "deterministic contract must explicitly declare lift policy");

console.log("tastecheck deterministic gate tests: 4 passed");

// W3 release-gate contract tests. These use a committed HTML fixture as the
// real artifact and deliberately exercise the fail-closed edges of the new
// one-row-per-catalog-ID runner.
const loadedCatalog = loadCheckCatalog({ root: ROOT });
const artifactInput = { type: "file", path: "tools/smoke/fixtures/gate-audit-fixture.html" };
const measuredArtifact = inspectArtifact(artifactInput, { root: ROOT }).artifact;
const capturedAt = "2026-09-04T12:00:00Z";

function makeEvidence(check, status = "pass", overrides = {}) {
  const mode = check.manual_inspector_required ? "manual" : "automated";
  const evidence = {
    mode,
    summary: `${check.label} evidence for ${status}`,
    details: { check_id: check.id, observed: status === "pass" },
    ...(status === "n/a" ? { subject: check.applicability.subject, subject_absent: true } : {}),
    ...overrides,
  };
  evidence.sha256 = hashEvidence(evidence);
  return evidence;
}

function makeRow(check, status = "pass", evidenceOverrides = {}, provenanceOverrides = {}) {
  const evidence = makeEvidence(check, status, evidenceOverrides);
  const provenance = {
    artifact_identity: measuredArtifact.identity,
    artifact_sha256: measuredArtifact.sha256,
    captured_at: capturedAt,
    tool: { name: "tastecheck-test-runner", version: "1.0.0" },
    browser: { name: "Chromium", version: "126.0.0" },
    inspector: check.manual_inspector_required ? { name: "fixture-reviewer", role: "auditor", method: "browser fixture" } : null,
    ...provenanceOverrides,
  };
  provenance.sha256 = hashProvenance(provenance);
  return {
    skill: "tastecheck-pass",
    check_id: check.id,
    status,
    reason: `${check.label} was checked on the committed fixture.`,
    remediation: `Rerun ${check.id} after the next artifact change.`,
    evidence,
    provenance,
  };
}

const validRows = loadedCatalog.catalog.checks.map((check) => (
  check.required ? makeRow(check) : makeRow(check, "n/a")
));
const validLedger = {
  schema_version: 1,
  catalog: { path: CATALOG_PATH, sha256: loadedCatalog.sha256 },
  artifact: artifactInput,
  rows: validRows,
};
const validReport = evaluateReleaseGate(validLedger, { root: ROOT });
assert.equal(validReport.verdict, "SHIP", validReport.validation.errors.join("; "));
assert.equal(validReport.release_eligible, true);
assert.equal(validReport.rows.length, loadedCatalog.catalog.checks.length);
assert.equal(new Set(validReport.rows.map((row) => row.check_id)).size, loadedCatalog.catalog.checks.length);

const requiredCheck = loadedCatalog.catalog.checks.find((check) => check.required);
const optionalCheck = loadedCatalog.catalog.checks.find((check) => !check.required);
const missingReport = evaluateReleaseGate({ ...validLedger, rows: validRows.filter((row) => row.check_id !== requiredCheck.id) }, { root: ROOT });
assert.equal(missingReport.verdict, "HOLD");
assert(missingReport.validation.errors.some((error) => error.includes(`${requiredCheck.id}: missing ledger row`)));
assert.equal(missingReport.rows.filter((row) => row.check_id === requiredCheck.id).length, 1);

const requiredNa = makeRow(requiredCheck, "n/a");
const requiredNaReport = evaluateReleaseGate({ ...validLedger, rows: validRows.map((row) => row.check_id === requiredCheck.id ? requiredNa : row) }, { root: ROOT });
assert.equal(requiredNaReport.verdict, "HOLD");
assert(requiredNaReport.validation.errors.some((error) => error.includes(`${requiredCheck.id}: required row may not use n/a`)));

const optionalNaWithoutAbsence = makeRow(optionalCheck, "n/a", { subject_absent: false, subject: optionalCheck.applicability.subject });
const optionalNaReport = evaluateReleaseGate({ ...validLedger, rows: validRows.map((row) => row.check_id === optionalCheck.id ? optionalNaWithoutAbsence : row) }, { root: ROOT });
assert.equal(optionalNaReport.verdict, "HOLD");
assert(optionalNaReport.validation.errors.some((error) => error.includes(`${optionalCheck.id}: n/a requires subject_absent=true evidence`)));

const forgedEvidence = structuredClone(validRows);
forgedEvidence[0].evidence.sha256 = "0".repeat(64);
const forgedEvidenceReport = evaluateReleaseGate({ ...validLedger, rows: forgedEvidence }, { root: ROOT });
assert.equal(forgedEvidenceReport.verdict, "HOLD");
assert.equal(forgedEvidenceReport.validation.evidence_hashes_verified, false);

const missingInspector = structuredClone(validRows);
const manualIndex = missingInspector.findIndex((row) => loadedCatalog.catalog.checks.find((check) => check.id === row.check_id).manual_inspector_required);
missingInspector[manualIndex].provenance.inspector = null;
missingInspector[manualIndex].provenance.sha256 = hashProvenance(missingInspector[manualIndex].provenance);
const missingInspectorReport = evaluateReleaseGate({ ...validLedger, rows: missingInspector }, { root: ROOT });
assert.equal(missingInspectorReport.verdict, "HOLD");
assert(missingInspectorReport.validation.errors.some((error) => error.includes("inspector is required for manual evidence")));

const duplicateAndUnknownReport = evaluateReleaseGate({ ...validLedger, rows: [...validRows, validRows[0], { ...validRows[0], check_id: "unknown:check" }] }, { root: ROOT });
assert.equal(duplicateAndUnknownReport.verdict, "HOLD");
assert(duplicateAndUnknownReport.validation.errors.some((error) => error.includes("duplicate ledger rows")));
assert(duplicateAndUnknownReport.validation.errors.some((error) => error.includes("unknown check ID")));

console.log("release gate ledger tests: 7 passed");
