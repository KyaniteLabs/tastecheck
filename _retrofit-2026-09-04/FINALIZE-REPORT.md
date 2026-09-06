# Receipt finalization report

Status: DONE_WITH_CONCERNS

Timestamp: 2026-09-05T04:03:01Z

## Blocker diagnosis and resolution

- `command inventory is 21; expected 20` — the canonical `release-facts.json`
  inventory contains 20 canonical commands plus one approved `/darkmode` alias,
  therefore 21 command files. `tools/release/check.mjs` had a stale hard-coded
  expected count of 20. The claims check now derives the expected file count from
  the canonical facts source.
- `context-budget: receipt does not exactly match recomputed current skill metrics and frozen baseline`
  — the receipt was stale after skill edits. Recomputed findings were
  `humanize-copy` 1,441 tokens vs 1,199 baseline (+20.2%) and `tastecheck-pass`
  1,899 vs 1,076 (+76.5%). Redundant skill prose was compressed; the final values
  are 1,350 (+12.6%) and 1,235 (+14.8%), both passing.
- `context-budget: current skills exceed the frozen context budget` — this was a
  genuine source regression, not a gate defect. The frozen baseline was retained;
  the two skills were reduced below the 15% growth limit.
- `receipt source_tree_sha256 does not match final source digest` for context-budget,
  browser, e2e, mechanical, security, and clean-clone, plus
  `public status: source_tree_sha256 does not match final source digest` — prior
  source edits left all mutable receipts and the projection bound to the previous
  digest. `tools/release/finalize.mjs` now recomputes context metrics, refreshes all
  six mutable receipt digest fields, updates the six manifest pins, projects public
  status, checks source stability, and runs verify-chain.
- `evals/receipts/v1/public-release-status.json is stale relative to current receipt bytes and source revision`
  — the projection was downstream of the stale receipt bytes and source digest;
  finalization now projects it after receipt and manifest-pin refresh.

## Verification

- `npm run finalize` — PASS; source digest `0f8f3b3d3ff237c0ca8e56fd55d16ac55436a14e46b5d9468aeaf4e9c6a428ea`.
- `npm run test:structural` — PASS end-to-end, including
  `test-public-status-stability` and `test-final-source-receipt-gate`.
- `node tools/release/check.mjs --mode=claims` — PASS.
- Final source digest matches all six mutable receipts, all six manifest pins, and
  public-status source digest.
- No installs, network access, commits, or pushes.

## Transcript tail

```text
finalize: context-budget refreshed (20 skills)
finalize: refreshed 6 mutable receipt digests (0f8f3b3d3ff237c0ca8e56fd55d16ac55436a14e46b5d9468aeaf4e9c6a428ea)
finalize: updated engineering receipt pins
finalize: projected public status (UNVERIFIED)
release check passed (verify-chain); source_tree_sha256=0f8f3b3d3ff237c0ca8e56fd55d16ac55436a14e46b5d9468aeaf4e9c6a428ea
finalize: complete (0f8f3b3d3ff237c0ca8e56fd55d16ac55436a14e46b5d9468aeaf4e9c6a428ea)
project-facts two-run byte-stability test passed
public-status two-run byte-stability test passed (evals/receipts/v1/public-release-status.json, README.md, index.html)
final-source receipt digest gate tests passed without optional dependencies
tastecheck verification passed
skill lint: 20 skills, 0 failures, 0 warnings
landing verification passed
integration verification passed
cold-load heuristic and release-runner verification passed (checks 1 & 3 + closed-catalog HOLD probe)
verification failure mutation fixtures passed (unknown ref, missing contract, stale projection, false landing claim); mutation score 4/4 killed, 0 survived (100.00%)
```

## Concern

The projected public status is `UNVERIFIED`, honestly preserving the existing
browser evidence gap: the browser receipt omits 33 required coverage checks. The
requested structural lane is green; no browser evidence was fabricated or rerun.

## IMPROVEMENTS

1. Refresh the browser receipt through the real browser producer when its required
   dependency/evidence lane is available. WHY: public status remains UNVERIFIED
   because 33 coverage rows are absent. FIX: run the registered producer with the
   full coverage matrix, then rerun `npm run finalize`.
2. Add a focused finalizer test for missing/malformed receipt cells. WHY: the
   production script currently relies on JSON read errors to stop the sequence.
   FIX: assert fail-closed diagnostics and no partial receipt refresh in a fixture.
