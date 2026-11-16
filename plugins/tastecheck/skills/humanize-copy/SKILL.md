---
name: humanize-copy
description: >-
  Humanize prose by removing LLM tells. Use for landing copy, docs, READMEs,
  emails, UI microcopy, release notes, social posts, or requests like humanize,
  less robotic, remove AI tells, punch up, or make this sound human.
---

# Humanize Copy

Human copy sounds meant for this reader, now. Keep facts; replace formula with consequence,
stance, and cadence the speaker can sustain aloud.

## Establish the speaking situation before editing

Do not synonym-swap detached text. Build a voice brief from source, reader job, protected
language, defensible claim, and register. For a real author, use supplied/approved samples;
never infer private identity from stereotypes.

| Voice brief field | Evidence to use |
| --- | --- |
| Speaker and audience | Named role, relationship, and reader context from the request/source |
| Reader job | Decision, action, reassurance, or understanding the text must support |
| Defensible claim | Source fact, direct quote, measurement, or explicitly marked opinion |
| Protected language | Legal, safety, product, customer, or brand wording that cannot be casually altered |
| Register boundary | Degree of formality, humor, intimacy, and certainty the situation can bear |

Without facts/voice authority, change only clarity, order, and cadence; never invent claims,
metrics, anecdotes, testimony, or personal voice.

## Edit in three passes

1. **Source:** mark protected meaning and authority behind every claim.
2. **Stance:** decide what the speaker can say plainly; lead with reader consequence,
   decision, or next action.
3. **Shape:** cut wrapper, restore causal order, tune sentence length/register.

Compare revision to source; apply `references/writing-constitution.md`, then use kill-list and
rhythm references as detectors after meaning is settled.

## Detect formula before replacing words

The kill list is a detector, not a ban. Inspect buzzwords, ceremonial hooks, manufactured
contrast, repeated rule-of-three/em-dash cadence, hedges, and generic metaphor. Preserve
technical, legal, and brand terms. When it fires, name the subject, state the consequence, or
remove the sentence; a fancier synonym is not repair.

## Worked transformation

**Source facts:** appointments are booked online; technicians give a two-hour arrival
window; customers receive a text before arrival.

**Before:** “Experience seamless repair solutions designed to get your day back on track.”

**After:** “Book online. We’ll give you a two-hour window and text before the technician
arrives.”

The revision earns confidence from source: it replaces unsupported emotional promise with
decision, timing, and useful reassurance. Target specificity and rhythm that fit authority,
not universally casual copy.

## Decision order and evidence

Build the brief/fact ledger; revise stance, order, precision, and cadence without changing
facts or safety meaning. Record source authority for new specificity.

## Self-check

1. Read-aloud test, direct opening, and no formulaic cadence, hedge, or thesaurus-salad?
2. Source-backed specifics and bounded claims—not competitor-generic copy or invented texture?
3. Register fits this reader, task, and consequence?
4. Writing rules applied and their IDs recorded in the evidence?

## Reference files

- `references/kill-list.md` — detector list and examples.
- `references/rhythm-and-voice.md` — structure, stance, cadence.
- `references/decision-records.md` — novel-case ADR rules.
- `references/writing-constitution.md` — portable IA floor.

## How to deliver

Deliver revised copy first when requested. Follow with voice brief and 2–5 high-leverage
mechanism changes when useful. Preserve facts/register; pair non-English work with
`i18n-ready`.

## Information-architecture gate

Apply the bundled Writing Constitution floor (`references/writing-constitution.md`):
old-before-new, stress position, anchor/linking/umbrella/preview, and exact key-term repetition.
Run the three-pass audit and record rule IDs. This reference is portable; do not use a
workstation-local copy. Echo argument terms; remove formulaic repetition.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: UI or product copy is factually correct but generic, hedged, clichéd, or unlike the intended author voice.; avoid: The request requires changing product facts, legal meaning, or interaction behavior.
- Exclude: Do not invent claims, testimonials, or product facts. (+2 in contract.json)
- Stop / handoff: Stop when source facts or approval constraints are missing. (+1 in contract.json); receives [cognitive-a11y, design-system-interview, deslop-ui, empty-states, improve-existing-website, tasteroll] -> sends [form-ux, i18n-ready, tastecheck-pass]
- Output: fact-preserving copy revision with voice rationale
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
