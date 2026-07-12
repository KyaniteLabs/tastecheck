---
name: improve-existing-website
description: >-
  Use when improving an existing website or codebase while retaining its recognizable
  identity, especially when evidence, scope, or redesign approval is uncertain.
---

# Improve Existing Website

Improve an observed system without erasing its recognizable identity or mistaking drift
for a new brand decision.

## The state machine

Run `inspect → infer → score → ask_or_skip → approve → execute → verify`. Label direct
observations **EVIDENCE** and derivations **INFERRED**, record preserved signals, and use
`references/inspection-state-machine.md` for incomplete/resumed decisions. Inspect rendered
and source hierarchy, tokens, components, voice, and business cues; use
`references/signal-vs-drift.md` for ambiguity. `assets/INFERRED-SYSTEM.template.md` covers audience,
territory, type, color, layout, components, voice, and accessibility; score/ask/approve per
the reference before execution.

## Handoff chain

After approval, use `references/repair-handoffs.md` for evidence-justified specialists
and valid subject-absence skips.

## Output shape

Before editing, write `INFERRED-SYSTEM.md` with labels, preserved signals, readiness,
scope, and question rationale. Afterward report preserved signal, removed drift, skills,
browser/static proof, and deferred ambiguity.

## Repair authorization packet

For each candidate, record the smallest safe edit/proof and source/approved provenance.
Classify **preserve** (recognizable identity), **normalize** (accidental variation), or
**approval needed** (new language/hierarchy/palette/material redesign); never queue the
last class without owner agreement.

## Reference files

- `references/audit-procedure.md` — extraction order.
- `references/signal-vs-drift.md` — identity versus accident.
- `references/decision-records.md` — scope ADR rules.
- `references/inspection-state-machine.md` — readiness and approval.
- `assets/improve-checklist.md` — completion ledger.
- `references/repair-handoffs.md` — routing and skip rules.
- `references/interview-contract.generated.md` — canonical state/question authority.

## Self-check

`assets/improve-checklist.md` is the completion authority for inspection, labels,
approval, handoffs, and evidence.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An existing site or codebase needs improvement while preserving its intended identity (+1 in contract.json); avoid: A greenfield project needs direction before anything exists to inspect (+1 in contract.json)
- Exclude: Do not prescribe or edit before inspecting evidence (+1 in contract.json)
- Stop / handoff: Pause when evidence is insufficient for a safe inference (+2 in contract.json); receives [none] -> sends [deslop-ui, color-system, web-typography, theming, responsive-layout, a11y-pass, cognitive-a11y, i18n-ready]
- Output: An evidence-labelled inferred system, readiness decision, and scoped repair plan or implementation report
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
