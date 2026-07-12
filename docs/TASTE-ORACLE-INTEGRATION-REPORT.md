# Taste Oracle integration hardening report

Date: 2026-07-11

Scope: post-review integration hardening for the `deslop-ui` vertical slice. This report is implementation evidence, not release evidence.

## TDD receipts

- RED — statistics and schema tests rejected the previous caller-authored `provenance: "collected"` / `release_evidence` contract.
- RED — the collector end-to-end test failed with `ERR_MODULE_NOT_FOUND` before `collect-observations.mjs` existed.
- RED — capture regression reported `Missing expected rejection` when a second manifest replaced an accepted run directory.
- RED — authority regressions accepted an unmask map bound to another packet path/hash, accepted tampered collected observations, and allowed self-authored provenance to reach analysis.
- RED — semantic result mutations could flip disagreement, sufficiency, cluster arithmetic, or a justified directional status without rejection.
- GREEN — focused statistics, observation-schema, analysis-result-schema, judge, collector end-to-end, and capture-regression suites pass.

## Boundaries added

- A validated-panel collector unblinds one requested arm pair and emits v2 observations with packet, manifest, result, viewport, family, citation, and file-hash provenance.
- Ties, abstentions, and family disagreement remain explicit. Abstentions are counted but not scored.
- Observation and analysis outputs are permanently `milestone_only`; no caller-controlled release eligibility field exists.
- Public-safety validation is recursive and rejects local paths and email-shaped text even when wrapped in underscores. Opaque role-prefixed observation, family, result, and judge IDs are required.
- Filesystem-backed judge validation checks manifest structure plus artifact existence and byte hashes.
- A successful capture directory is immutable. A later capture must use a fresh directory.
- Analysis output has a documented v2 result schema.

## Evidence limits

- Completed results in the end-to-end test are synthetic fixtures written to a unique ignored temporary run directory solely to exercise the file-backed seam. They are deleted after the test, are not canonical results, and are not committed as evidence.
- This lane does not alter or clear the 1.0 release gate.

## Independent integration-review closure

- Authoritative panel validation and collection now accept repo-relative file paths only and hash exact bytes. In-memory structural validation is explicitly non-authoritative.
- End-to-end coverage writes a self-contained ignored run with real packet, unmask, manifest, screenshot, and result files, then invokes judge, collector, and analyzer CLIs. Corrupt and missing artifacts fail through those same seams.
- Inference now uses equal-family, within-family result-cluster bootstrap. Per-family diagnostics and disagreement are explicit; disagreement or fewer than two analyzable clusters per family cannot produce directional support.
- Analysis output has both a closed JSON Schema provenance contract and runtime semantic validation for relationships JSON Schema cannot express.
- Unmask authority binds the exact packet path and packet-file hash. Certification parses and hashes one safely opened byte buffer per packet, unmask, manifest, and result; the analyzer regenerates collected receipts from those paths and requires canonical equality.
- `npm run test:oracle` is included in default `npm test`.

## Fresh browser receipt

- Run directory: `.omx/taste-oracle/integration-hardening-20260711-01`
- Screenshots: 6
- Manifest file SHA-256: `a17176f80e1292e50cb703e2233126d1a1a5c5c0a80580ef8c5400baac7b7fed`
- Manifest canonical SHA-256: `e39fe3d5adcb89719ad16a25ef53852cacdd93fe09677b07a082ed7b6d0017f3`
- Visual inspection: current-arm mobile and desktop renders were inspected at original resolution; text and navigation were legible, no probe was clipped, and no font fallback failure was visible.
- Release check: BLOCKED as required. The existing version, pinned receipt, semantic-verdict, terminal synthesis, browser-receipt, and end-to-end receipt gates remain uncleared.
