# Light-theme mapping

Read when light is a supported mode. Establish the semantic structure in the product's
default mode, then map the same roles here.

## Choose endpoints from context
Pure white/black gives maximum nominal contrast. Softer endpoints can reduce glare in
some environments and support a warmer or quieter art direction; pure endpoints can be
appropriate for stark systems or user-selected high contrast. Test real text at target
brightness and preference settings instead of assigning one palette to a diagnosis.

- **Ground:** choose pure or softened white from brand, ambient use, and display context.
- **Ink:** choose black or near-black, then measure every real pair.
- **Neutrals:** true and hue-biased neutrals are both valid when their role is explicit.

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
- Choose neutral temperature from the content; do not import a stock gray without a role.

## Light → dark relationship (one token set)
Define roles once. Other authored modes remap them; forced colors lets system colors take
authority. Do not assume every product needs every authored mode.
