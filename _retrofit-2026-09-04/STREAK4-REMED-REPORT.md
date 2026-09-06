# Streak-4 remediation report

Status: DONE_WITH_CONCERNS

## Implemented

- Added `tools/release/test-public-status-stability.mjs`, an AJV-free test
  that builds an isolated temporary fixture and executes
  `project-public-status.mjs --write` twice.
- The test hashes and byte-compares `public-release-status.json`, `README.md`,
  and `index.html` after both runs.
- The test snapshots every fixture file and asserts that the first run changes
  only the three projected outputs and the second run changes nothing.
- Wired the strengthened test into `npm run test:structural`.

## Verification

- `node tools/release/test-public-status-stability.mjs` — PASS.
- Deliberately added a nondeterministic value to the projector's generated gate,
  ran the new test, observed the expected byte-stability assertion failure, and
  reverted the mutation.
- `npm run test:structural` — the strengthened stability test passes, but the
  full lane stops at `test-final-source-receipt-gate.mjs`: all six engineering
  receipts and the public-status projection have stale source digests. This is
  pre-existing evidence freshness debt outside this single test remediation.
- No installs, network access, commits, or pushes.

## IMPROVEMENTS

1. Add a shared temporary Git-fixture helper for projector tests. WHY: each
   projector test currently recreates fixture setup and cleanup independently.
   FIX: centralize fixture creation and whole-tree snapshot helpers under
   `tools/test/lib/`.
2. Make the structural lane report completed checks after a later failure. WHY:
   a failing downstream verifier can hide that the strengthened stability proof
   already passed. FIX: emit a machine-readable check ledger for each structural
   command before exiting.
