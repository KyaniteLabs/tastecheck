# Effectiveness v2

Effectiveness v2 is a sealed, machine-only blind comparison of the frozen source revisions `0f99603a603b0243345e7320a52702df67a2194e` and `08591213f562073f9ddb0ff9012ec0e3f8ed09c2`.

## Scope and claims

- The protocol has 12 scenarios, two seeds, two opaque arms, 24 comparison units, 48 generation calls, 96 production judgments, and 16 anchor judgments.
- The exclusion set is exactly `[]`; missing evidence terminates the run and is never removed from a denominator.
- Evaluation is machine-only. It does not measure human preference, is not calibrated against people, and cannot support a human-equivalence claim.
- A rehearsal may report only `rehearsal_passed`. It must never report production support, effectiveness, superiority, equivalence, or a production result.
- Production evidence may be claimed only after every Task 8 stop gate passes and a terminal synthesis artifact validates. Historical W1, full19, and V5 failures remain immutable and cannot be promoted as v2 evidence.

## Rehearsal

Run `npm run eval:v2:rehearse` or the full gate `npm run verify:v2`.

The rehearsal reconstructs both exact source revisions in isolated clean worktrees, consumes the committed `skills/`, `commands/`, and `contracts/` bytes, verifies the registry and validator closure, creates a real one-time randomization commitment, and records one fully bound `production_admitted` event. It durably commits the control artifacts and revalidates the clean source identities and admission boundary before ordinal 1. It then drives the same `runGenerations` and `runJudgments` orchestration used by production with injected local fakes.

The only successful count report is:

```json
{"generations":48,"render_receipts":96,"packets":24,"anchors":4,"production_judgments":96,"anchor_judgments":16,"simulated_external_calls":160,"real_external_calls_started":0}
```

Renders consume zero external-call ordinals. The instantiated judgment schedule is durably persisted and verified before ordinal 49, and all 112 judgment receipts bind its digests. Judge outputs must satisfy the frozen closed schema and cite exact packet evidence before an attempt may complete. Failures at any reserved ordinal are terminal, consume that ordinal exactly once, and prohibit retry or substitution. Pre-admission failures remain `production_not_started`; post-reservation failures become `production_incomplete`. The rehearsal never opens the unmask authority and deletes its isolated artifacts on exit.

## Production stop rule

The production commands are fail-closed entry points. They must not be used until implementation, the fake rehearsal, the existing v1 suite, clean-clone reconstruction, independent review, adversarial QA, and the public leak audit all pass. Preflight must also prove two already-provisioned providers from two distinct verified foundation lineages at zero incremental spend. If that exact capability is unavailable, production remains not started; scope, lineages, cost, retries, and call counts are never weakened.
