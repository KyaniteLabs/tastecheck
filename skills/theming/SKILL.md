---
name: theming
description: >-
  Semantic theme system for light, dark, and high contrast. Use for dark mode,
  theme toggles, prefers-color-scheme, forced-colors, accessible contrast,
  surface/elevation tokens, persistent user choice, and re-themeable components.
---

# Theming (light · dark · high-contrast, from one token source)

A "dark mode" bolted onto a light site is half a design system. A real theme system has
**one set of semantic tokens** (`--color-bg`, `--color-surface-1`, `--color-text`,
`--color-accent`, …) and **many mappings** of them: light (the baseline), dark, and
high-contrast. Components reference the *roles*, never raw colors, so switching themes
is one swap and nothing drifts. The token names are the canonical tastecheck contract
(defined in the `design-system-interview` skill's tokens reference); never rename
them per project.

This skill builds that system. The hard part isn't the toggle — it's that **each theme
is tuned, not flipped**: dark isn't inverted light (pure-black vibrates, saturated colors
bloom, shadows vanish), and high-contrast isn't "more contrast everywhere" (it's
forced-colors-aware). Every value here is checkable.

## The decision order
1. **Semantic tokens first.** Define roles (`--color-bg`, `--color-surface-1/2`,
   `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`,
   `--color-accent-ink`, `--color-focus` — the canonical contract names). Components
   use these only. (Palette comes from `color-system`.)
2. **Light is the baseline** — design it first (most users, most contexts). Off-white,
   not pure glare (helps dyslexia — see `cognitive-a11y`); real elevation.
3. **Dark is a tuned mapping**, not an inversion — surface *ramp* (each elevation step
   lighter, not shadowed), off-white text on near-black (never #fff on #000), accents
   desaturated + lightened. (Depth in `references/surfaces-and-elevation.md` +
   `color-and-contrast.md`.)
4. **High-contrast theme** — a third mapping for `prefers-contrast: more` and
   `forced-colors` (Windows High Contrast): max legibility, system colors honored, never
   suppressed. (See `references/high-contrast.md`.)
5. **Wire it up** — `prefers-color-scheme` default + a **persistent toggle** that wins;
   `color-scheme` set so native controls follow.
6. **Verify each theme** — contrast on the *actual* surfaces of *each* theme.

## Non-negotiables
- **One semantic-token source; components never hard-code colors.** Re-theming = remap
  tokens, nothing else.
- **Light baseline ≠ pure #fff/#000.** Off-white ground, softened ink — max glare hurts
  readability (dyslexia/sensory). Still meet WCAG.
- **Dark is tuned, not inverted:** bg ≈ `#121212`–`#1a1a1a` (never `#000`); elevation by
  **lighter** surfaces; text off-white ~`#ececec` (not `#fff`); accents desaturated +
  lightened (OKLCH +L/−C).
- **Ship a default AND a toggle.** `prefers-color-scheme` for the default; a persistent
  override class (localStorage) that beats it. Don't trap users in OS preference.
- **`color-scheme` declared** per theme (native controls/scrollbars follow).
- **Respect `forced-colors`/high-contrast** — don't override system colors there; use
  `forced-color-adjust` only deliberately, keep focus visible.
- **Contrast re-verified per theme** (body ≥4.5, large/UI ≥3) against that theme's
  surfaces — a color that passes in light often fails in dark, and vice-versa.

## Quick-start: tokens + 3 themes + toggle
The full starter (light + dark + high-contrast, `prefers-color-scheme`, persistent
toggle, `forced-colors`, dim-media-on-dark) is in `assets/theme-starter.css`. Shape:

```css
/* Values below are EXAMPLE light/dark mappings — yours come from your DESIGN-SYSTEM.md
   and color-system ramp. The TOKEN NAMES are the contract; keep them exactly. */
:root{ color-scheme:light;
  --color-bg:#f7f4ee; --color-surface-1:#fffdf9; --color-surface-2:#efebe2;  /* off-white, not #fff glare */
  --color-text:#211d18; --color-text-muted:#5d574f; --color-border:#ddd6c9;
  --color-accent:var(--accent-500); --color-accent-ink:#fff;
  --color-focus:var(--color-accent);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  color-scheme:dark;
  --color-bg:#121212;                                                  /* never #000 */
  --color-surface-1:color-mix(in oklab,#fff 6%,var(--color-bg));       /* elevation = lighter */
  --color-surface-2:color-mix(in oklab,#fff 9%,var(--color-bg));
  --color-text:#ececec; --color-text-muted:#a0a0a6;
  --color-border:color-mix(in oklab,#fff 14%,var(--color-bg));
  --color-accent:var(--accent-300);                                    /* dark accent = +L, −C */
}}
:root[data-theme="dark"]{ /* same dark block, as an explicit override */ }

/* High contrast: keep the media queries FLAT (one condition each) — nested
   media queries are valid CSS but easy to break when editing. */
@media (prefers-contrast: more){
  :root{ --color-bg:#fff; --color-text:#000; --color-border:#000; --color-text-muted:#1a1a1a; }
  :root[data-theme="dark"]{ --color-bg:#000; --color-text:#fff; --color-border:#fff; --color-text-muted:#e6e6e6; }
}
@media (prefers-contrast: more) and (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --color-bg:#000; --color-text:#fff; --color-border:#fff; --color-text-muted:#e6e6e6; }
}
@media (forced-colors: active){ :root{ /* let system colors win; keep focus visible */ } }
body{ background:var(--color-bg); color:var(--color-text); }
```

**No-flash toggle (the part everyone gets wrong):** the persistent override must be
applied *before first paint* — an inline `<head>` script that reads localStorage and
sets `data-theme` on `<html>`, not a deferred bundle (which flashes the wrong theme):

```html
<script>/* inline, in <head>, before CSS paint */
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
</script>
```

Also set `<meta name="theme-color">` per theme (browser chrome follows), and style
`::selection` + scrollbars from the same tokens so no surface escapes the system.

## Reference files
- `references/surfaces-and-elevation.md` — the **dark** surface ramp + elevation-by-
  lightness (Material overlay model), borders, why shadows fail on dark.
- `references/color-and-contrast.md` — desaturating accents for dark, semantic state
  colors per theme, contrast re-testing, OKLCH conversions.
- `references/light-and-contrast.md` — the **light** baseline (off-white not glare,
  real elevation, accent contrast) + the dyslexia/sensory tie-in.
- `references/high-contrast.md` — `prefers-contrast` + `forced-colors`/Windows High
  Contrast: what to do and what NOT to override.
- `references/decision-records.md` — meta-patterns + ADR rules.

## Self-check
1. One semantic-token set; components reference roles only (no hard-coded colors)?
2. Light baseline off-white (not #fff glare); ink softened (not pure #000)?
3. Dark tuned not inverted: bg≥#121212, elevation by lightness, off-white text, accents +L/−C?
4. High-contrast / `forced-colors` handled; system colors not suppressed; focus visible?
5. `prefers-color-scheme` default + persistent toggle that wins; `color-scheme` set?
6. Contrast re-verified on each theme's real surfaces (body ≥4.5, large/UI ≥3)?

## How to deliver
- State the token roles and the three mappings; report contrast per theme.
- Pair with `color-system` (ramp), `web-typography`, `a11y-pass` (run its audit per
  theme), `cognitive-a11y` (off-white/calm).
- Provenance: distills Material dark-theme guidance + WCAG + forced-colors practice;
  credited, expressed independently.
