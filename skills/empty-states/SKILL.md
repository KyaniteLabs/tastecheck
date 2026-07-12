---
name: empty-states
description: >-
  Empty, loading, and error-state design. Use for first-run screens, zero results,
  empty lists/tables/dashboards, loading skeletons, offline/permission errors,
  retries, layout stability, and state copy.
---

# Empty States

Every data region needs truthful loading, empty, and error states; absence and failure
are different conditions with different safe next moves.

## Start with a state contract, not a set of illustrations

Name the region and transition before copy or illustration. Record:

| Question | Decision to record |
| --- | --- |
| User goal | What they came to find, create, compare, or finish in this region |
| Data authority | Network source, local draft, cached result, permission boundary, or user-entered filter |
| Entry condition | The observable event that enters loading, zero-result, error, stale, or partial state |
| Continuity | What remains visible and editable while the state is active |
| Recovery | The action that can change the state, its owner, and whether retry is safe to repeat |
| Exit proof | The event that replaces the state and the announcement/visual confirmation the user receives |

First-use, zero results, and permission absence need different truth. Trusted cached data
is stale content with progress—not a blank reset.

## The minimum state set (always design all three)

Design loading (in flight), empty (successful zero plus why), and error (failed fetch)
before shipping. Add stale, partial, awaiting-input, or pending-mutation only when the
region can enter it; never render zero, unavailable, and loading as the same state.

## Loading: skeleton over spinner

Use a layout-matching skeleton for regions and reserve its final space; use a spinner
only for short inline waits. Avoid a flash for very fast loads; use optimistic UI only
when rollback/reconciliation is safe.

## Empty: the three flavors, each with a next step

Every empty state has heading, context, and a safe way forward. First-run teaches the
first action; user-cleared affirms completion; no-results names the query/filter and
offers clear/broaden/correct/create. If no action exists, say what will fill it.

## Error: explain, reassure, offer recovery

Use plain, blameless language; distinguish offline, permission, not-found, and server
when recovery differs. Preserve work and offer retry, a working route, or support with
a tone proportionate to the consequence.

## Preserve continuity through transitions

Retain position, prior content, filters, and drafts unless safety/integrity forbids it.
Make in-flight retry visible without duplicating mutation; explain rollback and return
focus to repair. Record idempotent, confirmation-required, or support-only retry—never
promise retry can resolve permission or duplicate-money risk.

## Quick-start pattern

Use `references/patterns.md` for state-specific markup and copy. Render one explicit
state per region, reserve the same container space, announce changes, and preserve
user work across errors.

## Reference files

- `references/patterns.md` — surface patterns, copy, skeletons, and announcements.
- `references/decision-records.md` — novel-case ADR rules.

## Decision order and evidence

For each applicable state, record cause, retained context, next action, retry semantics,
exit proof, and accessible recovery; `n/a` requires subject absence. Hand control
behavior to `component-states`.

## Self-check (before shipping any data region)

1. Loading, empty, and error are distinct and truthful?
2. Empty has heading/context/forward action; no-results has an exit?
3. Errors explain/recover without raw internals; skeletons reserve space?
4. Changes announce, preserve work, and state safe retry/cached/partial behavior?

## How to deliver

Deliver a region matrix: entry, truthful message, retained context, recovery, exit,
announcement, and layout-shift evidence. Keep containers stable; hand adjacent scope off.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A data region needs first-use, no-results, loading, permission, or error states.; avoid: The issue is only a button or field state.
- Exclude: Do not use a spinner as the only loading communication. (+1 in contract.json)
- Stop / handoff: Stop when the cause of absence cannot be distinguished. (+1 in contract.json); receives [design-system-interview, improve-existing-website] -> sends [component-states, a11y-pass, humanize-copy, tastecheck-pass]
- Output: domain-specific data-region state plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
