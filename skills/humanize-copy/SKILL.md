---
name: humanize-copy
description: >-
  Humanize prose by removing LLM tells. Use for landing copy, docs, READMEs,
  emails, UI microcopy, release notes, social posts, or requests like humanize,
  less robotic, remove AI tells, punch up, or make this sound human.
---

# Humanize Copy

Human copy sounds like someone meant it for this reader, in this moment. Keep the facts;
replace formula with consequence, stance, and a cadence the speaker could sustain aloud.

## Establish the speaking situation before editing

Do not synonym-swap detached text. Build a voice brief from source, reader job, protected
language, defensible claim, and situational register. If the intended author is a real
person, use supplied or approved samples; never infer a private identity from stereotypes.

| Voice brief field | Evidence to use |
| --- | --- |
| Speaker and audience | Named role, relationship, and reader context from the request/source |
| Reader job | Decision, action, reassurance, or understanding the text must support |
| Defensible claim | Source fact, direct quote, measurement, or explicitly marked opinion |
| Protected language | Legal, safety, product, customer, or brand wording that cannot be casually altered |
| Register boundary | Degree of formality, humor, intimacy, and certainty the situation can bear |

Without facts/voice authority, change only clarity, order, and cadence; never invent
claims, metrics, anecdotes, testimony, or personal voice.

## Edit in three passes

1. **Source:** mark protected meaning and the factual authority behind every claim.
2. **Stance:** decide what the speaker can say plainly, then lead with the reader's
   consequence, decision, or next action.
3. **Shape:** cut the wrapper, restore causal order, and tune sentence length and register.

Compare the revision to the source, not to a list of banned words. Use
`references/kill-list.md` and `references/rhythm-and-voice.md` as detectors after meaning
is settled.

## Detect formula before replacing words

The kill list is a detector, not a ban. Inspect abstract buzzwords, ceremonial hooks,
manufactured contrast, repeated rule-of-three or em-dash cadence, hedges, and generic
metaphor. Preserve necessary technical, legal, and brand terms. When a detector fires,
repair the underlying mechanism: name the subject, state the consequence, or remove the
sentence. A fancier synonym is not a repair.

## Worked transformation

**Source facts:** appointments are booked online; technicians give a two-hour arrival
window; customers receive a text before arrival.

**Before:** “Experience seamless repair solutions designed to get your day back on track.”

**After:** “Book online. We’ll give you a two-hour window and text before the technician
arrives.”

The revision earns its confidence from the source. It replaces an unsupported emotional
promise with the decision, the timing, and the useful reassurance. This is the target:
not universally casual copy, but language whose specificity and rhythm fit its authority.

## Decision order and evidence

Build the brief and fact ledger, then revise stance, order, precision, and cadence without
changing facts or safety meaning. Record source authority for every new specificity.

## Self-check (run before claiming "humanized")

1. Read-aloud test, direct opening, and no formulaic cadence, hedge, or thesaurus-salad?
2. Source-backed specifics and bounded claims—not competitor-generic copy or invented texture?
3. Register fits this reader, task, and consequence?

## Reference files

- `references/kill-list.md` — full detector list and examples.
- `references/rhythm-and-voice.md` — structure, stance, and cadence.
- `references/decision-records.md` — novel-case ADR rules.

## How to deliver

Deliver the revised copy first when that is what the user asked for. Follow with the voice
brief and 2–5 high-leverage changes by mechanism when rationale is useful. Preserve facts
and register; pair non-English work with `i18n-ready`.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: UI or product copy is factually correct but generic, hedged, clichéd, or unlike the intended author voice.; avoid: The request requires changing product facts, legal meaning, or interaction behavior.
- Exclude: Do not invent claims, testimonials, or product facts. (+1 in contract.json)
- Stop / handoff: Stop when source facts or approval constraints are missing. (+1 in contract.json); receives [cognitive-a11y, design-system-interview, deslop-ui, empty-states, improve-existing-website, tasteroll] -> sends [form-ux, i18n-ready, tastecheck-pass]
- Output: fact-preserving copy revision with voice rationale
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
