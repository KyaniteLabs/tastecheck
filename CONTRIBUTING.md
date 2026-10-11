# Contributing

Thanks for helping. TasteCheck is MIT licensed.

## Run the checks

```bash
npm ci
npm test
```

`npm test` runs preflight checks, the structural suite (contracts, lint, install, links, gate audit, calibration) and the oracle tests. For a faster loop use `npm run test:structural`.

## Skill structure

Each skill lives in `skills/<name>/`:

- `SKILL.md`: the skill itself, plain Markdown with frontmatter
- `contract.json`: the machine-readable contract the structural tests check
- optional `assets/` for scripts or fixtures the skill references

Commands live in `commands/<name>.md`. The released set of skills, commands and gallery pages is defined in `tools/release/release-facts.json`.

## Rules

- No secrets, tokens, personal data or machine-specific paths (such as `/home/you/...`) in any file.
- Do not hand-edit generated blocks marked `<!-- ...:start -->` / `<!-- ...:end -->`. Change the source and run `node tools/release/project-facts.mjs --write`.
- Do not claim the tool improves designs unless the evidence is in the repo. `node tools/release/check-effectiveness-claims.mjs` scans for this.
- New calibration cases must cite a real defect or a verified-clean surface. See `evals/corpus/CORPUS.md`.

## Pull requests

Describe what changed and which checks you ran. Keep PRs focused. Security issues go through [SECURITY.md](SECURITY.md), not public issues.
