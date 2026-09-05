Status: DONE_WITH_CONCERNS

Verdict: CONFIRM, confidence 9/10. The round-6 acceptance chain is green at source digest `327b70be16c06672c488b9c2e63b7a4d39c2c1d810ccf49130846dd2bc6ce9da`; no release-blocking regression or false green survived the counter-check.

## Pre-registered criteria

Confirm only if `npm run test:structural` passes with the zero-install structural preflight, the stability test compares every projected output from two executions, all mutable receipt digests and manifest pins equal the final source, and two `npm run finalize` executions are byte-idempotent. Refute on any failure, omitted projected surface, stale pin, or second-run mutation.

## Findings

- `npm run test:structural` exited 0. Its structural dependency preflight reported `no installation performed`; the full lane passed, including project-facts stability, public-status stability, the final-source receipt gate, contract checks, verification checks, and mutation fixtures.
- `tools/release/test-public-status-stability.mjs:12-16,93-128` now tests outputs, not projector source. It hashes and byte-compares `evals/receipts/v1/public-release-status.json`, `README.md`, and `index.html` after each of two projector executions, and asserts that the second run changes no fixture file.
- Independent reconciliation computed final source digest `327b70be16c06672c488b9c2e63b7a4d39c2c1d810ccf49130846dd2bc6ce9da`. All 6/6 mutable receipts carry it, all 6/6 manifest SHA-256 pins match their receipt bytes, public status carries it, and `verifyFinalSourceReceiptDigests` returned `ready` with zero errors.
- Two consecutive `npm run finalize` executions exited 0. SHA-256 snapshots of the six receipts, manifest, public status, README, and index were identical after run one and run two. The pre-run snapshot already matched run one, so HEAD was finalized before review.
- The projected public release status remains honestly `UNVERIFIED` because the browser receipt omits 33 currently required coverage checks; historical effectiveness remains `BLOCKED`. This is not a false green in the requested structural/finalization chain: the public surface preserves those non-passing claims instead of promoting them.
- Grok's remaining cure is closed: receipts are now pinned to the final source digest. Its two improvement notes are useful ergonomics/CI hardening, not blockers to this acceptance chain.

## Counter-case and justice pass

The strongest case against green is that `finalize` rewrites receipt source fields without rerunning the underlying producers, while public status still reports incomplete browser coverage. That limits what the receipts prove about current live execution, but the reviewed claim is source freshness, deterministic projection, and honest status—not renewed browser evidence. Calling the product evidence fully verified would be wrong; calling this bounded acceptance chain green is supported. A false positive would shift risk to release consumers, so the public `UNVERIFIED`/`BLOCKED` states must remain visible.

Calibration log: 2026-09-05 — claim: round-6 structural/finalize retrofit is fully green; verdict: CONFIRM; confidence: 9/10.

## IMPROVEMENTS

1. Add the HEAD/source receipt-pin comparison to CI or a commit hook. WHY: Grok's prior failure arose when source changed after finalization. FIX: run the dependency-free final-source gate against the final committed tree before accepting the branch.
2. Make the stale-digest failure concise and actionable. WHY: repeated per-receipt errors obscure the one remediation. FIX: print live and pinned digests once, followed by `run npm run finalize`.
3. Separate source rebinding from evidence regeneration in naming and documentation. WHY: `finalize` updates source fields without rerunning browser producers, which can be mistaken for fresh execution proof. FIX: label these as source-bound retained receipts and require producer reruns for any claim of current live coverage.

FULLY-GREEN: yes
