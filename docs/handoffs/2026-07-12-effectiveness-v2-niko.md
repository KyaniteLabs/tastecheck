# Effectiveness v2 Niko handoff

## BLUF

Continue the machine-only blind effectiveness v2 lane autonomously from commit
`dd8a47d`. Forgejo is canonical; GitHub is mirror-only.

## Immediate gate

The revised preregistration and implementation plan must receive sequential architect
`APPROVE`, then critic `APPROVE`, before implementation begins. The earlier architect
approved a prior revision; the critic returned `REVISE`. Treat the latest revision as
unapproved until both new reviews pass.

Read in order:

1. `docs/superpowers/specs/2026-07-12-machine-only-blind-effectiveness-design.md`
2. `docs/superpowers/plans/2026-07-12-machine-only-blind-effectiveness.md`
3. `.superpowers/sdd/ralplan-architect-review.md` when present
4. `.superpowers/sdd/ralplan-critic-review.md` when present
5. `AGENTS.md` and applicable skill instructions

## Locked boundaries

- Baseline: `0f99603a603b0243345e7320a52702df67a2194e`
- Candidate: `08591213f562073f9ddb0ff9012ec0e3f8ed09c2`
- No human calibration and no human-preference claim.
- Exactly 160 maximum external calls, no retries, and zero incremental pay-per-call spend.
- Two verified provider and foundation-model lineages are mandatory.
- If two admissible families are unavailable, stop production as not started or incomplete;
  never shrink the corpus or weaken the rule.
- Historical W1, full19, and V5 failure evidence remains immutable.
- A zero-turn, zero-token, or no-artifact worker is a failed attempt.
- Run Pushing Dispatch routing before every delegated or background worker selection.
- Follow TDD task by task, keep a durable progress ledger, independently review each task,
  commit coherent checkpoints, and push Forgejo first.
- Before any commit, push, PR, or shared artifact, run the public leak audit.
- Verify fleet identity live before asserting host state.

## Production stop gate

Do not make production model calls until implementation, the complete fake-executor
rehearsal, the existing suite, clean-clone reconstruction, independent code review,
adversarial QA, and leak audit all pass. Return receipts, not promises, and do not ask Simon
routine questions.
