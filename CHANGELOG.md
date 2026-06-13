# Changelog

All notable changes to the tastecheck skill pack. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

The "the gate actually runs, and it caught us" pass — findings from a cross-model audit
(one build brief through 7 model lanes) shipped back into the pack.

### Added
- **Runnable gate auditor** (`skills/tastecheck-pass/assets/gate-audit.js`) — a paste-able
  (or browser-injectable) console auditor for the cold-load tells self-reported gate
  tables miss: `hidden` defeated by a CSS display rule, error text before input, content
  stuck at opacity 0, uniform card grids, stat-counter bands, pill CTAs, the indigo
  gradient. Prints named selectors so its output is pasteable evidence. Injecting it sets
  `window.__gateAudit = {verdict, fails, warns, notes}` so a browser-driving lane runner
  reads the result with no manual paste (Playwright/Puppeteer snippet in
  `tools/smoke/README.md`).
- **Gate-auditor regression** (`tools/verify-gate-audit.mjs`, in `npm test`) — executes
  the asset against a fake DOM and guards the attribute-pure checks plus the structured
  and console-golden contract; the layout-dependent stat-band/date-context check is
  protected by a real-browser fixture (`tools/smoke/fixtures/gate-audit-fixture.html`).
- Structural-slop self-check items hoisted into `deslop-ui`'s SKILL.md (the SaaS
  skeleton, uniform card grid, metronomic rhythm, image-shaped placeholders) so the
  structural plane runs on every pass, not just in a reference file.

### Changed
- `tastecheck-pass`: the gate outranks polish — reserve budget for it before optional
  extras, and never imply it ran when it didn't; a measurable ✓ must carry its measured
  value; added a cold-load render check and the auditor wiring.
- `design-system-interview`: budget for the gate from minute one (rule 2.6), at the front
  door of the pipeline rather than only in the last-read skill.
- `micro-motion`: reveal-on-scroll must not park content at `opacity: 0` in static CSS —
  gate the hidden state behind a JS-added hook so a no-JS reader never sees blank
  sections; the canonical example now uses the `html.js` hook.

## [0.1.0] — 2026-06-12

The "make every agent read it the same way" overhaul.

### Added
- **Four new skills** closing expert-workflow gaps: `art-direction` (imagery,
  illustration, iconography as committed decisions), `spacing-system` (owns the
  `--space-*` scale and section rhythm), `i18n-ready` (multilingual-resilient UI,
  EN/ES first-class), `tastecheck-pass` (the ship gate; states the canonical pipeline
  once and executes every relevant self-check with a pass/fail report).
- **Canonical token glossary** in `skills/design-system-interview/references/tokens.md`
  — the exact names every skill consumes/emits (semantic `--color-*`, type, space,
  radius, shadow, motion, data-viz series).
- **`skills.json` manifest** — drives all three verifiers; landing coverage is
  declared, not implied.
- **Skill lint** (`tools/lint-skills.mjs`, in `npm test`) — dead skill cross-refs,
  off-glossary tokens, frontmatter drift.
- **Smoke-prompt harness** (`tools/smoke/`, manual) — regression-tests how models
  interpret the skills (the samples-as-menu failure class).
- CI workflow (`.github/workflows/verify.yml`), `FONTS-LICENSES.md`,
  `install.sh --uninstall`, and slash commands for the new skills.

### Changed
- **Every skill normalized to the canonical token contract** (theming, web-typography,
  component-states, data-viz, deslop-ui, color-system — SKILL.md, assets, references).
- **Samples renamed** `samples/*.DESIGN-SYSTEM.md` → `*.case-study.md` (the old name
  collided with the artifact the interview emits) and each now opens with a
  do-not-implement header; llms.txt carries an anti-menu note for AI readers.
- **design-system-interview hardened**: existing-direction skip path, anti-menu rule,
  domain-bounded boldness, imagery/iconography question, light/dark decided at
  interview time, do-not-copy-the-examples guard.
- **improve-existing-website brought to parity**: audit procedure, signal-vs-drift
  tests with a worked example, ADRs, run checklist.
- Reduced-motion doctrine unified under `micro-motion` (designed fallback primary,
  global kill switch demoted to retrofit baseline); duration values reconciled across
  skills; slash commands now symlinked so `git pull` updates them.

### Fixed
- Dead skill references (`idiomatic-translation`, `web-design-guidelines`).
- Indigo/Tailwind-blue fallback colors in the component-states quick-start (the exact
  default the pack exists to kill).
- Copper-hardcoded data-viz chart starter (now canonical tokens + a clearly-marked
  example palette).
- Nested media query in the theming starter; stale `text-rendering` advice; ungrounded
  letter-spacing self-check item in web-typography.
