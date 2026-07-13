---
name: tastecheck-pass
description: >-
  Use when final frontend work needs an evidence-backed ship or hold decision, a
  fail-closed release gate, or an actionable cross-skill verification report.
---

# TasteCheck Pass

Give finished frontend work an honest **SHIP** or **HOLD** decision. Run the checks on the
real artifact, put the verdict first, and turn every failure into a concrete next action.
Files, intentions, and checkmarks are not execution evidence.

## The answer the user sees

Lead with this compact release brief:

```markdown
# HOLD — 2 blockers
What passed: <one-line scope>
Ship blockers: TC-04 keyboard trap; TC-11 dark-theme contrast
Fastest path: fix TC-04 → rerun keyboard path → fix TC-11 → remeasure pair
Evidence: <ledger/report links>
```

Use **SHIP** only when every applicable row passes. Use **HOLD** when a required check
fails, could not run, lacks a real artifact, or lacks evidence. Never make the user infer
the verdict from a table.

## Evidence table

Create one authoritative row per applicable check: `skill`, `check_id`, `status`,
`reason`, `remediation`, `evidence`, and `provenance`. `n/a` means the named subject is
absent; it never means “not tested.” Keep measurements and skip reasons in this table.
The release brief links to the rows instead of paraphrasing them into softer claims.

## What to check, in order

1. Direction: `design-system-interview` (new) or `improve-existing-website` (existing).
2. Foundations: `color-system`, `web-typography`, `spacing-system`, `theming`.
3. Structure/behavior: `responsive-layout`; `component-states`, `form-ux`, `empty-states`.
4. Surface: `micro-motion`, `data-viz`, `art-direction` where subject exists.
5. Verification/audit: `a11y-pass`, `cognitive-a11y`, `i18n-ready` if multilingual,
   `deslop-ui` against spec, and `humanize-copy`; then this gate.

Only absent subjects skip. Direction, foundations, structure, accessibility, and the
against-spec `deslop-ui` audit are required.

## Run the gate

1. Confirm `DESIGN-SYSTEM.md` or approved inferred-system statement and built-to-spec
   status; otherwise fail and return to direction.
2. Run each relevant self-check on the real rendered artifact; record pass/fail/named `n/a`.
3. Test browser rendering, 320px/400% zoom, keyboard, theme contrast, reduced motion,
   and a cold load. On the cold load run `assets/gate-audit.js`, attach its output, and
   inspect shadow roots/iframes manually. Automation supports the browser pass; it does
   not replace it.
4. Audit phrase, tokens, refusals, and signature across surface/structure/verbal planes;
   default template skeleton is a fail.
5. Fix failed rows and rerun them. Pass only when every non-`n/a` row passes.

## Turn failures into a release path

For every blocking ID, provide:

- the owner and concrete repair;
- the rerun or artifact that will produce fresh evidence;
- the measurable acceptance rule;
- any predecessor blocking that work.

Keep separate facts in separate rows: contrast, cold-load behavior, structure, keyboard,
and unsupported `n/a` are not one finding. New evidence replaces the affected row and
reruns the verdict. An ETA never changes **HOLD** to **SHIP**.

## Gate self-check

Add three final evidence rows confirming: the real artifact and spec were used; required
browser/numeric checks actually ran; and every blocker has an owner, repair, rerun, and
acceptance rule. Then deliver the release brief first and the evidence table second.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A finished frontend artifact needs an evidence-backed ship decision. (+1 in contract.json); avoid: The artifact is still at the direction or implementation stage. (+1 in contract.json)
- Exclude: Never infer execution from a file existing or a claimed checkmark. (+2 in contract.json)
- Stop / handoff: Fail when the required spec is absent or the artifact was not built to it. (+2 in contract.json); receives [a11y-pass, cognitive-a11y, i18n-ready, deslop-ui, humanize-copy, art-direction, component-states, data-viz, empty-states, form-ux, micro-motion] -> sends [none]
- Output: fail-closed evidence ledger with a deterministic verdict and actionable gate report
- Evidence: `ledger_with_verdict` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
