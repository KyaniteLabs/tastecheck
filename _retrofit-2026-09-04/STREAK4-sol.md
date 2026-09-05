Status: DONE_WITH_CONCERNS

Fresh verdict on the requested structural lane: RED.

Findings:

1. P0 — The acceptance chain fails at the newly wired final-source receipt test. `npm run test:structural` reaches `tools/release/test-final-source-receipt-gate.mjs`, whose real `--mode=verify-chain` subprocess rejects all six engineering receipts and `public-release-status.json` as stale. The final source digest at HEAD is `24b4fdffc953d7b96ed33b964c80a472aeb469891122f63b32b2ae0934feb837`; every claimed-fresh receipt contains `471eb983d24f27f3d91bc639c73f24b26ecec3bfe85a31926a19eb82bc162f14`. This is a real final-source failure, not an AJV availability issue.

2. P1 — The claimed two-run public-status projector proof is not wired into `npm run test:structural`. The script `_retrofit-2026-09-04/test-tps2-stability.mjs` passes when invoked directly, but `package.json` never invokes it. The only two-run message in the structural output is for the separate project-facts projector. Therefore the required lane does not prove public-status byte stability.

3. P1 — The standalone TPS2 test is not a strict byte-stability proof for the projection outputs. It regenerates once, runs `test-public-status.mjs` twice around an mtime-only change to the projector source, and compares only that source file's bytes plus source digests. It never snapshots and compares the bytes of `evals/receipts/v1/public-release-status.json`, `README.md`, or `index.html` across two projector runs.

4. AJV-free property: confirmed for the new gate path. The structural preflight passes without installing dependencies, and `test-final-source-receipt-gate.mjs` plus `--mode=verify-chain` use the dependency-free gate. The run fails on genuine stale digests before later structural checks; AJV is not the blocker.

IMPROVEMENTS

- Regenerate and commit all six receipts plus public status from the actual final source digest, then run `npm run test:structural` from that exact tree. WHY: the committed receipt digest is already stale at HEAD. FIX: make final receipt regeneration the last source-affecting release step and fail the commit gate if the digest changes afterward.
- Wire an AJV-free public-status stability test directly into `test:structural`. WHY: the claimed TPS2 proof is currently outside the acceptance chain. FIX: add a dedicated `tools/release/test-public-status-stability.mjs` command before the final receipt gate.
- Make that test execute the projector twice in a temporary fixture and compare all projected output bytes after run one versus run two. WHY: the current test compares the projector source file, not projector outputs. FIX: hash the status JSON and both generated surfaces after each run and assert exact equality.

FULLY-GREEN: no
