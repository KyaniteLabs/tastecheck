# ROLE: LUNA FIX TEAM — WAVE 1 (tastecheck)
Read _retrofit-2026-09-04/MASTER-REGISTER.md. Execute WAVE 1 ONLY.
GIT: do NOT run any git command (branch/commit are the orchestrator's job — branch retrofit/2026-09-04 already exists). You edit files only.
- Implement every W1 row exactly as scoped. No drift into other waves.
- Run the wave's acceptance test(s) from the register; record commands + results.
- Run npm test (offline pieces; record which ran); all must pass.
- Write _retrofit-2026-09-04/WAVE1-REPORT.md: per-row status (fixed/parked+why), acceptance evidence, test tail, list EVERY file you changed (orchestrator commits exactly this list).
- HARD: no dependency installs, no network, no changes outside wave scope + report.
