# Landing copy rewrite report

## Before and after

| Before | After |
| --- | --- |
| Hero: verdict trail and evidence edition | Hero: a direct promise for developers building interfaces with AI agents |
| Retrofit: review history and repair summary | Problem → fix: generic defaults versus a design system before code |
| Density: token reduction and finalization details | How it works: interview → design system → craft skills → evidence gate |
| Skills: instruments and required evidence | What's inside: 20 skills grouped by craft area |
| Contract rail: landing contract demonstrations | Contract rail: concrete examples of states, forms, and recovery |
| Canonical proof: integration-surface explanation | The gate: the same required proof sentences, framed around the customer path |
| Put it to work: Markdown and repository guide | Install: documented command, quickstart, GitHub, and the honest boundary |
| Footer: changelog and internal brand framing | Footer: product framing, GitHub, license, and back to top |

## What was cut

- Retrofit, gauntlet, wave, ASTRA, adversarial review, finding-count, severity, density, mutation, and finalization language.
- Token and percentage measurements that described the page's internal work instead of the product.
- Links into `_retrofit-2026-09-04/` and links that sent readers to internal reports.
- Workflow-first framing in the hero, navigation, status copy, and section headings.
- The seven-point process chart; it now shows 20 skills across seven craft areas with seven matching table rows.

## Kept and checked

- Theme controls, `data-test` hooks, browser contract, accessibility structure, 20 skill concerns, release-facts block, release-status markers, and canonical proof phrases.
- Install command from the README and an explicit GitHub link.
- Honest effectiveness boundary: it is not yet independently proven, and the gate reports what it checked and could not check.

Copy rules applied: `SENTENCE`, `PARAGRAPH`, `IDEA`, and `AUDIT` from `humanize-copy`.

Verification: `node tools/verify-landing.mjs` and `npm run test:structural` passed.
