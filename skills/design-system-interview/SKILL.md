---
name: design-system-interview
description: >-
  Design-system interview before new frontend builds or redesigns. Use for vague
  site/app/landing/dashboard requests, generic-looking UI, direction-setting,
  aesthetic choices, type/color/density decisions, and DESIGN-SYSTEM.md tokens.
---

# Design System Interview

Unspecified intent produces generic UI. Before building, turn real evidence into
committed refusals, `DESIGN-SYSTEM.md`, and semantic tokens; when the user abstains,
make a bounded bold choice and label it.

## Interview from evidence, not a canned questionnaire

Make a decision map from product job, audience, marks/content, constraints, locales,
and contradictions. For each exchange: **signal** (supplied evidence), **consequence**,
two materially different brief-compatible **forks** with recommendation/trade-off, and
**record** (`committed`, `assumption awaiting confirmation`, or `blocked by contradiction`).
Ask the highest-consequence unresolved fork; batch only causal neighbors and resume there.

| Situation | Move |
| --- | --- |
| Existing evidence | Separate binding signal from historical residue. |
| Conflict | Assign domains, then resolve their overlap—never average them. |
| No taste vocabulary | Ask what the real task must feel like. |
| Headless/interrupted | State confidence and exact confirmation; do not imply completion. |

## How to run it (the loop)

1. Choose full interview for greenfield brand work; offer a brief recommendation for
   urgent/internal work without pressuring the user.
2. Inspect existing direction/source of truth first; use the shortcut only for undecided
   dimensions, and never adopt a worked example as the answer.
3. In 4–10 evidence-derived exchanges, recommend then react; vague adjectives require
   concrete forks. Surface headless assumptions and failed gates.
4. Close all nine dimensions with a commitment, labelled abstention, or block. A bold
   choice stays credible for trust-critical domains.
5. Emit the artifact/token block and explicit downstream handoff.

## The dimension bank (use adaptively, then close every dimension)

Use these adaptively; `references/interview-contract.generated.md` holds the canonical
session/dimension detail. Do not use any example as an answer.

| Canonical ID | Close with |
| --- | --- |
| `reference` | a real artifact and what it earns |
| `personality` | a chosen pole, not a middle |
| `aesthetic` | one concrete phrase predicting hierarchy/material |
| `type` | binding evidence, display/body stance, language/measure risk |
| `color_mode` | dominant hue, accent job, and light/dark commitment |
| `density_shape` | density, numeric radius range, elevation |
| `structure_rhythm` | composition, motif, and sectional cadence |
| `signature` | one memorable move |
| `imagery_iconography` | source/treatment or absence; one icon system |

Optionally set motion level for products.

## Anti-slop guardrails (enforce during the interview)

Reject generic adjectives and default template choices; choose a real hue, poles rather
than middles, and a labelled bounded decision when the user abstains.

## The output: decision map, then DESIGN-SYSTEM.md + tokens

Write `DESIGN-SYSTEM.md` from `assets/DESIGN-SYSTEM.template.md`, semantic tokens, and
the decision map below. Read `references/session-protocol.md` for readiness/resume rules.

```markdown
| Dimension / conflict | Evidence | Decision or assumption | Consequence | Confirmation / owner |
| --- | --- | --- | --- | --- |
| Alert hierarchy | ... | committed / assumed / blocked | ... | ... |
```

Blocked rows make the artifact `approval-ready`, not `approved`, and name waiting work.
Each non-obvious choice cites authority; each token and direction has a semantic/build job.

```
The committed direction in one line: "<source-derived aesthetic phrase> — <chosen
hierarchy>, <color role>, <type stance>, <shape/density>, signature = <specific move>."
```

Hand off hue to `color-system`, type to `web-typography`, modes to `theming`, tokens to
implementation skills, and the completed spec to `deslop-ui` for audit.

## Reference files

- `references/interview-bank.md` — forks and abstention guidance; read while interviewing.
- `references/structure-and-rhythm.md` — composition and rhythm; read before committing structure.
- `references/tokens.md` — token architecture; read when writing the artifact.
- `references/decision-records.md` — novel cases.
- `references/session-protocol.md` — shortcut, headless, contradiction, and resume states.
- `references/interview-contract.generated.md` — generated session and dimension authority.

## Completion evidence (before you start building)

Report these rows with direct evidence, reason, remediation, and `pass`/`fail`/`n/a`.

| Check | Status | Evidence / provenance | Reason | Remediation |
| --- | --- | --- | --- | --- |
| Nine required dimensions decided |  |  |  |  |
| Existing-direction shortcut or full interview justified |  |  |  |  |
| Contradictions and trust-critical rationale resolved |  |  |  |  |
| DESIGN-SYSTEM.md and canonical token block complete |  |  |  |  |
| Downstream handoff is explicit |  |  |  |  |

## Self-check

Confirm dimensions/evidence, labelled contradictions/abstentions, source-specific direction,
and ready artifact/token handoff.

## How to deliver

Run a fast evidence-dependent recommend-then-react interview, finish with the one-line
direction and artifact, then build to it through the stated handoff chain.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A new interface or redesign lacks a committed visual direction (+1 in contract.json); avoid: An existing site has sufficient evidence to improve without a new direction interview (+1 in contract.json)
- Exclude: Do not begin implementation before direction is resolved or explicitly assumed (+1 in contract.json)
- Stop / handoff: Pause when contradictory or trust-critical direction is unresolved (+1 in contract.json); receives [none] -> sends [color-system, web-typography, spacing-system, theming, responsive-layout, art-direction, micro-motion]
- Output: A decision-complete design-system artifact with explicit assumptions and readiness state
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
