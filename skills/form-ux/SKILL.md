---
name: form-ux
description: >-
  Form UX and accessibility pass. Use for forms, inputs, checkout, signup/login,
  validation, labels, autocomplete, mobile keyboards, inline errors, required
  fields, disabled submits, and field-level accessibility.
---

# Form UX

A form is a completion path: reduce effort, prevent predictable errors, and make every
failure truthful, repairable, and accessible.

## Model the task before styling fields

Start with outcome, risk, and data authority—not an inherited input array. Remove,
defer, or explain each field through this contract:

| Field contract | What to decide |
| --- | --- |
| User value | What completing this field unlocks now, in the user's words |
| Data rule | Required/optional condition, source of truth, and whether the rule is client- or server-owned |
| Input affordance | Label, type, inputmode, autocomplete, format help, and a safe example |
| Validation moment | What can be checked while editing, on blur, on submit, or only after a server request |
| Recovery | Exact message, preserved value, focus destination, and next available action |
| Sensitivity | Whether the field is personal, financial, irreversible, or must never be persisted locally |

Unknown rule/ownership stays unresolved; never invent validation. Group by the user’s
task, not database/API shape.

## Non-negotiables

- Persistent associated label; visible required/optional state; correct type, inputmode,
  autocomplete, and a one-column task flow (short related pairs excepted).
- Validate on submit. Validate on blur only when the value is complete enough to judge;
  after an error, re-check while the person repairs it. Keep server truth server-owned.
- Put specific, adjacent “what + fix” errors behind `aria-invalid`/`aria-describedby`;
  announce and focus first error on failed submit.
- Never silently disable submit; retain visible focus and explain what is missing.

## The error-message formula

Use `[what is wrong] + [how to fix it] (+ example)`, plainly and without blame. Tie it
visually/programmatically to the field; a top summary links to inline errors on long forms.

## Validation is a conversation, not a trap

Give feedback at the earliest truthful moment; browser checks never impersonate server
truth. On submit distinguish field errors (focus/retain), conflict (correct branch),
transient failure (preserved draft/safe retry), authorization (boundary/route), and
irreversible payment (duplicate lock plus receipt/status). Pending work has an accessible
label/status and rejects duplicates; failure restores a usable explained route. Cancel or
ignore stale asynchronous validation responses so an older result cannot overwrite the
current value.

### Worked field contract

| Field | Rule owner | When to check | Repair path |
| --- | --- | --- | --- |
| Email | server owns account availability; client owns basic shape | submit; blur after a complete address; re-check while repairing | “Enter an address like name@example.com.” Preserve the value; announce an account conflict only after the server responds. |

The row separates a local affordance from server authority. Apply that distinction to
cross-field rules, invitation codes, inventory, pricing, and payment status.

## Quick-start

Use `references/patterns.md` for markup/wiring; retain the field contract above.

## Reduce effort (completion-rate wins)

Ask only necessary fields; defer optional data. Use safe defaults/autofill, helpful
nonblocking formatting, password reveal/paste, inline help, preserved input, and saved
progress for long flows.

## Reference files

- `references/patterns.md` — types, validation, mobile/autofill, and a11y wiring.
- `references/decision-records.md` — novel-case ADR rules.

## Decision order and evidence

Establish task, fields, rule owner, success/risk/interruption before styling. Record each
field/state plus validation owner/recovery; `n/a` needs subject absence, never an unknown rule.

## Self-check (before shipping a form)

1. Field contract, labels, required state, types/autofill, and keyboard/screen-reader wiring complete?
2. Submit/blur/repair timing, stale async responses, specific adjacent errors, first-error focus, and retained input work?
3. No silent disabled submit; pending, duplicate, conflict, authorization, and irreversible outcomes differ?

## How to deliver

Deliver one field/state matrix with source rule, affordance, owner/timing, recovery,
pending behavior, evidence, and remaining risk; hand adjacent concerns to their skills.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A form has completion, validation, recovery, autofill, or interruption problems.; avoid: The issue is only a control's visual interaction state.
- Exclude: Do not hide errors or validate only on blur without a recovery path. (+1 in contract.json)
- Stop / handoff: Stop when validation rules or data ownership are unknown. (+1 in contract.json); receives [component-states, design-system-interview, deslop-ui, humanize-copy, responsive-layout, spacing-system, tasteroll] -> sends [a11y-pass, i18n-ready, tastecheck-pass, cognitive-a11y]
- Output: completion-oriented form flow and evidence table
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
