---
name: theming
description: >-
  Use when semantic roles must map coherently across light, dark, forced-colors, or
  saved theme preferences without contrast or no-flash regressions.
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

## Vary the mappings, preserve the contract

The starter values demonstrate role mapping and preference order, not a dark-theme
recipe. Derive each mapping from the supplied semantic roles, ambient conditions,
brand direction, and platform constraints. A credible theme system may use quiet
surfaces, high-information field surfaces, or a more editorial reading surface, but it
must keep role names, forced-colors respect, preference precedence, and measured pairs
intact. When source roles are missing, stop and name the recovery needed rather than
inventing raw values in components.

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

## Theme resolution and recovery

Separate three decisions that are often accidentally merged: stable semantic role names,
the values each supported theme maps to those roles, and the policy that chooses a theme
at render time. Document the precedence in plain language: system forced-colors takes
authority; then an explicit supported user choice; then the operating-system preference;
then the application default. A theme toggle is incomplete until its precedence, storage
behavior, and no-preference fallback are known.

Treat forced-colors as an environment, not another palette. Let system colors and native
control behavior remain authoritative, and preserve warnings, errors, selections, and
focus with text, icons, state, or shape as well as color. If a semantic role is absent,
record a failed recovery row and stop the mapping decision; reusing a convenient accent
silently changes the role’s meaning.

Prove no-flash behavior at the earliest theme application point. State what happens
before the first paint, when a saved choice is unavailable, and how native controls
receive the matching color-scheme. A preference plan is not a verified no-flash result
until a cold-load observation names the theme, artifact, and timing.

## Quick-start

Use `assets/theme-starter.css` for the complete mapping. Preserve the invariants:
tuned dark surfaces, flat high-contrast media queries, `forced-colors` cooperation,
semantic roles, and a no-flash preference applied before first paint.

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

## Completion evidence

Close with a five-field evidence ledger. Put the check ID at the start of Reason and
name the environment or mode in Evidence.

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | role-map — semantic roles across supported themes |  |  |  |
|  | dark-map — tuned values rather than inversion |  |  |  |
|  | resolution — preference, no-flash, and native-control behavior |  |  |  |
|  | forced-colors — high-contrast environmental behavior |  |  |  |
|  | contrast-handoff — per-theme proof and accessibility boundary |  |  |  |

## How to deliver

Report semantic roles, all mappings, resolution policy, no-flash behavior, and per-theme
contrast. Include a task-level proof for each supported environment: a bright setting,
a dim setting, and forced-colors where applicable. Hand source ramps, type, technical
a11y, and cognitive concerns to the adjacent skills. Provenance is credited and
independent.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs coherent light, dark, high-contrast, or forced-colors mappings (+1 in contract.json); avoid: The request is to invent the source palette rather than map semantic roles (+1 in contract.json)
- Exclude: Do not invert a light palette and call it dark mode (+1 in contract.json)
- Stop / handoff: Pause when semantic roles are missing and theme values would be raw-color copies (+1 in contract.json); receives [design-system-interview, improve-existing-website, color-system] -> sends [a11y-pass, cognitive-a11y, responsive-layout]
- Output: A semantic light, dark, and high-contrast theme map with preference behavior and measured pairs
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
