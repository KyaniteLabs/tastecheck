# ROLE: LUNA FIX TEAM — WAVE 2 (tastecheck)
Read _retrofit-2026-09-04/MASTER-REGISTER.md. Execute WAVE 7 ONLY (W1-W6 done).
GIT: run NO git commands — orchestrator owns branch/commits (branch retrofit/2026-09-04 exists).
- Implement W7 rows exactly as scoped; no drift into other waves.
- Acceptance: run the register's W7 acceptance commands; then npm test offline pieces (record which ran).
- KNOWN BASELINE (do NOT chase): ValidatePublicTests link failures inside _retrofit-2026-09-04/ markdown (orchestrator-owned artifact dir) — everything else must pass.
- Write _retrofit-2026-09-04/WAVE7-REPORT.md: per-row status, evidence, test tail, exact changed-file list.
- HARD: no installs, no network, nothing outside W2 scope + report.
