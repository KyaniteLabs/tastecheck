# Code-review fix report

Status: DONE_WITH_CONCERNS

Closed the three CY-TC findings without installing dependencies, using the
network, committing, or pushing.

## CY-TC-001 — producer receipt freshness

- Renamed the finalizer operation to `sourceRebindReceipts` and made it
  metadata-only: it reports stale producer receipts and never rewrites their
  producer-owned `source_tree_sha256`.
- Added the `stale-until-rerun` label to final-source/check diagnostics and the
  derived public README/status projection.
- Added a regression proving source-rebind preserves receipt bytes and the
  final-source gate remains blocked until registered producers rerun.

The finalize probe refreshed only the deterministic context-budget producer,
preserved the five offline producer identities, projected `UNVERIFIED`, and
blocked on browser, e2e, mechanical, security, and clean-clone receipts that
remain stale until rerun.

## CY-TC-002 — NIMA response validation

`scoreNima` now accepts only finite scores in the inclusive 1–10 range and a
ten-bin histogram containing finite nonnegative values whose sum is 1 within a
small numeric tolerance. Tests cover score boundaries, NaN/infinity,
out-of-range scores, malformed histogram lengths, negative/NaN bins, and bad
histogram sums.

## CY-TC-003 — release output path safety

`--out` now rejects symlink components and symlink destinations, verifies the
real parent remains inside the verifier root, and writes through a temporary
`O_NOFOLLOW` file followed by an atomic rename. Regression tests cover both a
symlinked output parent and a symlinked destination target.

## Compatibility repairs encountered

The local-link verifier treated the valid fragment URL `README.md#quickstart`
as a filename. Its HTML-link path now strips query and fragment components
before checking the local file. The current dirty landing rewrite also lacked
the generated public-status and gate markers; those markers were restored so
finalization can project the honest `UNVERIFIED` state without replacing the
landing page.

## Verification

- Focused NIMA, source-rebind/freshness, release-gate, public-status, syntax,
  local-link, and `git diff --check` probes — PASS.
- `npm run test:structural` — BLOCKED by the overlapping dirty `index.html`
  landing rewrite: its released skill set is missing the required `data-skill`
  markers, and its browser contract is missing `skillCount: 20` and
  `softwareVersion: "1.4.1"`. The user-owned landing content was preserved.
- `npm run finalize` — correctly BLOCKED with explicit stale-until-rerun
  producer blockers after refreshing only context-budget and projecting public
  status; no stale producer receipt was restamped.
- `node tools/release/test-check.mjs` — not runnable because `ajv` is absent;
  no install or network action was taken.

## IMPROVEMENTS

1. Provision the lockfile-resolved structural and release-contract dependency
   set in the worker image. WHY: the dependency-backed `test-check` lane could
   not run even though the structural lane passed. FIX: provide `ajv` and
   `playwright` from the existing lockfile before dispatch, without worker
   installs.
2. Add a dependency-free CLI fixture for `verify-chain`. WHY: the live tree is
   intentionally stale until offline producers rerun, so the prior test could
   not assert a passing command-level chain. FIX: let the command accept an
   explicit fixture root or add a small subprocess harness around the gate.
3. Create missing contained output parents in the release CLI. WHY: valid
   nested output paths currently require the caller to pre-create their parent,
   which adds friction to otherwise safe report generation. FIX: create only
   lexical, symlink-free verifier-root parents before the atomic write.
