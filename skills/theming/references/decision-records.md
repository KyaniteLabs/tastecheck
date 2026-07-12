# Dark Mode — Meta-Patterns & Decision Records

Reasoning behind the rules, for novel cases. Independent synthesis of established dark-
UI practice (Material Design's dark theme guidance; UX-community consensus 2024–2026).
Credited ideas, original expression.

## Meta-patterns

### MP-1 · Dark mode is a tuned mapping, not an inversion
The eye responds differently on a dark field, so values must be tuned per theme, not
flipped. **Consequence:** build a dark-specific surface ramp,
text tiers, and accent set; share only the *semantic structure* via tokens.

### MP-2 · On dark, light means near, dark means far
Depth cues invert: shadows (darker) can't read against dark, so elevation is shown by
*lighter* surfaces. **Consequence:** higher elevation = lighter gray; shadows are a
secondary reinforcement for floating UI only.

### MP-3 · Nominal contrast is not the whole reading context
Pure white on pure black is 21:1, but comfort also depends on ambient light, display,
type, user preference, and visual direction. **Consequence:** choose endpoints deliberately
and test them; do not turn a common near-black recipe into a universal rule.

### MP-4 · Chroma blooms in the dark
Saturated colors over-stimulate on dark fields. **Consequence:** desaturate + lighten
accents (trivial in OKLCH: +L, −C, same H), and re-verify contrast against every
surface they sit on.

### MP-5 · Tokens are the sync mechanism
Two themes drift unless components reference semantic variables, never raw colors.
**Consequence:** `--color-surface-1/--color-text/--color-accent` swap by theme; components are theme-blind.

## Decision records

### DR-1 · Choose the dark endpoint deliberately
- **Why (MP-3):** near-black preserves more surface/shadow range; pure black can serve
  OLED, projection, high-contrast, or deliberately stark systems.
- **Apply:** start around `#121212`–`#1a1a1a` when no stronger evidence exists, then test.

### DR-2 · Elevation by lightness
- **Why (MP-2):** shadows don't read on dark.
- **Apply:** surface ramp where each step is lighter; or Material white-overlay alphas
  via `color-mix`.

### DR-3 · Off-white text, tiered with explicit grays
- **Why (MP-3):** comfort + reliable contrast on tinted/raised surfaces.
- **Apply:** primary `#ececec`, muted `#a0a0a6` (verify ≥4.5:1); avoid opacity on text.

### DR-4 · Desaturate accents and re-test contrast
- **Why (MP-4):** stop the glow; a light-mode-passing color may fail on dark.
- **Apply:** +L/−C in OKLCH; verify against `--color-bg` and raised surfaces.

### DR-5 · Set color-scheme
- **Why:** native controls/scrollbars stay light otherwise.
- **Apply:** `color-scheme: dark` on the dark `:root`.

### DR-6 · Resolution policy matches supported scope
- **Why (MP-1):** theme choice must be predictable; a control is useful only when the
  product offers multiple supported mappings.
- **Apply:** define application and OS precedence; persist a validated override when a
  user control exists.

## Principle, not property
Distills shared dark-UI practice; credit lineage (Material) where natural, never copy
prose or assets. Your implementation is your own.
