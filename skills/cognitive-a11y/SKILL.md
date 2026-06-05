---
name: cognitive-a11y
description: >-
  Make interfaces usable for ADHD, autism, dyslexia, and neurodivergent minds —
  the cognitive accessibility that WCAG technical audits and a11y-pass barely
  touch. Apply this whenever you write or build anything a person has to read,
  understand, focus on, remember, or complete: copy, onboarding, forms, dashboards,
  docs, settings, error/empty states, multi-step flows. Use it to avoid the usual
  failures: walls of text, idioms/jargon/abstract language, no TL;DR or structure,
  surprising or inconsistent layouts, autoplaying motion and distraction, forcing
  users to remember things across screens, time limits, harsh sensory color/glare,
  pure-black-on-white that hurts dyslexic reading, and punishing error handling.
  Trigger on cues like "make this accessible for ADHD / autism / dyslexia /
  neurodivergent users", "cognitive accessibility", "plain language", "reduce
  cognitive load", "is this readable / understandable", "neuroinclusive", or
  whenever you finish content/flows. Distinct from a11y-pass (sensory/motor/screen-
  reader/WCAG); this is the understandable/attention/reading/predictability layer.
  Checkable, per-profile, not vibes. Pairs with web-typography, humanize-copy,
  micro-motion, form-ux, theming. Grounded in W3C COGA "Making Content Usable."
---

# Cognitive Accessibility (ADHD · autism · dyslexia · neurodivergence)

`a11y-pass` makes a UI *perceivable and operable* — contrast, keyboard, screen
readers, motor targets. It says almost nothing about whether a person can **read it,
understand it, stay focused on it, remember it, and finish the task** without
overwhelm. That's cognitive accessibility, it's the weakest area of WCAG, and most AI
output ignores it entirely. This skill is that layer — concrete, per-profile, checkable.

Governing idea: **reduce the cognitive cost of using the thing.** Every extra word,
surprise, distraction, and memory demand is a tax. The profiles overlap ~70%, so most
fixes help everyone — but each profile has sharp specifics, below.

## The non-negotiables (help every profile)

- **Plain language.** Short sentences (aim ≤ ~20 words), common words, **literal not
  idiomatic** (no "hit the ground running," "low-hanging fruit"), active voice,
  front-load the point. Target ~grade 8 reading level for general UI. (Pairs with
  `humanize-copy`; for other languages, `idiomatic-translation`.)
- **Chunk and structure.** Short paragraphs, headings, lists, one idea per chunk. Long
  pages get a **TL;DR / summary up top**. Long tasks get **visible steps + progress.**
- **Be predictable and consistent.** Same nav, labels, and patterns everywhere; help in
  a consistent place; **nothing changes automatically** on focus or input; no surprising
  pop-ups or layout shifts. (Autism especially.)
- **Don't make people remember.** Don't require recalling info across screens (show it,
  or carry it forward / autofill); one clear primary action per screen; avoid codes the
  user must memorize. (ADHD especially; WCAG 2.2 §3.3.7 Redundant Entry.)
- **Calm by default; control the sensory load.** No autoplay; motion is subtle and
  user-stoppable (respect `prefers-reduced-motion`); no parallax/flashing overload;
  avoid vibrating high-saturation color pairings; offer an **off switch** for animation.
- **Readable type, dyslexia-aware.** Generous line-height (~1.5), measure 45–75ch,
  left-aligned ragged (**never justify**), no long ALL-CAPS, **off-white background not
  pure-white**, ink not pure-black (slightly softened) — high glare/contrast can *hurt*
  dyslexic reading. (Pairs with `web-typography`, `theming`.)
- **Forgive errors, don't pressure.** Clear errors with the fix (pairs with `form-ux`),
  confirm/undo destructive actions, **no time limits** (or make them extendable; WCAG
  §2.2.1).

## Per-profile quick guide (full detail in `references/profiles.md`)

- **ADHD** — attention & working memory. Kill distraction (no autoplay, fewer
  notifications, calm default, optional focus mode); chunk; show progress; minimize
  steps and memory; make the next action obvious; allow saving/return.
- **Autism** — predictability & sensory. Maximum consistency; literal, unambiguous
  language; clear expectations ("this takes 3 minutes," "we'll email you"); no
  surprising motion/sound; muted sensory palette; figurative language flagged or avoided.
- **Dyslexia** — reading. Type and spacing (above); plain language; chunking; avoid
  walls of text and dense justified blocks; support read-aloud; don't rely on reading
  alone (icons + text); spell-tolerant inputs.
- **Neurodivergence (umbrella) / general cognitive load** — all of the non-negotiables;
  plus clear consistent help (WCAG 2.2 §3.2.6), error prevention, low-memory flows, and
  a kind, non-judgmental tone (no shame in empty/error states).

## How to use this skill

1. **Audit the content first** — is the language plain and literal? Is it chunked with a
   summary? (Most failures are here.)
2. **Audit the flow** — predictable, consistent, low-memory, no time pressure, obvious
   next step, recoverable errors?
3. **Audit the sensory layer** — calm default, motion controllable, palette not
   vibrating, off-white not glare, type dyslexia-friendly?
4. **Apply per-profile specifics** for the relevant audience (or all four for general UI).
5. Run the **self-check** before claiming it's cognitively accessible.

## Reference files

- `references/profiles.md` — ADHD / autism / dyslexia / neurodivergence in depth: the
  specific barriers and the concrete fixes per profile, with overlaps marked.
- `references/patterns.md` — the cross-cutting, checkable patterns: plain-language rules
  (with before/after), chunking & TL;DR, predictability/consistency, memory-reduction,
  attention/sensory, reading support, error/time. Read when building.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before claiming cognitively accessible)

1. Plain & literal language; short sentences; no idioms/jargon; point front-loaded?
2. Chunked, with headings/lists and a TL;DR for long content?
3. Predictable & consistent; nothing auto-changes; help in a consistent place?
4. No required memory across screens; one clear primary action; redundant entry avoided?
5. Calm by default; motion controllable + reduced-motion; no sensory overload?
6. Dyslexia-aware type (1.5 line-height, 45–75ch, ragged-left, off-white, no all-caps/justify)?
7. Errors forgiving with fixes; no/extendable time limits; destructive actions undoable?
8. Tone kind and non-judgmental, especially in errors/empty states?

## How to deliver
- State which profiles you optimized for and the concrete moves ("plain-language pass,
  added TL;DR + step progress, off-white theme, motion off by default, no time limit").
- This is the **cognitive** layer; run `a11y-pass` too for the technical/WCAG layer —
  they're complementary, not substitutes.

## Provenance — principle, not property
Grounded in the W3C Cognitive and Learning Disabilities Accessibility Task Force (COGA)
"Making Content Usable for People with Cognitive and Learning Disabilities" and
established neurodivergent-design practice. Independent synthesis, credited — not copied.
