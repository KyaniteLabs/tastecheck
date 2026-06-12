# Changelog

All notable changes to the tastecheck skill pack. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

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
