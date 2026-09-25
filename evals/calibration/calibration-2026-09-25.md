# tastecheck calibration report — 2026-09-25T19:50:01.028Z

Corpus: 17 cases (13 bad, 4 clean, 1 known-open).
Rerun: `npm run calibrate` (or `node tools/calibrate/run-calibration.mjs`). Law: evals/corpus/CORPUS.md.

## Measured rates

- False positives: 0/4 clean cases flagged (FPR 0)
- False negatives: 1/13 bad cases missed (FNR 0.0769)
- Recall 0.9231 · precision 1

## Known-open misses (standing floor, carried in the rate)

- `ledger/falsified-structured-observation` (hollow-signal-verification) — known-open floor: an internally consistent ledger whose structured observations misrepresent the consumed medium cannot be caught offline; the consume-don't-inspect (browser/audio) lane owns this class. Recorded as a standing FN until a cure lands.

## Cases

| case | label | class | documented | got | result |
| --- | --- | --- | --- | --- | --- |
| ledger/falsified-structured-observation | bad | hollow-signal-verification | SHIP | SHIP | FN (known-open) |
| ledger/forged-evidence-hash | bad | checkmark-without-verification | HOLD | HOLD | TP |
| ledger/gestalt-divergence-unresolved | bad | gestalt-elements-divergence | HOLD | HOLD | TP |
| ledger/green-surface-full-ledger | clean | verified-green-ledger | SHIP | SHIP | TN |
| ledger/hostile-evidence-redacted | clean | receipt-privacy-redaction | SHIP | SHIP | TN |
| ledger/missing-required-row | bad | silently-skipped-check | HOLD | HOLD | TP |
| ledger/narrowed-input-set | bad | input-parity-regression | HOLD | HOLD | TP |
| ledger/record-only-evidence | bad | hollow-signal-verification | HOLD | HOLD | TP |
| ledger/stale-linked-artifact | bad | stale-linked-artifact | HOLD | HOLD | TP |
| ledger/unadjudicated-disagreement | bad | unresolved-review-disagreement | HOLD | HOLD | TP |
| surface/clean-fixture | clean | verified-green-surface | CLEAN | CLEAN | TN |
| surface/clean-landing | clean | verified-green-surface | CLEAN | CLEAN | TN |
| surface/credential-in-source | bad | credential-in-browser-source | FAIL | FAIL | TP |
| surface/default-display-face | bad | template-slop-tell | REVIEW | REVIEW | TP |
| surface/indigo-gradient | bad | template-slop-tell | REVIEW | REVIEW | TP |
| surface/machine-path-leak | bad | machine-path-leak | FAIL | FAIL | TP |
| surface/title-vocabulary-leak | bad | title-vocabulary-leak | FAIL | FAIL | TP |

