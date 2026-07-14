---
name: component-states
description: >-
  State matrix for interactive UI. Use when building or reviewing buttons, links,
  inputs, tabs, toggles, menus, cards, or controls that need hover, focus, active,
  disabled, loading, selected, error, keyboard, or ARIA states.
---

# Component States

An interactive control is a lifecycle, not a resting style. Map every applicable state
to semantics, a visible treatment, and recovery.

## Decision order and evidence contract

1. Name role, interaction model, owner, and applicable states.
2. Give each state an ARIA/DOM mapping, visible non-color treatment, trigger, and recovery.
3. Test keyboard, focus-visible, contrast, reduced motion, and async completion.

Report one evidence row per state; `n/a` needs a subject-absence reason. Hand field
validation to `form-ux`, region emptiness to `empty-states`, and missing state tokens
back as gaps rather than invented fallbacks.

## Async and destructive controls

Name one semantic owner; visual states only present its lifecycle.

| State / event | Guard and observable contract |
|---|---|
| `ready` / invoke | Click, Enter, Space, and script use one eligible route; accepted work creates a request key. |
| `confirming` | Use only for irreversible, broad, or cascading work; name consequence, move focus in, and restore the invoker on cancel. |
| `submitting` | Create the key before dispatch; reject duplicates; expose native disabled/busy and a working label. |
| matching completion | Only the matching key may settle current work; stale results cannot clear busy, alter another target, or move focus. |
| success / failure | Record data before presentation; confirm locally and choose focus, or retain context with nearby error and retry/cancel. |

Test a real and a stale/failed completion. If success empties a region, hand that
region to `empty-states`.

## The universal state matrix

Every interactive element should account for these (not all apply to every component):

| State | Trigger | Must communicate | CSS |
|-------|---------|------------------|-----|
| **Default** | rest | "this is here / interactive" | base styles |
| **Hover** | pointer over | "you can interact" (pointer devices only) | `:hover` |
| **Focus** | keyboard tab / programmatic | "this is where you are" (keyboard) | `:focus-visible` |
| **Active / pressed** | during click/tap | "your action registered" | `:active` |
| **Disabled** | not available | "not available, and why" | `:disabled` / `[aria-disabled]` |
| **Loading** | async in progress | "working, wait" | a `data-loading` / `aria-busy` class |
| **Selected / current** | chosen / active page | "this is the active one" | `[aria-selected]`/`[aria-current]` |
| **Error / invalid** | failed validation | "something's wrong here" | `[aria-invalid]` |

The first five are the baseline for *any* control. Add selected (tabs, nav, options)
and error (form fields) where they apply.

## Non-negotiables

- Never ship default-only: applicable hover, focus-visible, active, disabled, loading,
  selected, and error states need semantics and non-color signals.
- Never remove a focus outline without an equally visible replacement; hover is not focus.
- Explain unavailability; a silent disabled submit is a `form-ux` failure.
- Async controls prevent duplicate dispatch, expose busy state, and preserve contrast
  (≥3:1 UI, ≥4.5:1 text). Use fast reduced-motion-safe feedback.

## Implementation starter

Read `assets/states-starter.css` for tokenized CSS and reduced-motion details. A missing
token is a gap, never a fallback hex; add the request guard before styling async work.

## State by component (what each one needs)

- **Button/link:** default, hover, focus-visible, active, disabled/loading as applicable;
  toggles use `aria-pressed`, links retain a non-color cue/visited treatment.
- **Toggle / switch:** use `role="switch"` (not `role="checkbox"`) with `aria-checked`;
  Space toggles, Tab moves focus. Example: `<button role="switch" aria-checked="true">Notifications</button>`.
  Screen readers announce "switch, on/off" instead of "checkbox, checked."
- **Fields:** focus, disabled, filled/readonly, error, and selected/open/checked states;
  style a real or correctly labelled focusable input (`form-ux` owns validation).
- **Navigation/list/menu:** current/selected state uses `aria-current`/`aria-selected`;
  pointer and keyboard focus are equally legible.
- **Overlays:** model open/closed and entry/exit; prefer native Popover or `<dialog>`;
  toasts use `role="status"` and hover-only content remains reachable by focus.

## Reference files

- `references/states.md` — state semantics, pitfalls, and ARIA pairings.
- `references/decision-records.md` — novel-case ADR rules.

## Self-check (per interactive element)

For each applicable state, confirm visible focus, semantics, non-color contrast, and
reduced-motion behavior. For async/destructive work confirm owner, guard, justified
confirmation, duplicate prevention, recovery, and final focus; exercise real and stale
or failed completion separately. Do not collapse controls into one checkmark.

## How to deliver

Deliver the full applicable matrix plus lifecycle evidence. Pair with `form-ux`,
`empty-states`, `micro-motion`, `a11y-pass`, and `color-system` at their boundaries.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A control has interaction states missing or inconsistent with its semantics. (+1 in contract.json); avoid: The request is only about form copy or validation timing. (+1 in contract.json)
- Exclude: Do not invent page-level empty states or validation policy. (+2 in contract.json)
- Stop / handoff: Stop when the component semantics or interactive states cannot be identified. (+2 in contract.json); receives [design-system-interview, empty-states, improve-existing-website, responsive-layout, spacing-system, tasteroll, theming] -> sends [form-ux, empty-states, a11y-pass, micro-motion, tastecheck-pass]
- Output: component lifecycle contract and implementation guidance
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
