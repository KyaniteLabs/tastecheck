# Machine-only blind effectiveness evaluation

Status: approved direction, written-design review gate

## Outcome

Evaluate whether TasteCheck 1.1 improves generated frontend work over the frozen 1.0
baseline using a precommitted, machine-only, multi-model blind protocol. The result may
support only this claim:

> TasteCheck passed a precommitted, multi-model blind evaluation for the frozen corpus,
> generator, evaluator families, runtimes, render environment, and source revisions.

The protocol may never emit “human preferred,” “human validated,” or an unqualified claim
that all users, models, tasks, or individual skills improve.

## Immutable boundaries

- Historical W1, full19, and terminal V5 evidence remains unchanged and failed.
- The new evaluation uses a new `contracts/v2/effectiveness/` namespace.
- Baseline source is frozen at commit `0f99603a603b0243345e7320a52702df67a2194e`.
- Candidate source is frozen at TasteCheck 1.1 merge commit
  `08591213f562073f9ddb0ff9012ec0e3f8ed09c2`.
- Thresholds, corpus hashes, exclusions, retry rules, and the unmask procedure are frozen
  before production generation or judging.
- A failed or inconclusive result is final for this protocol version. No selective rerun,
  threshold edit, judge substitution, or cherry-picking is allowed.

## Experimental scope

The pack-level treatment is the complete TasteCheck pack at the frozen source revision.
The evaluation does not attempt to identify the marginal contribution of individual
skills.

- Six strata: greenfield direction, brownfield repair, accessibility and safety,
  verbal and copy, orchestration and gates, and render-grounded integration.
- Two preregistered scenarios per stratum: 12 scenarios total.
- Two deterministic generation seeds per scenario: 24 paired comparison units.
- The same generator model, runtime, settings, task text, starting repository, tool policy,
  and time budget are used for baseline and candidate arms.
- A/B labels are assigned only after generation and remain opaque until synthesis.
- Renderable tasks are captured at mobile and desktop widths with content-addressed
  screenshot, DOM, and computed-style evidence.

The scenario is the primary sampling unit. Multiple judge rows for one scenario are
clustered observations and never inflate the effective sample size.

Before the first external call, a hash-bound execution manifest freezes the exact generator
provider, foundation-model lineage, model version, runtime, adapter digest, system-prompt
digest, settings, tool policy, and time budget. It also freezes both evaluator providers,
foundation-model lineages, exact model versions, identity tuples, runtime and adapter
digests, plus the Playwright and Chromium versions, font-set digest, viewport matrix, and
render host contract. No alias, version, provider, runtime, adapter, or render substitution
is allowed after admission. Drift produces `production_incomplete`.

## Machine judges and anchor qualification

Use two declared provider/model families. Provider separation is evidence of operational
diversity, not proof of statistical independence. Each family supplies two isolated judge
identities. Every judge identity evaluates each comparison and anchor in a separate fresh
call with no shared response context, producing 96 production judgments and 16 anchor
judgments in total.

Each judge batch also receives four blinded machine anchors:

1. an identical pair whose required answer is tie;
2. a second identical pair with labels reversed;
3. a structurally broken artifact paired with a contract-complete artifact;
4. the same broken/complete comparison with labels reversed.

All four anchors must pass. A failed anchor invalidates the whole judge batch. Anchors
qualify machine consistency only; they are not represented as human calibration or ground
truth about taste.

The two evaluator families must have different verified providers and different verified
foundation-model lineages. Alias resolution is recorded before admission. If lineage cannot
be verified, preflight fails; two declared endpoint labels cannot satisfy the family claim.
A judge identity is the frozen provider, lineage, model version, system-prompt digest,
rubric digest, runtime, and adapter-digest tuple. Every call has a unique context and
invocation ID; duplicates are inadmissible.

Every production judgment must cite exact packet evidence. Results that leak arm identity,
omit evidence, share context with another judge, or fail schema validation are inadmissible.

Packets use a closed allowlist: opaque packet, scenario, unit, artifact, viewport, and label
IDs; the common brief and rubric; sanitized treatment-produced artifact content; and
content hashes. They never contain revisions, versions, package metadata, source paths,
worktree/run paths, timestamps, logs, generator receipts, provider data, filesystem
metadata, or asymmetric arm fields. Opaque IDs are derived independently of arm order from
a committed randomization commitment. Judges may infer treatment from genuine output
differences; the protocol claims only that direct provenance cues are absent.

## Frozen decision rule

The candidate passes only when all conditions hold:

1. Map each identity preference to candidate `1`, tie `0.5`, or baseline `0`. Abstention or
   a missing/invalid preference makes production incomplete. The family-unit score is the
   arithmetic mean of its two identity scores. Both families independently require the sum
   of their 24 family-unit scores to be at least `18`.
