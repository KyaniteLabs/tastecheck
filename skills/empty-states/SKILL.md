---
name: empty-states
description: >-
  Empty, loading, and error-state design. Use for first-run screens, zero results,
  empty lists/tables/dashboards, loading skeletons, offline/permission errors,
  retries, layout stability, and state copy.
---

# Empty States

Every reachable data state needs a truthful treatment; absence and failure are different
conditions with different safe next moves.

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

## Model the reachable state set

Design loading when work can be in flight, empty when a successful result can contain
zero items, and error when the region can fail. A static or fully local region need not
invent unreachable states. Add stale, partial, awaiting-input, or pending-mutation only
when their entry condition exists; never render zero, unavailable, and loading as the same state.

## Loading: communicate the wait honestly

Use a layout-matching skeleton when the final geometry is known and the placeholder will
help orientation. Use determinate progress when progress is measurable, a compact status
for short inline waits, and a spinner only as a supporting cue. Delay transient indicators
when measured latency makes flashing likely, but keep slow work visibly alive. Never imply
progress or shape the system cannot know. Use optimistic UI only when rollback and
reconciliation are safe.

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
promise retry can resolve permission or duplicate-money risk. Give each request an owner:
late responses from an abandoned query or retry must not replace the current state.

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

1. Every reachable loading, empty, and error state is distinct and truthful?
2. Empty has heading/context/forward action; no-results has an exit?
3. Errors explain/recover without raw internals; loading feedback matches what is actually known?
4. Changes announce, preserve work, reject stale responses, and state safe retry/cached/partial behavior?

## How to deliver

Deliver a region matrix: entry, truthful message, retained context, recovery, exit,
announcement, and layout-shift evidence. Keep containers stable; hand adjacent scope off.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A data region needs first-use, no-results, loading, permission, or error states.; avoid: The issue is only a button or field state.
- Exclude: Do not use a spinner as the only loading communication. (+1 in contract.json)
- Stop / handoff: Stop when the cause of absence cannot be distinguished. (+1 in contract.json); receives [component-states, data-viz, design-system-interview, deslop-ui, improve-existing-website, tasteroll] -> sends [component-states, a11y-pass, humanize-copy, tastecheck-pass, cognitive-a11y]
- Output: domain-specific data-region state plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
