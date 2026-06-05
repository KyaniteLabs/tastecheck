# High-contrast & forced-colors

Read when adding the high-contrast theme. Two distinct mechanisms — handle both.

## 1. `prefers-contrast: more` (a *your-tokens* high-contrast theme)
A user-requested higher-contrast variant you control. Remap the same semantic tokens to
maximal legibility:
```css
@media (prefers-contrast: more){
  :root{ --text:#000; --text-muted:#1a1a1a; --border:#000; --bg:#fff; }
  :root[data-theme="dark"], :root:not([data-theme="light"]){
    --text:#fff; --text-muted:#e6e6e6; --border:#fff; --bg:#000; }
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
A robust system handles both: a high-contrast token mapping for the former, and
border/focus resilience + system-color keywords for the latter.

## Self-check
- [ ] `prefers-contrast: more` mapping exists (max-contrast variant of the tokens).
- [ ] `forced-colors: active` handled: borders on buttons/cards so they don't vanish;
      focus visible; system color keywords used; meaningful SVG kept legible.
- [ ] Nothing relies on a removed background or on color alone in either mode.
