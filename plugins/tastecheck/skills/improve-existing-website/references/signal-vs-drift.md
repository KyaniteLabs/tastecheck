# Signal vs. Drift — the judgment call, with a worked example

The whole skill hinges on one distinction: **signal** (choices to preserve and
formalize) vs **drift** (accidents to remove). Get this wrong in either direction and
you either erase a brand or polish a mess.

## The tests

A pattern is **signal** when at least two hold:
1. **Repetition with intent** — it appears 3+ times *in the same role* (the green isn't
   one button; it's every primary action).
2. **Business alignment** — it serves the obvious job (the oversized phone number on a
   plumber's site is not a mistake).
3. **Cost to remove** — users/SEO/brand recognition would notice it gone.

A pattern is **drift** when at least two hold:
1. **Inconsistent within its own role** (five radii on the same card type).
2. **Traceable to a template/era**, not a decision (Bootstrap-blue links nobody chose).
3. **No one defends it** — it harms a measurable thing (contrast failure, broken reflow).

When the tests disagree, **ask the user** — that's exactly what the ≤3 questions are for.

## Worked example — a local bakery site

Observed: warm cream background everywhere (signal: repeated, fits the brand, photos
are warm) · hand-drawn logo + one hand-drawn divider (signal: the only personality the
site has — *amplify*, don't sanitize) · 23 distinct grays (drift: consolidate to a
4-stop tinted-neutral ramp) · three button styles — rounded green, square gray,
Bootstrap blue (the green repeats on every order action → signal, formalize as
`--color-primary`; the other two → drift, remap) · Lobster for headings (judgment call:
distinctive but dated and unreadable at small sizes → *replace with a face that keeps
the warmth*, and ask the user first because it reads as a brand choice) · justified
body text at 11px (drift: fails readability and WCAG — fix without asking).

The resulting one-line system: "Warm artisan-handmade — cream ground, the existing
green as committed primary, hand-drawn accents kept as the signature, one humanist
face, 4-stop tinted neutrals." Nothing invented; everything traceable.

## The cardinal sins

- **Erasing identity to impose taste** — replacing a quirky-but-loved brand color
  because a generic palette "looks cleaner." You're a restorer, not a colonizer.
- **Formalizing the accident** — tokenizing all 23 grays faithfully. Consolidate.
- **The stealth redesign** — "improving" until it's a different site. If >40% of the
  visual surface changes, you've left this skill's mandate; stop and confirm scope.
