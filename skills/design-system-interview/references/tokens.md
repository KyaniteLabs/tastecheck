# Design Tokens — Architecture for the Output

Read when writing the artifact. The interview's decisions become **design tokens** the
other frontend skills consume. Keep the structure simple and current (2026 consensus):
**two tiers — primitive → semantic** — and only add a third (component) tier if truly
needed. Starting with primitive + semantic is the recommended default; component-scoped
tokens are a "only when necessary" escalation.

## The two tiers (start here)

1. **Primitive (raw) tokens** — the actual values, named by what they *are*. No meaning,
   just the palette/scale. E.g. `--brand-600: oklch(0.54 0.16 30)`, `--space-4: 1rem`,
   `--radius-2: 4px`. Generated, not hand-picked (color-system builds the ramp).
2. **Semantic (role) tokens** — named by *job*, referencing primitives. This is what
   components use. E.g. `--color-bg`, `--color-text`, `--color-primary`,
   `--color-border`, `--radius-control`, `--space-section`. Re-theming = remap these.

Components reference **semantic only**, never primitives. That's what makes the system
coherent and themeable (and what lets `theming` swap the mapping for dark and high contrast).

Optional third tier — **component tokens** (`--button-bg`) — only when a component needs
to diverge from the semantic defaults. Don't add it preemptively; it's overhead.

## What to emit from the interview

A token block capturing the committed decisions, ready for the other skills to fill in
the generated values:

```css
:root {
  /* ---- PRIMITIVE (color-system generates the full ramp from the anchor hue) ---- */
  /* anchor hue from Q5; ramp via color-system/oklch-ramp */
  --brand-500: oklch(0.62 0.16 <H>);   /* ... 50–900 ramp ... */
  --neutral-500: oklch(0.62 0.012 <H>);/* neutrals tinted toward brand */
  --accent-500: oklch(0.65 0.18 <Haccent>);

  /* type faces from Q4 (web-typography builds the scale) */
  --font-display: "<Display>", serif;
  --font-body: "<Body>", system-ui, sans-serif;

  /* shape & density from Q6 */
  --radius-control: <0–4|8–12|16+>px;
  --radius-card: <…>px;
  --density: <spacious|dense>;          /* drives spacing scale base */
  --elevation-style: <flat|layered>;

  /* ---- SEMANTIC (what components use) ---- */
  --color-bg: var(--neutral-50);
  --color-surface: var(--neutral-100);
  --color-text: var(--neutral-900);
  --color-text-muted: var(--neutral-600);
  --color-primary: var(--brand-600);
  --color-primary-hover: var(--brand-700);
  --color-accent: var(--accent-500);
  --color-border: var(--neutral-200);
  --color-focus: var(--brand-600);
}
```

Leave generated specifics (full ramps, type scale steps) to the implementing skills —
this block is the *contract*; they fill it in:
- **color-system** → full OKLCH ramp + verified-contrast semantic colors + dark variant.
- **web-typography** → fluid type scale from the chosen faces, measure, rhythm.
- **theming** → light/dark/high-contrast remaps of the semantic tokens.
- **component-states / form-ux / empty-states** → implement using semantic tokens.
- **micro-motion** → motion tokens at the chosen level.
- **deslop-ui** → audits the built UI against this committed spec, not the average.

## Naming rules
- Semantic names describe **role**, not value: `--color-danger`, not `--color-red`.
- Primitives describe **value/scale position**: `--brand-600`, `--space-4`.
- Be consistent: `--{category}-{role|step}`. Don't mix conventions.
- One source of truth: the other skills *extend* this, never fork a parallel set.

## Why two tiers, not more
A common 2026 recommendation: stick to primitive + semantic when starting; only add
component tokens if a component genuinely needs to break from semantics. More tiers =
more indirection to maintain. Match the system's complexity to the project.
