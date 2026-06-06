---
name: color-system
description: >-
  OKLCH color-system guidance for cohesive palettes and contrast-safe tokens. Use
  when choosing colors, generating ramps, fixing muddy palettes, creating semantic
  state colors, checking WCAG contrast, or defining theme variables.
---

# Color System

Most palette problems come from one root cause: **HSL and hex don't match human
perception.** In HSL, `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)` (blue) have
the *same* lightness value but the yellow looks far brighter — so ramps built in HSL
have lightness that lurches around as hue changes, contrast becomes unpredictable, and
mid-tones go muddy. **OKLCH fixes this**: its L (lightness) is perceptually uniform, so
"L = 0.6" looks equally bright at every hue. That one property makes cohesive,
contrast-predictable palettes straightforward.

This skill is a method + real values for building a palette that is cohesive,
accessible, and not generic — every step checkable.

## Why OKLCH (use it)

`oklch(L C H)`: **L** 0–1 perceptual lightness, **C** chroma (0 = gray, ~0.37 max
real), **H** 0–360 hue. Benefits that matter:
- Equal L = equal perceived brightness across hues → predictable contrast & even ramps.
- Adjust one property without wrecking the others (lighten without desaturating).
- Wide-gamut (P3) ready; degrades to sRGB. Supported in all current evergreen browsers;
  for very old targets provide a hex fallback (build tools can emit both).

## The method: generate, don't hand-pick

1. **Choose the brand hue(s).** Pick H for your dominant color; optionally one accent
   hue (analogous = harmonious, complementary ≈ +180 = high energy, triadic ≈ +120).
2. **Build a lightness ramp** at fixed steps. A 10–12 stop ramp from ~0.97 (50) down
   to ~0.20 (900). Keep H constant; vary L; let C peak in the mid-tones and taper at
   the extremes (very light and very dark can't hold high chroma).
3. **Build neutrals as a low-chroma version of the brand hue** (C ≈ 0.01–0.03), not
   pure gray — tinted neutrals feel designed and tie the system together.
4. **Pick semantic colors** (success/error/warning/info) at matched L/C so they belong
   to the same family (don't paste in a random stock red/green).
5. **Derive interaction states** (hover/active) by nudging L ±0.04–0.06, not by adding
   opacity.
6. **Verify contrast** for every text/bg pair you'll actually use.

## Non-negotiables

- **Build ramps in OKLCH with constant hue and stepped lightness.** Don't eyeball hex.
- **One dominant color + a sharp accent; neutrals do most of the work.** The timid,
  evenly-distributed five-pastel palette is an AI-slop tell (see `deslop-ui`). Commit.
- **Tint neutrals toward the brand hue** (tiny chroma) — pure `#888` grays look dead.
- **Verify WCAG on real pairs:** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1. A color
  that looks fine can still fail; measure.
- **Don't convey meaning by color alone** (color-blind users) — pair with icon/text.
- **Chroma tapers at lightness extremes.** Max chroma lives in the mid L range; near-
  white and near-black stops must drop C or they look neon/muddy.

## Quick-start: a generated palette

```css
:root {
  /* Brand ramp — constant hue 250, stepped L, chroma peaking mid */
  --brand-50:  oklch(0.97 0.02 250);
  --brand-100: oklch(0.93 0.04 250);
  --brand-200: oklch(0.86 0.07 250);
  --brand-300: oklch(0.78 0.10 250);
  --brand-400: oklch(0.70 0.14 250);
  --brand-500: oklch(0.62 0.16 250);   /* base */
  --brand-600: oklch(0.54 0.16 250);
  --brand-700: oklch(0.46 0.14 250);
  --brand-800: oklch(0.38 0.11 250);
  --brand-900: oklch(0.30 0.08 250);

  /* Neutrals = brand hue at tiny chroma (not dead gray) */
  --neutral-50:  oklch(0.98 0.005 250);
  --neutral-200: oklch(0.90 0.008 250);
  --neutral-500: oklch(0.62 0.012 250);
  --neutral-800: oklch(0.32 0.010 250);
  --neutral-900: oklch(0.22 0.010 250);
  --neutral-950: oklch(0.18 0.008 250);

  /* Semantic — matched L/C so they’re a family */
  --success: oklch(0.62 0.15 150);
  --error:   oklch(0.60 0.20 25);
  --warning: oklch(0.75 0.15 85);
  --info:    oklch(0.65 0.14 230);

  /* Semantic aliases (what components reference) */
  --color-bg: var(--neutral-50);
  --color-text: var(--neutral-900);
  --color-primary: var(--brand-600);
  --color-primary-hover: var(--brand-700);
}
```

A generator script (`assets/oklch-ramp.md`) shows the exact math so you can produce a
ramp for any hue and emit hex fallbacks.

## Reference files

- `references/oklch-and-ramps.md` — OKLCH in depth, ramp math, chroma-taper, harmony
  schemes, neutral tinting, P3/fallbacks. Read when generating a palette.
- `references/contrast-and-tokens.md` — WCAG targets, measuring contrast, semantic
  token architecture, interaction states, color-blind safety, light/dark sharing.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## How to deliver

- State the system: "dominant hue 250, accent at 25 (complementary), neutrals tinted
  toward 250, 10-step ramp, all text pairs ≥ 4.5:1."
- Emit **semantic tokens** components reference (`--color-primary`), not raw ramp stops
  scattered through markup.
- Always run the contrast check on the actual pairs and report the numbers.
- Pair with `theming` (the dark palette reuses these hues with +L/−C) and `deslop-ui`
  (commit to one dominant color — avoid the timid even palette).

## Self-check

- [ ] One dominant hue stated; accents intentional — not an even, timid, five-color spread
- [ ] Ramp built in OKLCH with chroma taper at the light/dark ends; P3 with sRGB fallback
- [ ] Semantic tokens (`--color-primary`…) referenced by components — not raw ramp stops in markup
- [ ] Every text pair **measured** ≥ 4.5:1 (3:1 large/UI), and the numbers reported
- [ ] Meaning never by color alone; palette is color-blind safe
- [ ] Not the indigo→violet (or wine-red) default — committed to a real direction
