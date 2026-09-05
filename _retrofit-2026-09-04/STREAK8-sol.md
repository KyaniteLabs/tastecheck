# Streak Round 8 — SOL Independent Review

Date: 2026-09-05
Reviewed state: requested HEAD `0889b3e`; receipt source digest `b4f0bc7e554422dadd882e3a7cd30efa98f627364f1f0f2a4596a483ba08f2db`.

## Verdict

Green streak does not advance. Four requested ASTRA failure classes hold, but the route × state × viewport closure remains claimant-defined and can omit real combinations while the gate returns `SHIP`.

## Acceptance evidence

- `npm run test:structural`: PASS. Dependency preflight confirmed the structural lane needs no optional dependency; all structural checks completed with exit 0.
- `npm run finalize` twice: PASS. Both verify-chain runs bound source digest `b4f0bc7e…`; all mutable output hashes were byte-identical across consecutive runs.
- Contradictory declared status versus measured boolean observations: HOLD.
- Review transplanted across check and artifact identities: HOLD.
- Unchanged HTML with changed linked CSS: HOLD through dependency-manifest mismatch.
- Truncated/oversized complete capture: HOLD.
- Root-split CLI: PASS for argument routing. A verifier-relative input resolved under an isolated verifier root, the consumer root remained distinct, and the invalid input returned HOLD.
- Incomplete route × state × viewport inventory: FAIL. A fresh valid ledger containing only one claimant-declared browser tuple returned `SHIP`; no independent universe established that other routes, states, or viewports were missing.

## Finding

### SEV-1 — Subject coverage is still self-attested

`validateSubjectInventory` validates tuple shape, uniqueness, and non-emptiness, then treats the submitted member set as the complete universe (`skills/tastecheck-pass/assets/release-gate.mjs:451-497`). `deriveObservationStatus` only reconciles evidence to that submitted set. The regression named “incomplete inventory” merely empties one required check (`tools/evals/test-tastecheck-gate.mjs:273-279`); it does not remove one member from an independently derived route × state × viewport matrix. Therefore an author can omit an entire route/state/viewport combination from both inventory and observations and still receive `SHIP`. This is the original category-versus-subject-coverage attack in a signed but self-declared form.

## Regression hunt

No additional blocker was found in contradictory-observation derivation, review binding, linked CSS closure, capture-size failure, or root-split parsing. The CLI split is not covered by a committed regression test, although the fresh isolated probe passed.

## IMPROVEMENTS

1. Derive the browser subject universe from an authoritative route/state manifest plus a required viewport policy. Why: the claimant can currently shrink scope silently. Fix: hash that manifest independently, compute the Cartesian members in the gate, and require exact equality with submitted inventory.
2. Replace the empty-inventory regression with an omission mutation. Why: the current test proves non-emptiness, not completeness. Fix: build a two-route × two-state × required-viewport fixture, delete one tuple, rehash the claimant inventory, and assert HOLD against the independently derived universe.
3. Add a committed root-split CLI test. Why: only the API consumer-root path is currently covered. Fix: spawn the CLI with isolated verifier/artifact roots and assert input/output containment, distinct recorded identities, dependency resolution, and escape rejection.

FULLY-GREEN: no
