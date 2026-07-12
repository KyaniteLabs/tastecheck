# High-contrast & forced-colors

Read when adding authored higher contrast or verifying forced-colors behavior. These are
distinct mechanisms; a product may support one without shipping a selectable authored mode.

## 1. `prefers-contrast: more` (a *your-tokens* high-contrast theme)
A user-requested higher-contrast variant you control. Remap the same semantic tokens to
maximal legibility:
```css
@media (prefers-contrast: more){
  :root{ --color-text:#000; --color-text-muted:#1a1a1a; --color-border:#000; --color-bg:#fff; }
  :root[data-theme="dark"], :root:not([data-theme="light"]){
    --color-text:#fff; --color-text-muted:#e6e6e6; --color-border:#fff; --color-bg:#000; }
}
```
Here pure black/white IS correct — this is the opt-in maximal-contrast path. Thicken
borders/focus rings; remove subtle low-contrast decoration; keep state distinguishable by
shape, not just color.

## 2. `forced-colors: active` (Windows High Contrast / forced-colors mode)
The OS replaces your palette with the user's system colors. **Do NOT fight it.** Rules:
- **Don't suppress system colors.** Let backgrounds/text/borders take system values; use
  the **CSS system color keywords** (`Canvas`, `CanvasText`, `LinkText`, `ButtonFace`,
  `ButtonText`, `Highlight`, `HighlightText`, `GrayText`) when you need to reference them.
- **Keep borders/outlines** — in forced-colors, backgrounds often disappear, so elements
  defined only by `background` vanish. Give buttons/cards a `border` so they survive.
- **Focus must stay visible** — `:focus-visible { outline: 2px solid Highlight }` or rely
  on the UA outline; never `outline:none` here.
- **Icons/SVG:** set `forced-color-adjust:auto` (default) so they recolor; only use
  `forced-color-adjust:none` for meaningful imagery (a chart, a brand mark) — and then
  ensure it's still legible.
- **Images of text / color-coded meaning** break here — pair with text/shape.
```css
@media (forced-colors: active){
  .btn{ border:1px solid ButtonText; }      /* survives bg removal */
  .card{ border:1px solid CanvasText; }
  :focus-visible{ outline:2px solid Highlight; outline-offset:2px; }
}
```

## Why both
`prefers-contrast` is *your* enhanced theme; `forced-colors` is the *OS* overriding you.
A complete implementation handles the mechanisms in scope: a token mapping for authored
higher contrast, and border/focus resilience plus system-color keywords for forced colors.
