---
name: a11y-pass
description: >-
  WCAG 2.2 AA fix pass for web UI. Use before shipping, or for requests about
  accessibility, a11y, keyboard navigation, screen readers, contrast, labels,
  focus, landmarks, target size, reduced motion, or ARIA.
---

# Accessibility Pass (WCAG 2.2 AA)

Accessibility is whether a person can finish a real task without an avoidable barrier. Repair the failing path, then prove the repair in the rendered interface.

## Triage one rendered user path

Write one path before opening a checker: **entry → action → result/recovery**. Name the user-facing outcome, the affected UI, and the smallest viewport or assistive setup that can expose the failure.

| Path point | Inspect | Repair when it fails |
| --- | --- | --- |
| Entry | landmark, page title, reading order, skip link | give the page a named, reachable start |
| Action | visible focus, native semantics, keyboard order, target size | repair the control before adding ARIA |
| Change | errors, loading, dialogs, live updates, motion | announce the meaningful change without stealing focus |
| Recovery | error copy, focus destination, retained input, retry | return the person to a specific next action |
| Layout | 200% and 400% zoom, reflow, narrow viewport | remove horizontal loss and clipped controls |

Start with native HTML. Use ARIA only to express a relationship or live behavior native elements cannot supply. Never use a role, audit score, or automated pass as proof that the path works.

## Prove the path in the interface

1. Tab forward and backward from the browser chrome through completion. Record focus order, visible indicator, and any trap.
2. Trigger the failure state with the keyboard. Confirm focus stays purposeful, the error is programmatically associated, and entered data survives.
3. Read the affected region with a screen reader or inspect its computed name, role, value, state, and description. Check the update is announced once.
4. Measure the final rendered foreground/background pair and test reflow at 200% and 400%. Include text over imagery and disabled-looking controls if they carry meaning.
5. Repeat with reduced motion when the interaction animates. The non-motion path must still expose progress and completion.

A screenshot can support a claim; it cannot prove keyboard order or announcements. An automated audit can find candidates; it cannot clear the path.

## Report a repair ledger

Use this row format for every finding:

| Path / criterion | Observed failure | Repair | Evidence | Residual risk |
| --- | --- | --- | --- | --- |
| Submit → invalid email | focus lands on an unnamed summary; inline error is silent | move focus to named summary, link field error with `aria-describedby`, retain value | keyboard trace; computed accessibility tree; 400% capture | screen-reader wording needs product review |

Separate a confirmed defect from a design concern. State the browser, assistive technology or inspection method, viewport/zoom, and exact reproduction step. If the artifact is unavailable, stop and ask for the rendered path rather than inventing evidence.

## Delivery and handoff

Prioritize blockers to task completion, then frequent-path defects, then polish. Send component lifecycle or form-state questions to the owning skill when the defect is a state-design problem rather than a WCAG repair.

- [Audit method](references/audit.md)
- [Keyboard and focus helper](assets/audit.js)
- [Decision records](references/decision-records.md)

## Ship check

- [ ] A named user path has keyboard, semantic, zoom/reflow, and dynamic-state evidence.
- [ ] Every finding names a concrete control or region, repair, and verification result.
- [ ] Automated checks are labeled as discovery, not sign-off.
- [ ] Focus, announcements, errors, and reduced-motion behavior have an explicit owner.

## Provenance — standard, not opinion

Grounded in the W3C Web Content Accessibility Guidelines (WCAG) 2.2, Level AA — the conformance target named throughout this skill (keyboard, focus, contrast, reflow, target size, reduced motion, error identification, status announcements). Independent Kyanite Labs synthesis of the standard's success criteria, credited — not copied. WCAG 2.2 is a W3C Recommendation; its success criteria are factual conformance requirements. Hand cognitive-load concerns to `cognitive-a11y` (COGA).

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A rendered interface needs WCAG 2.2 AA repair findings verified by keyboard, browser, or measurement.; avoid: The request is only cognitive load or multilingual expansion without an accessibility defect.
- Exclude: Do not self-attest a fix without browser or source evidence. (+1 in contract.json)
- Stop / handoff: Stop when the user path or target artifact is unavailable. (+1 in contract.json); receives [component-states, form-ux, responsive-layout, theming, art-direction, cognitive-a11y, color-system, data-viz, deslop-ui, empty-states, i18n-ready, improve-existing-website, micro-motion, web-typography] -> sends [tastecheck-pass]
- Output: prioritized WCAG repair ledger with measured verification
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
