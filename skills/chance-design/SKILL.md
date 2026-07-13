---
name: chance-design
description: >-
  Procedural design-system generation through seeded randomness. Use when a
  user wants a "surprise me" design direction, when exploring the space of
  valid design systems, or when generating varied-but-tasteful output without
  a manual interview. Draws from a bounded answer space so any roll passes
  a relaxed quality gate.
---

# Chance Design (roll the dice, keep the taste)

Every AI builds the same site because it fills every blank with the most probable
token. Chance-design inverts this: it fills the blanks with **seeded randomness
from a curated option space**, then runs the full design pipeline. The result is
a design system that is unpredictable but never incoherent — because the option
space is bounded by the same rules that make hand-chosen systems pass the gate.

This is the proof of the thesis: constraints produce taste, even when the
choices are random.

## How it works

1. **Seed** — accept a numeric seed (or derive one from the current timestamp).
   Same seed → same design, always. This makes rolls reproducible and shareable.
2. **Roll** — for each `design-system-interview` handoff field, pick one option
   from the bounded space in `assets/bounded-space.json` using the seeded PRNG
   in `assets/chance-engine.js`.
3. **Derive** — from the rolled answers, derive the token anchors: accent hue
   (from the reference territory's color range), measure, line-height, density
   scale, heading weight, corner radius, section rhythm.
4. **Pipeline** — hand the rolled DESIGN-SYSTEM to the same downstream skills
   the interview uses: `color-system`, `web-typography`, `spacing-system`,
   `theming`, `responsive-layout`, `component-states`, `art-direction`,
   `micro-motion`, `data-viz`, `empty-states`, `form-ux`, `humanize-copy`.
5. **Gate** — apply the relaxed gate (below), not the full 19-skill strict gate.

## The bounded answer space

Each field has curated options. Any combination is structurally valid — there
are no "wrong" rolls, only different ones.

| Field | Dice faces |
|-------|-----------|
| reference | 8 visual territories (mineral, Swiss, brutalist, folio, shipping, clinical, humanist, maximalist) |
| personality | 8 tones (warm, serious, playful, refined, stark, editorial, operational, decorative) |
| aesthetic | 8 approaches (mineral, grid, maximalist, brutalist, humanist, operational, clinical, folio) |
| type | 5 directions (system-serif, system-sans, system-mono, 2 mixed pairings) |
| color_mode | 3 postures (light, dark, dual) |
| density | 3 levels (compact, standard, airy) |
| rhythm | 3 patterns (metronomic, syncopated, asymmetrical) |
| signature | 8 committed moves (needle-accent, structural-rule, display-word, color-block, tessellated-bento, timeline-feed, measurement-annotation, sixling-divider) |
| imagery | 5 stances (none, documentary, diagrammatic, editorial, icon-system) |
| motion | 4 levels (restrained, purposeful, kinetic, none) |

Full option text and color/hue anchors are in `assets/bounded-space.json`.

## The design bounds (the fire budget)

These are the rails. Chance may pick freely within them; anything outside is a
gate violation, not a "creative choice."

- `--measure`: 58–75ch
- `line-height`: 1.5–1.8
- `heading-weight`: 600–800
- `body-size`: 1.0–1.125rem
- `density-scale`: 0.85–1.15×
- `texture-opacity`: 0–5%
- `corner-radius`: one of {0, 2, 4, 6}px — pick once, use everywhere
- `accent-count`: exactly 1 — no exceptions
- `section-rhythm`: compact, standard, or airy — pick once

## The relaxed gate

Chance-generated designs are personal artifacts, not shipped product surfaces.
The gate is deliberately lighter than `tastecheck-pass`:

- **Readable**: body text ≥ 1rem, measure 58–75ch, line-height ≥ 1.5
- **WCAG AA**: body text contrast ≥ 4.5:1, large/UI ≥ 3:1 on the actual surfaces
- **Self-contained**: no external requests (fonts, images, scripts) in exports
- **Inert**: no scripts in exported HTML
- **Keyboard-reachable**: all interactive elements focusable, visible focus treatment

What the relaxed gate does NOT require (vs. the strict gate):
- Full `a11y-pass` audit (only the contrast + keyboard floor)
- `cognitive-a11y` checklist
- `deslop-ui` anti-slop scan (chance-rolled systems are expected to be unusual)
- `tastecheck-pass` full ship-gate report

If the chance-rolled design will be a **shipped surface** (landing page, product
UI, public-facing), escalate to the full strict gate via `tastecheck-pass`.

## Relationship to Chance

[Chance](https://github.com/simongonzalezdecruz/chance) is a multi-source
randomness engine (OS entropy, ChaCha20, PCG, XoShiRo, source mixing, MCP
server). This skill's `assets/chance-engine.js` is a self-contained xoshiro128++
implementation so the skill works with zero dependencies.

If Chance is available (via MCP or as a local dependency), prefer it for:
- **Multi-source entropy mixing** (combining OS + CSPRNG + external sources)
- **Divination methods** (dice, cards, runes, I Ching) as themed randomness for
  narrative or brand-aligned design generation
- **Reproducible audit trails** (Chance logs its draws for evidence)

The inline engine is the fallback; Chance is the upgrade.

## The roll contract

A chance-design delivery includes:

1. **The seed** — the numeric seed that produced this design (shareable, reproducible)
2. **The rolled answers** — a table showing which option was picked for each field
3. **The derived tokens** — accent hue, measure, line-height, density, etc.
4. **The DESIGN-SYSTEM.md** — in the same format as `design-system-interview` output
5. **The gate result** — relaxed-gate pass/fail with evidence

## Quick-start

```javascript
// Roll a design system from seed 42
var rng = chanceEngine(42);
var space = require('./assets/bounded-space.json');

var design = {};
for (var field in space.fields) {
  var opts = space.fields[field].options;
  design[field] = rng.pick(opts);
}

// Derive accent color from the reference territory
var hue = rng.float(60, 95);    // warm gold range
var chroma = rng.float(0.10, 0.16);
var accent = 'oklch(0.67 ' + chroma.toFixed(3) + ' ' + hue.toFixed(0) + ')';

console.log('Seed 42:', JSON.stringify(design, null, 2));
console.log('Accent:', accent);
```

## Reference files

- `assets/bounded-space.json` — the complete option space, color anchors, and design bounds.
- `assets/chance-engine.js` — pasteable xoshiro128++ PRNG with `pick`, `range`, `float`, `shuffle`, `chance`.

## How to deliver

Deliver the seed, the rolled answer table, the derived DESIGN-SYSTEM.md, and the
relaxed-gate evidence. Hand off to the same downstream skills as
`design-system-interview`. If the user says "roll again," use a new seed — never
silently re-roll with the same seed and present different answers.

## Completion evidence

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | seed — the numeric seed and PRNG identity |  |  |  |
|  | roll — each field's picked option from the bounded space |  |  |  |
|  | derivation — tokens derived from the rolled answers |  |  |  |
|  | gate — relaxed-gate contrast, readability, self-containment |  |  |  |
|  | handoff — DESIGN-SYSTEM.md to downstream skills |  |  |  |

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A user wants a surprise or procedural design direction without a manual interview (+2 in contract.json); avoid: The user wants to commit to a specific direction by hand (+2 in contract.json)
- Exclude: Do not roll outside the bounded answer space or bypass the design bounds (+2 in contract.json)
- Stop / handoff: Stop when the rolled design will be a shipped public surface — escalate to tastecheck-pass strict gate (+1 in contract.json); receives [design-system-interview] -> sends [color-system, web-typography, spacing-system, theming, responsive-layout, art-direction, micro-motion, component-states, data-viz, empty-states, form-ux, humanize-copy]
- Output: A seeded, reproducible DESIGN-SYSTEM.md with rolled answers and relaxed-gate evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
