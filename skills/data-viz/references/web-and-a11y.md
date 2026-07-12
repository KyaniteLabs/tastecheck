# Web integration & accessibility for charts

Read when building the actual chart component. Tufte makes it honest; this makes it
*shippable on the web* — on-brand, theming-ready, responsive, and usable by everyone.
This is the part the pure-Tufte plugin doesn't cover.

## Use the design system
- **Series colors come from `color-system` tokens**, not ad-hoc hex. Use a real
  sequential/categorical scale (OKLCH). Cap at ~5 categorical hues.
- **Contrast:** each series ≥3:1 against the background AND distinguishable from adjacent
  series; axis/label text ≥4.5:1 (it's text). Verify — don't assume.
- **Tokens for everything:** `--series-1…6`, `--chart-label`, `--chart-grid`, and the page's `--color-bg`. One source
  of truth so the chart re-themes for free.

## Dark mode (pairs with the theming skill)
- Re-check every contrast on the dark surface; axis lines and labels that passed on white
  often fail on dark.
- Desaturate/raise lightness of series colors for dark (OKLCH +L, −C), like any accent.
- Don't use pure white gridlines on near-black; use a faint token (`--chart-grid`) or none.

## Responsive
- Author SVG with `viewBox` + `width:100%;height:auto` so it scales fluidly; never a fixed
  pixel width that overflows at 320px.
- Reflow, don't shrink-to-illegible: on narrow screens, drop minor ticks, rotate or wrap
  labels, or switch a wide multi-series chart to stacked small multiples.
- Container queries (`cqi`) for charts that live in variable-width slots.
- Label sizes in `rem` (zoom-safe), not hard px.

## Accessibility contract (a chart isn't done until these pass)
1. **Text equivalent / takeaway.** A `<figcaption>` that states the *point* ("Revenue up
   31% in Q2"), not just "Figure 1." The insight in words.
2. **The numbers, reachable.** Provide the data as a real `<table>` — either visible (a
   table *is* often the better viz) or visually-hidden / toggle for screen readers. SVG
   alone is not enough; AT users need the values.
3. **`role="img"` + `aria-label`** on the SVG summarizing it; mark purely decorative SVG
   bits `aria-hidden`.
4. **Not color-alone** (WCAG 1.4.1). Distinguish series by direct label, position, and/or
   pattern — never hue only. Critical for the ~8% with CVD.
5. **Contrast** (1.4.11): data marks, axis, and focus indicators ≥3:1; text ≥4.5:1.
6. **Interactive charts** (tooltips, hover): keyboard-operable, focus-visible on data
   points, tooltip content also in the DOM/table (not hover-only), respect
   `prefers-reduced-motion` for any transitions.
7. **Don't encode meaning in size below perceivable thresholds**; keep labels ≥12px / ~0.8rem.

## Library notes
- You rarely need a heavy charting lib for honest charts — hand-authored SVG (or a thin
  helper) gives full control of ink and a11y. If using a lib (Recharts, Chart.js,
  visx, Observable Plot), still apply this skill: strip its default gridlines/legends,
  feed it token colors, add the table fallback, and check theming + contrast.
- Canvas charts must add an off-canvas table/`aria` equivalent (canvas is invisible to AT).

## The visually-hidden table pattern
```css
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
```
```html
<figure>
  <figcaption>Quarterly revenue — up 31% in Q2 2026.</figcaption>
  <svg role="img" aria-label="Quarterly revenue 2024–2026, peaking Q2 2026 at $4.2M">…</svg>
  <table class="visually-hidden"><caption>Quarterly revenue ($M)</caption>
    <thead><tr><th>Quarter</th><th>Revenue</th></tr></thead>
    <tbody><tr><td>Q1 2026</td><td>3.2</td></tr> … </tbody>
  </table>
</figure>
```