2. A family-scenario score is the arithmetic mean of its two seeded family-unit scores. It
   is candidate-majority only when strictly greater than `0.5`; exactly `0.5` is not a
   majority. Each family requires candidate-majority in at least 8 of 12 scenarios.
3. Each identity scores both opaque arms on all five dimensions from 1 through 5. For each
   family, unit, arm, and dimension, average the two identity scores. Then average the 24
   candidate unit scores separately for each dimension with equal unit weight. Each family
   requires the mean of its five candidate dimension means to be at least `4.0`, with every
   candidate dimension mean at least `3.0`. Missing or out-of-range scores make production
   incomplete; baseline scores remain diagnostic and cannot rescue the candidate.
4. Any hard accessibility, safety, contract, evidence-integrity, or task-completion
   regression flagged by any admissible identity blocks the run. There is no adjudication
   or override.
5. All generation, render, packet, anchor, judge-family, and unmask bindings validate.

If both families do not independently clear the rule, the status is `inconclusive` or
`blocked`; pooled votes cannot rescue family disagreement. Diversity and anti-slop remain
separate reported properties and cannot silently substitute for effectiveness.

## Components

1. Closed schemas for protocol, generation receipt, judge result, synthesis, and public
   claim projection under `contracts/v2/effectiveness/`.
2. A frozen scenario registry, source/corpus manifest, execution manifest, and committed
   SHA-256 authority manifest for tracked V1/W1/full19/V5 public evidence under `evals/v2/`.
3. A generation runner that enforces arm parity and records every attempted-call lineage.
4. A blind packet builder with a separate hash-bound unmask map.
5. Provider adapters that record model/version, packet digest, isolated execution, and
   declared family without exposing credentials.
6. A validator and one-time synthesizer that implement the frozen rule.
7. A public-safe receipt ledger and claim projector that cannot alter the existing 1.1
   engineering-readiness result.

Existing Taste Oracle milestone-only contracts remain valid and non-release. Its pending
single-scenario packet may serve as a harness rehearsal, but it cannot be promoted into
this evaluation’s evidence.

## Fail-closed behavior

- Missing provider family, credentials, source revision, scenario, render, anchor, or
  judgment stops before unmask.
- No external-call retry is permitted. Every attempted invocation reserves and increments
  the 160-call ledger ordinal before execution. Transport failure, false success, or any
  other failed attempt terminates the run as `production_incomplete`; ordinals are never
  reused or erased.
- Dispatch false-success—zero turns, zero tokens, or no artifact—is a failed attempt, never
  a completed judge.
- Costs and external-call counts are recorded. This cycle permits at most 160 external
  calls: 48 arm generations, 96 production judgments, and 16 anchor judgments. Incremental
  pay-per-call spend is capped at $0; existing flat-rate or already-provisioned access is
  admissible. If either family requires new incremental spend, production stops for explicit
  budget approval rather than shrinking the corpus or weakening quorum.
- Partial results are published only as `production_incomplete`; they make no effectiveness
  claim.

Admission verifies a committed historical-authority manifest before the first call and
again at closeout. V1 paths are prohibited as v2 generation, packet, judgment, or synthesis
inputs. The run ID is derived from the protocol, corpus, source, and execution-manifest
digests, and its initial ledger root is committed before admission.

Before unmasking, `reserve` atomically creates `synthesis-reservation.json` with exclusive
creation, fsyncs it, and exits. Synthesis is allowed only after that exact reservation is
committed in `HEAD` and the worktree is clean. A reservation is terminal: an interrupted
or crashed synthesis cannot resume or create another reservation for the same run ID. The
validator rejects deletion, truncation, a forked predecessor, copied run directories with
wrong roots, or any run ID/root that already contains a synthesis reservation.

## Verification

Implementation must include negative tests proving that the system rejects identity leaks,
single-family judging, failed anchors, pooled-family rescue, altered thresholds, corpus
overlap, late exclusions, missing evidence citations, forged unmask files, source drift,
reruns, and claim-scope promotion. Boundary fixtures cover split identities, split seeds,
ties, exact threshold equality, missing scores, contradictory regression flags, duplicate
lineage/context/invocation IDs, alias drift, renderer drift, historical-byte mutation,
ledger deletion/truncation/forks/copies, interrupted synthesis, and packet leaks through
revisions, versions, paths, timestamps, metadata, logs, ordering, or asymmetric structure.

The final gate includes the complete existing TasteCheck suite, the new v2 contract and
adversarial tests, clean-clone reconstruction, public leak audit, independent code review,
and adversarial end-to-end QA.
