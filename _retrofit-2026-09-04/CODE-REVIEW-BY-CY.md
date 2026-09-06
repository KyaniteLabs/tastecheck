# Code review by CheckYourself

Verdict: **HOLD**. Three open findings remain: one P1 release-integrity bypass and two P2 boundary defects.

## Findings

| ID | Severity | Finding | Evidence | Required fix |
|---|---|---|---|---|
| CY-TC-001 | P1 | `finalize` restamps all mutable producer receipts with the current source digest without rerunning their commands. Old browser/e2e/security/mechanical/clean-clone results can therefore appear current and satisfy the downstream freshness and pin checks. | `tools/release/finalize.mjs:39-45,70-80`; `tools/release/check.mjs:148-185`; `tools/release/final-source-receipt-gate.mjs:33-76` | Preserve producer-owned source identity and block, or rerun each registered producer after the final source snapshot. |
| CY-TC-002 | P2 | `scoreNima` accepts any JavaScript number, despite the documented 1-10 score contract, and does not validate the promised histogram. An invalid high score can become `ok`/`pass`. | `tools/lib/nima.mjs:42-59,66-68,83-85` | Validate finite inclusive range and histogram shape; add malformed and boundary tests. |
| CY-TC-003 | P2 | The SHIP gate realpath-checks inputs but only lexically checks `--out`; `writeFileSync` can follow a destination or parent symlink beyond the verifier root. | `skills/tastecheck-pass/assets/release-gate.mjs:209-217,925-931,963-964` | Reject symlink components, verify the real parent, and use an atomic no-follow write. |

## CheckYourself execution

- Findings artifact: `.checkyourself/code-review-findings.json` — schema and semantic validation passed.
- Coverage artifact: `.checkyourself/code-review-coverage.json` — all 20 surfaces are present; CheckYourself reports coverage incomplete because non-S11/S12 pass/applicability claims lack verifier-issued receipts.
- Score artifact: `.checkyourself/code-review-score.json` — **29/100**, coverage-backed, low confidence; 0 P0, 1 P1, 2 P2, 0 P3.
- S11 EXECUTED receipt: run `8817d951c5a598a28a098fcaf68cccda`, receipt SHA-256 `c9fc658348da9be62e2761775c8caa38523122d8026e18b6a21d9825da66e018`, PASS.
- S12 EXECUTED receipt: run `6f48f4d2d30da27b0417f347e8f707a3`, receipt SHA-256 `c8853a71cc1ec5b615c5de4fad4eed1ab4685955ec24bf70084cdfd32039263b`, PASS.

The green challenges do not clear the findings: S11 tests current NIMA verdict helpers but not response-domain validation; S12 runs structural verification but not the finalizer or adversarial output-path cases.

## Coverage swept

- `tools/verify.mjs`: skill inventory, nested resources, installer smoke, HTML/CSS/handler checks, input labels, chart tables, aliases, audit parsing, skip-link order.
- `tools/lib/nima.mjs`: health caching, abort paths, response parsing, status boundaries, combined verdict.
- `tools/release/`: manifest pins, receipt schema and assertions, source digest, public projection, effectiveness claims, producer/finalizer ordering, tests.
- `skills/tastecheck-pass/assets/release-gate.mjs`: execution policy, artifact/dependency hashing, subject inventory, evidence/provenance/review validation, SHIP eligibility, CLI input/output paths.
- `contracts/` and sampled `skills/*/SKILL.md`: schema/code identity and workflow obligations.

## Design-tool blind spots

1. Self-authored receipts cannot prove execution authorship. Hash and source consistency detect mutation, not whether a claimed browser or human run actually happened against those bytes.
2. Deterministic gates cannot decide subjective taste validity. NIMA is uncalibrated and warn-only; semantic hierarchy, originality, and design coherence still require independent visual judgment.
3. Reviewer independence is string-based. A ledger can use different reviewer/tool labels without proving distinct actors or an external trust root.
4. Static and light-DOM checks cannot cover pixels hidden behind browser behavior, shadow roots, iframes, fonts, GPU differences, assistive technology, or real interaction state.

## IMPROVEMENTS

1. Separate refresh from reproduction. WHY: `finalize` currently turns source rebinding into apparent freshness. FIX: make producer reruns the only path to a current receipt and rename any metadata-only operation explicitly.
2. Add adversarial boundary challenges. WHY: S11/S12 passed while all three findings remained reachable. FIX: commit mutations for stale receipt restamping, invalid NIMA payloads, and symlinked output parents.
3. Let CheckYourself ingest challenge receipts directly. WHY: fresh EXECUTED receipts were minted, but the coverage scorer did not recognize them as verified evidence after manual mapping. FIX: add a `coverage --attach-challenge` command that validates and binds challenge receipts to surfaces.
