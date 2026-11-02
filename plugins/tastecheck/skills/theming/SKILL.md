---
name: theming
description: >-
  Use when semantic roles must map coherently across light, dark, forced-colors, or
  saved theme preferences without contrast or no-flash regressions.
---

# Theming

A theme system keeps component roles stable while modes remap values. Components reference
semantic tokens such as `--color-bg`, `--color-text`, and `--color-focus`; measure every mode
before claiming accessibility. Dark is not inverted light; authored high contrast is not
forced colors.

## The decision order
1. **Semantic tokens first.** Define roles (`--color-bg`, `--color-surface-1/2` (`-3` if elevation needs it),
   `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`,
   `--color-primary-hover`, `--color-primary-ink`, `--color-accent`, `--color-accent-ink`,
   `--color-success`, `--color-error`, `--color-warning`, `--color-info`,
   `--color-focus` — canonical contract names). Components use these only; palette comes
   from `color-system`.
2. **Choose the product baseline.** Start with the default supported mode; set structure and
   role relationships there.
3. **Tune every additional mapping**, never invert it. For dark, use a lighter-per-level
   surface *ramp*, comfortable text contrast, and retuned accents. See
   `references/surfaces-and-elevation.md` and `color-and-contrast.md`.
4. **Separate authored contrast from forced colors.** `prefers-contrast: more` may select a
   higher-contrast mapping; `forced-colors` is system-controlled, so honor its colors.
5. **Resolve preferences deliberately.** Use `prefers-color-scheme`, persist selectable
   themes, and set `color-scheme` so native controls follow.
6. **Verify each theme** on its *actual* surfaces.

## Vary mappings, preserve contract

Starter values show role mapping, not a dark recipe. Derive mappings from roles, ambient
conditions, brand, and platform constraints; keep role names, forced-colors respect,
preference precedence, and measured pairs intact. Missing roles require named recovery; never
invent component colors.

## Non-negotiables
- **One semantic-token source; components never hard-code colors.** Re-theming remaps
  tokens only.
- **Choose light surfaces from context.** Pure or softened endpoints can both be valid;
  test contrast, glare, reading comfort, and preferences.
- **Dark is tuned, not inverted:** near-black is reliable, but pure black can suit OLED,
  projection, or a stark system. Distinguish elevation with surfaces/borders, tune text
  below glare-inducing white where appropriate, and remeasure accents.
- **Ship a default and resolution policy.** A supported user choice persists and outranks
  OS preference; a single-theme product needs no toggle.
- **`color-scheme` declared** per theme (native controls/scrollbars follow).
- **Respect `forced-colors`/high-contrast** — don't override system colors; use
  `forced-color-adjust` deliberately and keep focus visible.
- **Contrast re-verified per theme** (body ≥4.5, large/UI ≥3) against that theme's
  surfaces — a color that passes in light often fails in dark, and vice-versa.

## Resolution and recovery

Separate role names, theme values, and selection. Document precedence: system forced-colors;
supported user choice; OS preference; application default. For a control, define storage and
fallback.

Forced-colors is an environment, not a palette: keep system colors/native controls authoritative
and preserve warnings, errors, selections, and focus with text, icons, state, or shape. If a
role is absent, record a failed recovery row and stop; reusing an accent changes its meaning.

Apply the theme early to minimize wrong-theme flash. State pre-paint behavior, unavailable
saved choices, and native-control `color-scheme`. No-flash needs a cold-load observation
naming theme, artifact, and timing.

## Quick-start

Use `assets/theme-starter.css`; preserve roles, tuned mappings, `forced-colors` cooperation,
and early saved-preference resolution.

**Early saved-theme resolution:** when a persistent control exists, apply the validated
override before render. In a CSP-compatible implementation, this is commonly a small
nonced or hashed `<head>` script rather than a deferred bundle:

```html
<script>/* inline, in <head>, before CSS paint */
  try {
    const t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
  } catch {
    /* Storage is unavailable; CSS keeps the OS/application default authoritative. */
  }
</script>
```

Browser chrome, selection, and custom scrollbars are optional polish, not completion gates.
### `light-dark()` shorthand

When `color-scheme` drives the switch (no persisted override), `light-dark()` avoids
media-query duplication: `background: light-dark(oklch(96% .02 78), oklch(18% .024 64))`.
Broad browser support (2024+); pair with `[data-theme]` so explicit choice and
forced-colors override. It is not the sole mechanism with a manual toggle.

## Reference files
- `references/surfaces-and-elevation.md` — **dark** ramp, elevation, borders, shadow limits.
- `references/color-and-contrast.md` — dark accents, state colors, contrast, OKLCH.
- `references/light-and-contrast.md` — light mappings, relationships, accents, rendered checks.
- `references/high-contrast.md` — `prefers-contrast` + `forced-colors`; override limits.
- `references/decision-records.md` — meta-patterns + ADR rules.

## Ledger

Close with five-field ledger. Start Reason with the check ID; name mode/environment in Evidence.

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | role-map — semantic roles across supported themes |  |  |  |
|  | supported-maps — each requested mode is tuned rather than inverted |  |  |  |
|  | resolution — preference, no-flash, and native-control behavior |  |  |  |
|  | forced-colors — high-contrast environmental behavior |  |  |  |
|  | contrast-handoff — per-theme proof and accessibility boundary |  |  |  |

## How to deliver

Report roles, mappings, resolution, wrong-theme-flash behavior, and per-theme contrast, with
scoped-environment and forced-colors proof when applicable. Hand source ramps, type, technical
a11y, and cognitive concerns to adjacent skills. Provenance is credited and independent.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs coherent light, dark, high-contrast, or forced-colors mappings (+1 in contract.json); avoid: The request is to invent the source palette rather than map semantic roles (+1 in contract.json)
- Exclude: Do not invert a light palette and call it dark mode (+1 in contract.json)
- Stop / handoff: Pause when semantic roles are missing and theme values would be raw-color copies (+1 in contract.json); receives [color-system, design-system-interview, improve-existing-website, tasteroll] -> sends [a11y-pass, cognitive-a11y, responsive-layout, component-states]
- Output: Semantic mappings for every supported theme, plus forced-colors behavior, preference policy, and measured pairs
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
