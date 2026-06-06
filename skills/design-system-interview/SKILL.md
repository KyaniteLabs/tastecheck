---
name: design-system-interview
description: >-
  Design-system interview before new frontend builds or redesigns. Use for vague
  site/app/landing/dashboard requests, generic-looking UI, direction-setting,
  aesthetic choices, type/color/density decisions, and DESIGN-SYSTEM.md tokens.
---

# Design System Interview

The reason AI builds the same generic site every time is **unspecified intent**. Asked
to "build a landing page" with no direction, the model fills every blank with the most
probable token from its training data — and the average of the web is purple, Inter,
centered, three-cards. You don't fix that after the fact with polish. You fix it
*before the first line of code* by **forcing the decisions the model would otherwise
average away.**

This skill is a short, opinionated interview that drags a real direction out of the
user (or, when they genuinely don't care, makes a *bold committed choice* and tells
them) and writes it down as a `DESIGN-SYSTEM.md` + tokens. Every other frontend skill
then builds from that committed spec instead of from the average.

The mindset: **a design system is a set of refusals.** "We use Fraunces, not Inter.
We're warm, not cool. We're dense, not airy. We never use pure black." Taste is
constraint. Your job here is to extract or supply those refusals.

## How to run it (the loop)

0. **Choose the pressure level.** Greenfield brand/marketing work can use the full
   opinionated interview. Internal tools, admin flows, urgent fixes, or users who ask for
   low-friction help get a short recommendation first: "I can pick a calm default and
   keep moving, or we can do the full taste interview." Pair this with
   `cognitive-a11y`: decisive should not mean pressuring.
1. **Don't start building.** If the request is "build/make/design a [frontend thing]"
   and no direction exists, run this interview first. Say so: "Before I build, 6 quick
   questions so this doesn't come out generic."
2. **Ask in rounds, not all at once.** Lead each question with a *concrete recommended
   default* (your opinion), so the user can react ("yes" / "no, more X") instead of
   facing a blank. Reacting is easier than inventing — and it still forces a decision.
3. **Push back on vagueness.** "Modern / clean / professional / sleek" are non-answers
   — that *is* the average. When you hear them, counter with concrete forks (below).
4. **Force a commitment per dimension.** Don't leave a dimension at "default"; land on
   a specific named choice and write it down.
5. **If the user truly doesn't care, decide boldly and state it.** A committed
   unexpected choice beats a safe average. Never resolve indecision toward the mean.
6. **Emit the artifact.** Produce `DESIGN-SYSTEM.md` + a token block, then hand off to
   `color-system`, `web-typography`, etc. to implement.

## The interview (the forcing questions)

Ask these in order. Each has the **anti-slop framing** and **concrete forks** to offer.
Keep it to ~6–7; this is a sprint, not a survey.

1. **Reference, not adjectives.** "Name one site, brand, or object whose feel you want
   — Stripe? a Criterion DVD case? a 1970s ski lodge? Bloomberg terminal?" Concrete
   references encode taste that adjectives can't. If they say "modern," reject it and
   ask again with examples.
2. **Personality (pick a pole, not the middle).** Offer opposed axes and make them
   choose a side: warm⇄cool, serious⇄playful, minimal⇄maximal, classic⇄experimental,
   refined⇄raw, dense⇄spacious. The middle of every axis is where slop lives.
3. **Aesthetic direction (name it in one concrete phrase).** Editorial / Swiss-grid /
   brutalist-terminal / soft-organic / retro-print / high-contrast-luxury / playful-
   geometric. If nothing fits, invent a specific phrase. "Modern/clean" is banned.
4. **Type stance.** Recommend a distinctive display + readable body pairing (NOT Inter/
   Roboto). "Headlines in Fraunces (editorial) or Space Grotesk (technical); body in a
   clean humanist sans. Or do you have brand fonts?" Force a real face. (→ web-typography)
5. **Color anchor.** "One dominant brand hue + one sharp accent — what's the dominant?
   (and we tint neutrals toward it; no dead grays; no purple-on-white default)." Get a
   hue, not a palette; we generate the ramp. (→ color-system)
