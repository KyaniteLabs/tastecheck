---
name: spacing-system
description: >-
  Use when layout rhythm, density, or gaps feel arbitrary or inconsistent, or when one
  product needs different reading pressures without splitting into unrelated spacing
  systems.
---

# Spacing System (the scale nobody owns)

Every gap uses one `--space-*` scale; named semantic relationships create composition
instead of arbitrary margins.

## The decision order

1. Publish one 4px-base ladder: `4/8/12/16/24/32/48/64/96px` as `--space-1` through
   `--space-9`, plus `--space-section: clamp(48px, 32px + 4vw, 96px)`.
2. Map attachment, control, task, group, region, and chapter relationships to visibly different steps
   (roughly ≥1.5× between levels).
3. Choose metronomic or intentional syncopated section rhythm from content pressure.
4. Use `gap` and one-direction logical margins; do not stack arbitrary margins.

## Let content set the rhythm

Map repeated operational tasks to compact predictability and editorial/narrative content
to deliberate breathing room; retain one system and state why named roles differ. Use the
role map before picking a value:

| Relationship | Shared token | Compact operational rhythm | Long-form editorial rhythm |
| --- | --- | --- | --- |
| attachment | `--space-1` (4px) | icon/state to its label | inline metadata pair |
| control | `--space-2/3` (8/12px) | label-to-control / inside a control | claim-to-citation / tight evidence pair |
| task | `--space-4` (16px) | repeated queue item | adjacent paragraph or evidence group |
| group | `--space-5` (24px) | task-group break | discrete finding |
| region | `--space-6/7/8` (32/48/64px) | console-region break | narrative subsection or causal pivot |
| chapter | `--space-section` (fluid) | major workflow view | major account transition |

The console may be metronomic; an account may widen only at finding, subsection, and
chapter boundaries. That is one vocabulary with different relationships, not two scales.

## Non-negotiables

- Audit `margin`/`padding`/`gap` for tokens (except legitimate `0`/`auto`/relative prose).
- Proximity must tell the truth; `--space-section` is fluid and each context has one base.
- Whitespace is an intentional structural move, never inconsistent leftover space.

## Migration and honest audit boundary

Classify every literal by its relationship before replacement: `13px` becomes `12px`
(`--space-3`), `17px` becomes `16px` (`--space-4`), and a bare `24px` layout value becomes
`var(--space-5)`. Treat `19px` as failed until its observed selector establishes task (16px)
or group (24px); do not silently round it. The sole prose exception is documented following-
paragraph `1em` spacing, because it is relative to type rather than a layout primitive.

Use `assets/spacing-starter.css` as a fixture and starting point. Without a CSS fixture in
the target project, mark the audit `PENDING`, name it and the next audit action; never claim
that residual off-scale values are gone. The ladder, map, and migration rules remain required.

## Completion evidence

Audit the source before describing it and map each value to a role. Handoff one completed
Markdown table with `status`, `reason`, `remediation`, `evidence`, and `provenance`, covering
`scale`, `off-scale`, `proximity`, `rhythm`, and `handoff`. `PENDING` names its missing source
and next action; it blocks that check rather than acting as placeholder proof.

## Semantic rhythm map

Name attachment, control, task, group, region, and chapter relationships, then show how
compact/editorial contexts select them without parallel scales. Each arbitrary value is
replaced, justified as an observed exception, or left PENDING with a source and next action.

## Authoritative self-check

Include exactly one labeled **Authoritative self-check** in the delivery. It confirms the
complete ladder and exact section clamp, all six relationships, operational versus editorial
role selection, the `13/17/19/bare-24` migration decision, and the honest fixture boundary.
This check is evidence-based, not a length target or a duplicate summary.

## How to deliver

Deliver base, token scale, role map, context rhythm, off-scale audit, and the one authoritative
self-check. Reject `responsive-layout` as the primary route because it owns breakpoint reflow,
not the scale, proximity, or reading-pressure decisions; hand it `--space-*` and the completed
evidence table. Send control and form relationships to `component-states` or `form-ux`, rather
than re-deciding their behavior.

## Reference files

- `references/decision-records.md` — novel-case ADR rules.
- `assets/spacing-starter.css` — copy-paste ladder, layout primitives, and migration helpers.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs a spacing scale, content-derived rhythm, or gap consistency (+1 in contract.json); avoid: The request is only responsive reflow or component state behavior (+1 in contract.json)
- Exclude: Do not impose one uniform cadence across dissimilar content (+1 in contract.json)
- Stop / handoff: Pause when content hierarchy is absent and spacing would be arbitrary (+1 in contract.json); receives [design-system-interview, improve-existing-website, tasteroll, web-typography] -> sends [responsive-layout, component-states, form-ux]
- Output: A tokenized spacing scale and stated section-rhythm strategy tied to content hierarchy
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
