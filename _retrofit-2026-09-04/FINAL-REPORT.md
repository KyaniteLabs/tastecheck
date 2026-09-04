# Final cleanup report

## Per-fix status

- MR-008/009/012 — DONE. Regenerated `evals/receipts/v1/public-release-status.json`
  with `node tools/release/project-public-status.mjs --write` after the final
  source changes. The projection now matches current receipt bytes and the
  current source-tree revision. Its honest public result is `UNVERIFIED` because
  the existing engineering/browser receipts are stale; no live evidence was
  fabricated or upgraded.
- Retrofit report links — DONE. Removed the two link-like code examples that
  `tools/verify.mjs` interpreted as missing local links. The examples remain
  readable plain code text in `FINDINGS-luna-a.md` and `FINDINGS-luna-b.md`.
- Required verification — DONE. The exact requested chain passed:
  `node tools/verify.mjs`;
  `node tools/release/test-public-status.mjs`;
  `npm run test:contracts`.

## Evidence

- `tastecheck verification passed`
- `public release status projection tests passed (receipt hashes, freshness, failed/stale fail-closed states)`
- `verified release inventory: v1.4.1; 20 skills; 20 canonical commands; 1 alias; 8 gallery systems`
- `All lint fixture tests passed`
- `contract schema/adversarial tests passed (20 valid contracts, 2 red fixtures)`
- `scenario assertion tests passed (21 scenarios, 20 skills)`
- `Contract projections: no drift`
- `check-generated: no byte-for-byte contract drift`

## Changed files

- `_retrofit-2026-09-04/FINDINGS-luna-a.md`
- `_retrofit-2026-09-04/FINDINGS-luna-b.md`
- `evals/receipts/v1/public-release-status.json`
- `_retrofit-2026-09-04/FINAL-REPORT.md`

Test-generated output refreshed by the required contract command:
`evals/receipts/v1/contracts/dead-references.json`.

## IMPROVEMENTS

1. Improve verifier scope handling. WHY: prose/code examples in committed audit
   reports were parsed as executable local links. FIX: ignore fenced and inline
   code when validating Markdown links, or validate audit reports with a
   report-aware parser.
2. Improve receipt refresh ergonomics. WHY: the projection test passes while
   correctly preserving an `UNVERIFIED` status when source-bound receipts are
   stale. FIX: add a documented offline command that refreshes deterministic
   receipt cells before projecting public status.
