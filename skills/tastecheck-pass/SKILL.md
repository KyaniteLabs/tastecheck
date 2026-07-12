---
name: tastecheck-pass
description: >-
  Use when final frontend work needs an evidence-backed ship or hold decision, a
  fail-closed release gate, or an actionable cross-skill verification report.
---

# TasteCheck Pass (the ship gate)

This is the fail-closed ship gate: execute relevant self-checks against finished work,
then issue the evidence-backed verdict. “Done” requires execution evidence.

## Canonical ledger contract

Create one authoritative row per applicable check: `skill`, `check_id`, `status`,
`reason`, `remediation`, `evidence`, and `provenance`. `n/a` requires named subject
absence, never unexecuted work. Keep rows, measurements, skip reasons, interpretation,
and verdict stable; a readable report only links to—not rewrites—the ledger.

## The canonical pipeline (the single source of truth for ordering)

1. Direction: `design-system-interview` (new) or `improve-existing-website` (existing).
2. Foundations: `color-system`, `web-typography`, `spacing-system`, `theming`.
3. Structure/behavior: `responsive-layout`; `component-states`, `form-ux`, `empty-states`.
4. Surface: `micro-motion`, `data-viz`, `art-direction` where subject exists.
5. Verification/audit: `a11y-pass`, `cognitive-a11y`, `i18n-ready` if multilingual,
   `deslop-ui` against spec, and `humanize-copy`; then this gate.

Only absent subjects skip; direction, foundations, structure, a11y, and deslop do not.

## How to run the gate

1. Confirm `DESIGN-SYSTEM.md` or approved inferred-system statement and built-to-spec
   status; otherwise fail and return to direction.
2. Run each relevant self-check on the real rendered artifact; record pass/fail/named `n/a`.
3. Measure browser, 320px/400% zoom, keyboard, theme contrast, reduced motion, and cold
   load. On that load run `assets/gate-audit.js`, attach output, and manually inspect
   shadow roots/iframes; script output supplements, never replaces, browser evidence.
4. Audit phrase, tokens, refusals, and signature across surface/structure/verbal planes;
   default template skeleton is a fail.
5. Fix failed rows and rerun them. Pass only when every non-`n/a` row passes.

## The report has two linked layers

**Authoritative ledger:** one row per individual failure/measurement/skip; never merge
contrast, cold-load, unsupported `n/a`, or structural findings. It stays deterministic
until replacement execution evidence arrives.

**Readable execution report:** link ledger IDs, blockers, reruns, and changes without
softening facts. Use failure queue for independent sequencing, evidence trace for source
conflict, or release memo for the earliest credible ship decision; it is never authority.

## Report shape

Name project/date/spec/north star, then provide the canonical ledger and deterministic
verdict. On failure list blocking IDs plus why, repair/rerun, and still-needed evidence;
those facts must resolve directly to the rows.

## Linked execution protocol

For every blocking ID provide owner/concrete action, evidence-producing rerun/artifact,
acceptance rule, and predecessor. Group only when one artifact/rule resolves all rows;
new evidence reopens affected rows with replacement provenance and reruns the gate.
Intent, checkmarks, and ETA never change the verdict; surface the earliest unblocked path.

## Non-negotiables

- State when the gate cannot run; gate the spec, not personal taste.
- Measure numeric claims; a failed row is fixed or explicitly user-accepted.
- Ship the report with work and expose each distinct failure plus its next evidence action.

## Self-check (yes, the gate has one)

1. Spec, real self-check execution, numeric/browser/cold-load measurements, and spec audit complete?
2. Canonical rows preserve distinct facts and the report links them without release claim gaps?
3. Every blocker has action/owner, rerun, acceptance rule, dependency, and no competing ledger?

Emit these gate checks as evidence rows, never bare checkmarks.

## How to deliver

Run last for pack-built work or a done/review/ship request. A credible gate may fail.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A finished frontend artifact needs an evidence-backed ship decision. (+1 in contract.json); avoid: The artifact is still at the direction or implementation stage. (+1 in contract.json)
- Exclude: Never infer execution from a file existing or a claimed checkmark. (+2 in contract.json)
- Stop / handoff: Fail when the required spec is absent or the artifact was not built to it. (+2 in contract.json); receives [a11y-pass, cognitive-a11y, i18n-ready, deslop-ui, humanize-copy] -> sends [none]
- Output: fail-closed evidence ledger with a deterministic verdict and actionable gate report
- Evidence: `ledger_with_verdict` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
