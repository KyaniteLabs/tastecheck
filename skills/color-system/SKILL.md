---
name: color-system
description: >-
  OKLCH color-system guidance for cohesive palettes and contrast-safe tokens. Use
  when choosing colors, generating ramps, fixing muddy palettes, creating semantic
  state colors, checking WCAG contrast, or defining theme variables.
---

# Color System

Build a palette whose roles survive real text, controls, themes, and gamut limits.
OKLCH makes lightness and chroma easier to reason about than HSL or hex, but it does
not choose the art direction or guarantee contrast. The rendered pair remains the
test.

## Why OKLCH

`oklch(L C H)`: **L** 0–1 perceptual lightness, **C** chroma (0 = gray, ~0.37 max
real), **H** 0–360 hue. Benefits that matter:
- Similar L values are a useful starting point for visually even ramps; hue and chroma
  still affect the result, so inspect and measure it.
- Adjust one property without wrecking the others (lighten without desaturating).
- Wide-gamut (P3) ready; degrades to sRGB. Supported in all current evergreen browsers;
  for very old targets provide a hex fallback (build tools can emit both).

## The method

1. **Choose a palette structure from evidence.** A restrained product may need one hue
   and neutrals; a data or editorial system may need several. Record what each hue does.
2. **Build a lightness ramp** at fixed steps. A 10–12 stop ramp from ~0.97 (50) down
   to ~0.30 (900). Keep H constant; vary L; let C peak in the mid-tones and taper at
   the extremes (very light and very dark can't hold high chroma).
3. **Choose neutral temperature deliberately.** Low-chroma brand tinting can create
   cohesion; true neutrals can be better for data, photography, or strict status colors.
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

- **Build ramps in OKLCH with controlled lightness and chroma.** Keep hue stable when
  continuity matters; allow documented hue correction when a nominally constant ramp
  looks uneven or leaves the target gamut.
- **Give every hue a job.** Do not add equally weighted colors just to make the palette
  feel complete; do not force a single-accent formula on evidence that needs more.
- **Choose neutral temperature from the content.** Tinted and true-neutral ramps are
  both valid when their role is explicit.
- **Verify WCAG on real pairs:** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1. A color
  that looks fine can still fail; measure. WCAG 2.x ratios are the AA conformance
  thresholds used here; legal applicability depends on the project's jurisdiction.
  Treat APCA as an additional reading check, not a substitute for the required gate.
  CSS `contrast-color()` is useful where supported but still ships only a black/white
  answer — don't lean on it for brand pairs.
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
- Stop / handoff: Pause when the required foreground-background roles are unknown (+1 in contract.json); receives [design-system-interview, deslop-ui, improve-existing-website, tasteroll] -> sends [theming, data-viz, a11y-pass]
- Output: A brief-derived OKLCH ramp and semantic color-token system with measured pair evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
