---
name: theming
description: >-
  Use when semantic roles must map coherently across light, dark, forced-colors, or
  saved theme preferences without contrast or no-flash regressions.
---

# Theming

A theme system keeps component roles stable while their values change. Components
reference semantic tokens such as `--color-bg`, `--color-text`, and `--color-focus`;
supported light, dark, or branded modes remap those roles without rewriting components.

This skill builds that system. The hard part isn't the control — it is tuning each
supported mapping in context. Dark is not inverted light, an authored high-contrast theme
is not forced colors, and no mode earns an accessibility claim without measurement.

## The decision order
1. **Semantic tokens first.** Define roles (`--color-bg`, `--color-surface-1/2` (`-3` if elevation needs it),
   `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`,
   `--color-primary-hover`, `--color-primary-ink`, `--color-accent`, `--color-accent-ink`,
   `--color-success`, `--color-error`, `--color-warning`, `--color-info`,
   `--color-focus` — the canonical contract names). Components
   use these only. (Palette comes from `color-system`.)
2. **Choose the product baseline.** Start with the application's default supported mode;
   it may be light, dark, or brand-specific. Set structure and role relationships there.
3. **Tune every additional mapping**, never invert it — for dark, a surface *ramp* (each elevation step
   lighter, not shadowed), comfortable text contrast on dark surfaces, and accents
   retuned for the surrounding lightness. (Depth in `references/surfaces-and-elevation.md` +
   `color-and-contrast.md`.)
4. **Keep authored contrast and forced colors separate.** `prefers-contrast: more` may
   select an authored higher-contrast mapping. `forced-colors` is a system-controlled
   environment: honor system colors instead of treating it as another palette.
5. **Resolve preferences deliberately.** Use `prefers-color-scheme` when applicable;
   add a persistent user control when the product supports selectable themes. Set
   `color-scheme` so native controls follow.
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
- **Choose light surfaces from context.** Pure or softened endpoints can both be valid;
  test contrast, glare conditions, reading comfort, and user preferences rather than
  attaching one palette recipe to a diagnosis.
- **Dark is tuned, not inverted:** near-black surfaces are a reliable default, but pure
  black can be intentional for OLED, projection, or a stark visual system. Express
  elevation through distinguishable surfaces or borders, tune text below glare-inducing
  white where appropriate, and remeasure every accent in context.
- **Ship a defined default and resolution policy.** If users can select a theme, their
  supported choice persists and outranks OS preference. A single-theme product does
  not need a performative toggle.
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
then the application default. When a theme control exists, define its precedence,
storage behavior, and no-preference fallback.

Treat forced-colors as an environment, not another palette. Let system colors and native
control behavior remain authoritative, and preserve warnings, errors, selections, and
focus with text, icons, state, or shape as well as color. If a semantic role is absent,
record a failed recovery row and stop the mapping decision; reusing a convenient accent
silently changes the role’s meaning.

Minimize wrong-theme flash at the earliest theme application point. State what happens
before the first paint, when a saved choice is unavailable, and how native controls
receive the matching color-scheme. A preference plan is not a verified no-flash result
until a cold-load observation names the theme, artifact, and timing.

## Quick-start

Use `assets/theme-starter.css` as a mapping example. Preserve the invariants that apply
to the supported scope: semantic roles, tuned authored mappings, `forced-colors`
cooperation, and early preference resolution when a saved choice exists.

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

Update supported browser chrome where it materially improves the experience. Treat
selection and custom scrollbar styling as optional polish, not completion gates.
### `light-dark()` shorthand

When `color-scheme` drives the switch (no persisted override), `light-dark()` avoids
media-query duplication: `background: light-dark(oklch(96% .02 78), oklch(18% .024 64))`.
Broad browser support (2024+); pair with `[data-theme]` so explicit user choice and
forced-colors still override. Not the sole mechanism when a manual toggle exists.

## Reference files
- `references/surfaces-and-elevation.md` — the **dark** surface ramp + elevation-by-
  lightness (Material overlay model), borders, why shadows fail on dark.
- `references/color-and-contrast.md` — desaturating accents for dark, semantic state
  colors per theme, contrast re-testing, OKLCH conversions.
- `references/light-and-contrast.md` — contextual light mappings, surface relationships,
  accent contrast, and rendered checks.
- `references/high-contrast.md` — `prefers-contrast` + `forced-colors`/Windows High
  Contrast: what to do and what NOT to override.
- `references/decision-records.md` — meta-patterns + ADR rules.

## Completion evidence

Close with a five-field evidence ledger. Put the check ID at the start of Reason and
name the environment or mode in Evidence.

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | role-map — semantic roles across supported themes |  |  |  |
|  | supported-maps — each requested mode is tuned rather than inverted |  |  |  |
|  | resolution — preference, no-flash, and native-control behavior |  |  |  |
|  | forced-colors — high-contrast environmental behavior |  |  |  |
|  | contrast-handoff — per-theme proof and accessibility boundary |  |  |  |

## How to deliver

Report semantic roles, supported mappings, resolution policy, wrong-theme-flash behavior,
and per-theme contrast. Include task-level proof for the environments in scope and
forced-colors where applicable. Hand source ramps, type, technical
a11y, and cognitive concerns to the adjacent skills. Provenance is credited and
independent.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs coherent light, dark, high-contrast, or forced-colors mappings (+1 in contract.json); avoid: The request is to invent the source palette rather than map semantic roles (+1 in contract.json)
- Exclude: Do not invert a light palette and call it dark mode (+1 in contract.json)
- Stop / handoff: Pause when semantic roles are missing and theme values would be raw-color copies (+1 in contract.json); receives [color-system, design-system-interview, improve-existing-website, tasteroll] -> sends [a11y-pass, cognitive-a11y, responsive-layout, component-states]
- Output: Semantic mappings for every supported theme, plus forced-colors behavior, preference policy, and measured pairs
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
