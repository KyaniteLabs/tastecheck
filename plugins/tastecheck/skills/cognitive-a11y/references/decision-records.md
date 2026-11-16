# Cognitive Accessibility — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of W3C COGA "Making Content Usable for
People with Cognitive and Learning Disabilities," WCAG 2.2 understandable-criteria, and
established neurodivergent-design practice. Credited, not copied.

## Meta-patterns

### MP-1 · Cognitive cost is the thing to minimize
Every word, surprise, distraction, and memory demand taxes attention and comprehension.
**Consequence:** default to *less* — less text, fewer steps, fewer changes, less to recall.

### MP-2 · Technical access ≠ cognitive access
A page can be perfect on contrast/keyboard/screen-reader (a11y-pass) and still be
unusable for ADHD/autism/dyslexia. **Consequence:** cognitive accessibility is a separate
pass with its own checks; passing WCAG AA does not cover it.

### MP-3 · The profiles overlap; design for the union
ADHD, autism, dyslexia share ~70% of remedies (plain language, chunking, calm, low
memory). **Consequence:** do the shared non-negotiables first; they help everyone, then
add profile specifics for the target audience.

### MP-4 · Predictability is access (autism), distraction is the enemy (ADHD)
Surprise and noise are not neutral — they actively exclude. **Consequence:** consistency,
no auto-changes, no autoplay, calm-by-default, with user control over motion/sensory load.

### MP-5 · Reading load is removable
Dyslexic difficulty scales with the *amount* and *presentation* of text. **Consequence:**
reduce text (plain + chunked) and fix presentation (spacing, ragged-left, off-white) — and
never rely on reading alone.

### MP-6 · Don't make people remember; don't make people hurry
Working-memory limits and time pressure cause failure. **Consequence:** carry data
forward, show don't recall, and remove or extend time limits.

## Decision records

### DR-1 · Cognitive pass is separate from a11y-pass
- **Why (MP-2):** different barriers. **Apply:** run both; this skill = understandable/
  attention/reading/predictability; a11y-pass = perceivable/operable/robust.

### DR-2 · Plain, literal, chunked language by default
- **Why (MP-1/MP-5):** comprehension. **Apply:** short literal sentences, TL;DR, lists,
  one idea per chunk. Use `humanize-copy` jointly.

### DR-3 · Predictable, consistent, no auto-changes
- **Why (MP-4):** autism + everyone. **Apply:** consistent nav/labels/help; nothing
  changes on focus/input; no autoplay/auto-advance.

### DR-4 · Low memory, low steps, no time pressure
- **Why (MP-6):** ADHD + everyone. **Apply:** carry forward / autofill; one primary
  action; save+return; no/extendable time limits.

### DR-5 · Calm, controllable sensory layer
- **Why (MP-4):** ADHD distraction + autism overload. **Apply:** motion off/subtle +
  stoppable; reduced-motion; low-chroma fields; no flashing/vibrating pairs.

### DR-6 · Dyslexia-aware reading + off-white, not glare
- **Why (MP-5):** reading load. **Apply:** 1.5 line-height, 45–75ch, ragged-left, no
  all-caps/justify, off-white ground + softened ink, read-aloud-friendly, icons + text.

### DR-7 · Forgive and reassure
- **Why (MP-1/MP-6):** anxiety + error cost. **Apply:** undo, clear fix-oriented errors,
  kind non-judgmental tone in empty/error states.

## Principle, not property
Distills public cognitive-accessibility guidance (W3C COGA, WCAG) and neurodivergent-
design practice — credited, expressed in our own words. The work you build is your own.
