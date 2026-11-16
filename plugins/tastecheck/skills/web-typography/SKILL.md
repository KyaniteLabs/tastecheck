---
name: web-typography
description: >-
  Use when a web product needs a contextual type system, resilient font loading,
  multilingual glyph or wrap coverage, or readable hierarchy across operational and
  editorial surfaces.
---

# Web Typography

Set type for screens, not print: **legible**, **readable**, and hierarchically clear across
viewports, zoom, and font preferences. Work top-down: roles, measure, scale, loading, polish.
Fit reading task, language coverage, density, and brand.

## The decision order

Make these decisions in sequence; each constrains the next.

1. **Font choice** — A fast system stack is deliberate for operational UI. For brand,
   marketing, portfolio, or launch surfaces, start from the design-system interview and choose
   a display/body stance. Plan web-font loading (step 6) up front.
2. **Base size & measure** — Start around `1rem` and 45–75 characters per line; test
   the actual face, language, density, and viewport.
3. **Type scale** — Define a small role scale. Use a modular ratio to start, then set optical
   values; use fluid sizing only where the role benefits.
4. **Vertical rhythm** — Start body line-height around 1.4–1.6, tighten display roles,
   and verify clipping/spacing with the chosen face and scripts.
5. **Hierarchy & polish** — Use weight/size/space contrast, `text-wrap: balance` on
   headings, `pretty` on body where supported, OpenType features, and optical tracking.
   Numeric tracking recipes are starting points, not universal values.
6. **Loading & performance** — Choose `font-display`, preload only a genuinely critical known
   resource, prefer WOFF2, and metric-match the fallback where reflow matters.
7. **Accessibility pass** — Check contrast, zoom to 200%, WCAG 1.4.12 text-spacing
   overrides, enabled zoom, and rendered justified-reading text.

## Derive a type stance from use, not a sample pairing

Quick-start faces and scales show constraints, not defaults. Start from reading task, density,
language coverage, brand direction, and loading budget. Public narrative, data-dense operations,
and multilingual transactions may need different hierarchy and fallbacks. Record intended
reading behavior plus computed-size, wrap/measure, glyph-coverage, and loading evidence;
variation must change the type system without weakening those checks.

## Non-negotiables (the rules that prevent the common failures)

Apply these rules to novel cases, not just the sample.

- **Use user-relative units.** Prefer `rem` for document roles and `em` for components
  that scale with context. Pixels are not inherently inaccessible, but a pixel-only
  system detaches from user preferences and scales poorly.
- **Use unitless line-height.** `line-height: 1.5` inherits a ratio and recomputes per
  element; `line-height: 24px` inherits a computed pixel value and breaks on children.
- **Bound fluid type.** Include a relative-unit contribution and test zoom/text resize:
  `clamp(2rem, 1rem + 3vw, 4rem)`.
- **Constrain measure.** Lines over ~75 characters lose the return sweep; under ~45
  become choppy. `max-width: 66ch` is a high-leverage readability fix.
- **Default sustained reading to ragged text.** Justification needs language-aware
  hyphenation, adequate measure, and rendered review or it creates rivers.
- **Control layout shift.** Pair `font-display` with a **metric-matched fallback**
  (`size-adjust` + `ascent/descent/line-gap-override`) and measure it. This reduces
  font reflow but cannot support a zero-CLS claim without observation.

## Role map and metric budget

Build the role map before naming faces. Separate scanning roles (labels, identifiers, tables:
stable width, clear wraps, numeric behavior) from sustained reading (calmer measure, hierarchy,
rhythm). Record job, size/measure, language coverage, numeric feature, fallback, and verification.

Test longest translation, accents, punctuation, dense labels, and comparison values (including
tabular figures). A family is a hypothesis until loaded face and fallback render specimens
without clipping, substitution, or unstable hierarchy.

For each loaded face, record fallback, metric overrides, critical reflow text, and observed
layout shift. A system stack is valid when it fits; a custom face needs coverage and metric
proof. Missing measurements are gates, never zero-CLS claims.

## Quick-start

Use `assets/starter.css` for the complete scale and metric-matched font example. Keep
contextual roles, readable measure, fluid sizing, language coverage, measured loading/CLS,
and no duplicate reduced-motion contract here.
### Canonical tokens

| Token | Role |
|-------|------|
| `--step--2` | Fine print / legal / footnotes |
| `--step--1` | Captions / small labels |
| `--step-0` | Body text |
| `--step-1` through `--step-5` | Headings through display |
| `--font-body` / `--font-display` / `--font-mono` | Font role stacks |
| `--measure` | Max line length (`~66ch`) |

## Reference files

- **`references/decision-records.md`** — ADR rationale/rejected alternatives; read for novel
  judgments and the "principle, not property" boundary.
- **`references/foundations.md`** — web anatomy, measure, hierarchy, pairing, alignment; read
  for font pairing or unexplained layout problems.
- **`references/fluid-scale.md`** — `clamp()` math, modular ratios, Utopia, and `cqi`; read for
  scale or container-driven type.
- **`references/font-loading.md`** — loading, WOFF2, subsetting, variable fonts, and
  metric-matched fallbacks; read for custom-font or layout-shift issues.
- **`references/accessibility.md`** — WCAG 2.2 contrast, 200% resize (1.4.4), text-spacing
  (1.4.12), zoom, readability, and reduced motion; read before accessibility/compliance claims.
- **`references/modern-css.md`** — text wrapping, OpenType, text-box, punctuation, `lh`/`cap`/
  `ch`/`ic`, line-clamp, and `color-mix`; read for polish/enhancement checks.

## How to deliver

Explain the type decision, edit existing tokens, and keep unsupported features progressive.
Report contrast, 200% zoom, text-spacing, loading, and glyph evidence; pair multilingual
work with `i18n-ready`.

## Completion evidence

Close with a five-field evidence ledger. Start Reason with the check ID; record an
observed result or explicit verification gate.

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | role-map — contextual type stance and language coverage |  |  |  |
|  | reading-behavior — scale, measure, wrap, and numeric behavior |  |  |  |
|  | metrics — loading and fallback measurement |  |  |  |
|  | accessibility — zoom, text-spacing, and contrast result |  |  |  |
|  | handoff — responsive-layout boundary |  |  |  |

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A web interface needs a contextual type stance, scale, readable measure, or font-loading plan (+1 in contract.json); avoid: The request is to write or rewrite product copy (+1 in contract.json)
- Exclude: Do not choose a font from examples instead of the brief (+1 in contract.json)
- Stop / handoff: Pause when a requested font lacks required language coverage and no fallback is agreed (+1 in contract.json); receives [design-system-interview, deslop-ui, improve-existing-website, tasteroll] -> sends [responsive-layout, i18n-ready, a11y-pass, spacing-system]
- Output: A contextual type system with tokens, loading plan, and tested reading constraints
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
