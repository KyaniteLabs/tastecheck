---
name: color-system
description: >-
  OKLCH color-system guidance for cohesive palettes and contrast-safe tokens. Use
  when choosing colors, generating ramps, fixing muddy palettes, creating semantic
  state colors, checking WCAG contrast, or defining theme variables.
---

# Color System

Build a palette whose roles survive text, controls, themes, and gamut limits. OKLCH makes
lightness/chroma easier to reason about than HSL/hex, but does not choose art direction or
guarantee contrast; the rendered pair is the test.

## Why OKLCH

`oklch(L C H)`: **L** 0–1 perceptual lightness, **C** chroma (0 = gray, ~0.37 max real),
**H** 0–360 hue. Similar L values start even ramps, but hue/chroma still need inspection.
Adjust one property without wrecking the others. It is P3-ready and degrades to sRGB; provide
a hex fallback for very old targets.

## The method

1. **Choose structure from evidence.** A restrained product may need one hue/neutrals; data
   or editorial systems may need several. Record each hue's job.
2. **Build a fixed-step lightness ramp:** 10–12 stops from ~0.97 (50) to ~0.30 (900).
   Keep H constant; vary L; let C peak mid-range and taper at extremes.
3. **Choose neutral temperature deliberately.** Brand tinting can create cohesion; true
   neutrals can suit data, photography, or strict status colors.
4. **Pick semantic colors** (success/error/warning/info) at matched L/C; avoid random stock
   red/green.
5. **Derive interaction states** (hover/active) by nudging L ±0.04–0.06, not opacity.
6. **Verify contrast** for every text/bg pair you'll actually use.

## Derive from the brief, not this file

The sample shows ramp mechanics, not a palette menu. Start from brand evidence, audience,
ambient light, and roles; state why hue, neutral temperature, and accent energy fit. Missing
evidence gets an approved assumption, not fashionable blue/violet/green.

## Build a token system, not a swatch sheet

Keep three layers separate: **primitives** are named OKLCH stops; **semantic roles** name jobs
such as text, surface, focus, and danger; **component aliases** reference one role, never a
raw value. Define focus, non-color cues, and rendered pairs per status.

## Non-negotiables

- **Build ramps in OKLCH with controlled lightness/chroma.** Keep hue stable when useful;
  document hue correction when a constant ramp looks uneven or leaves gamut.
- **Give every hue a job.** Do not add equally weighted colors for completeness or force
  a single-accent formula where evidence needs more.
- **Choose neutral temperature from content.** Tinted and true-neutral ramps are valid
  when the role is explicit.
- **Verify WCAG on real pairs:** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1. Measure;
  WCAG 2.x ratios are this skill's AA thresholds, while legal applicability depends on
  jurisdiction. APCA is an additional reading check, not a substitute. CSS
  `contrast-color()` still ships only black/white; do not rely on it for brand pairs.
- **Don't convey meaning by color alone** (color-blind users) — pair with icon/text.
- **Chroma tapers at lightness extremes.** Max chroma is mid-L; near-white/black stops
  must drop C or look neon/muddy.

## Measure the rendered pair, including gamut and state

Measure each rendered text, icon/UI, focus, and error pair in every theme/state; a passing
body pair does not prove disabled or hover. For P3, retain hierarchy in the sRGB fallback and
record gamut compression. If a hue cannot carry a legible role, use it as a mark/large accent
and assign darker semantic ink.

## Quick-start

Use `assets/oklch-ramp.md` for the generator/token skeleton. Keep primitives separate from
roles; measure real text/UI pairs and emit hex fallbacks for legacy targets.

## Reference files

- `references/oklch-and-ramps.md` — OKLCH, ramp math, chroma taper, harmony, neutral
  tinting, P3/fallbacks. Read when generating a palette.
- `references/contrast-and-tokens.md` — WCAG targets, contrast measurement, token
  architecture, interaction states, color-blind safety, light/dark sharing.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## How to deliver

State hue/neutral strategy, semantic tokens, measured pairs, gamut fallbacks, and gaps; hand
role mappings to `theming`.

## Evidence

Record brief fit, primitive/role map, real contrast, non-color cues/gamut fallback, and
theming handoff with evidence, reason, remediation.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A design needs a cohesive palette, color ramp, semantic tokens, or contrast repair (+1 in contract.json); avoid: The request is only to map existing semantic tokens between light, dark, or forced-colors themes (+1 in contract.json)
- Exclude: Do not deliver an unmeasured palette (+1 in contract.json)
- Stop / handoff: Pause when the required foreground-background roles are unknown (+1 in contract.json); receives [design-system-interview, deslop-ui, improve-existing-website, tasteroll] -> sends [theming, data-viz, a11y-pass]
- Output: A brief-derived OKLCH ramp and semantic color-token system with measured pair evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
