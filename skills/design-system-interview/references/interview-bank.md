# Interview Bank — Questions, Defaults & Counters

Read this to run the interview well. The technique throughout: **recommend a concrete
default, then let the user react.** Reacting ("no, warmer") is easier and faster than
inventing from blank, and it still forces a real decision. Never ask an open "what do
you want?" — that returns the average.

## The rules of the interview
- **Lead with an opinion.** Every question carries your recommended pick + 2–3 concrete
  alternatives. The user picks or vetoes.
- **One round of decisions, ~6–7 questions.** Speed matters; this is a sprint before
  building, not a discovery phase.
- **Reject adjectives, demand references/poles.** "Modern/clean/professional" → counter.
- **Land each dimension on something nameable and specific.** Write it as you go.
- **If they abstain, decide boldly and announce it.** "You don't have a preference, so
  I'm committing to X — react if it's wrong." Mean-seeking is the enemy.

## Q1 — Reference, not adjectives
**Ask:** "Name one site/brand/object whose *feel* you want to borrow — e.g. Stripe
(precise, techy-trust), Linear (dark, sharp), a Criterion DVD case (editorial film),
Aesop (warm apothecary), a Bloomberg terminal (dense data), a 1970s ski lodge (warm
retro)."
**Why:** a concrete reference encodes taste, palette, type, and density at once;
adjectives don't.
**Counter if vague:** "'Modern' describes 90% of sites — point me at *one* you'd be
happy to resemble." If they can't, offer 3 references spanning different moods and have
them pick the least-wrong.

## Q2 — Personality poles (pick a side)
**Ask:** "Pick a side on each — don't say 'both':
warm ⇄ cool · serious ⇄ playful · minimal ⇄ maximal · classic ⇄ experimental ·
refined ⇄ raw · dense ⇄ spacious."
**Why:** the middle of each axis is exactly where generic lives. Commitment to poles
creates character.
**Counter if 'a bit of both':** "Both = average = forgettable. If you had to lean,
which way?" Force the lean.

## Q3 — Aesthetic direction (one concrete phrase)
**Ask / recommend:** based on Q1–Q2, propose a named direction and confirm:
- Editorial (serif headlines, generous measure, magazine feel)
- Swiss / International (grid, Helvetica-grade sans, red accent, objective)
- Brutalist / terminal (monospace, hairlines, high contrast, raw)
- Soft-organic (rounded, warm, friendly, blobby-but-tasteful)
- Retro-print (limited ink palette, halftone, vintage)
- High-contrast luxury (black/ivory, big type, lots of space, one metallic accent)
- Playful-geometric (bold shapes, primary-ish colors, motion)
**Why:** the model can execute a named aesthetic; it cannot execute "nice."
**Counter:** if none fit, invent a specific phrase combining Q1+Q2 ("warm dense
editorial-terminal"). Ban "modern/clean/minimalist-but-unique."

## Q4 — Type stance (→ web-typography)
**Recommend:** "Distinctive display + readable body, never Inter/Roboto/Arial:
- Editorial: **Fraunces** / Newsreader display + a humanist sans body
- Technical: **Space Grotesk** / IBM Plex + IBM Plex Sans body
- Luxury: a high-contrast serif (Canela-like) + clean grotesque
- Playful: **Bricolage Grotesque** / Clash Display
Or do you have brand fonts?"
**Force:** an actual display face + body face. Note real size/weight contrast intent
(3×+ scale, weight extremes). Hand the faces to web-typography.

## Q5 — Color anchor (→ color-system)
**Ask:** "Give me ONE dominant brand hue (a color or a thing — 'burnt orange',
'deep teal', 'oxblood') and one sharp accent. We generate the full OKLCH ramp from it,
tint neutrals toward it (no dead grays), and we do **not** default to indigo→violet."
**Why:** a system has one dominant color + an accent, not five equal pastels (slop).
**Force:** a hue, not a hex palette; color-system builds the rest. If they abstain,
pick a non-obvious committed hue that fits the direction and say so.

## Q6 — Density & shape
**Ask, land on numbers:**
- Density: spacious (generous whitespace) or dense (data-rich, tight)?
- Corner radius: sharp (0–4px), soft (8–12px), or round (16px+)? (Not pill on CTAs.)
- Elevation: flat (borders, no shadow) or layered (a real shadow scale)?
**Why:** these three silently define the whole feel and are almost always left to
default. Decide them explicitly.

## Q7 — One signature move
**Ask:** "What's the one memorable thing people screenshot — an oversized serif number
treatment, a single unexpected accent color, an asymmetric split grid, one beautifully
orchestrated page-load reveal, a distinctive cursor/hover?"
**Why:** designed work has exactly one signature; slop has none (or five competing
gimmicks). Pick one and commit.

## Optional Q8 — Motion level (→ micro-motion)
Restrained (subtle, fast) / lively (more animation, still tasteful) / none. Default
restrained.

## Deciding boldly when the user abstains
If the user says "you choose" / "I don't know" / "whatever's best":
1. Use any signal you have (their product, audience, Q1 reference) to pick a
   *specific, slightly unexpected* direction — not the safe average.
2. State it as a committed default they can veto: "I'm going with high-contrast luxury,
   oxblood anchor, Fraunces display, dense, sharp 2px corners, signature = oversized
   numerals. Shout if any of that's wrong; otherwise I'll build to it."
3. Never resolve "I don't know" into Inter + slate + centered. Abstention is permission
   to be bold, not permission to be average.

## Closing the interview
Restate the full committed direction in **one line** (the "north star"), write
`DESIGN-SYSTEM.md` + tokens, then build to it and audit against it with deslop-ui.
