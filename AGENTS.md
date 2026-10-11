# AGENTS.md

Brief for coding agents working on this repository (not for agents using the skills).

## Layout

- `skills/<name>/SKILL.md` + `contract.json`: the 20 skills
- `commands/*.md`: Claude Code slash commands (20 plus the `/darkmode` alias)
- `tools/`: verification, release, calibration and eval scripts
- `tools/release/release-facts.json`: the single source for the released inventory
- `evals/corpus/`, `evals/calibration/`: labeled test cases and measured error counts
- `samples/`, `demos/`, `index.html`: gallery and landing page
- `docs/`: verification notes and launch copy

## Commands

```bash
npm ci
npm test                      # full suite
npm run test:structural       # faster structural suite
node tools/verify.mjs
npm run release:inventory     # checks generated inventory blocks
node tools/release/check-effectiveness-claims.mjs
```

## Rules

- Do not hand-edit generated marker blocks (`<!-- release-facts:v1:start -->`, `<!-- release-status:v1:start -->`, and their end markers). Edit the source and run `node tools/release/project-facts.mjs --write`. Release status is projected by `npm run finalize`.
- Never add unsupported effectiveness claims. Effectiveness is BLOCKED; state measured numbers with their scope.
- No secrets or machine-specific paths in committed files.
- Taste data is user-local and must not be committed.
- Do not commit or change git state unless asked.
