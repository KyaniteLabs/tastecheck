---
name: web-typography
description: >-
  Use when a web product needs a contextual type system, resilient font loading,
  multilingual glyph or wrap coverage, or readable hierarchy across operational and
  editorial surfaces.
---

# Web Typography

You are setting type for screens, not print. The goal is text that is **legible**
(can you tell the letters apart), **readable** (is it comfortable to read at
length), and **clear in hierarchy** (does the eye know where to go) — across every
viewport, zoom level, and font preference a real user might have.

This skill encodes a small number of decisions that matter most, in the order you
should make them. Work top-down: get the **system** right (scale, measure, rhythm)
before reaching for clever features. Most "bad typography" on the web is not a
missing OpenType flag — it's a body size that's too small, a measure that's too
wide, line-height that's too tight, and a font that shifts the layout when it loads.

## Provenance — principle, not property

This skill is an **independent synthesis of widely-taught typographic principles**,
not a reproduction of anyone's writing, examples, or designs. Ideas are attributed to
their lineage (e.g. measure from Bringhurst, Letter→Text→Grid from Lupton, the modular
scale from Tim Brown) because crediting an idea is scholarship — but the expression and
the web translation here are this skill's own. When you apply or extend it, do the
same: express principles in your own words, credit the source of an idea where natural,
and never copy a source's prose, sample layouts, or proprietary content. The shared
*knowledge* is yours to use; any individual's *expression* is not.

## The decision order

Make these decisions in sequence. Each one constrains the next.

1. **Font choice** — For operational/product UI, a fast, good system stack is a
   valid deliberate choice. For brand, marketing, portfolio, or launch surfaces,
   start from the design-system interview and choose a display/body stance with
   personality. If you load a web font, plan its loading (step 6) at the same time.
2. **Base size & measure** — Body text ≥ `1rem` (16px), line-length 45–75
   characters (`max-width: ~66ch`). These two do more for readability than anything else.
3. **Type scale** — Pick one modular ratio and derive every size from it. Make it
   fluid with `clamp()`. Don't hand-pick random px values.
4. **Vertical rhythm** — Line-height ~1.5 for body, tighter (1.1–1.3) for large
   headings. Space paragraphs *or* indent them, never both.
5. **Hierarchy & polish** — Weight/size/space contrast, `text-wrap: balance` on
   headings and `pretty` on body, OpenType features, and tracking: display sizes
   (step-3 and up) get −0.01 to −0.03em letter-spacing, ALL-CAPS labels get +0.05 to
   +0.1em — body text is never negative-tracked.
6. **Loading & performance** — `font-display`, preload the one critical font,
   self-host WOFF2, and **metric-match the fallback** so the page doesn't shift (CLS).
7. **Accessibility pass** — Contrast, zoom to 200%, the WCAG 1.4.12 text-spacing
   overrides, never disable zoom, never justify body text.

## Derive a type stance from use, not a sample pairing

The quick-start faces and scales demonstrate constraints; they are not default answers.
Start from the reading task, information density, language coverage, brand direction,
and loading budget. A public narrative, a data-dense operational surface, and a
multilingual transactional flow may all require different hierarchy and fallback
decisions. Record the intended reading behavior, then show computed-size, wrap/measure,
glyph-coverage, and loading evidence. Variation is meaningful only when it changes the
type system’s structure, territory, and explanatory approach without weakening those
checks.

## Non-negotiables (the rules that prevent the common failures)

These are the mistakes that show up again and again. Internalize the *why* so you
can apply them in novel situations, not just copy them.

- **Size body text in `rem`, never `px`.** `rem` respects the user's browser
  font-size setting; `px` silently overrides an accessibility preference. Reserve
  `px` for hairline borders and genuinely fixed physical details.
- **Line-height is unitless.** `line-height: 1.5` is inherited as a *ratio*, so
  each element recomputes from its own size. A fixed `line-height: 24px` inherits
  the computed pixel value and breaks on differently-sized children.
- **Never size fonts in pure `vw`.** Viewport units don't respond to zoom or user
  font-size — that fails WCAG 1.4.4. Always wrap fluid sizing in `clamp()` with a
  `rem` term: `clamp(2rem, 1rem + 3vw, 4rem)`. The `rem` keeps zoom working.
- **Constrain the measure.** Lines longer than ~75 characters make the eye lose its
  place on the return sweep; shorter than ~45 gets choppy. `max-width: 66ch` on
  text containers is the single highest-leverage readability fix.
