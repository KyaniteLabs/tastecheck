# Projection paradox root cure

Status: DONE_WITH_CONCERNS

Changed the shared source-tree revision computation so committed public-status regeneration is stable:

- `README.md` and `index.html` keep their source content in the digest, but generated release-status marker bodies are canonicalized.
- `evals/receipts/v1/public-release-status.json` remains excluded as generated receipt output.
- `_retrofit-*` evidence and report artifacts are excluded so committing a required report cannot change the source revision after regeneration.
- Added focused engineering-receipt assertions for generated surfaces, retrofit reports, and source changes.

Verification:

- `node tools/release/project-public-status.mjs --write` — exit 0; status remains `UNVERIFIED`.
- `node tools/release/test-public-status.mjs` — exit 0.
- No-op `touch tools/release/project-public-status.mjs`, then `node tools/release/test-public-status.mjs` — exit 0.
- Projection check after regeneration — no errors; projection source digest matches the derived digest.
- Proof artifact for the enclosing commit: `TPS2-STABILITY-PROOF.log` captures regeneration, persisted-projection testing, an mtime-only no-op change, and the second passing test with an unchanged source digest.
- `node --check` passed for the changed release modules.
- `node tools/release/test-engineering-receipt.mjs` could not complete because the environment-enforced GPG signing keybox is not writable when its temporary fixture tries to commit (`gpg`/`keyboxd` permission error).

No installs or network access used. No git commands run by the worker.

## IMPROVEMENTS

- Make the engineering-receipt fixture disable signing only for its isolated temporary commits; the actual test is currently blocked by host GPG policy before reaching its assertions.
- Add an integration test that generates the public projection, adds a new `_retrofit-*` report, and verifies the projection remains fresh across that tracked/untracked transition.
