# Dark Mode — Meta-Patterns & Decision Records

Reasoning behind the rules, for novel cases. Independent synthesis of established dark-
UI practice (Material Design's dark theme guidance; UX-community consensus 2024–2026).
Credited ideas, original expression.

## Meta-patterns

### MP-1 · Dark mode is a separate design system, not an inversion
The eye responds differently on a dark field, so values must be tuned per theme, not
flipped. **Consequence:** never `#fff`↔`#000`. Build a dark-specific surface ramp,
text tiers, and accent set; share only the *semantic structure* via tokens.

### MP-2 · On dark, light means near, dark means far
Depth cues invert: shadows (darker) can't read against dark, so elevation is shown by
*lighter* surfaces. **Consequence:** higher elevation = lighter gray; shadows are a
secondary reinforcement for floating UI only.

### MP-3 · Maximum contrast is not maximum comfort
Pure white on pure black is 21:1 and physically uncomfortable — edges vibrate, strain
rises. **Consequence:** aim high-but-not-max (~15:1 body); off-white on near-black.

### MP-4 · Chroma blooms in the dark
Saturated colors over-stimulate on dark fields. **Consequence:** desaturate + lighten
accents (trivial in OKLCH: +L, −C, same H), and re-verify contrast against every
surface they sit on.

### MP-5 · Tokens are the sync mechanism
Two themes drift unless components reference semantic variables, never raw colors.
**Consequence:** `--surface/--text/--accent` swap by theme; components are theme-blind.

## Decision records

### DR-1 · Background ≥ #121212, never #000
- **Why (MP-3):** pure black maxes contrast and kills shadow depth.
- **Apply:** `#121212`–`#1a1a1a`, optional 5–10% hue tint.

### DR-2 · Elevation by lightness
- **Why (MP-2):** shadows don't read on dark.
- **Apply:** surface ramp where each step is lighter; or Material white-overlay alphas
  via `color-mix`.

### DR-3 · Off-white text, tiered with explicit grays
- **Why (MP-3):** comfort + reliable contrast on tinted/raised surfaces.
- **Apply:** primary `#ececec`, muted `#a0a0a6` (verify ≥4.5:1); avoid opacity on text.

### DR-4 · Desaturate accents and re-test contrast
- **Why (MP-4):** stop the glow; a light-mode-passing color may fail on dark.
- **Apply:** +L/−C in OKLCH; verify against `--bg` and raised surfaces.

### DR-5 · Set color-scheme
- **Why:** native controls/scrollbars stay light otherwise.
- **Apply:** `color-scheme: dark` on the dark `:root`.

### DR-6 · Default + persistent toggle
- **Why (MP-1):** respect OS preference but don't trap the user.
- **Apply:** `prefers-color-scheme` default; `data-theme` override class that persists
  and wins.

## Principle, not property
Distills shared dark-UI practice; credit lineage (Material) where natural, never copy
prose or assets. Your implementation is your own.
