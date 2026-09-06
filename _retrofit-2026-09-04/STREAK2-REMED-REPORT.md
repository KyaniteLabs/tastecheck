# Streak-2 remediation report

Status: BLOCKED

Timestamp: 2026-09-05T01:22:47Z

## Implemented

- `tools/release/project-facts.mjs` now recursively sorts JSON object keys, uses one stable newline-terminated serialization, and compares generated JSON byte-for-byte. `skills.json` and `contracts/v1/commands.json` were regenerated from the canonical release facts.
- `tools/release/test-check.mjs` now runs the projector twice under different time zones and environment values and asserts identical bytes. It also covers valid final-source receipt verification, stale engineering/public-status receipts, and source mutation during the gate.
- `tools/release/check.mjs` exposes `verifyFinalSourceReceiptDigests`; `verify:chain` runs it against all six mutable engineering receipts and the public-status receipt, with a second source snapshot to catch changes during verification. `verify:release` runs the chain first.
- `MASTER-REGISTER.md` now records MR-012 as **CONTAINED — NOT CLOSED**. `public-release-status.json` was regenerated against the current source and remains honestly `UNVERIFIED`.

## Verification

Passed: release inventory, skill verification, skill lint, landing verification, integration verification, `npm run test:contracts`, public-status projection, JavaScript syntax checks, `git diff --check`, and an independent two-run projector byte-stability probe.

Blocked or not green:

- `npm test` stops at dependency preflight: `ajv` and `playwright` are absent. No install or network action was taken.
- `npm run test:release-contracts`, `npm run verify:chain`, and `npm run verify:claims` cannot load `ajv` in this worktree, so the new gate tests and runtime gate could not execute here.
- `eval:context-budget` reports pre-existing violations for `humanize-copy` (20% growth) and `tastecheck-pass` (76% growth); no scope-expanding skill rewrite was made.
- The five existing pass receipts for browser, e2e, mechanical, security, and clean-clone still carry the prior source digest. The current digest is `9b04d4d9179ec208c4341984cd86c8a458cd4cf804d8199e2b9f6811d55e4c86`; these receipts carry `d6561d5371b263a5e84f15fd392b25da4045133e6015edeff92698c114df825b`. They were not rewritten without rerunning their producers.

MR-012 therefore remains safely contained, not closed: current browser/e2e execution proof and the full release receipt chain still require a provisioned dependency/browser environment. No false closure or execution claim was added.

## IMPROVEMENTS

1. Provision locked `ajv` and `playwright` before dispatch. WHY: dependency preflight stopped both the new gate tests and the release chain before exercising them. FIX: make the worker setup provide the lockfile-resolved dependency tree without requiring the worker to install or access the network.
2. Split `verify-chain` into a dependency-free entrypoint. WHY: a source-digest freshness gate cannot run when an unrelated schema validator import is unavailable. FIX: isolate receipt-digest verification from live-receipt schema validation, while keeping the full release lane strict.
3. Add one finalization command that regenerates all mutable receipts, updates manifest pins, projects public status, and reruns `verify:chain`. WHY: five otherwise passing receipts became stale after source changes. FIX: make final-source receipt refresh and post-refresh verification one explicit, ordered operation.
