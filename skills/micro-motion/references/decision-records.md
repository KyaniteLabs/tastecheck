# Micro-Motion — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of established web-animation practice
(compositor performance, Disney principles applied to UI, accessibility guidance,
2024–2026). Credited ideas, own expression.

## Meta-patterns

### MP-1 · Motion is communication, not decoration
Every animation should explain a change: what happened, where it came from, where to
look. **Consequence:** if an animation answers none of those, cut it. Decoration-only
motion is the "annoying" category.

### MP-2 · Smoothness is a property of which property you animate
60fps comes from staying off layout/paint — transform/opacity are composited.
**Consequence:** the smoothness problem is usually "you animated width/top", not "the
duration is wrong." Fix the property first.

### MP-3 · Speed reads as quality; slowness reads as cheap
Crisp 150–300ms motion feels premium; sluggish 600ms+ feels laggy and amateur.
**Consequence:** when in doubt, faster. Exits faster than entrances.

### MP-4 · Restraint follows causality
The eye can follow a causal sequence. **Consequence:** animate only changes that explain
the current action or state; a numeric element ratio is not evidence of restraint.

### MP-5 · Motion is opt-out by the user, always
Vestibular disorders make large motion physically harmful. **Consequence:**
`prefers-reduced-motion` is a contract, not a nicety — gate movement, keep a fade.

## Decision records

### DR-1 · Transform/opacity only
- **Why (MP-2):** composited = smooth. **Apply:** size/pos via scale/translate or FLIP/
  View Transitions, never width/top.

### DR-2 · 150–300ms, non-linear
- **Why (MP-3):** premium feel. **Apply:** hover 150, entrance 220, modal 300; ease-out
  in, ease-in out; linear only for loops.

### DR-3 · Stage one causal sequence
- **Why (MP-4):** avoid busy. **Apply:** name the user-facing change each transition
  explains; remove unrelated fidgets.

### DR-4 · Reduced-motion contract
- **Why (MP-5):** accessibility. **Apply:** gate movement behind `no-preference`; keep a
  fade or nothing; test the reduced path doesn't break layout.

### DR-5 · CSS first, library when needed
- **Why:** CSS transitions/keyframes cover most UI cheaply. **Apply:** reach for Motion/
  GSAP only for springs, gestures, layout/FLIP, or complex sequencing.

### DR-6 · No scroll-jack, no unstoppable loops
- **Why (MP-1/accessibility):** top annoyance + WCAG 2.2.2. **Apply:** let users
  control scroll; provide pause for any looping/auto motion.

## Principle, not property
Distills shared animation practice; credit lineage (Disney principles, web-perf
community) where natural; never copy prose. Your motion code is your own.
