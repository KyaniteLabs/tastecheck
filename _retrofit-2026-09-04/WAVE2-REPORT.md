# W2 report — one release inventory

## MR-004 — released skill, command, gallery, and version inventory

Status: DONE_WITH_CONCERNS

Decision: `tasteroll` is released. The inventory is 20 skills, 20 canonical
commands, one separately counted `/darkmode` alias, 21 command files, and eight
gallery systems at version `1.4.1`.

Evidence:

- `tools/release/release-facts.json` is the single source for the release version,
  skill set, command coverage, alias, and gallery set.
- `tools/release/project-facts.mjs --check` passed and verifies exact disk,
  manifest, command, landing-marker, and gallery-card set equality.
- `commands/tasteroll.md` supplies the missing canonical command wrapper.
- `skills.json`, `contracts/v1/commands.json`, README, llms.txt, landing page,
  launch/verification docs, and gallery copy are projected or checked against
  the same inventory.

## Register acceptance

Passed:

- `node tools/lint-skills.mjs` — 20 skills, 0 failures, 0 warnings.
- `node tools/verify-landing.mjs` — landing verification passed.
- `node tools/verify-integration.mjs` — integration verification passed.
- Contract projection/schema/scenario/check-generated portions of
  `npm run test:contracts` — passed, including 20 valid contracts and 21
  scenarios.

Environment concern:

- `npm run test:contracts` reached its final observation-schema test, then
  stopped with `ERR_MODULE_NOT_FOUND: Cannot find package 'ajv'`. No install or
  network action was taken, per the W2 hard boundary.

## Offline npm-test pieces run

- `node tools/release/project-facts.mjs --check` — passed.
- `node tools/verify-gate-audit.mjs` — passed.
- `node --test tools/test/nima.test.mjs` — 13 passed, 0 failed.
- `node tools/lib/test-nima.mjs` — passed.
- `node tools/verify.mjs` — only the known retrofit markdown link baseline
  failed: `_retrofit-2026-09-04/FINDINGS-luna-a.md` missing `../index.html#main`
  and `_retrofit-2026-09-04/FINDINGS-luna-b.md` missing `contract.json`.

The mandated lint fixture test also wrote its normal generated receipt at
`evals/receipts/v1/contracts/dead-references.json`; this is test output, not a
W2 implementation file.

## Exact changed-file list

- `README.md`
- `commands/tasteroll.md`
- `contracts/v1/commands.json`
- `docs/LAUNCH.md`
- `docs/VERIFICATION.md`
- `index.html`
- `llms.txt`
- `package.json`
- `samples/index.html`
- `skills.json`
- `tools/release/project-facts.mjs`
- `tools/release/release-facts.json`
- `_retrofit-2026-09-04/WAVE2-REPORT.md`

Test-generated outside-scope output: `evals/receipts/v1/contracts/dead-references.json`.

## IMPROVEMENTS

1. Provision `node_modules` or a dependency-free schema-test lane before dispatch; the required offline contract run could not finish because `ajv` was unavailable.
2. Make the release verifier consume `tools/release/release-facts.json`; the existing claims verifier still has a hardcoded command-file total outside W2 scope.
