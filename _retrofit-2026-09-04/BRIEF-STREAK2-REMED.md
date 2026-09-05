# ROLE: LUNA FIX TEAM — STREAK-2 REMEDIATION (tastecheck; SOL round-1 findings)
SOL (fs access) verdict FULLY-GREEN: no, 2 blockers. Read _retrofit-2026-09-04/STREAK-sol.md in full. Close both:
1. BYTE-REPRODUCIBLE COMMAND-CONTRACT PROJECTION: make the projection generator deterministic byte-for-byte across runs (sorted keys, stable serialization, no timestamps/env leakage) + a test proving two runs = identical bytes.
2. FINAL-SOURCE RECEIPT REFRESH GATE: mutable release receipts go stale after the final commit — add a gate (verify-chain step) requiring receipt source-digests to match final source at verification time, so the LAST commit can never leave receipts stale; regenerate current receipts through it.
3. MR-012 closure: produce the current execution receipts the row asked for OR restate the row honestly as contained-not-closed in the register (no false closure).
Acceptance: full chain green (verify, public-status, lint, contracts, landing) + the new tests. Write _retrofit-2026-09-04/STREAK2-REMED-REPORT.md. GIT: none. No installs/network.
