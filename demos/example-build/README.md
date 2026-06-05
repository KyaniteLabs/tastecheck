# Example build — how the before/after was actually made

The hero image in the main README is **two real browser renders**, not a mockup. This
folder is the proof. Everything in `after.html` traces to tokens the skills generated.

## The pipeline (in order)

1. **design-system-interview** → committed a direction (no human to grill in a demo, so
   the skill's "decide boldly and announce" rule applied). Output: `DESIGN-SYSTEM.md`
   — *editorial luxury, warm ink on ivory, one oxblood accent (H=25), high-contrast
   serif, asymmetric, signature = oversized index numerals.*

2. **color-system** → ran the OKLCH ramp generator for the oxblood hue + warm neutrals,
   then **verified every text/background pair against WCAG** (computed OKLCH→sRGB→
   luminance). Results: body 18.8:1, muted 16.9:1, oxblood text 14.0:1, oxblood UI
   9.9:1, paper-on-oxblood 14.0:1 — all ≥ AA. Output: the `--accent-*` / `--ink-*`
   primitives in `tokens.css`.

3. **web-typography** → generated the fluid type scale with the clamp() math
   (perfect-fourth 1.333, body 18→20px). Output: the `--step-*` tokens.

4. **responsive-layout** → asymmetric split hero (1.35fr / 1fr), intrinsic grids,
   collapses to one column < 760px. No magic pixel widths.

5. **component-states** → the buttons have real default / hover / active /
   `:focus-visible` states (sharp 2px, flat) — not default-only.

6. **micro-motion** → restrained transitions (transform/opacity, ease-out) with a
   `prefers-reduced-motion` fallback.

7. **deslop-ui** → audited the result against the committed spec. Tells removed vs. the
   `before.html` default: pill `9999px` → `2px`; indigo→violet → oxblood; Inter →
   editorial serif; 3 emoji cards → indexed numerals; `shadow-2xl` → hairline rules;
   centered → asymmetric.

## Files
- `DESIGN-SYSTEM.md` — the committed spec (design-system-interview output).
- `tokens.css` — generated, contrast-verified tokens (color-system + web-typography).
- `after.html` — built **only** from semantic tokens. The "after" panel.
- `before.html` — the raw no-skills AI default. The "before" panel.

## Reproduce
Open `before.html` and `after.html` in any browser. Both render with **zero console
errors** at mobile/tablet/desktop. The generators live in
`../../skills/color-system/assets/oklch-ramp.md` and the clamp method in
`../../skills/web-typography/references/fluid-scale.md`.
