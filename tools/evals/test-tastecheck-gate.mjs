#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateTastecheckGate } from "./evaluators/tastecheck-gate.mjs";
import {
  CATALOG_PATH,
  ROOT,
  REQUIRED_VIEWPORTS,
  evaluateReleaseGate,
  hashEvidence,
  hashProvenance,
  hashReview,
  hashSubjectInventory,
  inspectArtifact,
  loadBrowserSubjectAuthority,
  loadCheckCatalog,
  redactCapturedText,
  redactUntrusted,
  assessExecutionPolicy,
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
const artifactProbe = inspectArtifact({ type: "file", path: "tools/smoke/fixtures/gate-audit-fixture.html" }, { root: ROOT });
const artifactInput = { type: "file", path: "tools/smoke/fixtures/gate-audit-fixture.html", dependency_manifest: artifactProbe.artifact.dependency_manifest };
const measuredArtifact = inspectArtifact(artifactInput, { root: ROOT }).artifact;
const capturedAt = "2026-09-04T12:00:00Z";
const browserManifestPath = "tools/evals/fixtures/release-gate/browser-subject-manifest.json";
const browserAuthority = loadBrowserSubjectAuthority({ root: ROOT, manifestPath: browserManifestPath, requiredViewports: REQUIRED_VIEWPORTS });
assert.equal(browserAuthority.valid, true, browserAuthority.errors.join("; "));
assert.equal(browserAuthority.routes.length * browserAuthority.states.length * REQUIRED_VIEWPORTS.length, 12);
const gateOptions = { root: ROOT, browserManifestPath, requiredViewports: REQUIRED_VIEWPORTS };

function makeInventory() {
  const coverage = Object.fromEntries(loadedCatalog.catalog.checks.map((check) => {
    if (!check.required) return [check.id, []];
    if (check.observation.coverage === "browser") return [check.id, browserAuthority.members.map((member) => ({ ...member }))];
    if (check.observation.coverage === "control-state") return [check.id, [{ id: "control:fixture|state:default", control: "fixture-control", state: "default" }]];
    return [check.id, [{ id: check.id }]];
  }));
  const inventory = { frozen_at: capturedAt, subjects: [], coverage };
  inventory.sha256 = hashSubjectInventory(inventory);
  return inventory;
}

const subjectInventory = makeInventory();

function makeEvidence(check, status = "pass", overrides = {}) {
  const mode = check.manual_inspector_required ? "manual" : "automated";
  const members = subjectInventory.coverage[check.id] || [];
  const evidence = {
    mode,
    summary: `${check.label} evidence for ${status}`,
    details: { observations: status === "n/a" ? [] : members.map((member) => ({ subject_id: member.id, ...Object.fromEntries(check.observation.fields.map((field) => [field, check.observation.type === "contrast" ? [{ kind: "body", ratio: 7.2, foreground: "#111", background: "#fff", theme: "light" }] : true])) })) },
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
    dependency_manifest_sha256: measuredArtifact.dependency_manifest_sha256,
    subject_inventory_sha256: subjectInventory.sha256,
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
    ...(check.judgment === "subjective" ? { review: makeReview(check, status, evidence) } : {}),
  };
}

function makeReview(check, status = "pass", evidence = makeEvidence(check, status), overrides = {}) {
  const review = {
    check_id: check.id,
    artifact_sha256: measuredArtifact.sha256,
    evidence_sha256: evidence.sha256,
    reviewer: { id: "human-reviewer-1", type: "human", role: "independent-auditor", method: "rubric review" },
    rubric: { id: `rubric-${check.stage}`, version: "1.0", criteria: { evidence_bound: true, decision_bound: true } },
    independent: true,
    decision: status,
    disagreement: false,
    adjudication: null,
    reviewed_at: capturedAt,
    ...overrides,
  };
  review.sha256 = hashReview(review);
  return review;
}

const validRows = loadedCatalog.catalog.checks.map((check) => (
  check.required ? makeRow(check) : makeRow(check, "n/a")
));
const validLedger = {
  schema_version: 1,
  catalog: { path: CATALOG_PATH, sha256: loadedCatalog.sha256 },
  artifact: artifactInput,
  browser_subjects: {
    manifest_path: browserAuthority.manifest_path,
    manifest_sha256: browserAuthority.manifest_sha256,
    required_viewports: [...browserAuthority.required_viewports],
  },
  subject_inventory: subjectInventory,
  rows: validRows,
};
const validReport = evaluateReleaseGate(validLedger, gateOptions);
assert.equal(validReport.verdict, "SHIP", validReport.validation.errors.join("; "));
assert.equal(validReport.release_eligible, true);
assert.equal(validReport.rows.length, loadedCatalog.catalog.checks.length);
assert.equal(new Set(validReport.rows.map((row) => row.check_id)).size, loadedCatalog.catalog.checks.length);

const requiredCheck = loadedCatalog.catalog.checks.find((check) => check.required);
const optionalCheck = loadedCatalog.catalog.checks.find((check) => !check.required);
const missingReport = evaluateReleaseGate({ ...validLedger, rows: validRows.filter((row) => row.check_id !== requiredCheck.id) }, gateOptions);
assert.equal(missingReport.verdict, "HOLD");
assert(missingReport.validation.errors.some((error) => error.includes(`${requiredCheck.id}: missing ledger row`)));
assert.equal(missingReport.rows.filter((row) => row.check_id === requiredCheck.id).length, 1);

const requiredNa = makeRow(requiredCheck, "n/a");
const requiredNaReport = evaluateReleaseGate({ ...validLedger, rows: validRows.map((row) => row.check_id === requiredCheck.id ? requiredNa : row) }, gateOptions);
assert.equal(requiredNaReport.verdict, "HOLD");
assert(requiredNaReport.validation.errors.some((error) => error.includes(`${requiredCheck.id}: required row may not use n/a`)));

const optionalNaWithoutAbsence = makeRow(optionalCheck, "n/a", { subject_absent: false, subject: optionalCheck.applicability.subject });
const optionalNaReport = evaluateReleaseGate({ ...validLedger, rows: validRows.map((row) => row.check_id === optionalCheck.id ? optionalNaWithoutAbsence : row) }, gateOptions);
assert.equal(optionalNaReport.verdict, "HOLD");
assert(optionalNaReport.validation.errors.some((error) => error.includes(`${optionalCheck.id}: n/a requires subject_absent=true evidence`)));

const forgedEvidence = structuredClone(validRows);
forgedEvidence[0].evidence.sha256 = "0".repeat(64);
const forgedEvidenceReport = evaluateReleaseGate({ ...validLedger, rows: forgedEvidence }, gateOptions);
assert.equal(forgedEvidenceReport.verdict, "HOLD");
assert.equal(forgedEvidenceReport.validation.evidence_hashes_verified, false);

const missingInspector = structuredClone(validRows);
const manualIndex = missingInspector.findIndex((row) => loadedCatalog.catalog.checks.find((check) => check.id === row.check_id).manual_inspector_required);
missingInspector[manualIndex].provenance.inspector = null;
missingInspector[manualIndex].provenance.sha256 = hashProvenance(missingInspector[manualIndex].provenance);
const missingInspectorReport = evaluateReleaseGate({ ...validLedger, rows: missingInspector }, gateOptions);
assert.equal(missingInspectorReport.verdict, "HOLD");
assert(missingInspectorReport.validation.errors.some((error) => error.includes("inspector is required for manual evidence")));

const duplicateAndUnknownReport = evaluateReleaseGate({ ...validLedger, rows: [...validRows, validRows[0], { ...validRows[0], check_id: "unknown:check" }] }, gateOptions);
assert.equal(duplicateAndUnknownReport.verdict, "HOLD");
assert(duplicateAndUnknownReport.validation.errors.some((error) => error.includes("duplicate ledger rows")));
assert(duplicateAndUnknownReport.validation.errors.some((error) => error.includes("unknown check ID")));

const subjectiveCheck = loadedCatalog.catalog.checks.find((check) => check.judgment === "subjective");

console.log("release gate ledger tests: 7 passed");

// ASTRA #1: a record-only row must not pass. Status is derived from named
// observations, and declared status must agree with those observations.
const observationCheck = loadedCatalog.catalog.checks.find((check) => check.required && check.judgment === "deterministic" && check.observation.type === "boolean_bundle");
const browserObservationCheck = loadedCatalog.catalog.checks.find((check) => check.required && check.observation.coverage === "browser" && check.observation.type === "boolean_bundle");
const recordOnlyRows = validRows.map((row) => row.check_id === observationCheck.id
  ? { ...row, evidence: { ...row.evidence, details: { measurements: { claimed: true } } } }
  : row);
const recordOnlyRow = recordOnlyRows.find((row) => row.check_id === observationCheck.id);
recordOnlyRow.evidence.sha256 = hashEvidence(recordOnlyRow.evidence);
const recordOnlyReport = evaluateReleaseGate({ ...validLedger, rows: recordOnlyRows }, gateOptions);
assert.equal(recordOnlyReport.verdict, "HOLD");
assert(recordOnlyReport.validation.errors.some((error) => error.includes("observations")));

const contradictoryRows = validRows.map((row) => row.check_id === observationCheck.id
  ? { ...row, evidence: { ...row.evidence, details: { observations: [{ subject_id: observationCheck.id, ...Object.fromEntries(observationCheck.observation.fields.map((field) => [field, false])) }] } } }
  : row);
const contradictoryRow = contradictoryRows.find((row) => row.check_id === observationCheck.id);
contradictoryRow.evidence.sha256 = hashEvidence(contradictoryRow.evidence);
const contradictoryReport = evaluateReleaseGate({ ...validLedger, rows: contradictoryRows }, gateOptions);
assert.equal(contradictoryReport.verdict, "HOLD");
assert(contradictoryReport.validation.errors.some((error) => error.includes("contradicts measured observations")));

// ASTRA #2: a signed review cannot be replayed onto another check or artifact.
const replayedReview = makeReview(subjectiveCheck, "pass", validRows.find((row) => row.check_id === subjectiveCheck.id).evidence, {
  check_id: observationCheck.id,
  artifact_sha256: "f".repeat(64),
});
const replayedReviewRows = validRows.map((row) => row.check_id === subjectiveCheck.id ? { ...row, review: replayedReview } : row);
const replayedReviewReport = evaluateReleaseGate({ ...validLedger, rows: replayedReviewRows }, gateOptions);
assert.equal(replayedReviewReport.verdict, "HOLD");
assert(replayedReviewReport.validation.errors.some((error) => error.includes("review.check_id")));
assert(replayedReviewReport.validation.errors.some((error) => error.includes("review.artifact_sha256")));

// ASTRA #3: linked rendering dependencies are part of the capture. Keeping
// the entry HTML byte-identical while changing its stylesheet must HOLD.
const consumerRoot = mkdtempSync(join(tmpdir(), "tastecheck-astra-"));
try {
  writeFileSync(join(consumerRoot, "index.html"), "<!doctype html><link rel=\"stylesheet\" href=\"./styles.css\"><main>fixture</main>\n");
  writeFileSync(join(consumerRoot, "styles.css"), "body { color: #111; }\n");
  const initialConsumer = inspectArtifact({ type: "file", path: "index.html" }, { artifactRoot: consumerRoot });
  assert.equal(initialConsumer.artifact.hash_verified, true);
  const declaredConsumer = {
    type: "file",
    path: "index.html",
    sha256: initialConsumer.artifact.sha256,
    bytes: initialConsumer.artifact.bytes,
    dependency_manifest: initialConsumer.artifact.dependency_manifest,
  };
  writeFileSync(join(consumerRoot, "styles.css"), "body { color: #900; }\n");
  const changedConsumer = inspectArtifact(declaredConsumer, { artifactRoot: consumerRoot });
  assert.equal(changedConsumer.artifact.hash_verified, true);
  assert.equal(changedConsumer.artifact.dependency_manifest_hash_verified, false);
  assert(changedConsumer.errors.some((error) => error.includes("dependency manifest does not match")));
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}

// ASTRA #4: coverage is reconciled against frozen members, including the
// optional-subject applicability direction.
const cognitiveCheck = loadedCatalog.catalog.checks.find((check) => check.applicability?.subject === "cognitive-friction");
const presentCognitiveInventory = structuredClone(subjectInventory);
presentCognitiveInventory.subjects = ["cognitive-friction"];
presentCognitiveInventory.sha256 = hashSubjectInventory(presentCognitiveInventory);
const presentCognitiveReport = evaluateReleaseGate({ ...validLedger, subject_inventory: presentCognitiveInventory }, gateOptions);
assert.equal(presentCognitiveReport.verdict, "HOLD");
assert(presentCognitiveReport.validation.errors.some((error) => error.includes(`${cognitiveCheck.id}: applicable subject cognitive-friction`)));

const incompleteInventory = structuredClone(subjectInventory);
const omittedBrowserMember = incompleteInventory.coverage[browserObservationCheck.id].shift();
incompleteInventory.sha256 = hashSubjectInventory(incompleteInventory);
assert.equal(omittedBrowserMember.route, "/");
assert.equal(omittedBrowserMember.state, "default");
assert.notEqual(incompleteInventory.sha256, subjectInventory.sha256);
const incompleteInventoryReport = evaluateReleaseGate({ ...validLedger, subject_inventory: incompleteInventory }, gateOptions);
assert.equal(incompleteInventoryReport.verdict, "HOLD");
assert(incompleteInventoryReport.validation.errors.some((error) => error.includes(`${browserObservationCheck.id}: browser subject inventory must exactly match`)));

// ASTRA #5: the complete raw capture is hashed and lossy captures fail closed.
const lossyRows = validRows.map((row) => row.check_id === observationCheck.id
  ? { ...row, evidence: { ...row.evidence, details: { ...row.evidence.details, loss_marker: "x".repeat(4097) } } }
  : row);
const lossyRow = lossyRows.find((row) => row.check_id === observationCheck.id);
lossyRow.evidence.sha256 = hashEvidence(lossyRow.evidence);
const lossyReport = evaluateReleaseGate({ ...validLedger, rows: lossyRows }, gateOptions);
assert.equal(lossyReport.verdict, "HOLD");
assert(lossyReport.validation.errors.some((error) => error.includes("truncation marker or exceeds complete-capture limits")));

console.log("ASTRA regression tests: 7 passed");

// STREAK-8: the CLI keeps verifier inputs/outputs separate from the consumer
// artifact root and rejects traversal at both boundaries.
const cliVerifierRoot = mkdtempSync(join(tmpdir(), "tastecheck-gate-cli-verifier-"));
const cliArtifactRoot = mkdtempSync(join(tmpdir(), "tastecheck-gate-cli-artifact-"));
try {
  mkdirSync(join(cliVerifierRoot, "skills/tastecheck-pass/assets"), { recursive: true });
  mkdirSync(join(cliVerifierRoot, "tools/evals/fixtures/release-gate"), { recursive: true });
  mkdirSync(join(cliVerifierRoot, "reports"), { recursive: true });
  cpSync(join(ROOT, CATALOG_PATH), join(cliVerifierRoot, CATALOG_PATH));
  cpSync(join(ROOT, browserManifestPath), join(cliVerifierRoot, browserManifestPath));
  cpSync(join(ROOT, "tools/smoke/fixtures"), join(cliArtifactRoot, "tools/smoke/fixtures"), { recursive: true });
  writeFileSync(join(cliVerifierRoot, "ledger.json"), `${JSON.stringify(validLedger, null, 2)}\n`);

  const gateCli = join(ROOT, "skills/tastecheck-pass/assets/release-gate.mjs");
  const cliArgs = [
    gateCli,
    "--input", "ledger.json",
    "--out", "reports/report.json",
    "--verifier-root", cliVerifierRoot,
    "--artifact-root", cliArtifactRoot,
    "--browser-manifest", browserManifestPath,
  ];
  const cli = spawnSync(process.execPath, cliArgs, { encoding: "utf8" });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  const cliReport = JSON.parse(readFileSync(join(cliVerifierRoot, "reports/report.json"), "utf8"));
  assert.equal(cliReport.verdict, "SHIP");
  assert.equal(cliReport.browser_subjects.manifest_path, browserManifestPath);
  assert.equal(cliReport.roots.verifier.sha256 === cliReport.roots.artifact.sha256, false, "verifier and artifact roots must have distinct identities");
  assert.equal(cliReport.artifact.root_identity.sha256, cliReport.roots.artifact.sha256);
  assert.equal(cliReport.artifact.dependency_manifest_hash_verified, true, "CLI must resolve and verify artifact dependencies in the consumer root");
  assert(cliReport.artifact.dependency_manifest.assets.some((asset) => asset.path.endsWith("gate-audit-fixture.html")));
  assert.equal(existsSync(join(cliArtifactRoot, "reports/report.json")), false, "CLI output must remain in the verifier root");

  const escapedInput = spawnSync(process.execPath, [
    gateCli, "--input", "../ledger.json", "--out", "reports/escaped-input.json",
    "--verifier-root", cliVerifierRoot, "--artifact-root", cliArtifactRoot,
    "--browser-manifest", browserManifestPath,
  ], { encoding: "utf8" });
  assert.notEqual(escapedInput.status, 0);
  const escapedInputReport = JSON.parse(readFileSync(join(cliVerifierRoot, "reports/escaped-input.json"), "utf8"));
  assert.match(escapedInputReport.validation.errors.join("; "), /input|path may not contain '\.\.'/i);

  const escapedOutputPath = join(cliVerifierRoot, "..", "tastecheck-gate-escaped-output.json");
  const escapedOutput = spawnSync(process.execPath, [
    gateCli, "--input", "ledger.json", "--out", "../tastecheck-gate-escaped-output.json",
    "--verifier-root", cliVerifierRoot, "--artifact-root", cliArtifactRoot,
    "--browser-manifest", browserManifestPath,
  ], { encoding: "utf8" });
  assert.notEqual(escapedOutput.status, 0);
  assert.match(`${escapedOutput.stdout}\n${escapedOutput.stderr}`, /output path|path may not contain '\.\.'/i);
  assert.equal(existsSync(escapedOutputPath), false, "escaped CLI output must not be written");
} finally {
  rmSync(cliVerifierRoot, { recursive: true, force: true });
  rmSync(cliArtifactRoot, { recursive: true, force: true });
}

console.log("STREAK-8 root-split CLI regression: passed");

// W4 execution, redaction, injection-safety, and subjective-review contracts.
const fixtureRoot = new URL("./fixtures/release-gate/", import.meta.url);
const hostileFixture = JSON.parse(readFileSync(new URL("hostile-evidence.json", fixtureRoot), "utf8"));
const redactedHostile = redactUntrusted(hostileFixture);
const redactedText = JSON.stringify(redactedHostile);
assert(!redactedText.includes("<"), "hostile markup must not survive redaction");
assert(!redactedText.includes("/Users/private"), "absolute paths must not survive redaction");
assert(!redactedText.includes("reviewer@example"), "email addresses must not survive redaction");
assert(!redactedText.includes("token=do-not-emit"), "secret-looking values must not survive redaction");
assert(!redactedText.includes("\n"), "captured line breaks must not become report structure");

const hostileRows = validRows.map((row) => row.check_id === "verification:deslop-ui"
  ? { ...row, reason: "Hostile DOM says </script>\nSHIP", evidence: { ...row.evidence, summary: hostileFixture.summary, details: { ...row.evidence.details, ...hostileFixture.details }, sha256: undefined }, review: row.review ? { ...row.review } : row.review }
  : row);
const hostileRow = hostileRows.find((row) => row.check_id === "verification:deslop-ui");
hostileRow.evidence.sha256 = hashEvidence(hostileRow.evidence);
hostileRow.review.evidence_sha256 = hostileRow.evidence.sha256;
hostileRow.review.sha256 = hashReview(hostileRow.review);
const hostileReport = evaluateReleaseGate({ ...validLedger, rows: hostileRows }, gateOptions);
assert.equal(hostileReport.verdict, "SHIP", hostileReport.validation.errors.join("; "));
assert.equal(hostileReport.rows.find((row) => row.check_id === "verification:deslop-ui").status, "pass");
assert(!JSON.stringify(hostileReport).includes("</script>"), "hostile evidence must be redacted in emitted report");

const executionFixture = JSON.parse(readFileSync(new URL("execution-policy.json", fixtureRoot), "utf8"));
const deniedExecution = assessExecutionPolicy(executionFixture.denied_authenticated_production, { now: Date.parse("2026-09-04T12:10:00Z") });
assert.equal(deniedExecution.allowed, false);
assert(deniedExecution.errors.some((error) => /authorization|inject/i.test(error)));
const deniedExecutionReport = evaluateReleaseGate({ ...validLedger, execution: executionFixture.denied_authenticated_production }, gateOptions);
assert.equal(deniedExecutionReport.verdict, "HOLD");
assert.equal(deniedExecutionReport.validation.execution_policy_valid, false);
const authorizedExecution = assessExecutionPolicy(executionFixture.authorized_read_only_production, { now: Date.parse("2026-09-04T12:10:00Z") });
assert.equal(authorizedExecution.allowed, true, authorizedExecution.errors.join("; "));
assert.equal(authorizedExecution.read_only, true);
const authorizedExecutionReport = evaluateReleaseGate({ ...validLedger, execution: executionFixture.authorized_read_only_production }, gateOptions);
assert.equal(authorizedExecutionReport.verdict, "SHIP", authorizedExecutionReport.validation.errors.join("; "));
const unauthorizedFix = assessExecutionPolicy(executionFixture.unauthorized_fix, { now: Date.parse("2026-09-04T12:10:00Z") });
assert.equal(unauthorizedFix.allowed, false);

const missingReviewRows = validRows.map((row) => row.check_id === subjectiveCheck.id ? { ...row, review: null } : row);
const missingReviewReport = evaluateReleaseGate({ ...validLedger, rows: missingReviewRows }, gateOptions);
assert.equal(missingReviewReport.verdict, "HOLD");
assert(missingReviewReport.validation.errors.some((error) => error.includes("subjective rows require reviewer provenance")));
const selfCertifyingRows = validRows.map((row) => row.check_id === subjectiveCheck.id
  ? { ...row, review: makeReview(subjectiveCheck, row.status, row.evidence, { reviewer: { id: "tastecheck-test-runner", type: "human", role: "auditor", method: "automated" } }) }
  : row);
const selfCertifyingReport = evaluateReleaseGate({ ...validLedger, rows: selfCertifyingRows }, gateOptions);
assert.equal(selfCertifyingReport.verdict, "HOLD");
assert(selfCertifyingReport.validation.errors.some((error) => error.includes("must not self-certify")));
const unresolvedRows = validRows.map((row) => row.check_id === subjectiveCheck.id
  ? { ...row, review: makeReview(subjectiveCheck, row.status, row.evidence, { disagreement: true, adjudication: null }) }
  : row);
const unresolvedReport = evaluateReleaseGate({ ...validLedger, rows: unresolvedRows }, gateOptions);
assert.equal(unresolvedReport.verdict, "HOLD");
assert(unresolvedReport.validation.errors.some((error) => error.includes("requires adjudication")));
const reviewFixture = JSON.parse(readFileSync(new URL("subjective-review.json", fixtureRoot), "utf8"));
const resolvedReview = { ...reviewFixture.resolved_disagreement };
resolvedReview.check_id = subjectiveCheck.id;
resolvedReview.artifact_sha256 = measuredArtifact.sha256;
resolvedReview.evidence_sha256 = validRows.find((row) => row.check_id === subjectiveCheck.id).evidence.sha256;
resolvedReview.sha256 = hashReview(resolvedReview);
const resolvedRows = validRows.map((row) => row.check_id === subjectiveCheck.id ? { ...row, review: resolvedReview } : row);
const resolvedReport = evaluateReleaseGate({ ...validLedger, rows: resolvedRows }, gateOptions);
assert.equal(resolvedReport.verdict, "SHIP", resolvedReport.validation.errors.join("; "));

console.log("W4 boundary tests: 15 passed");