- **Never justify body text on the web.** CSS justification without sophisticated
  hyphenation opens "rivers" of whitespace. Left-align, ragged right.
- **A web font must not shift the layout when it loads.** Pair `font-display` with
  a **metric-matched fallback** (`size-adjust` + `ascent/descent/line-gap-override`)
  so swapping the real font in causes zero reflow. This is the fix for font-driven CLS.

## Role map and metric budget

Build a role map before naming faces. It distinguishes scanning work from sustained
reading while keeping both recognizably part of one product: operational labels,
identifiers, and tables need stable width, clear wraps, and numeric behavior; public
narrative needs a calmer measure, stronger editorial hierarchy, and a reading rhythm
that does not leak into dense controls. The role map records each role’s reading job,
size and measure, language coverage, numeric feature, fallback, and verification path.

Test language coverage with a real longest translation, accented characters, punctuation,
and the dense labels that create wrapping pressure. Test numeric tables with the values
users compare, including tabular figures where alignment carries meaning. A declared
font family is only a hypothesis until the loaded font and fallback both render those
specimens without clipping, substitution, or an unstable hierarchy.

For every loaded face, keep a metric budget: chosen fallback, size or metric overrides,
critical text that may reflow, and the observed layout-shift result. A system stack is a
valid final choice when it suits the role; a custom face is a valid choice when its
coverage and metric proof justify its cost. In either case, phrase missing measurements
as a verification gate, never as a zero-CLS claim.

## Quick-start

Use `assets/starter.css` for the complete scale and metric-matched font example. Keep
the operating constraints here: contextual roles, readable measure, fluid sizing,
language coverage, measured loading/CLS, and no duplicate reduced-motion contract.

## Reference files — read the one you need

Keep this file in context; pull a reference in when the task calls for it.

- **`references/decision-records.md`** — The distilled *reasoning* of the field: five
  meta-patterns (how typographers think) plus ADR-style decision records linking each
  rule to its rationale and the alternatives it rejects. **Read this when you face a
  novel judgment the other files don't directly cover** — the meta-patterns let you
  derive the right answer the way an expert would. Also the home of the "principle,
  not property" boundary.
- **`references/foundations.md`** — The classical principles (Lupton's *Letter /
  Text / Grid*, Bringhurst, Butterick) translated to the web: anatomy, measure,
  hierarchy, pairing, alignment. **Read this when choosing/pairing fonts or when a
  layout "feels off" but no single rule is obviously broken.**
- **`references/fluid-scale.md`** — Fluid type with `clamp()`, the `clamp()` math,
  modular-scale ratios, Utopia, container-query units (`cqi`) for component-level
  type. **Read this when building or adjusting a type scale, or making type respond
  to a container rather than the viewport.**
- **`references/font-loading.md`** — Web-font performance: `font-display`,
  preloading, self-hosting vs Google Fonts (GDPR), WOFF2, subsetting,
  `unicode-range`, variable fonts, and **eliminating CLS with metric-matched
  fallbacks** (`size-adjust`, `*-override`, Fontaine, next/font). **Read this
  whenever a project loads a custom web font or has layout-shift / slow-text issues.**
- **`references/accessibility.md`** — WCAG 2.2 for text: contrast ratios, resize to
  200% (1.4.4), text-spacing overrides (1.4.12), zoom, dyslexia/readability,
  reduced motion. **Read this before claiming type work is done, and any time the
  task mentions accessibility, a11y, contrast, or compliance.**
- **`references/modern-css.md`** — Current CSS type features with browser-support
  status: `text-wrap: balance/pretty`, OpenType (`font-variant-*`,
  `font-feature-settings`), `text-box-trim`/`text-box-edge`, `hanging-punctuation`,
  `initial-letter`, font-relative units (`lh`, `cap`, `ch`, `ic`), `line-clamp`,
  `color-mix` for tints. **Read this when reaching for a polish feature, and to
  check whether something needs progressive enhancement.**

## How to deliver

Explain the type decision, edit existing tokens, and keep unsupported features progressive. Report contrast, 200% zoom, text-spacing, loading, and glyph evidence; pair multilingual work with `i18n-ready`.

## Completion evidence

Close with a five-field evidence ledger. Put the check ID at the start of Reason, then
record either an observed result or an explicit verification gate.

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
- Stop / handoff: Pause when a requested font lacks required language coverage and no fallback is agreed (+1 in contract.json); receives [design-system-interview, improve-existing-website] -> sends [responsive-layout, i18n-ready, a11y-pass]
- Output: A contextual type system with tokens, loading plan, and tested reading constraints
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
