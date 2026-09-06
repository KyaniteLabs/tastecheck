# W5 report — verification completeness

Status: DONE_WITH_CONCERNS

## Per-row status

| Row | Status | Evidence |
| --- | --- | --- |
| MR-008 — verification complete and reproducible | PASS with execution limitation | Structural and contract lanes are separated; CI runs independent structural and Oracle jobs; dependency preflight is read-only; unknown references, missing contracts, stale generated blocks, and false landing claims fail with accumulated diagnostics. |

## Verification

- `npm run test:contracts` — PASS: release inventory, lint fixtures, 20 contracts, 21 scenarios, and byte-for-byte projections.
- `node tools/lint-skills.mjs` — PASS: 20 skills, 0 failures, 0 warnings.
- `node tools/verify-landing.mjs` — PASS.
- `node tools/verify-integration.mjs` — PASS.
- `node tools/verify-gate-audit.mjs` — PASS.
- `node --test tools/test/nima.test.mjs` — PASS: 13 tests.
- `node tools/lib/test-nima.mjs` — PASS.
- `node tools/test/test-verification-failures.mjs` — PASS: unknown ref, missing contract, stale projection, false landing claim; 4/4 mutations killed, 0 survived (100.00% kill rate), recorded in `W5-MUTATION-SCORE.json`.
- `npm run test:structural` — FAIL only on the known baseline `_retrofit-2026-09-04` markdown links: `FINDINGS-luna-a.md` → `../index.html#main`; `FINDINGS-luna-b.md` → `contract.json`. No baseline artifact was changed.
- `npm test` — stopped at dependency preflight: `node_modules/ajv` and `node_modules/playwright` are absent. `npm ci` was not run because W5 hard scope forbids installs/network.

## Test tail

```text
contract schema/adversarial tests passed (20 valid contracts, 2 red fixtures)
scenario assertion tests passed (21 scenarios, 20 skills)
check-generated: no byte-for-byte contract drift
verification failure mutation fixtures passed (unknown ref, missing contract, stale projection, false landing claim)
dependency preflight failed (3 findings)
```

## Changed files

- `.github/workflows/verify.yml`
- `package.json`
- `tools/contracts/check-generated.mjs`
- `tools/contracts/test-contracts.mjs`
- `tools/lib/skill-lint.mjs`
- `tools/lint-skills.mjs`
- `tools/preflight-dependencies.mjs`
- `tools/test/test-verification-failures.mjs`
- `tools/verify-landing.mjs`
- `_retrofit-2026-09-04/WAVE5-REPORT.md`

## IMPROVEMENTS

1. Provision dependencies during worker setup. WHY: the required full umbrella could not execute without `node_modules`. FIX: let CI/dispatch setup run the locked install before workers start, while keeping the preflight read-only.
2. Exclude orchestrator-owned retrofit evidence from repository link verification. WHY: two known markdown links prevent the structural umbrella from producing a clean result in this worktree. FIX: make `tools/verify.mjs` skip `_retrofit-*` evidence directories or verify them with an artifact-specific link policy.
