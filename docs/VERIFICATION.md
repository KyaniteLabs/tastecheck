# Verification

## What verification does not establish

Engineering readiness and effectiveness are separate. The checks below verify repository,
contract, integration, and browser properties. They do not establish that the skills improve
model output. Effectiveness remains blocked and unsupported because the terminal blind
evaluation did not clear its release threshold.

Public copy can be checked independently with:

```bash
node tools/release/check-effectiveness-claims.mjs
```

This repo has two verification layers:

1. **Repeatable local gate:** `npm test`
2. **Manual/browser QA:** render the static pages in a real browser and do the checks below

Do not claim "accessible", "zero contrast failures", "all agents auto-trigger", or "all
samples are identical" unless the relevant gate below was actually run and the evidence is
attached to the change.

## Repeatable Gate

Run from the repo root:

```bash
npm test
```

`npm test` runs `tools/verify.mjs`, `tools/lint-skills.mjs`, `tools/verify-landing.mjs`,
`tools/verify-integration.mjs`, and `tools/verify-gate-audit.mjs`.

`tools/verify.mjs` checks:

- 19 skill directories exist and each `SKILL.md` frontmatter `name` matches its directory.
- Referenced `references/*` and `assets/*` files exist.
- Slash commands target real `~/.agents/skills/<name>/SKILL.md` paths.
- `install.sh --yes` creates canonical `~/.agents/skills` links and detected Claude links.
- `install.sh` fails loudly on pre-existing real skill directories instead of nesting stale installs.
- Local Markdown/HTML links resolve.
- CSS does not contain unspaced `clamp()` math that browsers silently drop.
- Demo inputs have accessible names.
- Data-viz starter figures expose at least as many table rows as plotted SVG points.
- Stale internal skill names such as `dark-mode` are not used as handoff targets.
- `a11y-pass/assets/audit.js` parses as JavaScript, avoids `arguments.callee`, and uses browser
  color rasterization instead of numeric-regex RGB guessing.

`tools/lint-skills.mjs` checks the skill *content* (what static link checks miss): dead
skill cross-references, design tokens outside the canonical glossary, and frontmatter
drift across all 19 skills.

`tools/verify-gate-audit.mjs` executes `tastecheck-pass/assets/gate-audit.js` against a
minimal fake DOM and asserts its automation contract — `window.__gateAudit` is a
`{verdict, fails, warns, notes}` object, the console path still emits, and its output
matches the committed golden (`tools/smoke/fixtures/gate-audit-golden.txt`). Scope is
deliberate: it guards the attribute-pure checks (a layout-faithful fake DOM would be a
partial browser); the layout-dependent stat-band/date-context check is protected by the
real-browser fixture in `tools/smoke/fixtures/` instead.

`tools/verify-landing.mjs` checks [`index.html`](../index.html), the page connected to
GitHub Pages:

- Every installed skill has a live `data-skill` surface on the landing page itself.
- The page exposes stable operator controls for light/dark/high-contrast themes, the primary
  CTA path, component states, form validation, empty/error/retry recovery, and keyboard focus.
- Form inputs are named, landmarks/headings/live regions/focus/reduced-motion/forced-colors are present.
- The data-viz table has one row per plotted SVG point and the chart has title/description text.
- The proof section makes the landing page the canonical integration surface instead of sending
  the primary journey to a side demo.
- Landing colors are tokenized with OKLCH and page-level theme wiring is present.

`tools/verify-integration.mjs` checks the secondary harness,
[`demos/skill-integration.html`](../demos/skill-integration.html):

- Every installed skill has a live `data-skill` surface on one local website.
- The page exposes stable operator controls for themes, component states, forms, empty/error/retry,
  and task-list recovery.
- Form inputs are named, landmarks/headings/live regions/focus/reduced-motion/forced-colors are present.
- The data-viz table has one row per plotted SVG point and the chart has title/description text.
- Generic live-copy tells are absent from the improved site.
- Responsive/theming foundations are present, including OKLCH tokens and mobile layout guards.

## Browser QA Checklist

Run this before publishing visual claims or screenshots:

- Open `index.html`, `samples/index.html`, all five `samples/*/index.html`, and every `demos/*.html`.
- Check 390px, 768px, and 1280px widths.
- Confirm first meaningful content renders, fonts/images resolve, and there is no horizontal overflow.
- Open DevTools console; record any errors or warnings relevant to the page.
- Paste `skills/a11y-pass/assets/audit.js` and record fails/warnings.
- On a FRESH load (no clicks/scroll first), paste `skills/tastecheck-pass/assets/gate-audit.js`
  and record the verdict + any fails/warns (cold-load state honesty + slop tells).
- Do a keyboard pass: skip link, nav, buttons, forms, toggles, and links must be reachable and visibly focused.
- Check reduced motion with `prefers-reduced-motion: reduce`.
- Spot-check dark and high-contrast theme mappings where a page exposes them.

