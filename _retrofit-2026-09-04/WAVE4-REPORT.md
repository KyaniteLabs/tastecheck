# W4 report — isolate unsafe execution and subjective judgment

## Per-row status

| Register row | Status | Evidence |
| --- | --- | --- |
| MR-007 — audit data and target-origin execution lack trust and safety boundaries | DONE | `assessExecutionPolicy()` defaults to read-only audit mode; audit writes/injection are rejected; authenticated or mutating staging/production execution requires a time-bounded matching authorization scope. `redactUntrusted()` bounds depth, keys, items, and text; neutralizes markup/control characters, paths, addresses, secrets, dangerous URLs, and prototype keys before hashing or emitting evidence. Hostile evidence and unauthorized/authorized execution fixtures pass the focused gate tests. |
| MR-010 — subjective audits are presented as deterministic without independence or adjudication | DONE | The closed catalog declares `judgment` per check. Subjective rows require a human independent reviewer, rubric, matching decision, review timestamp, and review hash. Disagreement requires a distinct human adjudicator, rule, matching decision, timestamp, and rationale; unresolved disagreement is HOLD. Deterministic rows reject reviewer judgment fields. Missing-review, self-certification, unresolved-disagreement, and resolved-adjudication fixtures are covered. |

## Implementation evidence

- `skills/tastecheck-pass/assets/release-gate.mjs` adds the execution policy assessor,
  bounded untrusted-data redaction, safe hashing, and reviewer/adjudication validation.
- `skills/tastecheck-pass/assets/check-catalog.json` and
  `check-catalog.schema.json` classify every closed check as `deterministic` or
  `subjective`.
- `release-ledger.schema.json` and `release-gate.schema.json` describe execution,
  review, adjudication, bounded evidence details, and strict local references.
- `SKILL.md` separates audit from authorized fix passes and states the target-origin,
  redaction, and subjective-review boundaries.
- Focused fixtures live under `tools/evals/fixtures/release-gate/`.

## Acceptance and offline test tail

Passed:

- `npm run test:release-eval-contracts` — semantic diversity 8, context-aware
  anti-slop 6, deterministic gate 4, release gate ledger 7, W4 boundary 15,
  V5 CLI regression 1.
- `npm run test:eval-schema` — clean receipt passed; absolute path, email, token,
  non-public host, internal metadata, and raw-prompt fixtures rejected.
- `node tools/verify-gate-audit.mjs` — cold-load heuristic and release-runner
  verification passed.
- `node tools/contracts/check-generated.mjs` — no contract projection drift.
- JSON parsing, local schema-reference probe, and redaction boundary probe passed.
- Offline npm-test pieces passed: `node tools/lint-skills.mjs`,
  `node tools/verify-landing.mjs`, `node tools/verify-integration.mjs`,
  `node --test tools/test/nima.test.mjs`, and `node tools/lib/test-nima.mjs`.

Not completed due existing environment/baseline gates:

- `npm test` stopped in `test:oracle-capture` because `playwright` is not installed;
  no install or network action was taken.
- `node tools/verify.mjs` reports only the known retrofit markdown links:
  `_retrofit-2026-09-04/FINDINGS-luna-a.md` → `../index.html#main` and
  `FINDINGS-luna-b.md` → `contract.json`.
- AJV schema compilation was unavailable because `ajv` is not installed; all four
  W4 JSON artifacts parsed and all local `$defs` references resolved.

## Exact changed-file list

Implementation and documentation:

- `skills/tastecheck-pass/SKILL.md`
- `skills/tastecheck-pass/assets/release-gate.mjs`
- `skills/tastecheck-pass/assets/check-catalog.json`
- `skills/tastecheck-pass/assets/check-catalog.schema.json`
- `skills/tastecheck-pass/assets/release-ledger.schema.json`
- `skills/tastecheck-pass/assets/release-gate.schema.json`

Tests and fixtures:

- `tools/evals/test-tastecheck-gate.mjs`
- `tools/evals/fixtures/release-gate/hostile-evidence.json`
- `tools/evals/fixtures/release-gate/execution-policy.json`
- `tools/evals/fixtures/release-gate/subjective-review.json`

Report:

- `_retrofit-2026-09-04/WAVE4-REPORT.md`

Prescribed sanitizer tests also refreshed their private diagnostics under
`.omx/evidence/tastecheck-v1/test-receipts/`; no implementation or public receipt
was added there.

## IMPROVEMENTS

1. **Provision dependency-free schema compilation or a declared AJV lane.** WHY:
   this worktree cannot compile the JSON schemas with AJV, so runtime/schema parity
   remains only partially checked. FIX: preflight `ajv` and run the schema lane in a
   provisioned environment, or add a small dependency-free structural validator.
2. **Make target-origin execution use a single browser harness entrypoint.** WHY:
   the pasteable heuristic remains a human-operated browser surface even though the
   runner now records and rejects unsafe policy states. FIX: require the harness to
   submit the same signed execution policy before loading `gate-audit.js`.

