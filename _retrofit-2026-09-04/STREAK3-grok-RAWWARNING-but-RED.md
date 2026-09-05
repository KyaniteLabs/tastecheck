I'll re-run the structural acceptance chain on HEAD `def1eef` and check whether the reproducibility and receipt-refresh gates are real proofs, not false greens.Structural lane is green. Next I’ll independently run the two-run projector and the receipt-digest gate to see if they’re real proofs or just unhooked.Status: DONE_WITH_CONCERNS

`npm run test:structural` passed on `def1eef`. Byte-stable projection is independently true (two writes, eight files match HEAD). Receipt-refresh is code only: `ajv` missing so `test-check` / `verify:chain` cannot load; all six engineering receipts plus public status are stale vs digest `7d217793…`.

FULLY-GREEN: no — findings: two-run test and receipt-refresh gate are not on `test:structural` and cannot run without `ajv`; mutable receipts remain stale; MR-012 still not closed.

## IMPROVEMENTS
1. Split the two-run projector test off `ajv` and wire it into `test:structural` — official proof is currently unexecutable.
2. Isolate `verifyFinalSourceReceiptDigests` from schema imports so the digest gate can fail closed without `ajv`.
3. Either regenerate receipts after the last source change or stop treating structural green as a last-commit receipt gate.
