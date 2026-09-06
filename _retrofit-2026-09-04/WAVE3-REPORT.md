# W3 report — executable, fail-closed release gate

## Per-row status

| Register row | Status | Evidence |
| --- | --- | --- |
| MR-005 — flagship release gate is only a heuristic subset | DONE | `gate-audit.js` is explicitly documented as a cold-load heuristic; `release-gate.mjs` is the separate release authority over a 27-ID closed catalog. `tools/verify-gate-audit.mjs` proves the heuristic and runner remain distinct. |
| MR-006 — scope, n/a, artifact input, and provenance rules are gameable | DONE | Repo-relative file/directory hashing, HTTPS fail-closed behavior, required/optional applicability, one-row-per-ID normalization, evidence/provenance hash checks, tool/browser identity, and manual inspector requirements are schema/runtime tested. |

## Implementation evidence

- `check-catalog.json` defines 27 closed IDs: 21 required checks and 6 optional
  subject checks. Required checks use `na_policy: forbidden`; optional checks
  use `subject_absence` and name the subject that must be proven absent.
- `release-gate.mjs` measures repo-relative file/directory artifacts, binds every
  row to the measured artifact identity and SHA-256, verifies canonical evidence
  and provenance hashes, rejects missing/duplicate/unknown/malformed rows, and
  emits `SHIP` only when all validations and applicable rows pass.
- `release-ledger.schema.json`, `release-gate.schema.json`, and
  `check-catalog.schema.json` define the input, output, and closed-catalog
  contracts. The skill contract and generated block now describe the runner and
  the cold-load heuristic boundary.
- Focused tests cover a valid 27-row report, missing row, required `n/a`,
  optional `n/a` without absence evidence, forged evidence hash, missing manual
  inspector, and duplicate/unknown IDs.
- The closed catalog is enumerated in `GATE-CATALOG.md`, generated from
  `skills/tastecheck-pass/assets/check-catalog.json`; all 27 IDs and their
  verification meanings are listed exactly once.

## Acceptance and offline test tail

Passed:

- `node tools/verify-gate-audit.mjs` — cold-load heuristic and release-runner
  verification passed; empty ledger probe remained `HOLD`.
- `npm run test:release-eval-contracts` — semantic diversity 8, context-aware
  anti-slop 6, deterministic gate 4, release gate ledger 7, V5 CLI 1.
- `node tools/contracts/project.mjs` — no projection drift.
- `node tools/contracts/test-contracts.mjs` — 20 valid contracts, 2 red
  fixtures; no contract drift.
- `node tools/lint-skills.mjs` — 20 skills, 0 failures, 0 warnings.
- `node tools/verify-landing.mjs` and `node tools/verify-integration.mjs` —
  both passed.
- `node --test tools/test/nima.test.mjs` — 13 passed, 0 failed.
- `node tools/lib/test-nima.mjs` — passed.

Known non-W3 gates, preserved without changes:

- `npm run test:contracts` reached the final observation-schema test, then
  stopped with `ERR_MODULE_NOT_FOUND: Cannot find package 'ajv'`.
- `npm test` reached oracle capture regression, then stopped with
  `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`.
- `node tools/verify.mjs` reported only the known retrofit markdown links:
  `FINDINGS-luna-a.md` → `../index.html#main` and `FINDINGS-luna-b.md` →
  `contract.json`.

## Exact implementation file list

- `skills/tastecheck-pass/SKILL.md`
- `skills/tastecheck-pass/contract.json`
- `skills/tastecheck-pass/assets/gate-audit.js`
- `skills/tastecheck-pass/assets/check-catalog.json`
- `skills/tastecheck-pass/assets/check-catalog.schema.json`
- `skills/tastecheck-pass/assets/release-ledger.schema.json`
- `skills/tastecheck-pass/assets/release-gate.schema.json`
- `skills/tastecheck-pass/assets/release-gate.mjs`
- `tools/verify-gate-audit.mjs`
- `tools/evals/test-tastecheck-gate.mjs`

Test-generated output from the required contract fixture lane (not an
implementation file): `evals/receipts/v1/contracts/dead-references.json`.

## IMPROVEMENTS

1. **Provision dependency-free or preflighted umbrella lanes.** WHY: the
   required broader commands still stop at missing `ajv`/`playwright` before
   their final checks. FIX: add a preflight that reports unavailable optional
   lanes clearly, while keeping this dependency-free W3 gate runnable.
2. **Add schema/runtime parity tests for the three new JSON schemas.** WHY:
   the runner tests its runtime rules, but this worktree lacks `ajv` for live
   schema compilation. FIX: add a dependency-free schema smoke check or run
   the parity test in the provisioned contract lane.
