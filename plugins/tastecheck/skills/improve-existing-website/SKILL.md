---
name: improve-existing-website
description: >-
  Use when improving an existing website or codebase while retaining its recognizable
  identity, especially when evidence, scope, or redesign approval is uncertain.
---

# Improve Existing Website

Improve what is weak without sanding away identity. Existing work contains signal and drift;
evidence decides which is which.

## 1. Inspect the product people actually use

Open the rendered priority path before prescribing. Trace entry, decision, action, and recovery
at wide/narrow widths. Inspect hierarchy, tokens, repeated components, content, supplied
analytics/user evidence, and business cues.

Label what you can point to **EVIDENCE** and interpretations **INFERRED**. “The primary action
changes label across three screens” is direct; “the brand values warmth” is inferred unless
brief/product evidence says so.

**Done when:** priority path, recurring choices, and highest-cost failures are observable.

## 2. Separate identity from drift

Record signals worth preserving: distinctive type, color relationships, interaction patterns,
voice, layout logic, or recognizable assets. Classify each change:

| Class | Meaning | Authority |
| --- | --- | --- |
| **Preserve** | coherent, repeated, brief-supported identity | repair defects without replacing the signal |
| **Normalize** | accidental variation against an established pattern | safe to align when evidence is strong |
| **Approval needed** | a new hierarchy, palette, voice, or material redesign | show the choice and wait for owner agreement |

Use `references/signal-vs-drift.md` when repetition, age, or inconsistency could be
intentional. Age alone is not drift evidence.

**Done when:** every proposed change names what survives and why it is authorized.

## 3. Form the smallest coherent direction

Complete `assets/INFERRED-SYSTEM.template.md` across audience, territory, type, color, layout,
components, voice, and accessibility. Score readiness with `references/inspection-state-machine.md`.
Ask only questions that change the safe direction; otherwise state inference and evidence.

Do not solve a system problem with isolated polish. Choose a narrow vertical slice proving the
direction across a real path (navigation, content section, form/state, narrow layout) before
propagating it.

**Done when:** the direction can be approved, rejected, or resumed without reconstructing
the investigation.

## 4. Approve, repair, and verify

For each repair, record observed failure, preserved signal, smallest coherent edit, owner/
approval source, and proof. After approval, use `references/repair-handoffs.md` for specialist
passes. Verify the same path/viewports; comparison must show defect changed and signal survived.

If work pauses, save current state, unresolved question, evidence, and exact next decision using
`references/inspection-state-machine.md`. Resume from that checkpoint, not a fresh opinion.

**Done when:** report distinguishes repaired drift, preserved identity, browser/static proof,
and deliberately deferred ambiguity.

## Reference files

- `references/audit-procedure.md` — extraction order.
- `references/signal-vs-drift.md` — identity versus accident.
- `references/decision-records.md` — scope ADR rules.
- `references/inspection-state-machine.md` — readiness/approval.
- `assets/improve-checklist.md` — completion ledger.
- `references/repair-handoffs.md` — routing/skip rules.
- `references/interview-contract.generated.md` — canonical authority.

## Self-check

`assets/improve-checklist.md` is completion authority for inspection, labels, approval,
handoffs, and evidence.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An existing site or codebase needs improvement while preserving its intended identity (+1 in contract.json); avoid: A greenfield project needs direction before anything exists to inspect (+1 in contract.json)
- Exclude: Do not prescribe or edit before inspecting evidence (+1 in contract.json)
- Stop / handoff: Pause when evidence is insufficient for a safe inference (+2 in contract.json); receives [none] -> sends [a11y-pass, art-direction, cognitive-a11y, color-system, component-states, data-viz, deslop-ui, empty-states, humanize-copy, i18n-ready, responsive-layout, spacing-system, tasteroll, theming, web-typography]
- Output: An evidence-labelled inferred system, readiness decision, and scoped repair plan or implementation report
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
