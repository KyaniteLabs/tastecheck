# Dark Mode — Color & Contrast

Read this when accents glow, brand colors look wrong, or contrast needs verifying on
dark.

## Why saturated colors fail on dark

A bright, saturated color on a dark background appears to "vibrate" or bloom — the
high chroma + high contrast at the edges over-stimulates. Saturated blues are also
hard to read (blue is the hardest hue for the eye to focus at low light). The fix:
**desaturate and lighten** every accent for dark mode.

## Desaturate + lighten (one line in OKLCH)

OKLCH separates lightness (L), chroma (C), hue (H), so adjusting for dark is direct:
- **Raise L** (the color sits on a dark field, so it needs to be lighter to read).
- **Lower C** (cut chroma ~20–40% to stop the glow).
- Keep H (hue) the same so it's recognizably the brand color.

```css
/* light mode */ --color-accent: oklch(0.55 0.18 250);
/* dark  mode */ --color-accent: oklch(0.72 0.12 250);   /* +L, -C, same H */
```
If you only store HSL/hex, reduce saturation ~15–25% and raise lightness ~10–15%.

## Contrast must be re-tested on dark surfaces

A brand color tuned for white often fails on dark and vice-versa. WCAG targets are
unchanged but the background changed:
- Body text ≥ **4.5:1**, large text / UI components / icons ≥ **3:1**, measured
  against the actual surface the element sits on (remember: raised surfaces are
  lighter, so an element on `--color-surface-2` has *less* contrast headroom than on `--color-bg`).
- Accent text/links: verify the accent against `--color-bg` AND against `--color-surface-2` if it
  appears on cards.
- Don't rely on color alone for state (error/success) — pair with icon/text.

## Semantic state colors on dark

The light-mode red/green/amber are usually too saturated. Provide dark-tuned variants:

```css
:root { --color-success:#1a7f37; --color-error:#cf222e; --color-warning:#9a6700; }
@media (prefers-color-scheme: dark) {
  :root {
    --color-success: oklch(0.78 0.15 150);
    --color-error:   oklch(0.72 0.17 25);
    --color-warning: oklch(0.82 0.14 85);
  }
}
```
Tint their backgrounds with `color-mix` so alert surfaces don't blast:
`background: color-mix(in oklab, var(--color-error) 18%, var(--color-bg));`

## Handling brand colors that just won't pass

If the brand color can't hit contrast on dark even after tuning:
1. Use it for large/decorative elements (≥3:1 large-text rule) and a lighter tint for
   text/links.
2. Create a "brand-on-dark" token that's a lightened cousin, used only in dark theme.
3. For solid brand buttons, ensure the *label* contrast (text on the brand fill) ≥
   4.5:1 — often the button fill must lighten in dark mode for the dark label to work,
   or keep a light label.

## Text tiers

- Primary text: `#ececec` (≈15:1 on `#121212`).
- Secondary/muted: `#a0a0a6` (still ≥ 4.5:1 — verify; don't go below).
- Disabled: lower, but it's exempt from contrast minimums (keep it perceivable).
- Prefer explicit grays over `opacity` on text, because opacity over a tinted/raised
  surface shifts the effective color and can drop below contrast.
