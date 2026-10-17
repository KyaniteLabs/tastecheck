# Design System Interview — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of design-systems practice (token tiers,
MVP design-system anatomy), art-direction commentary, and the "AI exposes who has taste"
discourse (2024–2026). Credited ideas, own expression.

## Meta-patterns

### MP-1 · Slop is unspecified intent, resolved to the average
The model fills any undecided dimension with the most probable value. **Consequence:**
the highest-leverage anti-slop move is *upstream* — force the decisions before building,
so there are no blanks left to average.

### MP-2 · Taste is constraint; a design system is a set of refusals
Character comes from what you *won't* do (no Inter, no purple, no centered-3-cards) as
much as what you will. **Consequence:** the interview's job is to extract refusals and
commitments, not gather preferences vaguely.

### MP-3 · React beats invent
People can't answer "what do you want?" but can answer "this, or more like that?"
**Consequence:** always lead with an opinionated default + concrete forks; let the user
veto/redirect. Faster and produces real decisions.

### MP-4 · The middle of every axis is where generic lives
"A bit of both," "modern but friendly," "minimal but bold" all average out to nothing.
**Consequence:** force a pole on each axis; treat "both" as a non-answer to push on.

### MP-5 · Abstention is permission to be bold, not average
When the user doesn't care, resolving to the safe default produces slop. **Consequence:**
decide *boldly* and announce it for veto; never resolve indecision toward the mean.

### MP-6 · Decisions must become machine-usable tokens
A direction in prose doesn't propagate. **Consequence:** emit DESIGN-SYSTEM.md + a
primitive/semantic token contract the other skills implement, so the commitment
actually reaches the code.

## Decision records

### DR-1 · Interview before building, on vague requests
- **Why (MP-1):** kill blanks upstream. **Apply:** "build me a site" with no direction →
  run the 4–10 exchange interview first; say why.

### DR-2 · Recommend-then-react, not open questions
- **Why (MP-3):** speed + real answers. **Apply:** each question carries a default +
  forks; user vetoes/redirects.

### DR-3 · Reject adjectives, demand references/poles
- **Why (MP-2/MP-4):** "modern/clean" = the average. **Apply:** counter with a concrete
  reference request or a forced pole.

### DR-4 · One dominant color + distinctive type, by refusal
- **Why (MP-2):** the two biggest slop tells. **Apply:** one anchor hue (not five
  pastels, not indigo→violet); a real display face (not Inter/Roboto).

### DR-5 · Decide boldly on abstention
- **Why (MP-5):** mean-seeking = slop. **Apply:** commit to a specific, slightly
  unexpected direction and announce for veto.

### DR-6 · Emit tokens, hand off
- **Why (MP-6):** propagate the commitment. **Apply:** DESIGN-SYSTEM.md + primitive/
  semantic tokens; color-system/web-typography/etc. implement; deslop-ui audits against
  the spec.

## Principle, not property
Distills shared design-systems and art-direction practice; credit lineage (token-tier
conventions, MVP design-system guidance) where natural; never copy prose. The systems
produced are the user's own.
