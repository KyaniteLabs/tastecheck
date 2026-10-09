# Color System — OKLCH & Ramps

Read when generating a palette. The goal: cohesive ramps with predictable contrast,
built from a method, not guessed.

## OKLCH in one screen

`oklch(L C H [/ alpha])`
- **L** — perceptual lightness, 0 (black) → 1 (white). Equal L ≈ equal perceived
  brightness *across hues*. This is the whole point.
- **C** — chroma (colorfulness), 0 = neutral gray. Practical max ~0.37, but achievable
  max depends on L and H (you can't have vivid near-white).
- **H** — hue angle 0–360 (≈ red 25, yellow 90, green 145, cyan 195, blue 250,
  purple 300).

Contrast with HSL: HSL's "lightness" is not perceptual, so `hsl(60,100%,50%)` (yellow)
and `hsl(240,100%,50%)` (blue) read very differently in brightness. Ramps built in HSL
therefore have erratic contrast. OKLCH ramps don't.

## Building a lightness ramp

Pick a hue H, hold it constant, step L from light to dark. A 10-stop ramp (Tailwind-
style 50–900):

| Stop | L | typical C (mid-hue) |
|------|-----|------|
| 50 | 0.97 | 0.02 |
| 100 | 0.93 | 0.04 |
| 200 | 0.86 | 0.07 |
| 300 | 0.78 | 0.10 |
| 400 | 0.70 | 0.14 |
| 500 | 0.62 | 0.16 |
| 600 | 0.54 | 0.16 |
| 700 | 0.46 | 0.14 |
| 800 | 0.38 | 0.11 |
| 900 | 0.30 | 0.08 |

**Chroma taper:** chroma peaks in the mid-L band (~0.5–0.7) and must drop at both ends.
Near-white stops with high C look neon; near-black with high C look muddy. The C column
above rises then falls — keep that shape.

**Even steps:** equal L deltas give perceptually even ramps (a benefit you don't get in
HSL/hex). ~0.07–0.08 L per step works for a 10-stop ramp.

## Harmony schemes (choosing accent hues)

From the dominant hue H:
- **Monochrome:** one H, vary L/C. Safest, most cohesive.
- **Analogous:** H ± 30. Harmonious, low risk.
- **Complementary:** H + 180. High energy; use the accent sparingly.
- **Triadic:** H + 120, H + 240. Vivid; needs careful balance.
Keep accent **L and C in the same range** as the brand so they feel related, only H
differs.

## Neutrals: tinted, not dead

Pure gray (`C = 0`) looks lifeless next to a colored brand. Build neutrals at the brand
hue with tiny chroma (`C ≈ 0.005–0.02`). Warm brands → warm grays; cool brands → cool
grays. This single move makes a palette feel intentional.

## P3 / wide gamut & fallbacks

OKLCH can express colors outside sRGB (more vivid on P3 displays). For old browsers,
emit a hex fallback first, then override with OKLCH:
```css
--brand-500: #4f6bed;                 /* sRGB fallback */
--brand-500: oklch(0.62 0.16 250);    /* modern, possibly wider gamut */
```
Build tools (PostCSS oklch plugins, etc.) can auto-generate the fallback. Browser
support for OKLCH is broad in current evergreen browsers; fallback only if you target
legacy.

## Ramp generation pseudo-code
```
for stop in [50,100,...,900]:
    L = lerp(0.97, 0.30, position(stop))          # light → dark
    C = chroma_curve(L)                            # rises then falls, peak ~L 0.6
    emit oklch(L, C, H)
```
See `../assets/oklch-ramp.md` for a runnable version and a chroma curve.
