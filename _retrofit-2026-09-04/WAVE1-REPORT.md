# W1 report — restore fail-closed authority

## Per-row status

- MR-001 — fixed. The ordered gate now requires `deslop-ui` against spec. The embedded `tastecheck-pass` contract block matches the canonical contract projection; `design-critique` is no longer referenced by this gate.
- MR-002 — fixed. Restored `deslop-ui/contract.json` and all four required references from the local canonical vendor payload. `install.sh` now validates every skill payload against the repository contract schema, checks frontmatter identity, and checks local `assets/` and `references/` before changing destination links.
- MR-003 — fixed. `combinedVerdict()` now returns non-shippable `HOLD` for missing, empty, malformed, or unknown gate records. Valid `CLEAN`, `REVIEW WARNS`, and `FAIL` behavior remains covered, including NIMA WARN-only behavior.

## Acceptance evidence

Required acceptance command:

`node tools/verify.mjs && npm run test:contracts && node --test tools/test/nima.test.mjs && tmp_home="$(mktemp -d)" && HOME="$tmp_home" ./install.sh && test -f "$tmp_home/.agents/skills/deslop-ui/contract.json"`

- `node tools/verify.mjs`: nonzero only for two pre-existing out-of-wave report links: `_retrofit-2026-09-04/FINDINGS-luna-a.md` to `../index.html#main` and `_retrofit-2026-09-04/FINDINGS-luna-b.md` to `contract.json`. All `deslop-ui` missing-resource failures are cleared.
- `npm run test:contracts`: contract and scenario checks passed, including 20 valid contracts, 2 red fixtures, and no generated drift. The command then stopped at the existing dependency-free environment gap: `ERR_MODULE_NOT_FOUND` for `ajv` in `tools/taste-oracle/test-observations-schema.mjs`.
- `node --test tools/test/nima.test.mjs`: passed, 13 tests.
- Temporary-home installer smoke with `--no-commands`: passed, linked 20 skills, and confirmed `.agents/skills/deslop-ui/contract.json` exists.
- Restored `deslop-ui` artifact family: byte-for-byte match against the local vendor payload.
- Byte-exact evidence: `W1-DESLOP-UI-CHECKSUMS.json` records SHA-256 values for all six restored `deslop-ui` files against the local canonical W1-parent payload; 6/6 match.

## Offline test tail

- `bash -n install.sh`: PASS.
- `node --check tools/lib/nima.mjs`: PASS.
- `node --check tools/test/nima.test.mjs`: PASS.
- `node tools/lib/test-nima.mjs`: PASS.
- `node tools/lint-skills.mjs`: PASS — 20 skills, 0 failures, 0 warnings.
- `node tools/verify-landing.mjs`: PASS.
- `node tools/verify-integration.mjs`: PASS.
- `node tools/verify-gate-audit.mjs`: PASS.
- Contract core offline lane (`test-lint-fixtures`, `test-contracts`, `test-scenarios`, `check-generated`): PASS.
- Full `npm test`: blocked before the main verification chain by missing `playwright` in the existing offline environment. No dependency installation was attempted.

## Changed files

- `install.sh`
- `skills/deslop-ui/contract.json`
- `skills/deslop-ui/references/anti-patterns.md`
- `skills/deslop-ui/references/structural-tells.md`
- `skills/deslop-ui/references/design-direction.md`
- `skills/deslop-ui/references/decision-records.md`
- `skills/tastecheck-pass/SKILL.md`
- `tools/lib/nima.mjs`
- `tools/test/nima.test.mjs`
- `tools/lib/test-nima.mjs`
- `_retrofit-2026-09-04/WAVE1-REPORT.md`

## IMPROVEMENTS

1. **Make the verifier ignore or validate retrofit report links separately.** WHY: the required verifier remains red on two audit-report-relative links unrelated to W1. FIX: exclude generated audit reports from product link checks or give them a report-root link validator.
2. **Provide an offline dependency preflight.** WHY: both `npm test` and the full contract command fail only when they reach absent `playwright` or `ajv`, after useful checks have run. FIX: add a no-network preflight that reports missing packages before the command starts and exposes a documented structural-only lane.
