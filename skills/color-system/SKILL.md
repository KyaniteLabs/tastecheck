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

## Derive from the brief, not this file

The sample demonstrates ramp mechanics, not a palette menu. Start from brand evidence,
audience, ambient light, and semantic roles; state why hue, neutral temperature, and
accent energy fit. If evidence is missing, record the approved assumption rather than
defaulting to fashionable blue, violet, or “accessible” green.

## Build a token system, not a swatch sheet

Keep three layers separate: **primitives** are named OKLCH stops; **semantic roles**
name jobs such as text, surface, focus, and danger; **component aliases** reference one
role, never a raw value. Define a focus role, non-color status cue, and rendered
foreground/background pair for each semantic status.

## Non-negotiables

- **Build ramps in OKLCH with constant hue and stepped lightness.** Don't eyeball hex.
- **One dominant color + a sharp accent; neutrals do most of the work.** The timid,
  evenly-distributed five-pastel palette is an AI-slop tell (see `deslop-ui`). Commit.
- **Tint neutrals toward the brand hue** (tiny chroma) — pure `#888` grays look dead.
- **Verify WCAG on real pairs:** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1. A color
  that looks fine can still fail; measure. (WCAG 2.x ratios remain the AA/legal target
  in 2026; APCA is informative-only — use it as a sanity check, not the compliance
  number. CSS `contrast-color()` is useful where supported but still ships only a
  black/white answer — don't lean on it for brand pairs.)
- **Don't convey meaning by color alone** (color-blind users) — pair with icon/text.
- **Chroma tapers at lightness extremes.** Max chroma lives in the mid L range; near-
  white and near-black stops must drop C or they look neon/muddy.

## Measure the rendered pair, including gamut and state

Measure each rendered text, icon/UI, focus, and error pair in every supported theme and
state; a passing body pair does not prove disabled or hover. For P3, retain hierarchy in
the sRGB fallback and record gamut compression. If a brand hue cannot carry a legible
role, use it as a mark/large accent and assign a darker semantic ink.

## Quick-start

Use `assets/oklch-ramp.md` for the generator and the semantic-token skeleton. Keep
primitives separate from semantic roles; measure real text/UI pairs and emit hex
fallbacks when legacy targets are in scope.

## Reference files

- `references/oklch-and-ramps.md` — OKLCH in depth, ramp math, chroma-taper, harmony
  schemes, neutral tinting, P3/fallbacks. Read when generating a palette.
- `references/contrast-and-tokens.md` — WCAG targets, measuring contrast, semantic
  token architecture, interaction states, color-blind safety, light/dark sharing.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## How to deliver

State the brief-derived hue/neutral strategy, semantic tokens, measured pairs, gamut
fallbacks, and unresolved gaps; hand role mappings to `theming`.

## Completion evidence

Record brief fit, primitive/role map, real contrast, non-color cues/gamut fallback, and
theming handoff with evidence, reason, and remediation.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A design needs a cohesive palette, color ramp, semantic tokens, or contrast repair (+1 in contract.json); avoid: The request is only to map existing semantic tokens between light, dark, or forced-colors themes (+1 in contract.json)
- Exclude: Do not deliver an unmeasured palette (+1 in contract.json)
- Stop / handoff: Pause when the required foreground-background roles are unknown (+1 in contract.json); receives [design-system-interview, improve-existing-website] -> sends [theming, data-viz, a11y-pass]
- Output: A brief-derived OKLCH ramp and semantic color-token system with measured pair evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
