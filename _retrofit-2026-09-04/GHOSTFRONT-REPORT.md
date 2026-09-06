# Ghostfront report

Status: DONE

## Result

- Reworked `README.md` into an answer-first public surface with semantic sections for what TasteCheck is, quickstart, the 20 skills, the gate, gallery, install, and FAQ.
- Added an explicit release-facts table covering v1.4.1, 20 skills, 20 canonical commands, 1 alias, 21 command files, 8 gallery systems, MIT licensing, and the install path.
- Replaced the README’s grouped skill bullets with one-line “what it checks” rows sourced from each skill’s frontmatter description.
- Aligned `llms.txt` with the README’s facts, answers, skill rows, gate explanation, gallery, install, and current UNVERIFIED/BLOCKED status.
- Updated `docs/LAUNCH.md` to remove stale six/seven-system references and the stale “17 specialist skills” count; the launch image now uses `docs/hero/before-after.png`.
- Updated the landing proof sentence in `index.html` so the required direct-concern-coverage verification passes.
- No `CONTRIBUTING.md` exists in the repository; no change was needed there.

## Verification

- `node tools/release/project-facts.mjs --check` — PASS.
- `node tools/verify.mjs` — PASS.
- `node tools/verify-landing.mjs` — PASS.
- Consistency probe — PASS: README and llms each contain exactly the 20 release-facts skill names in order; inventory values match `tools/release/release-facts.json`.
- Stale-copy probe — PASS: no six/seven-system, 17-specialist, or 19-skill/command claims remain in the scoped public copy.
- Generated release-facts and release-status marker bodies were preserved exactly.
- No installs or network access were used.

## Changed files

- `README.md`
- `llms.txt`
- `docs/LAUNCH.md`
- `index.html`
- `_retrofit-2026-09-04/GHOSTFRONT-REPORT.md`
