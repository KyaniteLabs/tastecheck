# Streak 8 remediation report

Status: DONE_WITH_CONCERNS

All three SOL findings are closed in the worktree. No install, network access,
commit, or push was performed.

## Closure

1. **Independent browser subject universe — closed.**
   `loadBrowserSubjectAuthority` reads the verifier-root route/state manifest,
   hashes its exact bytes independently, validates the required viewport policy,
   and derives the route × state × viewport Cartesian members inside the gate.
   Every browser check now requires exact equality between those members and its
   submitted inventory coverage. The committed default manifest and the
   regression fixture are both closed-schema JSON assets.

2. **Omission mutation — closed.**
   `test-tastecheck-gate.mjs` uses a two-route × two-state fixture with the three
   required viewports, removes one browser tuple, recomputes the claimant
   inventory hash, and asserts `HOLD` with an exact-universe error.

3. **Root-split CLI regression — closed.**
   The test launches the CLI with isolated verifier and artifact roots, confirms
   the report is written only under the verifier root, records distinct root
   identities, verifies the consumer dependency manifest, and rejects input and
   output traversal.

## Verification

- `node tools/evals/test-tastecheck-gate.mjs` — PASS.
- `npm run test:structural` — PASS, including the two new Streak 8 tests.
- `npm run finalize` — PASS; verify-chain passed with source digest
  `74a5cd67078c9c69bf28d8dc40d1a6b0dae88b807739651fb5f4b6146bb668b7`.
- Finalize idempotence — PASS; pre/post tracked-diff digest was identical:
  `9dcb21f0eba3c0585065bd8d42b54748f66194be56aaf6207f911f414ccad19b`.

## Changed paths

- `skills/tastecheck-pass/assets/release-gate.mjs`
- `skills/tastecheck-pass/assets/release-ledger.schema.json`
- `skills/tastecheck-pass/assets/release-gate.schema.json`
- `skills/tastecheck-pass/assets/browser-subject-manifest.json`
- `tools/evals/fixtures/release-gate/browser-subject-manifest.json`
- `tools/evals/test-tastecheck-gate.mjs`
- `package.json`

## IMPROVEMENTS

1. **Finalize after staging the new authority files.** WHY: the receipt source
   digest uses tracked paths, so this worker’s required `GIT: none` boundary
   leaves newly added manifest/report files outside the current digest. FIX:
   rerun `npm run finalize` once the enclosing change stages or commits all
   intended files.
2. **Create missing CLI output parents.** WHY: the root-split test had to create
   `reports/` before invoking `--out`; a valid contained output path otherwise
   fails with `ENOENT`. FIX: have the CLI create only the requested verifier-root
   parent directory after containment validation.
