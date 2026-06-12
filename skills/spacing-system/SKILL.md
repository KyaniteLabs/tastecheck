---
name: spacing-system
description: >-
  Spacing scale and section rhythm for web UI. Use for inconsistent margins and
  padding, page rhythm, whitespace decisions, density, gap choices, vertical
  cadence between sections, and emitting the --space-* tokens other skills consume.
---

# Spacing System (the scale nobody owns)

Type has a scale, color has a ramp — and then spacing is 17px here, 24px there, 19px
there, because nobody owned it. Random spacing is invisible as a cause and obvious as
an effect: the page feels "off," cramped in one section and gappy in the next. This
skill owns the `--space-*` tokens the canonical contract promises and the **section
rhythm** that makes a page feel composed rather than stacked.

Governing rule: **every gap on the page is a token from one scale.** If you type a
margin that isn't a `--space-*` value, you're freelancing.

## The decision order

1. **Pick the base and ratio from the density choice.** The interview's
   spacious/dense pole sets it: dense UIs ~`4px` base, spacious/marketing ~`8px`.
   Build a geometric-ish scale, not a linear crawl: e.g.
   `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (/ 96 / 128)`.
2. **Name them as the contract tokens.** `--space-1` … `--space-8` (primitives) +
   `--space-section` (semantic: the default vertical gap between page sections,
   typically the 48–128px end, fluid via `clamp()`).
3. **Apply by proximity rule.** Related things get small steps, unrelated things get
   big ones — hierarchy is *made of* spacing differences. Label-to-input: 1–2 steps;
   field-to-field: 2–3; group-to-group: 4–5; section-to-section: `--space-section`.
   The jump between levels must be visible (≥1.5×), or grouping reads as noise.
4. **Set the section rhythm — metronomic or syncopated, on purpose.** Equal
   `--space-section` everywhere is calm but template-adjacent; varying it (and section
   *density*) with intent is the structure-and-rhythm move from the interview. Either
   is fine; **decide**, and let `deslop-ui`'s structural audit hold you to it.
5. **Prefer `gap` and one-direction margins.** Layout containers space children with
   `gap`; prose flows with `margin-block-start` on the *following* element. Mixed
   top+bottom margins are where collapse bugs and double-gaps breed.

## Non-negotiables

- **One scale; no off-scale values.** Grep the CSS for `margin|padding|gap` values
  that aren't tokens (or `0`/`auto`/`1em`-relative prose spacing) — each is a defect.
- **Spacing communicates grouping** (proximity beats borders): if two elements are
  closer to each other than to their own labels, the grouping is lying.
- **`--space-section` is fluid**: `clamp()` between its mobile and desktop values —
  sections breathe on desktop without leaving phone users scrolling through voids.
- **Density is consistent per context.** Marketing pages and the app shell may run
  different bases, but each context uses ONE — never per-component vibes.
- **Whitespace is structure, not leftover.** Asymmetric/intentional emptiness (an
  offset column, a wide left margin) is a committed move; accidental emptiness from
  inconsistent gaps is drift.

## Quick-start

```css
:root {
  /* Canonical contract names; values for an 8px-base spacious system */
  --space-1: 0.25rem;  /*  4px — icon-to-label, tight pairs */
  --space-2: 0.5rem;   /*  8px — label-to-input            */
  --space-3: 0.75rem;  /* 12px — within a control           */
  --space-4: 1rem;     /* 16px — field-to-field             */
  --space-5: 1.5rem;   /* 24px — card padding, group gaps   */
  --space-6: 2rem;     /* 32px — group-to-group             */
  --space-7: 3rem;     /* 48px — subsection breaks          */
  --space-8: 4rem;     /* 64px — large breaks               */
  --space-section: clamp(3rem, 2rem + 5vw, 7rem);  /* between page sections */
}

.stack > * + * { margin-block-start: var(--space-4); }   /* one-direction flow */
.cards { display: grid; gap: var(--space-5); }
section + section { margin-block-start: var(--space-section); }
```

## Self-check (before claiming the spacing is a system)

1. A stated base + scale, emitted as `--space-1…8` + `--space-section`?
2. Zero off-scale `margin/padding/gap` values in the CSS (grep, don't vibe)?
3. Proximity audit: related < unrelated, with visible (≥1.5×) jumps between levels?
4. `--space-section` fluid via `clamp()`; rhythm decision (even vs syncopated) stated?
5. Layout spacing via `gap`/one-direction margins — no top+bottom margin soup?
6. Density consistent within each context (marketing vs app may differ; inside, one base)?

## How to deliver

- State it like the other foundations: "8px-base scale, 9 steps, section rhythm
  syncopated (hero tight, proof section wide), all gaps tokenized."
- This skill *emits* the `--space-*` contract tokens; `responsive-layout` consumes
  them in patterns, `component-states`/`form-ux` use the small steps, the interview's
  density pole sets the base, and `deslop-ui` audits the rhythm plane.

## Reference files

- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.
