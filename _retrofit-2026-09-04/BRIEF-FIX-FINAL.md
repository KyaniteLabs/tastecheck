# ROLE: LUNA FIX TEAM — FINAL CLEANUP WAVE (tastecheck, post-re-vote)
Re-vote verdict RETROFIT-COMPLETE=NO with exactly 3 residuals. Fix ALL THREE:
1. MR-008/009/012 finish: regenerate/refresh evals/receipts/v1/public-release-status.json so tools/release/test-public-status.mjs passes against the final source revision.
2. tools/verify.mjs fails on two committed retrofit-report links (in _retrofit-2026-09-04/WAVE*.md): fix the links to valid repo-relative targets (or make them plain code text, not links).
3. Re-run: node tools/verify.mjs && node tools/release/test-public-status.mjs && npm run test:contracts — ALL must pass; record outputs.
GIT: no git commands. Write _retrofit-2026-09-04/FINAL-REPORT.md (per-fix status + evidence + changed-file list). No installs, no network.
