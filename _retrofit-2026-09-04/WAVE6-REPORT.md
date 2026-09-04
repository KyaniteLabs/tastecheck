# WAVE 6 report

Status: DONE_WITH_CONCERNS

## Scope

Implemented W6 only: MR-009 public release-status binding and MR-012 browser/accessibility evidence qualification. No installs, network access, or direct Git CLI commands were run; the projector necessarily uses the existing source-digest helper, which invokes Git internally. The known `ValidatePublicTests` markdown-link baseline was not chased.

## Per-row status

- MR-009: implemented. Added a closed public-status schema and deterministic projector. Exact manifest-pinned receipt bytes, receipt artifact hashes, source-tree freshness, execution state, and required browser coverage now derive `PASS`, `HOLD`, or `UNVERIFIED`. README and landing-page status markers are generated from the projection; the static `Gate: PASS` and green verified badge were removed.
- MR-012: implemented with an honest current result. Browser and accessibility claims are receipt-bound and require the complete 495-check browser matrix, including reduced-motion, keyboard-focus, a11y-audit, gate-audit, and console-error checks. The existing receipt is stale for the current source revision, so the generated public status is `UNVERIFIED`; historical effectiveness remains `BLOCKED`.

## Evidence

- `evals/receipts/v1/public-release-status.json`: generated projection; overall `unverified`; engineering/browser/accessibility `unverified`; effectiveness `blocked`.
- `contracts/v1/release-public-status.schema.json`: closed schema for the projection and its exact receipt evidence references.
- `tools/release/project-public-status.mjs`: projector/checker with fail-closed missing, malformed, stale, failed, hash-mismatch, artifact, and out-of-root handling.
- `tools/release/test-public-status.mjs`: mutation coverage for stale, failed, and missing receipts plus generated surface status.

## Test tail

Passed offline:

- `node tools/release/test-public-status.mjs`
- `node tools/release/project-public-status.mjs`
- `node tools/release/check-effectiveness-claims.mjs`
- `node tools/release/test-effectiveness-claims.mjs`
- `node tools/release/test-effectiveness-projections.mjs`
- `node --check` for the three changed release JavaScript modules

Blocked by environment, without installing:

- `npm run test:release-contracts`: new public-status test passed; existing `test-check.mjs` stops on missing `ajv`.
- `npm run verify:claims`: stops on missing `ajv` imported by `tools/release/check.mjs`.
- `npm run verify:release`: stops on missing `ajv` imported by `tools/release/check.mjs`.
- `npm test`: dependency preflight reports missing `node_modules/ajv`, `node_modules/playwright`, and the Playwright CLI.

## Exact changed-file list

- `contracts/v1/release-public-status.schema.json`
- `evals/receipts/v1/public-release-status.json`
- `tools/release/project-public-status.mjs`
- `tools/release/test-public-status.mjs`
- `tools/release/check.mjs`
- `package.json`
- `README.md`
- `index.html`
- `_retrofit-2026-09-04/WAVE6-REPORT.md`

## IMPROVEMENTS

1. Provision locked `ajv` and `playwright` dependencies in worker setup; the required acceptance lane stopped before exercising existing release contracts.
2. Rerun browser/e2e producers after the orchestrator commits the final W6 source; the current receipts intentionally remain `UNVERIFIED` because their source digest predates this change.
