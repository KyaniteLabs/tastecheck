# ROLE: CORRECTNESS HUNTER (luna @ max) — tastecheck stage-1
Read _retrofit-2026-09-04/FACTS.md first; it is authoritative.
Your lens: CODE-LEVEL DEFECTS, exhaustively. Hunt in tools/*.mjs + tools/lib/ (verify, lint-skills, verify-landing, verify-integration, verify-gate-audit, nima), assets/gate-audit.js, install.sh, package.json scripts:
- Logic bugs, wrong regexes, false-pass validations (checks that pass on garbage), path/platform bugs, broken imports, dead branches, JSON parse traps.
- Every finding: file:line + verbatim snippet + concrete failure scenario.
- Run each verify script offline (no network) on the repo; capture real exit codes + outputs into _retrofit-2026-09-04/scratch-<name>.log (scratch files allowed ONLY inside _retrofit-2026-09-04/).
- Defects only, no style nits. Output ONLY: _retrofit-2026-09-04/FINDINGS-luna-a.md (FACTS contract).
