# Decision Records — spacing-system

## Meta-patterns

- **MP-1 · Spacing is hierarchy.** Proximity groups harder than borders or color.
  Most "this layout feels messy" complaints are spacing-grouping lies, not aesthetics.
- **MP-2 · Scales survive; values don't.** A committed scale lets fifty future edits
  stay coherent without re-judging each one. The scale is the decision; values follow.
- **MP-3 · Rhythm is the page-level voice.** Even cadence reads calm/corporate;
  syncopated cadence reads editorial/alive. Both are legitimate — only the *unchosen*
  one is slop (same logic as every tastecheck dimension).

## ADRs

**ADR-1 — Geometric-ish steps, not linear.**
*Why (MP-1):* 4/8/12/16/24/32/48/64 keeps adjacent steps visibly different; a linear
4/8/12/16/20/24/28 makes neighboring choices indistinguishable, so people pick
randomly. *Apply:* widen the gaps as the scale rises.

**ADR-2 — `1em`-relative spacing is allowed inside prose only.**
*Why:* paragraph spacing should track the type size (`p + p { margin-block-start:
1em }` from web-typography), not the layout scale. *Apply:* prose flows em-relative;
layout containers use `--space-*`. Both are on-system; mixing the two *roles* is not.

**ADR-3 — One-direction margins (or `gap`) everywhere.**
*Why:* top+bottom margins collapse unpredictably and double up in compositions.
*Apply:* `gap` for flex/grid; `* + *` lobotomized-owl or `margin-block-start` for flow.

**ADR-4 — Optical exceptions are tokens too.**
*Why (MP-2):* sometimes a heading genuinely needs to sit tighter to its content than
the scale allows (optical alignment). *Apply:* if it recurs, add a named token or a
component token — never a bare magic number in place.

**ADR-5 — Mobile compresses the big end, not the small end.**
*Why (MP-1):* on phones, intra-component spacing must survive (touch targets, grouping);
section gaps are what shrink. *Apply:* `clamp()` on `--space-section` and the 48px+
steps; leave `--space-1…4` fixed.
