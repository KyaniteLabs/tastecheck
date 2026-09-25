# tastecheck calibration corpus — the law

A labeled regression corpus of known-BAD and known-CLEAN cases, harvested from
real org defect findings, used to measure the checker's false-positive and
false-negative rates per release. Until this corpus existed (v1.6.0 and
earlier) no rate was claimed; from v1.7.0 the rates below are measured numbers
from real runs, refreshed by `npm run calibrate` and gated in CI
(`npm run calibrate:check`) so a release cannot ship with a worse measured
rate than the recorded baseline.

## Where the labels come from

Every BAD case reproduces a defect class that actually fired in the org, and
carries the desk-of-record citation (`source.desk` + verbatim `source.quote`)
for the finding it was harvested from. Every CLEAN case is a verified-green
surface (suite-proven SHIP fixture, browser-receipt-green landing). Cases
without a citation are invalid — the runner enforces this.

Sources of record: `~/workspaces/product/smell-registry.md` (the org's
bug/smell registry), `~/workspaces/HealthAdvocate/internal-notes.md`,
`~/workspaces/product/internal-notes.md`, and tastecheck's own suite fixtures.

## Case file shape

`evals/corpus/cases/{ledger,surface}/<case>.json`:

```json
{
  "schema_version": 1,
  "kind": "calibration-case",
  "id": "ledger/stale-linked-artifact",
  "probe": "ledger | surface",
  "label": "bad | clean",
  "class": "defect-class-name",
  "known_open": false,
  "source": { "desk": "...", "quote": "verbatim finding text" },
  "case": { "mutation": "...", "target": "..." , "html" | "path": "...", "vocabulary": [...] },
  "expectation": { "verdict": "HOLD | SHIP | FAIL | REVIEW | CLEAN", "findings_include": [...], "report_must_not_contain": [...] }
}
```

- `probe: ledger` cases run a mutation of the suite-proven valid deep-lane
  ledger through `evaluateReleaseGate` (the deterministic verdict engine).
  Mutations are named for the org defect class they reproduce
  (`tools/calibrate/run-calibration.mjs` is the registry of mutations).
- `probe: surface` cases run the offline static surface probes
  (`tools/calibrate/surface-probes.mjs`): markup-visible leak classes and
  tells. `vocabulary` scopes the internal-vocabulary probe (what counts as
  "internal" is product-specific); `allow` scopes the email probe.

## Scoring and rates

Scoring is decided by the checker's OUTCOME against the label, never by the
documented expectation:

| label | checker outcome | result |
| --- | --- | --- |
| bad | refuses to pass (ledger `HOLD`, or a surface finding fired) | TP |
| bad | passes (ledger `SHIP`, surface clean) | FN |
| clean | passes with no leaked strings | TN |
| clean | refuses, or the report leaks forbidden strings | FP |

`FPR = FP/(FP+TN)`, `FNR = FN/(FN+TP)`. `expectation.verdict` documents what
the engine produces TODAY; a divergence is reported as a behavior change (cure
or regression) to be adjudicated deliberately — never silently.

### Known-open cases

A case with `known_open: true` is a standing, documented miss: the checker
cannot catch it today and the case pins that floor in the measured rate until
a cure lands (at which point the case flips to a normal HOLD expectation and
the baseline improves — visibly, not silently). v0 carries one: a falsified
but internally-consistent structured observation (the hollow-signal class in
its residual form) is indistinguishable offline from a true one; the
consume-don't-inspect browser/audio lane owns that class.

## Scope boundary (honest)

The offline corpus calibrates the deterministic verdict engine and the
markup-visible surface probes. Tells that need a rendered surface (computed
display face after font fallback, uniform card grids by measured geometry,
stat bands by font size, tap-target overlap, reduced-motion behavior) stay in
`skills/tastecheck-pass/assets/gate-audit.js` and the browser lane — they are
out of scope for this runner until a browser-driven corpus harness exists.

## Adding a case

1. Reproduce a REAL defect (cite the desk of record verbatim) or a
   verified-green surface; no synthetic plausibilities.
2. Add the case JSON; run `npm run calibrate` — the new case appears in the
   dated report.
3. If rates changed, re-record the baseline DELIBERATELY
   (`node tools/calibrate/run-calibration.mjs --write-baseline`) and say why
   in the PR; CI blocks silent regressions (`calibrate:check`).

## Current measured state

See `evals/calibration/baseline.json` (the gated baseline) and the dated
reports in `evals/calibration/`. The CHANGELOG carries the measured numbers
per release.
