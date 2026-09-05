# ASTRA Fix Report

Date: 2026-09-05

Scope: close all eight findings in `ASTRA-REVIEW.md`. The release runner remains
fail-closed: **SHIP** requires measured observations, matching derived statuses,
complete scope coverage, and bound artifact/provenance/reviewer records.

| # | Finding | Closure | Regression or verification evidence |
| --- | --- | --- | --- |
| 1 | Evidence structure without derived results | Added catalog observation contracts with named fields. The runner derives `pass`/`fail`/`n/a` from observations and rejects missing observations or status contradictions. | `test-tastecheck-gate.mjs`: record-only and contradictory-observation cases both HOLD. |
| 2 | Reviewer approval replayable across artifacts/checks | Reviews now bind `check_id`, rubric, artifact SHA-256, and complete evidence SHA-256; those fields are covered by the review hash. | `test-tastecheck-gate.mjs`: transplanted check/artifact review case HOLD. |
| 3 | Artifact hash misses rendering-dependency closure | File and directory captures require a measured manifest of the entry plus linked local CSS, JS, and font assets. Manifest drift blocks release even when the entry hash is unchanged. | `test-tastecheck-gate.mjs`: unchanged HTML plus changed CSS dependency case HOLD. |
| 4 | Category coverage is not subject coverage | Ledgers freeze subject inventory and per-check members. Browser checks reconcile route × state × viewport members; control checks reconcile control × state members. Optional checks are applicable when their subject is present, including cognitive friction. | `test-tastecheck-gate.mjs`: incomplete inventory and present-cognitive-subject cases HOLD. |
| 5 | Lossy sanitization before hashing | Complete raw evidence is hashed; redaction is presentation-only. Oversized, truncated, depth-limited, or marker-bearing captures fail toward HOLD. | `test-tastecheck-gate.mjs`: oversized complete-capture case HOLD; hostile presentation remains sanitized. |
| 6 | CLI root coupled to TasteCheck checkout | Verifier/catalog root and consumer artifact root are separate API/CLI inputs. Results record both root identities; ledger and output paths stay verifier-root relative while artifact paths resolve against the consumer root. | Root-separated options are implemented in `evaluateReleaseGate` and CLI usage; artifact-root closure is exercised by the consumer-root regression. |
| 7 | Recipes/rails become universal obligations | Spacing guidance and tasteroll rails now distinguish invariant craft floors from brief-dependent defaults and require evidence for overrides. The spacing scenario and generated registry judge rationale and evidence rather than literal adherence. | `test-scenarios.mjs`, skill lint, and context-budget checks pass. |
| 8 | GEO claims overstate authority | GEO copy now describes scoped evidence and accountable human judgment for subjective checks while preserving the existing opening and FAQ structure. Root-relative evidence links are accepted by the repository verifier. | `verify.mjs`, landing/integration checks, and full structural lane pass. |

## Verification

- `node tools/evals/test-tastecheck-gate.mjs` — deterministic, ledger, ASTRA, and boundary suites pass.
- `npm run test:release-eval-contracts` — pass.
- `npm run test:structural` — pass, including contracts, catalog/runner checks, verification, landing, integration, and mutation checks.
- `npm run finalize` — source-bound receipts and verify-chain pass after this report is included.
- No installs, network access, commit, or push performed.

The release runner does not turn stored claims into objective design truth: subjective rows still
require an independent human review, and the final decision remains scoped to the frozen inventory
and captured artifact closure.
