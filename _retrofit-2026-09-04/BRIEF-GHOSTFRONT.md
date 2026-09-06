# ROLE: LUNA FIX TEAM — PUBLIC FRONT SURFACES pristine + SEO/AI-GEO (tastecheck)
CEO order: GitHub public front-facing surfaces need updates; README pristine + SEO/AI-GEO. Ground EVERY count/claim in tools/release/release-facts.json (v1.4.1, 20 skills, 20 commands, 1 alias, 8 gallery systems) — never invent.
1. README.md: pristine pass — (a) first 160 chars must state what/who/why (AI snippet surface); (b) keep release-facts + release-status blocks EXACTLY as generated (do not touch generated markers); (c) semantic H2s matching how people search (what is it / quickstart / the 20 skills table / how the gate works / gallery / install / FAQ with quotable one-line answers AI engines can lift); (d) skill table with one-line "what it checks" each (from skill descriptions); (e) zero stale claims — grep every number.
2. llms.txt: align copy with README (same facts, same answers), keep generated blocks.
3. Check CONTRIBUTING.md / docs/ landing copy for stale counts; fix.
4. AI-GEO specifics: answer-shaped sentences ("TasteCheck is X for Y who Z"), consistent naming (TasteCheck), explicit facts table (version, skills, commands, gallery, license-per-LICENSE-file, install one-liner).
Acceptance: node tools/verify.mjs + verify-landing.mjs green; every number matches release-facts.json. Write _retrofit-2026-09-04/GHOSTFRONT-REPORT.md. GIT: none. No installs/network.
