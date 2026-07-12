# Dark Mode — Surfaces & Elevation

The surface system is what separates pro dark mode from inverted-light-mode. Read this
when building the dark theme's structure.

## Why shadows fail on dark (and what replaces them)

In light mode, a drop-shadow reads as depth because the shadow is *darker* than the
background. On a dark background there's little room to go darker, so shadows nearly
vanish. The fix, established by Material Design and now standard: **on dark, elevation
is communicated by making higher surfaces lighter.** The closer a surface is to the
"light source" (the user), the lighter its gray.

## The surface ramp

Define a ramp, not a single background. Each step up in elevation is a step up in
lightness. A practical 4-step ramp:

| Token | Role | Example |
|-------|------|---------|
| `--color-bg` | app background (lowest) | `#121212` |
| `--color-surface-1` | cards, panels | `#1e1e20` |
| `--color-surface-2` | raised cards, popovers | `#26262a` |
| `--color-surface-3` | modals, menus (highest) | `#2f2f34` |

Rules:
- Steps should be perceptually even — OKLCH lightness steps of ~0.03–0.04 work well
  (see `color-and-contrast.md`).
- Add a slight hue tint (toward the brand or cool blue) rather than pure neutral gray;
  5–10% chroma makes dark surfaces feel intentional, not dead. (Reddit/atmos both note
  a touch of saturation in the background reads better than flat gray.)
- Never exceed ~`#2f`–`#36` for the top surface in a standard app, or the contrast to
  text collapses.

## Material's overlay model (alternative to discrete grays)

Instead of hand-picking each gray, Material overlays translucent white on the base by
elevation — higher elevation = higher white-alpha. Approximate alphas: 1dp ≈ 5%,
2dp ≈ 7%, 4dp ≈ 9%, 8dp ≈ 12%, 16dp ≈ 15%, 24dp ≈ 16%.

```css
--color-surface-1: color-mix(in oklab, white 6%, var(--color-bg));
--color-surface-2: color-mix(in oklab, white 9%, var(--color-bg));
--color-surface-3: color-mix(in oklab, white 12%, var(--color-bg));
```
This keeps elevation consistent and derives from one base color.

## Borders as a second depth cue

Because shadows are weak on dark, subtle **light borders** (`1px solid` at ~`#34343a`
or `rgba(255,255,255,.08)`) do a lot of separation work. Use them on cards, inputs,
and dividers. A hairline top border slightly lighter than the side/bottom borders can
simulate a top light source.

## Shadows: still useful, but secondary

Keep shadows for genuinely floating UI (modals, dropdowns, toasts) to reinforce the
lighter-surface cue — but make them softer and larger, and pair with the lighter
surface; never rely on shadow alone for elevation on dark.

```css
--shadow-float: 0 8px 30px rgb(0 0 0 / .5);   /* darker/larger than light-mode shadow */
.modal { background: var(--color-surface-3); box-shadow: var(--shadow-float); }
```
