---
name: spacing-system
description: >-
  Use when layout rhythm, density, or gaps feel arbitrary or inconsistent, or when one
  product needs different reading pressures without splitting into unrelated spacing
  systems.
---

# Spacing System (the scale nobody owns)

Every gap uses one `--space-*` scale; relationships create composition, not arbitrary margins.

## The decision order

1. Start with the 4px-base ladder `4/8/12/16/24/32/48/64/96px` and
   `--space-section: clamp(48px, 32px + 4vw, 96px)` defaults. An alternate bounded scale
   needs brief and observed-hierarchy evidence.
2. Map attachment, control, task, group, region, and chapter to visibly different steps
   (roughly ≥1.5× between levels), or document a content-pressure exception.
3. Choose metronomic or intentional syncopated section rhythm from content pressure; explain it.
4. Use `gap` and one-direction logical margins; explain any arbitrary-margin exception.

## Let content set the rhythm

Map operational tasks to compact predictability and editorial/narrative content to breathing
room; retain one system and explain differing roles. Use the role map first:

| Relationship | Shared token | Compact operational rhythm | Long-form editorial rhythm |
| --- | --- | --- | --- |
| attachment | `--space-1` (4px) | icon/state to its label | inline metadata pair |
| control | `--space-2/3` (8/12px) | label-to-control / inside a control | claim-to-citation / tight evidence pair |
| task | `--space-4` (16px) | repeated queue item | adjacent paragraph or evidence group |
| group | `--space-5` (24px) | task-group break | discrete finding |
| region | `--space-6/7/8` (32/48/64px) | console-region break | narrative subsection or causal pivot |
| chapter | `--space-section` (fluid) | major workflow view | major account transition |

The console may be metronomic; an account may widen at finding, subsection, and chapter
boundaries. One vocabulary, different relationships—not two scales.

## Invariants and defaults

Invariant craft: audit `margin`/`padding`/`gap`; make proximity truthful and whitespace intentional;
keep one explainable vocabulary. Ladder, clamp, separation, and rhythm are brief-dependent
defaults; rendered overrides record scale, map, and tradeoff.

## Migration and honest audit boundary

Classify every literal by relationship. Starter disposition: `13px`→`12px` (`--space-3`),
`17px`→`16px` (`--space-4`), bare `24px`→`var(--space-5)`; override only with observed
hierarchy evidence. Keep `19px` unresolved; do not silently round it. Sole prose exception:
documented following-paragraph `1em` spacing.

Use `assets/spacing-starter.css` as fixture/start. Without a target CSS fixture, mark audit
`PENDING`, name it and the next action; never claim residual off-scale values are gone. The
ladder, map, and migration rules remain required.

## Evidence

Audit source before describing it; map each value to a role. Handoff one Markdown table with
`status`, `reason`, `remediation`, `evidence`, and `provenance`, covering `scale`, `off-scale`,
`proximity`, `rhythm`, and `handoff`. `PENDING` names missing source/next action; it blocks that
check, not placeholder proof.

## Rhythm map

Name attachment, control, task, group, region, and chapter; show compact/editorial selection
without parallel scales. Replace, justify as observed exception, or leave each arbitrary value
PENDING with source and next action.

## Authoritative self-check

Include exactly one labeled **Authoritative self-check**. It confirms ladder/clamp or evidence-backed
override, all six relationships, context selection, migration, and honest fixture boundary. Judge
reasoning/evidence, not literal starter values.

## Deliver

Deliver base, token scale, role map, context rhythm, off-scale audit, and one authoritative
self-check. `responsive-layout` owns breakpoint reflow, not scale/proximity/reading pressure;
hand it `--space-*` and the evidence table. Send control/form relationships to `component-states`
or `form-ux`, not re-decide their behavior.

## References

- `references/decision-records.md` — novel-case ADR rules.
- `assets/spacing-starter.css` — ladder, layout primitives, migration helpers.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs a spacing scale, content-derived rhythm, or gap consistency (+1 in contract.json); avoid: The request is only responsive reflow or component state behavior (+1 in contract.json)
- Exclude: Do not impose one uniform cadence across dissimilar content (+1 in contract.json)
- Stop / handoff: Pause when content hierarchy is absent and spacing would be arbitrary (+1 in contract.json); receives [design-system-interview, improve-existing-website, tasteroll, web-typography] -> sends [responsive-layout, component-states, form-ux]
- Output: A tokenized spacing scale and stated section-rhythm strategy tied to content hierarchy
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
