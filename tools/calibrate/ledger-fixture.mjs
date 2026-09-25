#!/usr/bin/env node
/**
 * Calibration corpus — shared valid-ledger builder.
 *
 * Builds a complete, gate-verifiable deep-lane ledger for an artifact the way
 * tools/evals/test-tastecheck-gate.mjs does (the suite-proven SHIP fixture),
 * so corpus cases only describe the DEFECT mutation applied on top. Every
 * mutation is named after the real org defect class it reproduces and each
 * case file carries the desk-of-record citation for that class.
 */
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CATALOG_PATH,
  ROOT,
  REQUIRED_VIEWPORTS,
  hashEvidence,
  hashProvenance,
  hashReview,
  hashSubjectInventory,
  inspectArtifact,
  loadBrowserSubjectAuthority,
  loadCheckCatalog,
} from "../../skills/tastecheck-pass/assets/release-gate.mjs";

const BROWSER_MANIFEST_PATH = "tools/evals/fixtures/release-gate/browser-subject-manifest.json";
const CAPTURED_AT = "2026-09-25T12:00:00Z";

/**
 * Build a fresh consumer artifact root. With `linked` the artifact is an entry
 * HTML plus a linked stylesheet, so cases can reproduce the
 * stale-linked-artifact class (stylesheet changes after the ledger was cut).
 */
export function makeArtifactRoot({ linked = false } = {}) {
  const artifactRoot = mkdtempSync(join(tmpdir(), "tastecheck-corpus-"));
  cpSync(join(ROOT, "tools/smoke/fixtures"), join(artifactRoot, "tools/smoke/fixtures"), { recursive: true });
  if (linked) {
    writeFileSync(join(artifactRoot, "index.html"), '<!doctype html><link rel="stylesheet" href="./styles.css"><main>corpus artifact</main>\n');
    writeFileSync(join(artifactRoot, "styles.css"), "body { color: #111; }\n");
  }
  return artifactRoot;
}

export function disposeArtifactRoot(artifactRoot) {
  rmSync(artifactRoot, { recursive: true, force: true });
}

export function buildValidLedger({ artifactRoot = ROOT, artifactPath = "tools/smoke/fixtures/gate-audit-fixture.html" } = {}) {
  const loadedCatalog = loadCheckCatalog({ root: ROOT });
  const probe = inspectArtifact({ type: "file", path: artifactPath }, { root: artifactRoot });
  const artifactInput = { type: "file", path: artifactPath, dependency_manifest: probe.artifact.dependency_manifest };
  const measuredArtifact = inspectArtifact(artifactInput, { root: artifactRoot }).artifact;
  const browserAuthority = loadBrowserSubjectAuthority({ root: ROOT, manifestPath: BROWSER_MANIFEST_PATH, requiredViewports: REQUIRED_VIEWPORTS });
  if (!browserAuthority.valid) throw new Error(`browser subject authority invalid: ${browserAuthority.errors.join("; ")}`);

  const inventory = {
    frozen_at: CAPTURED_AT,
    subjects: [],
    coverage: Object.fromEntries(loadedCatalog.catalog.checks.map((check) => {
      if (!check.required) return [check.id, []];
      if (check.observation.coverage === "browser") return [check.id, browserAuthority.members.map((member) => ({ ...member }))];
      if (check.observation.coverage === "control-state") return [check.id, [{ id: "control:fixture|state:default", control: "fixture-control", state: "default" }]];
      return [check.id, [{ id: check.id }]];
    })),
  };
  inventory.sha256 = hashSubjectInventory(inventory);

  const makeEvidence = (check, status = "pass", overrides = {}) => {
    const mode = check.manual_inspector_required ? "manual" : "automated";
    const members = inventory.coverage[check.id] || [];
    const evidence = {
      mode,
      summary: `${check.label} evidence for ${status}`,
      details: {
        observations: status === "n/a"
          ? []
          : members.map((member) => ({
            subject_id: member.id,
            ...Object.fromEntries(check.observation.fields.map((field) => [field, check.observation.type === "contrast"
              ? [{ kind: "body", ratio: 7.2, foreground: "#111", background: "#fff", theme: "light" }]
              : true])),
          })),
      },
      ...(status === "n/a" ? { subject: check.applicability.subject, subject_absent: true } : {}),
      ...overrides,
    };
    evidence.sha256 = hashEvidence(evidence);
    return evidence;
  };

  const makeReview = (check, status, evidence, overrides = {}) => {
    const review = {
      check_id: check.id,
      artifact_sha256: measuredArtifact.sha256,
      evidence_sha256: evidence.sha256,
      reviewer: { id: "corpus-reviewer-1", type: "human", role: "independent-auditor", method: "rubric review" },
      rubric: { id: `rubric-${check.stage}`, version: "1.0", criteria: { evidence_bound: true, decision_bound: true } },
      independent: true,
      decision: status,
      disagreement: false,
      adjudication: null,
      reviewed_at: CAPTURED_AT,
      ...overrides,
    };
    review.sha256 = hashReview(review);
    return review;
  };

  const makeRow = (check, status = "pass", evidenceOverrides = {}, provenanceOverrides = {}) => {
    const evidence = makeEvidence(check, status, evidenceOverrides);
    const provenance = {
      artifact_identity: measuredArtifact.identity,
      artifact_sha256: measuredArtifact.sha256,
      dependency_manifest_sha256: measuredArtifact.dependency_manifest_sha256,
      subject_inventory_sha256: inventory.sha256,
      captured_at: CAPTURED_AT,
      tool: { name: "tastecheck-corpus-runner", version: "1.0.0" },
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
  };

  const rows = loadedCatalog.catalog.checks.map((check) => (check.required ? makeRow(check) : makeRow(check, "n/a")));
  const ledger = {
    schema_version: 1,
    catalog: { path: CATALOG_PATH, sha256: loadedCatalog.sha256 },
    artifact: artifactInput,
    browser_subjects: {
      manifest_path: browserAuthority.manifest_path,
      manifest_sha256: browserAuthority.manifest_sha256,
      required_viewports: [...browserAuthority.required_viewports],
    },
    subject_inventory: inventory,
    rows,
  };
  return {
    ledger,
    catalog: loadedCatalog.catalog,
    measuredArtifact,
    inventory,
    makeRow,
    makeEvidence,
    makeReview,
    gateOptions: { verifierRoot: ROOT, artifactRoot, browserManifestPath: BROWSER_MANIFEST_PATH, requiredViewports: REQUIRED_VIEWPORTS },
  };
}

/** Re-hash a row after its evidence was mutated (keeps the ledger internally consistent). */
export function rehashRowEvidence(row) {
  row.evidence.sha256 = hashEvidence(row.evidence);
  if (row.review) {
    row.review.evidence_sha256 = row.evidence.sha256;
    row.review.sha256 = hashReview(row.review);
  }
  return row;
}

/** Replace the row for `checkId`, keeping row order. */
export function withRow(ledger, checkId, mutator) {
  const row = ledger.rows.find((item) => item.check_id === checkId);
  if (!row) throw new Error(`no ledger row for ${checkId}`);
  mutator(row);
  return ledger;
}

export const GATE_OPTIONS_BROWSER_MANIFEST = BROWSER_MANIFEST_PATH;
