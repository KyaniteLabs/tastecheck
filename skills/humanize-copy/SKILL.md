---
name: humanize-copy
description: >-
  Humanize prose by removing LLM tells. Use for landing copy, docs, READMEs,
  emails, UI microcopy, release notes, social posts, or requests like humanize,
  less robotic, remove AI tells, punch up, or make this sound human.
---

# Humanize Copy

Raw LLM prose is statistically safe, which is exactly why it reads as machine-made:
the same buzzwords, the same rhythm, the same hedging, the same tidy intro-three-
points-conclusion. Readers in 2026 have a sixth sense for it — surveys show a
majority stop reading the moment they suspect a bot wrote it. This skill is the
**AI-accent remover for writing**: a kill-list and a set of rewrite rules, each
checkable, that turn beige AI output into something a person would actually say.

The governing test, applied throughout: **the pub test** — would you say this
sentence out loud to a colleague over a beer? If not, rewrite it. Humanizing is
not adding flourish; it's usually *cutting* and *getting specific*.

## How to use this skill

1. Run the draft through the **Kill List** (vocabulary + phrase tells) — replace each
   hit with the human alternative or a concrete specific.
2. Apply the **Rhythm & structure rules** — break the flat AI cadence.
3. Apply the **Stance rules** — remove hedging, commit to a point.
4. Run the **self-check** before claiming it's humanized.
5. For the full word blacklist and worked rewrites, read `references/kill-list.md`;
   for rhythm/structure/voice, read `references/rhythm-and-voice.md`.

Important caveat: **don't over-correct into "syntax salad."** Thesaurus-swapping
("important" → "paramountly significant") creates a *new* AI tell. Plainer is more
human than fancier. When in doubt, simpler and more concrete.

## The Kill List (vocabulary tells → fix)

Replace these on sight. Full table with alternatives in `references/kill-list.md`.

**Verbs:** delve, leverage, foster, ignite, empower, unleash, unlock, underscore,
streamline, optimize, elevate, navigate → *use, help, give you, cut, build, start*.
**Adjectives:** seamless, robust, cutting-edge, future-ready, multifaceted, pivotal,
dynamic, comprehensive, transformative, revolutionary, game-changing → *say the
specific thing instead* ("seamless" usually hides a missing feature description).
**Nouns/metaphors:** landscape, tapestry, realm, beacon, journey, roadmap, symphony,
ecosystem → *concrete noun* (mix, situation, guide, plan, process).
**Transitions:** furthermore, moreover, additionally, in conclusion → *also, plus,
besides, to wrap up* — or cut entirely and link by logic.

The fix is rarely a synonym; it's a **specific**. "We empower users to optimize their
workflows" → "We help you work faster." "Cuts your server costs by 30%" beats any
adjective.

## Phrase & opener tells (cut or rewrite)

- **"In today's fast-paced / ever-evolving [world/landscape]…"** — filler the model
  emits to buy time. Cut it; start with the actual point.
- **"Let's dive in" / "Let's explore" / "Demystify"** — lazy-prompt hallmark. Delete.
- **"It's not just X, it's Y" / "Not only… but also…"** — the parallelism tell. Just
  say what it IS, directly.
- **"In conclusion / At the end of the day / Ultimately / In essence"** — essay
  throat-clearing. End on a point or a CTA, not a summary.
- **"Here's the kicker / That's only half the story / Real talk / Here's the truth"**
  — fake-hook transitions. Link ideas by their logic instead.
- **"Picture this… / Imagine a world where… / As a [role], you know…"** — faked
  experience. Replace with a specific, grainy detail only a real person would know.
- **The "No X. No Y. Just Z." rule-of-three** — fine once, robotic when it's in every
  section. Use at most once per piece.

## Rhythm & structure rules

AI prose has **low burstiness** — sentences all 15–20 words, Subject-Verb-Object,
paragraphs like perfect rectangles. Humans are jagged.

- **Vary sentence length deliberately.** Follow a long, explanatory sentence with a
  short, sharp one. Like this. (Flag any run of 3+ same-length sentences.)
- **Vary openings.** Don't start consecutive sentences/paragraphs the same way. It's
  fine to open with "But" or "And."
- **Use fragments for emphasis.** Not always. Just when it lands.
- **Break the listicle mold.** Not every bullet needs a **Bold lead:** + sentence.
  Mix bullet styles; sometimes turn a 3-point list into a sentence.
- **Cut the first 10%.** The real piece usually starts at paragraph two. Delete the
  polite warm-up and open on the actual claim or tension.

## Stance rules (remove the hedge)

RLHF makes models allergic to a strong position. That allergy is a tell.
- **Kill hedges:** "it's important to note," "it could be argued," "generally
  speaking," "while it's true that." They signal fear of being wrong.
- **Kill "aims to":** "This article aims to explore…" → state that you're doing it.
- **Take one side.** Don't give balanced pros/cons when the reader wants a
  recommendation. A clear point of view is the most human thing on the page.
- **Use specifics and data.** Concrete numbers, named things, real detail. Bland
  generality is the AI baseline; specificity is the human signal (and what readers
  trust). Verify any stat — models invent them.

## Self-check (run before claiming "humanized")

1. Any word from the Kill List still present? → replace with a specific.
2. Read the worst paragraph **aloud** — does it pass the pub test? → rewrite if not.
3. Are there 3+ sentences in a row of similar length? → break the rhythm.
4. Does it open with filler ("In today's…")? → cut to the point.
5. Any hedging or "aims to"? → commit.
6. Does it take an actual position / contain real specifics? → if not, add them.
7. Did a "humanizer" pass leave thesaurus-salad? → revert to plainer words.
8. Could this exact paragraph appear on a competitor's site verbatim? → if yes, it's
   too generic; inject brand-specific, proprietary detail.

## Reference files

- `references/kill-list.md` — the full 2026 word blacklist by category with human
  alternatives, plus before/after rewrites. Read when editing real copy.
- `references/rhythm-and-voice.md` — burstiness, sentence-shape variety, stance,
  specificity, and the "human sandwich" workflow. Read for structural rewrites.
- `references/decision-records.md` — meta-patterns (why models sound this way) and
  ADR-style rules for novel cases.

## How to deliver

- Edit, don't regenerate. Humanizing is surgical: cut tells, swap for specifics,
  vary rhythm. Show the before/after on a few lines so the user sees the moves.
- Preserve the author's actual claims and facts; never invent specifics or stats to
  sound human — get them from the user or the source.
- Keep the register appropriate (a README isn't a sales page). "Human" means natural
  for *that* context, not casual everywhere.
- For non-English copy, the tells differ by language — pair with the
  `idiomatic-translation` skill so you don't trade an AI accent for a translation accent.
