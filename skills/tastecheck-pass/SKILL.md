---
name: tastecheck-pass
description: >-
  The ship gate and canonical pipeline for the tastecheck pack. Use before
  declaring frontend work done, for final review, pre-ship verification,
  running all skill self-checks, or when asked what order the skills run in.
---

# TasteCheck Pass (the ship gate)

Every tastecheck skill ends with a self-check — and nothing makes sure they actually
ran. This skill is the **gate**: it states the canonical pipeline once (every other
description of the order defers to this one), then executes every relevant self-check
against the finished work and reports a pass/fail table. Honor-system checklists
become a verification step.

Governing rule: **"done" is a claim that requires evidence.** The output of this skill
is the evidence.

## The canonical pipeline (the single source of truth for ordering)

1. **Direction** — `design-system-interview` (new work) or `improve-existing-website`
   (existing sites) → produces `DESIGN-SYSTEM.md` + the canonical tokens.
2. **Foundations** — `color-system` · `web-typography` · `spacing-system` · `theming`
   → fill in the token values (ramps, scale, spacing, theme mappings).
3. **Structure** — `responsive-layout`.
4. **Behavior** — `component-states` · `form-ux` · `empty-states`.
5. **Surface** — `micro-motion` · `data-viz` · `art-direction` (each only where the
   work has motion / charts / imagery).
6. **Verification** — `a11y-pass` · `cognitive-a11y` · `i18n-ready` (if multilingual).
7. **Audit** — `deslop-ui` (against the committed spec, never the average) ·
   `humanize-copy` (the verbal plane).
8. **Gate** — this skill.

A skill is *skippable* only when its subject is absent (no charts → no data-viz);
direction, foundations, structure, a11y, and the deslop audit are never skippable.

## How to run the gate

1. **Confirm the spec exists.** There is a `DESIGN-SYSTEM.md` (or an inferred-system
   statement from `improve-existing-website`) and the work was built *to it*. No spec
   → fail the gate; go to step 1 of the pipeline, don't improvise one retroactively.
2. **Run each relevant skill's self-check** against the actual artifact (rendered
   where possible — open it; measuring beats reading). Record per item: ✓ pass /
   ✗ fail / n/a (with why).
3. **Run the measurable checks**: the paste-able auditor that ships with `a11y-pass`
   (its audit.js asset) in the browser console; 320px + 400% zoom; keyboard
   tab-through; each theme's contrast; `prefers-reduced-motion` path.
4. **Audit against the spec, not taste:** does the output match the committed
   aesthetic phrase, tokens, refusals, and signature move? Any default that snuck back
   in (`deslop-ui` tell catalog) is a fail even if it "looks fine."
5. **Report the table** (see shape below), fix the ✗ rows, re-run the failed checks.
   The gate passes only when every non-n/a row passes.

## The report shape

```
TASTECHECK PASS — <project> — <date>
Spec: DESIGN-SYSTEM.md ("<one-line north star>")

| Skill                | Self-check | Notes                              |
|----------------------|-----------|-------------------------------------|
| design-system-interview | ✓      | spec present, built-to              |
| color-system         | ✓         | all pairs measured, worst 4.6:1     |
| web-typography       | ✗ → ✓     | measure was 92ch; capped to 66ch    |
| …                    |           |                                     |
| deslop-ui            | ✓         | 0 tells; aesthetic = "<phrase>"     |

Gate: PASS (n checks, m fixed during gate)
```

## Non-negotiables

- **The gate outranks polish — budget for it.** In turn- or time-limited runs, reserve
  capacity for this gate *before* spending on optional extras (additional screenshots,
  embellishments, refactors). A first live pipeline run produced an excellent page and
  then starved the gate at the turn limit — an ungated "done" is the exact honor-system
  failure this skill exists to close. If you genuinely cannot finish the gate, say so
  explicitly in the deliverable; never imply it ran.
- **Never gate your own taste — gate the spec.** Disagreements with the committed
  direction are interview feedback, not gate failures.
- **Measure where a number exists** (contrast, target size, measure, zoom, duration);
  eyeballing a measurable is a skipped check.
- **A failed row is fixed or explicitly accepted by the user** — never silently waved
  through.
- **The report ships with the work.** "Gate passed" without the table is the same
  honor system this skill exists to replace.

## Self-check (yes, the gate has one)

1. Spec confirmed before checking anything against it?
2. Every pipeline-relevant skill's self-check executed (not summarized from memory)?
3. Measurable checks actually measured (auditor run, zoom tested, contrast numbers)?
4. Output audited against the *committed spec* (refusals honored, signature present)?
5. Report table delivered with the work, failures fixed or explicitly accepted?

## How to deliver

- Run this as the last step of any build that used the pack, and any time the user
  says "is this done?", "review this", or "ship it".
- Keep it honest: the value of the gate is that it sometimes fails. A gate that
  always passes on the first run isn't checking.
