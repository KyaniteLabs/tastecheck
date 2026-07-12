# Light theme — the baseline (off-white, not glare)

Read when building the light theme (it's the baseline — design it first). Dark and
high-contrast are *mappings* of the same tokens; light is where you set the structure.

## Off-white, not pure white
Pure `#fff` ground + pure `#000` text maxes contrast (21:1) — which reads as glare and
*increases* visual stress, especially for dyslexia, migraine, and light sensitivity (see
`cognitive-a11y`). Soften both ends:
- **Ground:** off-white, e.g. `#faf7f0` / `#f7f6f2` (warm or cool to match the brand hue;
  tint toward the brand, not dead gray).
- **Ink:** near-black, not `#000`, e.g. `#1a1714` / `#15171a`.
- Still meet WCAG: this is ~15:1, not 21:1 — high but not maximal. Comfortable AND compliant.

## Elevation in light = shadow + slightly-darker/whiter surfaces
Opposite of dark. In light, raised surfaces can be pure white over an off-white ground,
plus a soft real shadow:
```css
--color-bg:#faf7f0; --color-surface-1:#ffffff; --color-surface-2:#fbf9f4;
--shadow-card:0 1px 2px rgb(0 0 0 / .06); --shadow-float:0 10px 30px rgb(0 0 0 / .12);
```
Keep one elevation scale; most surfaces flat with a hairline border, depth reserved for
floating UI.

## Accent contrast in light
- Accent **text/links** on the light ground need ≥4.5:1 — that usually means a *deeper*
  accent than you'd use on dark (e.g. OKLCH L≈0.50–0.55, higher chroma).
- Accent **fills** (buttons): the label on the fill must hit ≥4.5:1 — white on a mid
  accent, or dark ink on a light accent. Verify the pair, not the color.
- Neutrals tinted toward the brand hue (warm grays for a warm brand), never `#888`.

## Light → dark relationship (one token set)
Define the roles once; the dark mapping (see `surfaces-and-elevation.md` +
`color-and-contrast.md`) raises lightness of accents and inverts the elevation logic
(lighter = higher). The light values here are the canonical names; dark/high-contrast
only remap them.
