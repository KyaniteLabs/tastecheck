# Projection-freshness fix

Status: DONE

Regenerated the committed public release projection after the generated README and landing-page markers converged on the current source digest. The public result remains honestly `UNVERIFIED`; historical effectiveness remains `BLOCKED`.

Verification:

- `node tools/release/test-public-status.mjs` — passed.
- `node tools/verify.mjs` — passed (`tastecheck verification passed`).

Files refreshed:

- `evals/receipts/v1/public-release-status.json`
- `README.md`
- `index.html`
- `_retrofit-2026-09-04/TPS-REPORT.md`

No projector or test logic was changed. No installs or network access were used.

## IMPROVEMENTS

- Improve the projector's post-write convergence check: the current loop compares only the source digest and overall status, which made the ordering behavior easy to misread. Add a focused test that runs projection in a temporary copy and asserts the second check is clean.
