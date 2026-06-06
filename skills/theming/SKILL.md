---
name: theming
description: >-
  Semantic theme system for light, dark, and high contrast. Use for dark mode,
  theme toggles, prefers-color-scheme, forced-colors, accessible contrast,
  surface/elevation tokens, persistent user choice, and re-themeable components.
---

# Theming (light · dark · high-contrast, from one token source)

A "dark mode" bolted onto a light site is half a design system. A real theme system has
**one set of semantic tokens** (`--bg`, `--surface`, `--text`, `--accent`, …) and **many
mappings** of them: light (the baseline), dark, and high-contrast. Components reference
the *roles*, never raw colors, so switching themes is one swap and nothing drifts.

This skill builds that system. The hard part isn't the toggle — it's that **each theme
is tuned, not flipped**: dark isn't inverted light (pure-black vibrates, saturated colors
bloom, shadows vanish), and high-contrast isn't "more contrast everywhere" (it's
forced-colors-aware). Every value here is checkable.

## The decision order
1. **Semantic tokens first.** Define roles (`--bg/--surface-1../--text/--text-muted/
   --border/--accent/--accent-ink/--focus`). Components use these only. (Palette comes
   from `color-system`.)
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
:root{ color-scheme:light;
  --bg:#faf7f0; --surface-1:#fff; --surface-2:#f2efe7;     /* off-white, not #fff glare */
  --text:#1a1714; --text-muted:#5b5650; --border:#e4ded3;
  --accent:oklch(0.55 0.16 250); --accent-ink:#fff; --focus:var(--accent);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  color-scheme:dark;
  --bg:#121212; --surface-1:color-mix(in oklab,#fff 6%,var(--bg));   /* elevation = lighter */
  --surface-2:color-mix(in oklab,#fff 9%,var(--bg));
  --text:#ececec; --text-muted:#a0a0a6; --border:color-mix(in oklab,#fff 14%,var(--bg));
  --accent:oklch(0.72 0.12 250);                                     /* +L, −C for dark */
}}
:root[data-theme="dark"]{ /* same dark block, as an explicit override */ }
@media (prefers-contrast: more){
  :root{ --bg:#fff; --text:#000; --border:#000; --text-muted:#1a1a1a; }
  :root[data-theme="dark"]{ --bg:#000; --text:#fff; --border:#fff; --text-muted:#e6e6e6; }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){ --bg:#000; --text:#fff; --border:#fff; --text-muted:#e6e6e6; }
  }
}
@media (forced-colors: active){ :root{ /* let system colors win; keep focus visible */ } }
body{ background:var(--bg); color:var(--text); }
```

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
