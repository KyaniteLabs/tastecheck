# Patterns — the checkable cognitive-accessibility moves

Read when building. Each pattern is checkable, with before/after where it helps.

## 1. Plain language (the highest-leverage pass)
- Short sentences (~≤20 words); one idea each. Common words over fancy ones.
- **Literal, not idiomatic** — no idioms, metaphors, sarcasm, or vague hedges.
- Active voice; front-load the point; define or avoid jargon; expand acronyms once.
- Target ~grade 8 reading level for general UI; lower for broad consumer.
Before → After:
- ✗ "In order to leverage the platform's full capabilities, navigate to settings."
  ✓ "To use all features, open Settings."
- ✗ "Your submission was unsuccessful." ✓ "We couldn't save your form. Your email is missing an @."
- ✗ "We'll circle back shortly." ✓ "We'll reply within one business day."
(Overlaps `humanize-copy`; that skill also kills the AI-accent — use both.)

## 2. Chunk & summarize
- Short paragraphs (2–4 lines); headings every ~few paragraphs; lists for steps/options.
- **TL;DR / summary at the top** of any long page or doc.
- One concept per chunk; progressive disclosure (reveal detail on demand, don't dump).
- Multi-step tasks: visible steps + progress ("Step 2 of 4").

## 3. Predictability & consistency
- Same navigation, control labels, and interaction patterns everywhere.
- **Help in a consistent location** on every page (WCAG 2.2 §3.2.6).
- **No automatic changes**: nothing submits/advances/reflows on focus or input change
  (§3.2.1 On Focus, §3.2.2 On Input); no auto-playing carousels; no surprising modals.
- Set expectations: tell users what will happen, how long, and what's next.

## 4. Reduce memory & steps
- Don't require info recalled from a previous step — carry it forward, prefill, or show it
  (WCAG 2.2 §3.3.7 Redundant Entry). Allow paste; support password managers (§3.3.8).
- One clear primary action per screen; fewest fields; sensible defaults.
- Save progress on long flows; returning never loses work.

## 5. Attention & sensory calm
- **No autoplay** (video, audio, animation). Motion subtle and **user-stoppable**;
  honor `prefers-reduced-motion` (gate non-essential motion off).
- No parallax overload, no flashing (>3/sec is also a seizure risk), no constant pulsing.
- Palette: avoid **vibrating high-saturation pairs** (e.g. saturated red on saturated
  blue); keep large fields lower-chroma; one calm dominant. (Pairs with `color-system`.)
- Provide a "reduce motion / focus" affordance where motion is core.

## 6. Reading support (dyslexia-aware)
- line-height ~1.5; measure 45–75ch; **ragged-left, never justify**; no long ALL-CAPS;
  generous spacing; real text (not text baked into images) so it can be read aloud/zoomed.
- **Off-white ground + softened ink**, not #fff/#000 glare (still ≥ WCAG minimums).
- Pair text with icons; spell-tolerant search/inputs (forgive typos).
- Support the 1.4.12 text-spacing overrides without breakage (see `web-typography`).

## 7. Errors, time, and tone
- Errors: say what's wrong **and the fix**, next to the field, in plain words (`form-ux`).
- **No time limits**, or make them adjustable/extendable/dismissible (WCAG §2.2.1).
- Destructive actions: confirm + provide **undo**.
- Tone: warm, non-judgmental, encouraging — especially empty and error states.

## Quick measurable checks
- Average sentence length ≤ ~20 words; longest paragraph ≤ ~5 lines.
- Reading level ≈ grade 8 (or lower for consumer) — sanity-check with any readability metric.
- Zero autoplay; all motion has an off path; `prefers-reduced-motion` respected.
- No step requires data only available on a previous step.
- Body line-height ≥ 1.5; measure ≤ 75ch; background not pure #fff; text not pure #000.
