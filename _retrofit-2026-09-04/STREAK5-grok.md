# STREAK 5 — Grok independent review

HEAD: `3518b0059a07b595a7f8c12c0d4e1085bcaa77e8`
branch: `retrofit/2026-09-04`
date: 2026-09-05

## Verdict

FULLY-GREEN: no

`npm run test:structural` fails on HEAD. Receipts are not fresh at the exact HEAD source digest. Two-run projector tests and the ajv-free digest gate itself are structurally sound.

## Method (fresh on HEAD)

- Read-only review of `test:structural`, two-run tests, digest gate, `finalize.mjs`.
- Ran `npm run test:structural` (no installs).
- Computed live vs HEAD `computeSourceTreeSha256` vs receipt `source_tree_sha256`.
- Ran `npm run finalize` twice, compared full working-tree content hashes, then restored the 8 mutated files to HEAD.

## Findings

### 1. Receipts stale at exact HEAD (blocks structural lane)

Live source digest and HEAD digest match:

`327b70be16c06672c488b9c2e63b7a4d39c2c1d810ccf49130846dd2bc6ce9da`

Pinned in mechanical / public-status / context-budget (and the other four mutable receipts):

`0f8f3b3d3ff237c0ca8e56fd55d16ac55436a14e46b5d9468aeaf4e9c6a428ea`

`test-final-source-receipt-gate.mjs` unit cases pass, then `spawnSync` of `check.mjs --mode=verify-chain` against the real tree fails with all six engineering receipts plus public status mismatched.

Working tree was clean vs HEAD before finalize. This is not dirty-file noise. The finalize commit did not re-pin after the last non-excluded source bytes landed.

### 2. `npm run test:structural` — FAIL

Preflight structural: pass (required optional deps: none).
`test:contracts` (inventory, lint fixtures, contracts, scenarios, check-generated): pass.
`test-project-facts.mjs`: pass.
`test-public-status-stability.mjs`: pass.
`test-final-source-receipt-gate.mjs`: FAIL (live verify-chain).
Later steps not reached.

### 3. Two-run tests now prove OUTPUT byte-stability — yes

`tools/release/test-public-status-stability.mjs`: hashes and byte-compares `public-release-status.json`, `README.md`, `index.html` across two `--write` runs. No source-file self-comparison.

`tools/release/test-project-facts.mjs`: reads generated output bytes after two `--write` runs under different `TZ` / env, `assert.deepEqual(second, first)`.

No ajv imports in either file.

### 4. Digest gate ajv-free and on the lane — yes

`final-source-receipt-gate.mjs` is stdlib-only. Structural preflight `required = []`. Gate test is on `test:structural`. `verify-chain` uses `verifyFinalSourceReceiptDigests` without requiring ajv (`check.mjs` ajv is optional for live-receipt JSON Schema in other modes).

Contract tests on the structural lane do not import ajv.

### 5. Finalize idempotence — yes (after a first refresh)

First `npm run finalize` on HEAD: exit 0; rewrote 8 files (6 receipts + context-budget + `contracts/v1/release-receipts.json` pins). Public status projected `UNVERIFIED`. Digest became `327b70be…`. README/index.html bytes unchanged.

Second `npm run finalize`: exit 0; full working-tree content hash identical to post-first-run (`84458fbf…`). Idempotent.

Files restored to HEAD after the probe.

## Closed from round 3 / 4

- Two-run tests hashing outputs, not sources: closed.
- Digest gate runnable without ajv: closed.
- Canonical `npm run finalize`: exists and is byte-idempotent once receipts match the tree.

## Remaining gap

Re-run `npm run finalize` and commit the 8 pin/receipt files so HEAD digest `327b70be…` is what the receipts claim. Until then structural is red and FULLY-GREEN is no.

## IMPROVEMENTS

1. **Commit-hook / CI check that HEAD digest equals receipt pins** — Why: this exact fail (finalize then extra source in the same commit) is invisible until `test:structural`. Fix: `computeHeadSourceTreeSha256` vs receipt pins in the gate, not only working-tree hash.
2. **`test:structural` should fail before later expensive steps with a one-line “run npm run finalize”** — Why: the spawnSync dump is a stack of seven digest lines. Fix: print the live vs pinned digest pair once.
3. **Exclude or freeze `evals/receipts/v1/contracts/dead-references.json` writes during structural** — Why: `test-lint-fixtures.mjs` writes that path mid-lane; content matched HEAD this time so git stayed clean, but a fixture change would dirty the tree mid-run. Fix: write under tmp or assert no byte change.
