---
name: design-system-interview
description: >-
  Design-system interview before new frontend builds or redesigns. Use for vague
  site/app/landing/dashboard requests, generic-looking UI, direction-setting,
  aesthetic choices, type/color/density decisions, and DESIGN-SYSTEM.md tokens.
---

# Design System Interview

Turn a vague frontend brief into buildable decisions: study evidence, recommend a point of
view, and ask only questions that materially change the build.

## Start with direction, not questionnaire

Inspect product job, audience, content, marks, constraints, locales, and visual references
before asking. Open with:

```markdown
What I see: <the strongest signal in the brief>
My recommendation: <a specific direction>
Why it fits: <the product consequence>
Choose: <fork A and trade-off> / <fork B and trade-off> / redirect me
```

Ask one high-consequence fork at a time; combine only when one answer settles several
decisions. Reflect each answer in one line for correction without rereading.

## Interview loop

1. **Read the room.** Separate current evidence from residue. If an existing direction covers
   five dimensions, confirm it and ask only for gaps.
2. **Propose a fork.** Give two brief-compatible outcomes that look or behave materially
   differently. Recommend one and name its trade-off.
3. **Turn language into consequences.** Translate “clean,” “premium,” or “bold” into hierarchy,
   density, material, type, color, or rhythm; do not debate adjectives.
4. **Record the decision.** Mark `committed`, `assumption awaiting confirmation`, or
   `blocked by contradiction`, with supporting evidence.
5. **Stop when buildable.** All nine dimensions are decided, delegated, or blocked; then write
   artifact and handoff.

Use 4–10 exchanges for a full interview. For urgent internal work, offer a short approval
pass. In a one-shot/interrupted run, save the decision snapshot and first resume question;
assumptions are not approval.

## Decisions

Use adaptively; `references/interview-contract.generated.md` is canonical session/dimension
authority. Examples teach format, never taste.

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

Optionally set motion level.

## User receives

Write `DESIGN-SYSTEM.md` from `assets/DESIGN-SYSTEM.template.md`, then give an approvable
build handoff:

1. **Direction:** sentence predicting the interface.
2. **Decisions:** completed decision map.
3. **Refusals:** three to five defaults this product will not use.
4. **Build contract:** semantic tokens, structural rhythm, responsive/accessibility constraints.
5. **Next move:** first implementation step, or exact blocker and owner.

Read `references/session-protocol.md` for readiness/resume rules.

```markdown
| Dimension / conflict | Evidence | Decision or assumption | Consequence | Confirmation / owner |
| --- | --- | --- | --- | --- |
| Alert hierarchy | ... | committed / assumed / blocked | ... | ... |
```

Use `approved` only when confirmed and buildable. Use `approval-ready` when recommendations
and tokens await confirmation; do not hand it to implementation. Use `blocked` when
contradiction or missing authority prevents a safe recommendation. Cite non-obvious choices;
each token needs a real build job.

```
The committed direction in one line: "<source-derived aesthetic phrase> — <chosen
hierarchy>, <color role>, <type stance>, <shape/density>, signature = <specific move>."
```

Hand hue to `color-system`, type to `web-typography`, modes to `theming`, tokens to
implementation skills, and the spec to `deslop-ui`. Keep one `DESIGN-SYSTEM.md` source of truth.

## Reference files

- `references/interview-bank.md` — forks and abstention.
- `references/structure-and-rhythm.md` — composition/rhythm.
- `references/tokens.md` — token architecture.
- `references/decision-records.md` — novel cases.
- `references/session-protocol.md` — shortcut, contradiction, resume.
- `references/interview-contract.generated.md` — generated authority.

## Ready-to-build check

Report rows with direct evidence, reason, remediation, and `pass`/`fail`/`n/a`.

| Check | Status | Evidence / provenance | Reason | Remediation |
| --- | --- | --- | --- | --- |
| Nine required dimensions decided |  |  |  |  |
| Existing-direction shortcut or full interview justified |  |  |  |  |
| Contradictions and trust-critical rationale resolved |  |  |  |  |
| DESIGN-SYSTEM.md and canonical token block complete |  |  |  |  |
| Downstream handoff is explicit |  |  |  |  |

Build-ready requires every row passing and artifact `approved`. `approval-ready` or
`blocked` is a resumable checkpoint: name unresolved owner and next confirmation; do not
start implementation. Deliver one-line direction, link artifact, then state next action.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A new interface or redesign lacks a committed visual direction (+1 in contract.json); avoid: An existing site has sufficient evidence to improve without a new direction interview (+1 in contract.json)
- Exclude: Do not begin implementation before direction is resolved or explicitly assumed (+1 in contract.json)
- Stop / handoff: Pause when contradictory or trust-critical direction is unresolved (+1 in contract.json); receives [none] -> sends [art-direction, color-system, component-states, data-viz, deslop-ui, empty-states, form-ux, humanize-copy, micro-motion, responsive-layout, spacing-system, tasteroll, theming, web-typography]
- Output: A decision-complete design-system artifact with explicit assumptions and readiness state
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
