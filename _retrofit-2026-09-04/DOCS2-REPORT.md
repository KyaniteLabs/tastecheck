# Documentation wave 2 report

Status: DONE_WITH_CONCERNS

The public documentation now describes the retrofit and ASTRA hardening without
turning scoped evidence or subjective review into an objective quality claim.

## Fact table

| Fact | Evidence command or source | Result |
|---|---|---|
| Release inventory | `node tools/release/project-facts.mjs --check` | v1.4.1; 20 skills; 20 canonical commands; 1 alias; 21 command files; 8 gallery systems |
| Retrofit scope | `_retrofit-2026-09-04/ASTRA-REVIEW.md` and `ASTRA-FIX-REPORT.md` | 8 ASTRA findings, 5 SEV-1; all 8 closed |
| Gate behavior | `ASTRA-FIX-REPORT.md` and `node tools/evals/test-tastecheck-gate.mjs` | Derived statuses, bound reviews, dependency capture, subject reconciliation, complete-capture hashing, root split, craft/style separation, and scoped authority claims documented |
| Independent post-ASTRA review | `STREAK9b-grok.md` and `STREAK10-sol.md` | Grok r9b and Sol r10 both report fully green with no findings |
| Required release finalization | `npm run finalize` | Receipt refresh, pins, public status, and verify-chain completed after all doc edits |
| Structural acceptance | `npm run test:structural` after finalize | PASS |
| Public status boundary | Generated release status and README banner | Engineering release status remains `UNVERIFIED`; effectiveness remains `BLOCKED` |

## Changed files

- `README.md`
- `llms.txt`
- `CHANGELOG.md`
- `_retrofit-2026-09-04/DOCS2-REPORT.md`

No installs, network access, commit, or push performed.

## IMPROVEMENTS

1. Add a generated projection for the new capability table. WHY: README and
   llms.txt currently require parallel edits to keep their public facts aligned.
   FIX: project a shared source block and verify byte-level agreement.
2. Add a structural assertion for the ASTRA count and severity split. WHY: the
   docs can state 8 and 5, but the verifier does not yet derive those facts from
   the report. FIX: parse the ASTRA findings table and check its row/severity
   counts in the docs lane.
