---
name: empty-states
description: >-
  Empty, loading, and error-state design. Use for first-run screens, zero results,
  empty lists/tables/dashboards, loading skeletons, offline/permission errors,
  retries, layout stability, and state copy.
---

# Empty States

Every reachable data state needs truthful treatment; absence and failure need different next moves.

## Start with a state contract, not a set of illustrations

Name region and transition before copy/illustration. Record:

| Question | Decision to record |
| --- | --- |
| User goal | What they came to find, create, compare, or finish in this region |
| Data authority | Network source, local draft, cached result, permission boundary, or user-entered filter |
| Entry condition | The observable event that enters loading, zero-result, error, stale, or partial state |
| Continuity | What remains visible and editable while the state is active |
| Recovery | The action that can change the state, its owner, and whether retry is safe to repeat |
| Exit proof | The event that replaces the state and the announcement/visual confirmation the user receives |

First-use, zero results, and permission absence need different truth. Trusted cached data is
stale content with progress, not a blank reset.

## Model the reachable state set

Design loading when work can be in flight, empty when success can contain zero items, and error
when the region can fail. Static/local regions need not invent states. Add stale, partial,
awaiting-input, or pending-mutation only when their entry condition exists; never merge zero,
unavailable, and loading.

## Loading: communicate the wait honestly

Use a layout-matching skeleton when final geometry is known and it aids orientation. Use
determinate progress when measurable, compact status for short waits, and a spinner only as a
supporting cue. Delay transient indicators when measured latency makes flashing likely, but
keep slow work visible. Never imply unknowable progress/shape. Use optimistic UI only when
rollback and reconciliation are safe.

## Empty: the three flavors, each with a next step

Every empty state has heading, context, and safe next action. First-run teaches; user-cleared
affirms completion; no-results names query/filter and offers clear/broaden/correct/create. If
no action exists, say what will fill it.

## Error: explain, reassure, offer recovery

Use plain, blameless language; distinguish offline, permission, not-found, and server when
recovery differs. Preserve work; offer retry, a working route, or support proportionate to
the consequence.

## Preserve continuity through transitions

Retain position, content, filters, and drafts unless safety/integrity forbids it. Make retry
visible without duplicate mutation; explain rollback and return focus to repair. Record
idempotent, confirmation-required, or support-only retry—never promise retry can resolve
permission or duplicate-money risk. Give each request an owner; late responses must not
replace current state.

## Quick start

Use `references/patterns.md` for state markup/copy. Render one explicit state per region,
reserve space, announce changes, and preserve work across errors.

## Reference files

- `references/patterns.md` — patterns, copy, skeletons, announcements.
- `references/decision-records.md` — novel-case ADR rules.

## Decision order and evidence

For each state, record cause, retained context, next action, retry semantics, exit proof,
and accessible recovery; `n/a` requires subject absence. Hand control behavior to
`component-states`.

## Self-check

1. Reachable loading, empty, and error states are distinct and truthful?
2. Empty has heading/context/forward action; no-results has an exit?
3. Errors explain/recover without raw internals; loading matches what is known?
4. Changes announce, preserve work, reject stale responses, and state safe retry/cached/partial behavior?

## Deliver

Deliver a region matrix: entry, message, retained context, recovery, exit, announcement,
and layout-shift evidence. Keep containers stable; hand adjacent scope off.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A data region needs first-use, no-results, loading, permission, or error states.; avoid: The issue is only a button or field state.
- Exclude: Do not use a spinner as the only loading communication. (+1 in contract.json)
- Stop / handoff: Stop when the cause of absence cannot be distinguished. (+1 in contract.json); receives [component-states, data-viz, design-system-interview, deslop-ui, improve-existing-website, tasteroll] -> sends [component-states, a11y-pass, humanize-copy, tastecheck-pass, cognitive-a11y]
- Output: domain-specific data-region state plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
