---
name: humanize-copy
description: >-
  Humanize prose by removing LLM tells. Use for landing copy, docs, READMEs,
  emails, UI microcopy, release notes, social posts, or requests like humanize,
  less robotic, remove AI tells, punch up, or make this sound human.
---

# Humanize Copy

Humanizing is source-backed specificity, clear order, and fitting cadence—not flourish.
Use the pub test: would this sound natural aloud to this reader in this situation?

## Establish the speaking situation before editing

Do not synonym-swap detached text. Build a voice brief from source, reader job, protected
language, defensible claim, and situational register.

| Voice brief field | Evidence to use |
| --- | --- |
| Speaker and audience | Named role, relationship, and reader context from the request/source |
| Reader job | Decision, action, reassurance, or understanding the text must support |
| Defensible claim | Source fact, direct quote, measurement, or explicitly marked opinion |
| Protected language | Legal, safety, product, customer, or brand wording that cannot be casually altered |
| Register boundary | Degree of formality, humor, intimacy, and certainty the situation can bear |

Without facts/voice authority, change only clarity, order, and cadence; never invent
claims, metrics, anecdotes, testimony, or personal voice.

## How to use this skill

1. Mark voice brief and protected facts.
2. Lead with reader consequence or defensible tension.
3. Use the detector to cut filler, restore causal order, add source-backed specificity,
   or change sentence shape; settle meaning before cadence.
4. Take stance only with authority; compare material changes to source.

Use `references/kill-list.md` and `references/rhythm-and-voice.md`; plainer is better
than thesaurus-salad.

## Detect formula before replacing words

The kill list is a detector, not a ban: preserve necessary technical, legal, or brand
terms. Inspect abstract buzzwords, ceremonial/fake-hook openers, manufactured contrast,
repeated rule-of-three or em-dash cadence, hedge, and generic metaphor. Cut the wrapper
or name the source-backed subject; do not replace one cliché with a fancier synonym.

## Rhythm & structure rules

Vary sentence length/openings and use fragments only when they serve the reader. Flag
three similarly shaped sentences, formulaic lists, and warm-up openings; lead with the point.

## Stance rules (remove the hedge)

Remove unsupported hedges and “aims to”; take the authorized position. Use verified
named specifics, never invented data.

## Revise by mechanism, not by surface word count

Pass claim (source/opinion/remove), order (consequence first), precision (proved subject
or plainer boundary), cadence (reader-beneficial variation), and register (real channel).
Explain high-leverage changes by mechanism, not adjective count.

## Decision order and evidence

Build brief/fact ledger, then revise claim, order, precision, cadence, and register
without changing facts/safety. Record source authority for new specificity or stance.

## Self-check (run before claiming "humanized")

1. Pub test, direct opening, no formulaic cadence/hedge/thesaurus-salad?
2. Source-backed specifics and bounded claims—not competitor-generic copy or invented texture?
3. Register fits this reader, task, and consequence?

## Reference files

- `references/kill-list.md` — full detector list and examples.
- `references/rhythm-and-voice.md` — structure, stance, and cadence.
- `references/decision-records.md` — novel-case ADR rules.

## How to deliver

Deliver voice brief, 2–5 source/protected-meaning changes by mechanism, then revision.
Preserve facts/register; pair non-English work with `i18n-ready`.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: UI or product copy is factually correct but generic, hedged, clichéd, or unlike the intended author voice.; avoid: The request requires changing product facts, legal meaning, or interaction behavior.
- Exclude: Do not invent claims, testimonials, or product facts. (+1 in contract.json)
- Stop / handoff: Stop when source facts or approval constraints are missing. (+1 in contract.json); receives [design-system-interview, improve-existing-website, deslop-ui] -> sends [form-ux, i18n-ready, tastecheck-pass]
- Output: fact-preserving copy revision with voice rationale
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
