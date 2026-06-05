# Profiles — ADHD · Autism · Dyslexia · Neurodivergence

Read for the audience(s) you're designing for. The profiles overlap heavily (marked ⊕);
each also has sharp specifics. Designing for one almost always helps the others.

## ADHD — attention & working memory
The barriers: distraction pulls focus; working memory is limited; long/ambiguous tasks
stall; "out of sight, out of mind."
Fixes:
- **Remove distraction:** no autoplay video/animation; minimize badges/notifications;
  calm default; offer a focus/declutter mode. ⊕
- **Chunk & sequence:** break tasks into visible steps with progress; one primary action
  per screen; show "you are here / N left." ⊕
- **Protect working memory:** never require recalling data across screens — carry it
  forward, autofill, show summaries; avoid codes to memorize. (WCAG 2.2 Redundant Entry) ⊕
- **Make the next step obvious:** strong single CTA; don't bury the action among equals.
- **Allow save & return:** long forms persist; coming back doesn't lose progress.
- **Reduce friction & time pressure:** fewer fields; no countdowns; instant, clear feedback.

## Autism — predictability & sensory regulation
The barriers: unexpected change is disorienting; figurative/ambiguous language is hard;
sensory overload (bright color, motion, sound) is painful; unclear expectations cause anxiety.
Fixes:
- **Maximize predictability/consistency:** identical nav, labels, and patterns across the
  app; help always in the same place (WCAG 2.2 §3.2.6); nothing auto-plays, auto-advances,
  or changes on focus/input (§3.2.1/§3.2.2). ⊕
- **Literal, unambiguous language:** no idioms, sarcasm, metaphor, or vague "maybe later";
  say exactly what will happen. ("Click Save — your changes are kept. We will not email you.") ⊕
- **Set expectations up front:** "This form takes ~3 minutes," "Next: payment," "We'll
  reply within a day." Remove uncertainty.
- **Muted sensory load:** lower-saturation palette, no vibrating color pairs, no flashing,
  motion off or subtle + stoppable, no surprising sound. ⊕
- **Clear structure & one task at a time:** avoid crowded screens; explicit start/finish.

## Dyslexia — reading
The barriers: decoding text is effortful; dense/justified/ALL-CAPS text and high glare
make it worse; reliance on reading alone excludes.
Fixes (type specifics also live in `web-typography`):
- **Type:** line-height ~1.5; measure 45–75ch; **left-aligned, ragged right (never
  justify** — rivers are disorienting); generous letter/word spacing; **no long ALL-CAPS**;
  avoid italics for long runs; a clean humanist/sans or a dyslexia-friendly face.
- **Contrast that helps, not glares:** **off-white background (e.g. #faf7f0), softened
  ink (not #000)** — maximum black-on-white contrast can increase visual stress. Still
  meet WCAG minimums, just don't max them with pure black/white. ⊕ (autism sensory)
- **Plain language & chunking:** short sentences, common words, lists, summaries — reduce
  the *amount* to decode. ⊕
- **Don't rely on reading alone:** pair text with icons/visuals; support browser/OS
  read-aloud (clean semantic HTML, real text not text-in-images); spell-tolerant search
  & inputs (forgive typos).

## Neurodivergence (umbrella) & general cognitive load
For mixed/unknown audiences and everyone under stress, fatigue, or time pressure, apply
all the non-negotiables, plus:
- **Consistent, findable help** (WCAG 2.2 §3.2.6) and clear instructions.
- **Error prevention & recovery:** confirm/undo destructive actions; forgiving inputs;
  errors say what's wrong and how to fix it (pairs with `form-ux`). ⊕
- **Low-memory, low-step flows;** progressive disclosure (don't show everything at once).
- **Kind, non-judgmental tone:** empty/error states encourage, never shame ("No projects
  yet — let's make your first," not "You haven't done anything").

## Cross-profile truth
The cheapest, highest-impact moves serve all four: **plain language, chunking + TL;DR,
predictability, low memory demand, calm controllable motion, dyslexia-aware off-white
type, and forgiving errors with no time pressure.** Do those first; layer profile
specifics for the target audience.
