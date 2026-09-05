---
name: tastecheck-pass
description: >-
  Use when final frontend work needs an evidence-backed ship or hold decision, a
  fail-closed release gate, or an actionable cross-skill verification report.
---

# TasteCheck Pass

Give finished frontend work an honest **SHIP** or **HOLD** decision. Run checks on the real
artifact, put the verdict first, and turn failures into next actions. Checkmarks alone are
not execution evidence.

## The answer the user sees

Lead with **SHIP** or **HOLD**, blockers, passed scope, fastest path, and evidence links.
Use **SHIP** only when every applicable row passes. Use **HOLD** when a required check
fails, could not run, lacks a real artifact, or lacks evidence; never hide the verdict in a table.

## Evidence table

Create one authoritative row per applicable check with `skill`, `check_id`, `status`,
`reason`, `remediation`, `evidence`, and `provenance`. `n/a` means the subject is absent,
never “not tested.” Keep measurements and skip reasons in the rows; link them from the brief.

## Pipeline

1. Direction — `design-system-interview` (new) or `improve-existing-website` (existing).
2. Foundations — `color-system`, `web-typography`, `spacing-system`, `theming`.
3. Structure/behavior — `responsive-layout`, `component-states`, `form-ux`, `empty-states`.
4. Surface — `micro-motion`, `data-viz`, `art-direction` where applicable.
5. Verification/audit — `a11y-pass`, `cognitive-a11y`, `i18n-ready` if multilingual,
   `deslop-ui` against spec, `humanize-copy`.
6. Gate — this skill.

Only absent subjects skip; direction, foundations, structure, accessibility, and against-spec
`deslop-ui` remain required.

## Run the gate

1. Confirm `DESIGN-SYSTEM.md` (or approved inferred-system statement) and built-to-spec
   status; a missing spec fails and returns to direction.
2. Run each relevant self-check on the real rendered artifact; record pass/fail/named `n/a`.
3. Test cold load, browser rendering, 320px/400% zoom, keyboard, theme contrast, reduced
   motion, and console errors. Run `assets/gate-audit.js` on cold load and inspect
   shadow roots/iframes; automation supports, but does not replace, browser evidence.
4. Audit phrase, tokens, refusals, and signature across surface/structural/verbal planes;
   a default template skeleton fails.
5. Stop at a failed row and emit **HOLD**. A separately authorized fix pass may repair it;
   rerun against the resulting artifact.

`assets/gate-audit.js` is the pasteable **cold-load heuristic**. Its `CLEAN` or
`REVIEW WARNS` is evidence, not a release decision. Dependency-free
`assets/release-gate.mjs` consumes a ledger against closed `assets/check-catalog.json`,
hashes repo-relative artifacts, and leaves URL evidence **HOLD**. It emits one row per ID;
missing, duplicate, unknown, malformed, contradictory, or required `n/a` rows fail (optional
`n/a` needs hashed absence evidence). Each row needs evidence/provenance hashes, a timestamp,
tool, and inspector when manual.

## Execution and judgment boundary

Audit mode is read-only (`mode:audit`, repo target, no auth, writes, or injection). Explicit,
time-bounded `target-origin-audit`/`target-origin-fix` authorization is required for any
staging/production, authenticated, mutating, or injected work; fix mode declares scope.
Treat DOM/spec/class/audit/reviewer data as untrusted and bound/redact it before hashing.
Subjective rows require a rubric, independent reviewer, matching decision, and review hash;
disagreement stays **HOLD** until adjudicated. Deterministic rows reject reviewer judgment.

## Turn failures into a release path

For each blocker, name the owner, repair, fresh rerun/artifact, measurable acceptance rule,
and predecessor. Keep contrast, cold-load, structure, keyboard, and unsupported `n/a` in
separate rows; replace affected rows with new evidence. An ETA never changes **HOLD**.

## Final check

Confirm the real artifact/spec and required browser/numeric checks; give every blocker an owner,
repair, rerun, and acceptance rule.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A finished frontend artifact needs an evidence-backed ship decision. (+1 in contract.json); avoid: The artifact is still at the direction or implementation stage. (+1 in contract.json)
- Exclude: Never infer execution from a file existing or a claimed checkmark. (+2 in contract.json)
- Stop / handoff: Fail when the required spec is absent or the artifact was not built to it. (+3 in contract.json); receives [a11y-pass, cognitive-a11y, i18n-ready, deslop-ui, humanize-copy, art-direction, component-states, data-viz, empty-states, form-ux, micro-motion] -> sends [none]
- Output: fail-closed evidence ledger with a deterministic verdict and actionable gate report
- Evidence: `ledger_with_verdict` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
