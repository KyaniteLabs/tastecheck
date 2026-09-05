# Streak-3 remediation report

Status: DONE_WITH_CONCERNS

Timestamp: 2026-09-05T02:51:05Z

## Implemented

- Split the project-facts two-run byte-stability proof into
  `tools/release/test-project-facts.mjs`, which imports only Node standard
  library modules, and added it to `npm run test:structural`.
- Isolated `verifyFinalSourceReceiptDigests` and its producer registry in the
  dependency-free `tools/release/final-source-receipt-gate.mjs` module.
  `tools/release/check.mjs` re-exports the gate and lazy-loads Ajv only for
  live-receipt schema validation; missing Ajv therefore blocks that validation
  instead of preventing the digest gate from loading.
- Added `tools/release/test-final-source-receipt-gate.mjs` with valid, stale
  receipt, stale public-status, and source-mutation cases plus a real
  dependency-free `verify-chain` subprocess check.
- Refreshed all six mutable engineering receipt source digests and manifest
  pins, then projected `evals/receipts/v1/public-release-status.json` through
  the canonical public-status projector.

## Verification

- `npm run test:structural` — PASS; includes the two-run projector proof and
  the final-source receipt gate proof.
- `node tools/release/test-project-facts.mjs` — PASS.
- `node tools/release/test-final-source-receipt-gate.mjs` — PASS without
  optional dependencies.
- `node tools/release/check.mjs --mode=verify-chain` — PASS with final source
  digest `471eb983d24f27f3d91bc639c73f24b26ecec3bfe85a31926a19eb82bc162f14`.
- Final reconciliation — 6/6 engineering receipt source digests and pins,
  plus public status source digest, match; zero mismatches.
- No installation, network, commit, or other Git mutation was performed.

## Concern

The locked optional dependency tree is absent, so the browser/e2e producers
and Ajv-backed full release-contract tests were not rerun. Existing receipt
pass evidence was retained and source-bound to the current tree through the
dependency-free freshness gate. Public status remains `UNVERIFIED` honestly.

## IMPROVEMENTS

1. Add one canonical no-install finalization command that refreshes all mutable
   receipt digests, updates manifest pins, projects public status, and runs
   `verify-chain`. WHY: manual refresh ordering is easy to omit after a final
   source edit. FIX: make the ordered refresh-and-gate sequence a checked-in
   script used by release handoffs.
2. Provision the lockfile-resolved Ajv and Playwright tree before full release
   verification. WHY: the environment cannot rerun browser/e2e or schema-backed
   producer evidence. FIX: provide a prebuilt dependency cache or CI lane
   without permitting workers to install packages.
