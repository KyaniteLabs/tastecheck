# ASTRA — design the new TasteCheck landing page (CEO-commissioned, 2026-09-05)

You are ASTRA (GPT-6, high reasoning). Tradition: every TasteCheck update ships a NEW landing-page design built with the latest tastecheck. This one is yours — the first designed by a model outside the family that built the kit, USING the kit.

## Workspace
This directory is a copy of the tastecheck repo at the retrofit release (v1.4.1 + ASTRA hardening + density pass). The PREVIOUS landing page is `index-PREVIOUS.html` — study it for the facts it carries, then exceed it. You have write access HERE ONLY; the real repo is untouched.

## Your instruments (use them by name, cite them)
The latest tastecheck lives in `skills/`: color-system, web-typography, spacing-system, theming, responsive-layout, component-states, a11y-pass, cognitive-a11y, deslop-ui, humanize-copy, art-direction, data-viz, micro-motion, tastecheck-pass (the gate contract), tasteroll. Read the ones you use — design THROUGH them, not around them.

## What the page must carry (truths, verbatim from the repo — do not invent)
- v1.4.1 · 20 skills · 20 canonical commands · 8 gallery systems (release-facts block — keep exact numbers).
- The 2026-09-05 retrofit story in one scroll: 7-wave gauntlet; external adversarial review — 8 findings closed (5 SEV-1 evidence-authority holes); verdicts now DERIVED from observations; reviews bound to check+artifact+evidence; dependency-manifest capture; subject inventories (route × state × viewport); complete-capture hashing; `npm run finalize`; token-density cut 15.1% (heaviest skill 31.6%); mutation score 4/4.
- Honest boundaries kept: public status UNVERIFIED where it is UNVERIFIED; the score/gate is accountable judgment + evidence, not an objective guarantee.

## Design laws
- Single self-contained `index.html`: no external assets, system/locally-referenced fonts only, dark-first with a coherent token system (OKLCH or documented equivalents), fluid type scale, measured line lengths.
- Every choice is evidence: DESIGN-NOTES.md must cite, per section, which skill drove it and the measured values (contrast ratios, scale steps, spacing rhythm).
- Responsive truth: the layout must be honest at 390 / 768 / 1280 (it will be rendered headlessly at exactly those widths on a Linux box and gated).
- No fabricated screenshots, no fake logos/press, no superlatives the repo can't back.

## Self-gate before you finish
Run the static legs of tastecheck-pass on YOUR OWN draft: read `skills/tastecheck-pass/SKILL.md`, check your page against its catalog (color/typography/spacing/responsive/a11y/copy legs), fix what fails, iterate. Note in DESIGN-NOTES.md which legs you self-checked and which need the browser/human legs (be honest — those run after you).

## Deliverables
1. `index.html` — the new landing page.
2. `DESIGN-NOTES.md` — skill→section map with measured values, self-gate results, honest open legs.

No network, no installs. Work only inside this directory.
