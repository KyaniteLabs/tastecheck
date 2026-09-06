# DENSITY-PASS METHOD — master prompt-engineer read (CEO order 2026-09-04)

Goal: token efficiency as a DIFFERENTIATOR — respect for users' context windows.
Not counting. READING. Every line, every skill, both packs, and the pack as a whole.

## Sources of technique (verified 2026-09-04)

- CAVEMAN (github.com/JuliusBrussee/caveman, getcaveman.dev): telegraphic prose.
  Drop articles, hedges, throat-clearing, politeness. "Same diagnosis, same fix — only
  the throat-clearing died." 19 tokens instead of 69, same information.
- PONYTAIL (github.com/DietrichGebert/ponytail, ponytail.dev): least-that-works.
  "Stdlib over custom, native over deps, one line over fifty." Every line must earn
  existence; prefer the smaller instruction that preserves function.

## The read (per skill, then per pack)

1. STRUCTURE: are sections in the order an agent consumes them? Any section that
   restates another? Do headers match what the body actually does?
2. WORDING: caveman-compressible prose (hedges, transitions, "it is important to
   note", politeness, motivational framing). Rewrite telegraphic. SMALLER WORDS.
3. SECTIONS: can two merge by clever writing? A "How to run" + "Rules" often folds
   into one ordered list where each step carries its rule inline (ponytail merge).
4. INTERNAL CONSISTENCY: does the skill contradict itself, repeat a rule in three
   places (keep ONE, the most load-bearing spot), or define terms it never uses?
5. PACK COHESION: cross-skill overlap — the same doctrine stated in 5 skills belongs
   in ONE place (the gate or the anchor skill) + one-line pointers elsewhere.
   Shared vocabulary: same concept = same word everywhere (no synonyms across skills).
6. FRONTMATTER: description = the always-loaded cost. Maximum density, honest trigger
   conditions, zero selling.

## Protected verbatim classes (NEVER compressed)

Check ids (TC-04, CY-SECRET-001), commands, file paths, exact evidence vocabulary
(pass/fail/n-a semantics), acceptance criteria, numeric thresholds, the gate verdict
grammar (SHIP/HOLD), provenance fields. Compression may only touch PROSE around them.

## Losslessness gate

A compression is valid ONLY if the pack's own verification chain stays green after it
(verify/lint/contracts for tastecheck; validate_public+pytest for checkyourself).
Meaning-density check per skill: every rule, threshold, check, and step must survive
— if a rewrite drops a rule, it is a functional loss, not a compression.
Track per skill: tokens before → after → % cut → chain green y/n.
