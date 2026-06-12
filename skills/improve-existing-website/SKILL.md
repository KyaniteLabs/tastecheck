---
name: improve-existing-website
description: >-
  Improve an existing website by auditing what is already there, inferring the
  intended design system, asking only a few ambiguity-clearing questions, then
  using the other tastecheck skills to make the partial system fully true.
---

# Improve Existing Website

Most redesign requests should not start from a blank canvas. Existing sites already contain
signals: the business model, audience, hierarchy, brand residues, content priorities,
component habits, and accidental drift. This skill turns that partial reality into a coherent
system without erasing what is working.

## The Loop

1. **Inspect the real site first.** Open the running page or files. Capture desktop and mobile
   screenshots when possible. Read the DOM, CSS tokens, typography, nav, repeated components,
   CTAs, content voice, forms, empty/error states, and any analytics/business cues available.
2. **Separate signal from drift.**
   - Signal: repeated choices that seem intentional, business-critical hierarchy, brand colors,
     useful interaction patterns, domain-specific language, recognisable layout grammar.
   - Drift: one-off hex values, inconsistent radii, mixed type systems, accidental spacing,
     copied template sections, inaccessible contrast, unlabelled controls, stale content.
3. **Infer the intended design system.** Write a compact "likely system" with:
   - audience and job-to-be-done
   - aesthetic territory
   - type stance
   - color and surface logic
   - layout/rhythm grammar
   - component/state conventions
   - copy voice
   - accessibility obligations
4. **Ask only questions that change the solution.** If ambiguity remains, ask at most three
   targeted questions. Prefer multiple-choice defaults with a recommendation. Do not interview
   the user about things the site already answers.
5. **Make the partial reality true.** Apply the smallest coherent set of changes that turns the
   inferred system into an actual system. Preserve strong existing signals; remove drift.

## Handoff Chain

Use the other tastecheck skills as the repair toolkit:

- `design-system-interview` only for unresolved direction decisions.
- `deslop-ui` to remove template/generic tells without flattening the existing identity.
- `color-system` and `theming` to consolidate colors into semantic tokens.
- `web-typography` for type scale, measure, font loading, and wrapping.
- `responsive-layout` for structure and overflow.
- `component-states`, `form-ux`, and `empty-states` for interaction and non-happy paths.
- `micro-motion` for restrained motion and reduced-motion behavior.
- `data-viz` when metrics/charts are present.
- `a11y-pass` and `cognitive-a11y` before calling the result done.
- `humanize-copy` when the site's voice is generic or machine-written.

## Output Shape

Before editing, state the inferred system in five to eight bullets and list any targeted
questions. If no questions are needed, say so and proceed.

After editing, report:

- what existing signals were preserved
- what drift was removed
- which tastecheck skills were applied
- what was verified in-browser and by static checks
- any remaining ambiguity or deliberately deferred work

## Reference files

- `references/audit-procedure.md` — exactly what to extract and in what order
  (rendered reality → de-facto tokens with counts → component habits → voice →
  business signals). Read before inspecting.
- `references/signal-vs-drift.md` — the tests that separate identity from accident,
  a worked example (the bakery), and the cardinal sins (erasing identity, formalizing
  the accident, the stealth redesign). Read before deciding what to change.
- `references/decision-records.md` — meta-patterns + ADR rules (what to fix without
  asking, what always gets asked, scope visibility).
- `assets/improve-checklist.md` — the run checklist (before / during / done).

## Self-Check

1. Did I inspect the actual rendered site or files before prescribing changes?
2. Did I preserve the strongest existing identity signals?
3. Did I ask no more than three questions, and only where the answer changes implementation?
4. Did I convert repeated choices into tokens/components instead of polishing one-off CSS?
5. Did I verify responsive layout, interaction states, contrast, keyboard focus, and copy clarity?