6. **Density & shape.** Spacious or dense? Sharp corners (0–4px), soft (8–12px), or
   round (16px+)? Flat or layered/shadowed? These set the whole feel and are usually
   skipped. Land on numbers.
7. **Structure & rhythm (do NOT skip — this is where pages escape slop).** Symmetric
   centered, or asymmetric/offset? Is there a spatial motif from the references (grid,
   tessellation/bento, columns, collage)? Metronomic sections or syncopated (varied
   width/density/treatment)? A committed palette on the generic SaaS skeleton is still
   slop. Land on a composition + motif + rhythm. (→ `references/structure-and-rhythm.md`,
   then `responsive-layout`; audited by `deslop-ui` → `structural-tells.md`.)
8. **One signature move.** "What's the one memorable thing — a bold type treatment, an
   unexpected color, a distinctive grid/structure, one orchestrated load animation?"
   Designed work has exactly one. Pick it.

(Optional 9th for products: motion level — restrained / lively / none — feeding
`micro-motion`.)

## Anti-slop guardrails (enforce during the interview)

- **Ban the average words.** "modern, clean, sleek, professional, minimal-but-friendly,
  elegant" → push for a concrete reference or a pole. These adjectives *are* the slop.
- **Forbid the defaults out loud.** State what you will NOT do unless told otherwise:
  no Inter/Roboto, no indigo→violet gradient, no centered-hero-+-3-cards, no pill CTAs,
  no glassmorphism-by-default. (See `deslop-ui`.)
- **One dominant color, not five pastels.** Commit to a hue; neutrals tint toward it.
- **Pick poles, not middles.** Every "it depends / a bit of both" is a slop vote.
- **Decide for them if needed — boldly.** Indecision resolved toward the mean = slop.
  Indecision resolved toward a committed choice = a starting point they can react to.

## The output: DESIGN-SYSTEM.md + tokens

When the interview lands, write a `DESIGN-SYSTEM.md` (template in
`assets/DESIGN-SYSTEM.template.md`) capturing the decisions, plus a **two-tier token
block** (primitive → semantic; see `references/tokens.md`) the other skills consume:

```
The committed direction in one line: "1970s ski-lodge editorial — warm, dense, classic,
burnt-orange anchor, Fraunces display, sharp 4px corners, signature = oversized serif numerals."
```

Then hand off: `color-system` builds the ramp from the hue, `web-typography` sets the
type scale from the faces, `theming` derives light/dark/high-contrast variants, `component-states`/
`form-ux`/etc. implement to the tokens, and `deslop-ui` audits the result against the
committed spec (not the average).

## Reference files

- `references/interview-bank.md` — the full question bank with recommended defaults,
  the "they said 'modern', now what" counters, and how to decide boldly when the user
  abstains. Read this to run the interview well.
- `references/structure-and-rhythm.md` — committing **layout structure** (composition,
  spatial motif, rhythm, signature), not just tokens. The half that actually escapes
  the template. Read this every time — it's the most-skipped, highest-impact part.
- `references/tokens.md` — the design-token architecture (primitive/semantic tiers,
  naming, what to emit), so the output plugs into the other skills. Read when writing
  the artifact.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before you start building)

1. Did I run the interview *before* building, on a vague request?
2. Is there a **named aesthetic in one concrete phrase** (not "modern/clean")?
3. One dominant color hue chosen (not five pastels, not "we'll see")?
4. A distinctive type pairing chosen (not Inter/Roboto by default)?
5. A pole picked on each personality axis (no "both")?
6. Density + corner + elevation decided as actual values?
7. One signature move named?
8. Wrote `DESIGN-SYSTEM.md` + tokens, and handed off to the implementing skills?

## How to deliver

- Run it conversationally and fast — recommend-then-react, 6–7 questions, not a form.
- Be opinionated: bring a strong default to every question; make abstention produce a
  bold committed choice, never the average.
- End with the one-line committed direction + the artifact, then build *to it*.
- This is the front of the chain: **design-system-interview → color-system /
  web-typography / theming → layout/components → micro-motion → a11y-pass**, with
  `deslop-ui` auditing against the committed spec.
