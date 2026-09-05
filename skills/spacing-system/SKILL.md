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

1. Start with one shared vocabulary: the 4px-base ladder
   `4/8/12/16/24/32/48/64/96px` and
   `--space-section: clamp(48px, 32px + 4vw, 96px)` are defaults. An alternate bounded scale
   needs brief and observed-hierarchy evidence.
2. Map attachment, control, task, group, region, and chapter relationships to visibly different steps
   (roughly ≥1.5× between levels), or document a content-pressure exception.
3. Choose metronomic or intentional syncopated section rhythm from content pressure and explain it.
4. Use `gap` and one-direction logical margins; explain any arbitrary-margin exception.

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

## Invariants and defaults

Invariant craft: audit `margin`/`padding`/`gap`; make proximity truthful; make whitespace intentional;
keep one explainable vocabulary. The starter ladder, clamp, separation, and rhythm examples are
brief-dependent defaults: rendered evidence may override them, but must record the scale, map, and
tradeoff.

## Migration and honest audit boundary

Classify every literal by relationship. The starter disposition is `13px`→`12px` (`--space-3`),
`17px`→`16px` (`--space-4`), bare `24px`→`var(--space-5)`; override only with observed hierarchy
evidence. Keep `19px` unresolved until its role is observed; do not silently round it. The sole
prose exception is documented following-paragraph `1em` spacing.

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

Include exactly one labeled **Authoritative self-check**. It confirms the default ladder and clamp
or an evidence-backed override, all six relationships, context selection, migration, and the honest
fixture boundary. It judges reasoning and evidence, not literal starter-value adherence.

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
