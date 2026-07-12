# Changelog

All notable changes to the tastecheck skill pack. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

## [1.0.0] — 2026-07-11

### Release status

- 1.0 engineering readiness and effectiveness are separate gates. Contract, static, and
  evidence-pipeline readiness can pass while effectiveness remains blocked and unsupported.
  The terminal blind evaluation remains below its release threshold; historical or failed
  evidence cannot be presented as current effectiveness proof.

The "the gate actually runs, and it caught us" pass — findings from a cross-model audit
(one build brief through 7 model lanes) shipped back into the pack, then the pack held to
its own standard on its own surfaces.

### Guardrails
- **`verify.mjs` now fails on curly quotes used as HTML attribute delimiters** (`class=”…”`).
  LLM agents emit smart quotes in code constantly; the browser then never matches the
  class, the layout silently degrades, and the page still passes every content check.
  Four agents shipped curly-broken sample layouts in this very pass — all reporting
  `npm test` green. The signature (`=` followed by a curly quote) is never valid HTML and
  never appears in prose, so the check is zero-false-positive.

### Samples & landing (dogfooding the structural plane)
- **The landing page now runs all 19 skills live** (was 15). The four newer skills —
  spacing-system, art-direction, i18n-ready, tastecheck-pass — are now working bento
  cells (the gate cell shows a live PASS), `landing:true` in the manifest, with
  `skillCount` bumped to 19 on the landing and the integration harness.
- **The landing page was restructured to break the SaaS-skeleton order** it was quietly
  shipping (hero → problem → how → grid → CTA): it now leads with the live bento and
  demotes "the problem" to a principle after the demonstration. The structural self-check
  caught this; the mechanical auditor could not.
- **All five samples stopped being recolors of one skeleton.** Each gets a reading order
  AND a skills-section layout native to its committed aesthetic: concrete a spec-sheet
  ledger, swiss a modular grid, maximal a color-block wall, copper a tessellated bento,
  clay soft grouped clusters.
- **A sixth sample — Dispatch / Shipping log** — a dark emerald-slate release timeline
  whose content is the changelog of the work above. The gallery is now "six committed
  design systems," a claim now backed by structure (no two share a section order or a
  skills layout), not skin.

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
