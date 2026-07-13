# Color System — Contrast & Tokens

Read when wiring colors into a real UI accessibly. A beautiful ramp is useless if the
text on it can't be read.

## WCAG contrast targets (2.x)

- **Body text ≥ 4.5:1** (AA). **Large text ≥ 3:1** — large = ≥24px regular or ≥18.66px
  bold.
- **UI components, icons, focus rings, chart strokes ≥ 3:1** (1.4.11).
- **AAA** (text-heavy reading): 7:1 body, 4.5:1 large.
- Measure the **actual pair** you'll ship (this fill on that surface). A mid-ramp color
  on white may pass; the same on a tinted card may not.

Rough OKLCH heuristic: against white (`L≈1`), text generally needs `L ≲ 0.5` for 4.5:1;
against near-black, text needs `L ≳ 0.72`. Always confirm with a real checker — L alone
doesn't fully determine contrast because chroma contributes.

APCA (WCAG 3 draft) models real readability better and is worth using as a quality
check, but **WCAG 2.x ratios remain the compliance standard** in 2026 — meet those.

## Semantic token architecture

Two layers: a **palette** (raw ramp stops) and **semantic tokens** (roles). Components
reference *only* the semantic layer, so re-theming = swap the mapping.

```css
:root {
  /* palette (raw) */
  --brand-600: oklch(0.54 0.16 250);
  --neutral-50: oklch(0.98 0.005 250);
  --neutral-900: oklch(0.22 0.01 250);
  /* semantic (roles — what components use) */
  --color-bg:            var(--neutral-50);
  --color-surface-1:       white;
  --color-text:          var(--neutral-900);
  --color-text-muted:    oklch(0.50 0.02 250);
  --color-primary:       var(--brand-600);
  --color-primary-hover: oklch(0.48 0.14 250);
  --color-border:        oklch(0.90 0.01 250);
  --color-focus:         var(--brand-600);
}
.btn-primary { background: var(--color-primary); color: var(--color-primary-ink); }
.btn-primary:hover { background: var(--color-primary-hover); }
```
Never hard-code `--brand-600` in a component; use `--color-primary`. This is also what
makes light/dark and multi-brand theming a one-place change.

## Interaction states without opacity

Derive hover/active/disabled by nudging lightness, not stacking opacity (opacity over
varied surfaces shifts the result and can break contrast):
- hover: base L − 0.04–0.06 (darker on light bg) or + on dark bg.
- active/pressed: a touch further.
- disabled: lower chroma + move L toward the surface; ensure still perceivable.
- focus ring: a 3:1-contrast outline (`outline: 2px solid var(--color-focus)`), use
  `:focus-visible`.

## Color-blind safety

~8% of men have some color vision deficiency. Don't encode meaning in hue alone:
- Pair status color with an icon or text label (✓ Success, ✕ Error).
- For charts, vary lightness/pattern/labels, not just hue; avoid red/green as the only
  distinction.
- Check the palette in a CVD simulator.

## Light/dark sharing

Reuse the same hues across themes; in dark mode raise L and lower C for accents (see
the `theming` skill) and remap semantic tokens. The palette stays one source of truth.
