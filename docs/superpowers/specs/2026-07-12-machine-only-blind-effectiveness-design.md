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

## Machine judges and anchor qualification

Use two declared provider/model families. Provider separation is evidence of operational
diversity, not proof of statistical independence. Each family runs two isolated judge
executions over the full corpus, producing 96 production judgments in total.

Each judge batch also receives four blinded machine anchors:

1. an identical pair whose required answer is tie;
2. a second identical pair with labels reversed;
3. a structurally broken artifact paired with a contract-complete artifact;
4. the same broken/complete comparison with labels reversed.

All four anchors must pass. A failed anchor invalidates the whole judge batch. Anchors
qualify machine consistency only; they are not represented as human calibration or ground
truth about taste.

Every production judgment must cite exact packet evidence. Results that leak arm identity,
omit evidence, share context with another judge, or fail schema validation are inadmissible.

## Frozen decision rule

The candidate passes only when all conditions hold:

1. Both evaluator families independently prefer the candidate on at least 18 of the 24
   paired units after ties are counted as half a preference for each arm.
2. Each family shows candidate-majority preference in at least 8 of the 12 scenarios.
3. Candidate absolute-quality mean is at least 4.0/5.0 in each family, with no dimension
   below 3.0/5.0.
4. Neither family reports a hard accessibility, safety, contract, evidence-integrity, or
   task-completion regression.
5. All generation, render, packet, anchor, judge-family, and unmask bindings validate.

If both families do not independently clear the rule, the status is `inconclusive` or
`blocked`; pooled votes cannot rescue family disagreement. Diversity and anti-slop remain
separate reported properties and cannot silently substitute for effectiveness.

## Components

1. Closed schemas for protocol, generation receipt, judge result, synthesis, and public
   claim projection under `contracts/v2/effectiveness/`.
2. A frozen scenario registry and source/corpus manifest under `evals/v2/`.
3. A generation runner that enforces arm parity and records failure/retry lineage.
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
- Infrastructure retries are permitted only for preregistered transport failures and keep
  the original failed-attempt receipt. Content-bearing retries are prohibited.
- Dispatch false-success—zero turns, zero tokens, or no artifact—is a failed attempt, never
  a completed judge.
- Costs and external-call counts are recorded. This cycle permits at most 160 external
  calls: 48 arm generations, 96 production judgments, and 16 anchor judgments. Incremental
  pay-per-call spend is capped at $0; existing flat-rate or already-provisioned access is
  admissible. If either family requires new incremental spend, production stops for explicit
  budget approval rather than shrinking the corpus or weakening quorum.
- Partial results are published only as `production_incomplete`; they make no effectiveness
  claim.

## Verification

Implementation must include negative tests proving that the system rejects identity leaks,
single-family judging, failed anchors, pooled-family rescue, altered thresholds, corpus
overlap, late exclusions, missing evidence citations, forged unmask files, source drift,
reruns, and claim-scope promotion.

The final gate includes the complete existing TasteCheck suite, the new v2 contract and
adversarial tests, clean-clone reconstruction, public leak audit, independent code review,
and adversarial end-to-end QA.
