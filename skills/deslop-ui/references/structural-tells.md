# Structural Tells — the deepest slop layer

The surface catalogue (`anti-patterns.md`) covers *visual* slop — color, type, shape.
But you can fix every pill button and purple gradient and still ship **structural slop**:
the layout *skeleton* itself is generic. This is the layer that survives a recolor, and
it's the one most AI pages never escape. Read this whenever you build or review a *page*,
not just a component.

## The three planes of slop
1. **Surface/visual** — palette, type, shape, effects. (`anti-patterns.md`)
2. **Structural** — the skeleton, rhythm, composition. (this file)
3. **Verbal** — the copy/voice (ChatGPT-accent). Hand to **`humanize-copy`**.
A page is only deslopped when all three planes are.

## The structural tells (named, with the fix)
- **The SaaS template skeleton** — nav → centered hero → "the problem" → 3-step "how it
  works" → uniform feature-card grid → testimonial row or stat-counter band (three big
  numbers with labels) → CTA band → footer, in that order.
  **Fix:** vary section *order, count, and treatment*; cut or merge the boilerplate
  sections; let the content dictate structure, not the template.
- **Centered everything** — hero (and most sections) center-aligned, content in a single
  centered column. **Fix:** asymmetry — split/offset hero, left-anchored content, an
  intentional focal point off the axis.
- **The uniform card grid** — N identical equal-size bordered rounded rectangles (the
  "three cards," scaled to 6/9/12). **Fix:** an *irregular* layout — varied cell sizes
  (bento/tessellation), different content per cell, a lead item; or not a grid at all.
- **Metronomic section rhythm** — every section is `eyebrow → H2 → lede → grid`, same
  padding, same shape. **Fix:** syncopation — vary section width, density, alignment, and
  treatment (one full-bleed, one editorial, one list, one visual).
- **Everything is a bordered rounded rectangle** on a slightly-lighter panel. **Fix:**
  vary containers by role; use rules/whitespace/overlap, not boxes, to separate.
- **Symmetric 50/50 splits** for every two-column block. **Fix:** asymmetric ratios
  (1.3/0.7), overlap, offset baselines.
- **Decorative-only full-bleed image/gradient behind a centered headline.** **Fix:** make
  the visual *structural* (a motif that organizes the layout), or remove it.
- **Sticky blurred nav + giant serif headline + mono-uppercase eyebrow + glow CTA** — the
  "premium dark-SaaS" skeleton (Tier-2 visual + structural). **Fix:** see dated attractors.

## Dated "current attractors" (this list EXPIRES — update it)
Slop moves. Each anti-slop move becomes next year's default once everyone copies it.
As of **2026**, these are the *tasteful-default* attractors to actively avoid (or commit
to consciously, not by reflex):
- **Cream + Fraunces + brick/wine-red editorial** ("not-AI" default).
- **Near-black + one electric accent + mono-uppercase eyebrow + huge serif + soft glow**
  (the Linear/Vercel "premium dark-SaaS" default).
- **Space Grotesk / Bricolage as the reflexive "characterful" font.**
The rule: **subtraction moves the average; only commitment escapes it.** Don't just avoid
the current attractor — commit to a *specific, named* direction from the design system
(see `design-direction.md` and the `design-system-interview` skill). Re-date this list
when the defaults shift.

## How to audit a page structurally
1. Sketch the section stack — is it the template skeleton? Reorder/cut/vary.
2. Is the hero centered? Make it asymmetric.
3. Is there a uniform card grid? Make it irregular or not-a-grid.
4. Does every section share the same rhythm/shape? Syncopate them.
5. Does the structure come from the committed design system, or from a default? If you
   can't name the structural choice, it's slop — go back to the interview.

## Self-check
(The short form of this list also lives in the SKILL.md self-check, items 9–12, so it
runs on every pass — keep the two in sync when editing.)
- [ ] Section stack is not the generic SaaS skeleton (varied order/treatment).
- [ ] Hero/composition is asymmetric, not centered-column.
- [ ] No uniform equal-card grid (irregular sizes or a different structure).
- [ ] Section rhythm is varied (syncopated), not metronomic.
- [ ] The structure traces to a committed design-system decision, not a template.
- [ ] None of the current dated attractors adopted by reflex.
