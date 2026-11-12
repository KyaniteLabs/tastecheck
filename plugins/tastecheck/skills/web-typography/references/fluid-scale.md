# Fluid Type Scales

Read this when **building or adjusting a type scale**, or making type respond to a
**container** rather than the viewport. The goal: one coherent set of sizes,
derived from a ratio, that scales smoothly between a small-screen and large-screen
target without media-query "steps" — while never breaking zoom.

## Modular scales: pick one ratio

Derive every size from a base (usually `1rem`) multiplied by a ratio. Using a single
ratio is what makes a page feel composed instead of arbitrary.

| Ratio | Name | Feel |
|------|------|------|
| 1.125 | Major second | Subtle, dense UI / dashboards |
| 1.200 | Minor third | Calm, conservative |
| 1.250 | **Major third** | **Safe, versatile default** |
| 1.333 | Perfect fourth | Confident editorial contrast |
| 1.414 | Augmented fourth | Strong |
| 1.500 | Perfect fifth | Dramatic |
| 1.618 | Golden ratio | Very dramatic, display-led |

`size(step) = base × ratio^step`. Step 0 = body. Negative steps for captions/fine
print. A common practice is a **smaller ratio for mobile** (less screen, so less
contrast) and a **larger ratio for desktop** — which is exactly what fluid scaling
gives you for free.

## Fluid sizing with `clamp()`

`clamp(MIN, PREFERRED, MAX)` returns PREFERRED, bounded by MIN and MAX. For type,
PREFERRED mixes a `rem` term with a viewport term so it grows with the screen:

```css
font-size: clamp(1rem, 0.95rem + 0.5vw, 1.25rem);
/*              ^min   ^------preferred------^  ^max */
```

### The non-negotiable rule: always include a `rem` term

A pure `vw` preferred value (`font-size: clamp(1rem, 4vw, 2rem)`) **fails WCAG 1.4.4**
because viewport units ignore browser zoom and the user's font-size setting. The
`rem` term in the preferred value is what keeps zoom and user preferences working.
Never ship `font-size` in pure `vw`.

### The clamp() math (so you can hand-derive a step)

To go from `MINsize` at `MINvw` viewport to `MAXsize` at `MAXvw` viewport:

```
slope      = (MAXsize − MINsize) / (MAXvw − MINvw)
vw_factor  = slope × 100                      // the number before "vw"
rem_offset = MINsize − slope × MINvw          // the rem intercept
preferred  = calc(rem_offset·rem + vw_factor·vw)   // express offsets in rem
```

Example: 16px→20px (1rem→1.25rem) between 320px→1240px viewport (20rem→77.5rem):
slope = 0.25/57.5 = 0.00435rem/vw → `clamp(1rem, 0.913rem + 0.435vw, 1.25rem)`.
You rarely do this by hand — **use Utopia** (below) to generate the whole scale.

## Utopia — the recommended generator

[utopia.fyi](https://utopia.fyi) generates a full fluid type scale (and matching
space scale) from: min/max viewport, min/max base size, and a min/max ratio. Output
is a set of CSS custom properties (`--step--2 … --step-5`) using `clamp()` with
proper `rem` terms. This is the current best-practice default for production type scales.

Workflow:
1. Choose min viewport (~320px) and max (~1240–1440px).
2. Choose base sizes: e.g. 16px @ min, 18–20px @ max.
3. Choose ratios: e.g. 1.2 @ min, 1.25 @ max (a little more contrast on big screens).
4. Copy the generated `--step-*` variables into `:root` and reference them
   (`font-size: var(--step-2)`).

Keep the generated variable names so the scale stays a single source of truth.

## Container-relative type (`cqi`) — component-level fluidity

Viewport units size text to the *window*. But a card in a narrow sidebar and the
same card in a wide main column should scale to **their own width**. Container query
units do this:

- `cqi` = 1% of the query container's **inline** size (`cqw`/`cqh`/`cqb` also exist).
- Set a containment context, then use `cqi` in `clamp()` instead of `vw`:

```css
.card { container-type: inline-size; }
.card h2 {
  font-size: clamp(1.25rem, 1rem + 2cqi, 2rem);   /* scales to the CARD, not the viewport */
}
```

This is the modern way to build genuinely reusable, context-responsive components.
Browser support is broad (all current evergreen browsers). Keep a `rem` term in the
clamp for the same zoom-safety reason as `vw`.

## A pragmatic default scale (Major Third, fluid)

If you don't want to open Utopia, this is a sane, accessible starting set (also in
`../assets/starter.css`). Tune the max base up to `1.125rem`/`1.25rem` for editorial
reading.

```css
:root {
  --step--2: clamp(0.69rem, 0.67rem + 0.11vw, 0.75rem);
  --step--1: clamp(0.83rem, 0.80rem + 0.17vw, 0.94rem);
  --step-0:  clamp(1.00rem, 0.95rem + 0.25vw, 1.13rem);   /* body */
  --step-1:  clamp(1.20rem, 1.13rem + 0.37vw, 1.41rem);
  --step-2:  clamp(1.44rem, 1.34rem + 0.53vw, 1.76rem);
  --step-3:  clamp(1.73rem, 1.58rem + 0.75vw, 2.20rem);
  --step-4:  clamp(2.07rem, 1.87rem + 1.04vw, 2.75rem);
  --step-5:  clamp(2.49rem, 2.20rem + 1.43vw, 3.43rem);
}
```

## Tailwind / token notes

- In Tailwind, set the scale in `theme.fontSize` (or `@theme` in v4) using the
  `clamp()` values, so utilities like `text-step-2` map to the fluid scale. Don't
  scatter arbitrary `text-[27px]` values — that defeats the scale.
- If the project already has a scale, **extend it**, don't introduce a parallel one.
