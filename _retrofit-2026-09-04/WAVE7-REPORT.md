# WAVE 7 report

Status: DONE_WITH_CONCERNS

## Scope

Implemented W7 / MR-011 only. No Git commands, installs, or network access were used.

## Per-row status

- MR-011: implemented. `humanize-copy` now uses a repository-owned portable writing reference
  instead of a workstation-local policy path. The contract declares the reference required and
  adds `writing_rule_evidence` to the handoff. The skill, contract, bundled resource, and
  generated contract projection agree that the writing-constitution floor is mandatory.

## Evidence

- `skills/humanize-copy/references/writing-constitution.md`: new compact repository-owned floor
  covering sentence, paragraph, idea, and audit rules; it requires evidence IDs
  `SENTENCE`, `PARAGRAPH`, `IDEA`, and `AUDIT`.
- `skills/humanize-copy/SKILL.md`: loads the bundled reference, requires the information-
  architecture self-check, records rule IDs, and has no workstation-local dependency.
- `skills/humanize-copy/contract.json`: declares
  `references/writing-constitution.md` under `resources.required`, requires the bundled floor as
  an input, and adds `writing_rule_evidence` to handoff fields.
- `node tools/contracts/project.mjs --scope=skills`: no projection drift.
- Temporary-home install with `--no-commands`: passed; 20 skills linked and the bundled reference
  resolved without a home-relative policy checkout.

## Acceptance and test tail

- `npm run test:contracts`: PASS — 20 valid contracts, 2 red fixtures; 21 scenarios; generated
  projections byte-clean.
- `node tools/verify.mjs`: FAIL on the pre-existing retrofit Markdown-link baseline only:
  `_retrofit-2026-09-04/FINDINGS-luna-a.md` reports missing `../index.html#main`, and
  `_retrofit-2026-09-04/FINDINGS-luna-b.md` reports missing `contract.json`. These are outside
  W7 and were not changed.
- `npm run preflight:structural`: PASS.
- `npm test`: BLOCKED before tests because locked `ajv` and `playwright` dependencies, including
  the Playwright CLI, are absent. No install was attempted.
- `npm run test:structural`: FAILS at the same two known verifier links above.
- Offline pieces: `node tools/lint-skills.mjs` PASS; `node tools/verify-integration.mjs` PASS;
  `node tools/verify-gate-audit.mjs` PASS; `node --test tools/test/nima.test.mjs` PASS (13/13);
  `node tools/lib/test-nima.mjs` PASS; `node tools/test/test-verification-failures.mjs` PASS.
- `node tools/verify-landing.mjs`: FAIL on unrelated pre-existing
  `index.html proof section does not state direct landing-page concern coverage`; outside W7 and
  not changed.

## Exact changed-file list

- `skills/humanize-copy/SKILL.md`
- `skills/humanize-copy/contract.json`
- `skills/humanize-copy/references/writing-constitution.md`
- `_retrofit-2026-09-04/WAVE7-REPORT.md`

Test-generated outside-scope output: `evals/receipts/v1/contracts/dead-references.json`.

## IMPROVEMENTS

1. Add a generic contract-resource validator. WHY: `resources.required` is currently enforced by
   the skill body and installer reference scan, not by the JSON contract schema itself. FIX:
   validate required/optional resource paths and overlap in `tools/contracts/validate.mjs`.
2. Initialize `td` during worktree setup. WHY: the mandated `td usage --new-session` could not run
   because this worktree has no tracking database. FIX: provision an arena-local database before
   dispatch or make the setup step create one.
