# Verification

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

`tools/verify.mjs` checks:

- 15 skill directories exist and each `SKILL.md` frontmatter `name` matches its directory.
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

## Browser QA Checklist

Run this before publishing visual claims or screenshots:

- Open `index.html`, `samples/index.html`, all five `samples/*/index.html`, and every `demos/*.html`.
- Check 390px, 768px, and 1280px widths.
- Confirm first meaningful content renders, fonts/images resolve, and there is no horizontal overflow.
- Open DevTools console; record any errors or warnings relevant to the page.
- Paste `skills/a11y-pass/assets/audit.js` and record fails/warnings.
- Do a keyboard pass: skip link, nav, buttons, forms, toggles, and links must be reachable and visibly focused.
- Check reduced motion with `prefers-reduced-motion: reduce`.
- Spot-check dark and high-contrast theme mappings where a page exposes them.

## Evidence Format

For releases, append a short dated note with:

- Commit hash.
- `npm test` output.
- Browser/version used for manual QA.
- Pages and viewport widths checked.
- Any remaining warnings and why they are acceptable.

## Current Branch Evidence

Date: 2026-06-05

- `npm test`: PASS (`tastecheck verification passed`).
- Browser: CloakBrowser Chromium against local `python3 -m http.server` on
  `http://127.0.0.1:4174/`.
- Pages checked in real same-origin iframes at 390px and 1280px:
  homepage, samples gallery, five sample systems, five demos, example-build after page,
  and `skills/data-viz/assets/chart-starter.html`.
- Browser smoke result: 28 page/viewport checks, 0 blank pages, 0 H1-count failures,
  0 horizontal-overflow failures, 0 broken images, 0 `a11yAudit()` failures.
- Keyboard spot check: first Tab focus lands on the home link with a visible 2px outline.
- Remaining audit warnings are manual-review prompts (tiny text, outline-at-rest heuristic,
  gradient/background manual contrast prompts), not measured failures.
