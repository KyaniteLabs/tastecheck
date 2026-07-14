---
name: responsive-layout
description: >-
  Use when a page or component must survive narrow containers, long or translated
  content, zoom, reflow, or overflow without device-name breakpoints.
---

# Responsive Layout

Responsive layout is intrinsic reflow plus content-led breakpoints and container queries,
not named-device CSS.

## The decision order

1. Start mobile-first and use Grid/Flex intrinsic sizing (`minmax`, `auto-fit`, `clamp`, `%`/`fr`).
2. Add breakpoints only where observed content breaks; reusable components use container queries.
3. Verify the product's minimum supported viewport, 200–400% zoom, long/translated
   content, narrow embeds, and wide views without accidental overflow or collapse.

## Preserve hierarchy under pressure

Start with non-disappearing content, reading order, and narrowest real container; decide
stack/reorder/progressive reveal/rail from observed pressure and test long content, locale,
zoom, and embedded cases before calling it responsive.

## Non-negotiables

- Start from the narrowest supported content state; avoid device-name breakpoints.
- Prevent overflow with `min-width: 0`, bounded media, and wrapping; reflow rather than shrink to unusable.
- Prefer container queries for reusable components when their behavior depends on their
  container, not the viewport.
- At narrow widths and zoom, ordinary reading and interaction should not require
  two-dimensional scrolling. Isolate essential exceptions such as wide data tables,
  maps, timelines, or canvases in a labelled, keyboard-operable scroll region.

## Quick-start patterns

Use `references/patterns.md` for the intrinsic grid, sidebar, stack, cluster, and
container-query patterns. Start with `minmax(min(16rem, 100%), 1fr)`, `min-width: 0`,
logical container sizing, and a breakpoint only where content actually breaks.

## Reference files

- `assets/layout-patterns.css` — intrinsic examples after pressure evidence.
- `references/patterns.md` — patterns, units, images, and overflow debugging.
- `references/decision-records.md` — novel-case ADR rules.

## Completion evidence

Use the five-field ledger; start Reason with the check ID.

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | layout-strategy — content hierarchy and intrinsic composition |  |  |  |
|  | containment — breakpoint and container-query rationale |  |  |  |
|  | narrow-reflow — 320px, long-content, and overflow result |  |  |  |
|  | zoom-interaction — zoom and keyboard-reachable interaction result |  |  |  |
|  | handoff — component and accessibility boundary |  |  |  |

## Pressure-test protocol

Each row names real longest-pressure fixture, available width/zoom, expected and observed
result (or fail-closed missing evidence). Test full shell, narrow, 400%, and narrow embed;
record what stays first/stacks/folds and why. No rendered build means a plan, not pass.

## How to deliver

Deliver content-led layout/breakpoints and rerunnable narrow/long/container/zoom/keyboard
evidence; hand type, rhythm, and state concerns onward.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A layout needs intrinsic reflow, responsive hierarchy, container behavior, or overflow repair (+1 in contract.json); avoid: The request is only to choose a spacing scale or type system (+1 in contract.json)
- Exclude: Do not choose breakpoints from device names (+1 in contract.json)
- Stop / handoff: Pause when content priority is unknown and reflow would silently hide required information (+1 in contract.json); receives [art-direction, design-system-interview, improve-existing-website, spacing-system, tasteroll, theming, web-typography] -> sends [component-states, form-ux, a11y-pass, deslop-ui, i18n-ready]
- Output: An intrinsic layout strategy with justified breakpoints and responsive verification evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