The 1.0 browser receipt automates this matrix for every committed sample and demo at
390px, 768px, and 1280px. It records HTTP/render/overflow/console results, keyboard focus,
reduced-motion state, the runnable accessibility and gate audits, and content-addressed
screenshots. `verify:release` validates the complete check set, current source digest, and
every referenced artifact byte/hash; a pinned `pass` field alone is insufficient.

## Evidence Format

For releases, append a short dated note with:

- Commit hash.
- `npm test` output.
- Browser/version used for manual QA.
- Pages and viewport widths checked.
- Any remaining warnings and why they are acceptable.

## Gate-Auditor Dogfood

Date: 2026-06-12

The full `tastecheck-pass` gate was run against the landing page (`index.html`), and it
matters *which layer* caught what — the lesson is that the mechanical auditor is the
shallow layer.

**The mechanical auditor (`gate-audit.js`) passed and was not enough.** On a fresh load
it reported 0 cold-load failures (nothing `hidden` defeated by CSS, no error text before
input, no content stuck at opacity 0, no stuck skeletons) and one accepted warn — the
intentional indigo→violet "before" demonstration (the `deslop-ui` cell's `✕ pill · purple`
example, and the `aria-hidden` slop swatch). The reveal-on-scroll already followed the
`micro-motion` no-JS rule (`.js .rv` behind a script-added `html.js` hook, with an
observer fallback and a `setTimeout` safety net); the display face resolves to "Red0"
(Redaction 0, the committed distinctive font) — a NOTE, not a tell.

**The structural self-check (`deslop-ui`) caught what the auditor structurally cannot.**
The page predated the structural-plane self-check, and applying it by judgment surfaced a
real defect the 10-check auditor has no concept of: the section stack was the SaaS
**funnel order** — hero → "the problem" → "how it works" → feature grid → proof → CTA.
Every section mapped to a skeleton slot, in skeleton order; only the *treatment* was
varied. That is exactly the tell `references/structural-tells.md` names.

**The fix (this branch):** the landing page was restructured to break the funnel on
order *and* count — lead with the working bento (demonstrate before pitching), demote the
three-planes section from a problem-opener to a principle that lands *after* the
demonstration, and cut the redundant "how it works" section (the interview already lives
in bento cell 00). New stack: `hero → skills (live) → what-it-refuses → proof → install`.
`npm test` stays green; the auditor re-run is still 0 fail / 1 (accepted) warn; the
structural self-check now passes. The takeaway recorded here: a clean mechanical-auditor
run is necessary, not sufficient — the structural plane is judgment work, and it bit the
pack's own page.

## Current Branch Evidence

Date: 2026-06-06

- `npm test`: PASS (`tastecheck verification passed`; `landing verification passed`; `integration verification passed`).
- Browser: CloakBrowser Chromium against local `python3 -m http.server` on
  `http://127.0.0.1:4176/`.
- Pages checked in real same-origin iframes at 390px and 1280px:
  homepage, samples gallery, five sample systems, six demos, example-build after page,
  and `skills/data-viz/assets/chart-starter.html`.
- Browser smoke result: 28 page/viewport checks, 0 blank pages, 0 H1-count failures,
  0 horizontal-overflow failures, 0 broken images, 0 `a11yAudit()` failures.
- Keyboard spot check: first Tab focus lands on the home link with a visible 2px outline.
- Homepage `skills/a11y-pass/assets/audit.js` result after the landing-page pass:
  0 measured failures and 0 warnings at desktop 1440px and mobile 390px.

Additional landing-page 19-skill evidence:

- Page: `index.html`, served as the GitHub Pages homepage.
- Static gate: all 19 installed skills are represented by `data-skill` on the homepage.
- Real operator paths covered by the page contract: light/dark/high-contrast themes, primary CTA,
  component loading/disabled/default states, invalid and valid email validation, empty/error/retry
  recovery, chart/table parity, keyboard-focus target, and live-region status updates.
- Proof copy now identifies the homepage itself as the integration surface.
- Visual checks: desktop hero/nav and mobile hero/skills/proof sections inspected by screenshot;
  the collapsed desktop nav, mobile tiny utility text, palette overlay collision, and mobile install
  command overflow were fixed during the pass.

Secondary integration harness evidence:

- Page: `demos/skill-integration.html`.
- Desktop 1440px and mobile 390px: title/URL correct, 19 unique skills exposed, 0 horizontal overflow.
- Real operator paths executed in browser: light/dark/high-contrast themes, component loading/success/disabled,
  invalid and valid form submission, empty/error/retry task-list states, and chart/table parity.
- `skills/a11y-pass/assets/audit.js`: 0 measured failures, 0 warnings on desktop and mobile.
- Manual keyboard check: skip link, nav link, and theme button receive visible 3px focus outlines.
