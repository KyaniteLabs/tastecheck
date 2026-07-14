---
name: design-system-interview
description: >-
  Design-system interview before new frontend builds or redesigns. Use for vague
  site/app/landing/dashboard requests, generic-looking UI, direction-setting,
  aesthetic choices, type/color/density decisions, and DESIGN-SYSTEM.md tokens.
---

# Design System Interview

Turn a vague frontend brief into decisions a builder can use. The interview should feel
like a sharp creative director at the table: it studies the evidence, recommends a point
of view, and asks only questions that materially change the build.

## Start with a direction, not a questionnaire

Inspect the product job, audience, content, existing marks, constraints, locales, and any
visual references before asking a question. Then open with:

```markdown
What I see: <the strongest signal in the brief>
My recommendation: <a specific direction>
Why it fits: <the product consequence>
Choose: <fork A and trade-off> / <fork B and trade-off> / redirect me
```

Ask one high-consequence fork at a time. Combine questions only when one answer genuinely
settles several decisions. After each answer, reflect the decision back in one line so the
user can correct it without rereading the conversation.

## The interview loop

1. **Read the room.** Separate current evidence from historical residue. If an existing
   direction already covers five dimensions, confirm it and ask only for the gaps.
2. **Propose a fork.** Give two brief-compatible outcomes that would look or behave
   materially differently. Recommend one and name its trade-off.
3. **Turn language into consequences.** Translate “clean,” “premium,” or “bold” into
   hierarchy, density, material, type, color, or rhythm. Do not debate adjectives.
4. **Record the decision.** Mark it `committed`, `assumption awaiting confirmation`, or
   `blocked by contradiction`, with the evidence that earned it.
5. **Stop when the system is buildable.** All nine dimensions are decided, explicitly
   delegated to the recommendation, or blocked. Then write the artifact and handoff.

Use 4–10 exchanges for a full interview. For urgent internal work, offer the recommended
direction as a short approval pass. In a one-shot or interrupted run, save the decision
snapshot and name the first question needed to resume; do not present assumptions as approval.

## Decisions to close

Use these adaptively; `references/interview-contract.generated.md` is the canonical
session/dimension authority. Examples teach format, never taste.

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

## What the user receives

Write `DESIGN-SYSTEM.md` from `assets/DESIGN-SYSTEM.template.md`, then give the user a
short handoff they can approve or build from immediately:

1. **Direction:** one sentence that predicts the interface.
2. **Decisions:** the completed decision map.
3. **Refusals:** three to five defaults this product will not use.
4. **Build contract:** semantic tokens, structural rhythm, and responsive/accessibility constraints.
5. **Next move:** the first implementation step, or the exact blocker and owner.

Read `references/session-protocol.md` for readiness and resume rules.

```markdown
| Dimension / conflict | Evidence | Decision or assumption | Consequence | Confirmation / owner |
| --- | --- | --- | --- | --- |
| Alert hierarchy | ... | committed / assumed / blocked | ... | ... |
```

Use `approved` only when the direction is confirmed and buildable. Use `approval-ready`
when recommendations and tokens are complete but await confirmation; do not hand that
state to implementation. Use `blocked` when a contradiction or missing authority prevents
a safe recommendation. Each non-obvious choice cites its source; each token has a real build job.

```
The committed direction in one line: "<source-derived aesthetic phrase> — <chosen
hierarchy>, <color role>, <type stance>, <shape/density>, signature = <specific move>."
```

Hand off hue to `color-system`, type to `web-typography`, modes to `theming`, tokens to
implementation skills, and the completed spec to `deslop-ui` for audit. Preserve a
single `DESIGN-SYSTEM.md` as the source of truth.

## Reference files

- `references/interview-bank.md` — forks and abstention guidance; read while interviewing.
- `references/structure-and-rhythm.md` — composition and rhythm; read before committing structure.
- `references/tokens.md` — token architecture; read when writing the artifact.
- `references/decision-records.md` — novel cases.
- `references/session-protocol.md` — shortcut, headless, contradiction, and resume states.
- `references/interview-contract.generated.md` — generated session and dimension authority.

## Ready-to-build check

Report these rows with direct evidence, reason, remediation, and `pass`/`fail`/`n/a`.

| Check | Status | Evidence / provenance | Reason | Remediation |
| --- | --- | --- | --- | --- |
| Nine required dimensions decided |  |  |  |  |
| Existing-direction shortcut or full interview justified |  |  |  |  |
| Contradictions and trust-critical rationale resolved |  |  |  |  |
| DESIGN-SYSTEM.md and canonical token block complete |  |  |  |  |
| Downstream handoff is explicit |  |  |  |  |

The interview is build-ready only when every row passes and the artifact is `approved`.
An `approval-ready` or `blocked` output is a resumable checkpoint: name the unresolved
owner and next confirmation, but do not start implementation. Deliver the one-line
direction first, link the artifact, then state the next allowed action.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A new interface or redesign lacks a committed visual direction (+1 in contract.json); avoid: An existing site has sufficient evidence to improve without a new direction interview (+1 in contract.json)
- Exclude: Do not begin implementation before direction is resolved or explicitly assumed (+1 in contract.json)
- Stop / handoff: Pause when contradictory or trust-critical direction is unresolved (+1 in contract.json); receives [none] -> sends [art-direction, color-system, component-states, data-viz, deslop-ui, empty-states, form-ux, humanize-copy, micro-motion, responsive-layout, spacing-system, tasteroll, theming, web-typography]
- Output: A decision-complete design-system artifact with explicit assumptions and readiness state
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
