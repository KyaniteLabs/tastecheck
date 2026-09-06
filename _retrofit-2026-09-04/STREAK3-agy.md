# STREAK round 3 — Grok 4.6 independent review (HEAD def1eef)

Status: DONE_WITH_CONCERNS

HEAD: `def1eef60043222927c9ae574d7ee3861b34106f` on `retrofit/2026-09-04`

## Method

Re-ran the requested acceptance chain and independently re-probed the two SOL remediations without trusting prior reports. No installs, no network, no git mutations.

## Acceptance chain

`npm run test:structural` — PASS (preflight structural, inventory `--check`, contracts, verify, lint, landing, integration, gate-audit, NIMA, mutation 4/4 killed).

This lane does **not** execute `tools/release/test-check.mjs`, `verify:chain`, or `verifyFinalSourceReceiptDigests`. Structural preflight also does not require `ajv`.

## Reproducibility test — real projector, unhooked official test

Independent two-run probe (UTC then Pacific/Honolulu `--write` on a fixture tree): **identical SHA-256** for all eight projected surfaces. Committed files match the projector byte-for-byte (`skills.json`, `contracts/v1/commands.json`, and six marker files). `project-facts.mjs --check` now compares raw strings (`actual !== json(expected)`), not parsed objects.

The dedicated two-run test in `tools/release/test-check.mjs` (`testProjectFactsByteStability`) is a real proof **if it runs**. It did not: `Cannot find package 'ajv'`. That test is not on `test:structural`.

Verdict: SOL P1 (non-byte-reproducible commands.json) is closed in the generator and committed artifacts. The *named* two-run test is not part of the stated acceptance chain and cannot execute in this worktree.

## Receipt-refresh gate — real function, not a last-commit proof

`verifyFinalSourceReceiptDigests` does exact `source_tree_sha256` equality against one snapshot plus a second snapshot for mid-gate mutation. Unit coverage in `test-check.mjs` includes valid, stale engineering, stale public-status, and changing-source cases. `verify:chain` / `verify:release` call it.

It is not a live proof here:

- `check.mjs` imports `ajv` at module load, so `npm run verify:chain` cannot start.
- Independent digest vs receipts (current tree `7d217793a73d9b42ece9373f323ddf400906cd427ade539bb93ecd9f9c2e5d57`): **all six engineering receipts and public-release-status are STALE**. Browser/e2e/mechanical/security/clean-clone still carry `d6561d53…`; context-budget and public status carry `9b04d4d9…`.
- A passing `test:structural` therefore does not imply receipts match HEAD. The last commit still left receipts stale. MR-012 remains contained, not closed.

If the gate ran against this tree it would correctly fail. That is fail-closed logic, not a green proof.

## False-green hunt

- Structural green is honest for its scope. It is a false green **only if** treated as closing SOL P1/P2.
- Public status remains `UNVERIFIED`; no public PASS claim observed from this lane.
- Mutation score 4/4 is the same four W5 fixtures as before; not a new gap.

## Findings

1. **P1 closed in artifacts, not in the structural chain.** Byte-stable projection is independently true. The two-run test is off the acceptance path and blocked on `ajv`.
2. **P2 / receipt-refresh gate is unimplemented as an enforced last-commit gate.** Code exists; receipts are stale; `verify:chain` cannot run without `ajv`; structural does not call it.
3. **No new regression in `test:structural`.** Inventory, contracts, landing, lint, NIMA HOLD, mutation kill-rate unchanged.

FULLY-GREEN: no — findings: two-run projector test and receipt-refresh gate are not executed by `test:structural` and cannot load without `ajv`; all mutable release receipts remain stale vs current source digest `7d217793…`; MR-012 still not closed.

## IMPROVEMENTS

1. **Put the two-run byte test on a dependency-free script.** WHY: `test-check.mjs` cannot even import because `ajv` is a top-level import for unrelated schema tests. FIX: split `testProjectFactsByteStability` into a Node-stdlib file and add it to `test:structural`.
2. **Split digest verification off `Ajv`.** WHY: `verify:chain` dies before comparing hashes. FIX: load schema validators only in live-receipt modes; keep `verifyFinalSourceReceiptDigests` import-free.
3. **Fail structural (or a required pre-commit lane) when receipts are stale, or stop claiming a last-commit gate.** WHY: HEAD still has six stale pass receipts. FIX: either regenerate receipts after the last source change or make the gate block the lane that people treat as green.
