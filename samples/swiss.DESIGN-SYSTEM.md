# Sample B — "Atelier" (Swiss / light) — Design System (from a simulated interview)

> **North star:** Gallery-grade Swiss precision. Bone-white paper, a strict modular
> grid, one decisive signal color, hairline rules, objective grotesque type. It should
> feel *engineered and curated* — the calm authority of a museum wall text. The
> deliberate opposite of the copper sample (dark/warm/material) and of any neon dark-SaaS.

## Simulated brief (who this is for)
A research/analytics or design-tooling product for precise, expert users. Persona's
references: *Swiss International Style posters · Josef Müller-Brockmann grids · a museum
catalogue · graph paper · Braun product manuals.* Personality poles: **cool · serious ·
minimal · classic · refined · spacious.** Stop-scroll = clarity, grid tension, one
perfect red. Must not be: warm, decorated, dark.

## Direction
- **Aesthetic:** Swiss / International — grid-driven, objective, high-whitespace.
- **Signature move:** an exposed **baseline/column grid** (faint hairlines) the content
  visibly sits on; oversized index numerals set flush to the grid.

## Type (web-typography)
- **One grotesque, many weights** — **Hanken Grotesk** (400/600/800). No serif, no second
  family (Swiss discipline). Massive size/weight contrast for hierarchy; tight tracking on
  big headings. Mono only for data/labels.
- Scale: perfect-fourth-ish, fluid clamp. Generous measure, left-aligned, ragged.

## Color (color-system)
- **Ground:** bone white `#f7f6f2` / pure surfaces; ink near-black `#15171a`.
- **One signal:** International **vermilion-red** `#e8482b` (jewel-bright, used sparingly —
  rules, the active state, one word). Neutrals are true/cool grays (this system is *not*
  warm). Verify all on light: ink ≥ 12:1, red-on-white ≥ 4.5 for text use or reserve red
  for large/marks (≥3:1).
- NOT: gradients, multiple accents, warm cream (that's slop v2).

## Shape & density
- **Sharp corners (0–2px)** — Swiss is rectilinear. **Hairline rules** (1px cool gray)
  everywhere a border is needed; **no shadows, flat.** Dense, grid-aligned.

## Motion (micro-motion)
- Minimal, mechanical: snappy 120–160ms; a precise grid-reveal on load (lines draw in);
  no soft glows. Reduced-motion safe.

## Texture
- Near-none — the *grid itself* is the texture. Optional: a barely-there paper grain
  (procedural, very subtle). No basalt/glaze (that's the copper system's motif).

## Refusals
No dark ground · no serif · no warm/cream · no gradient/glow · no rounded cards · no
multiple accent colors · no decoration. Different from copper in *every* axis.

## Build order
This → color-system (vermilion + cool neutrals, light) → web-typography (Hanken scale) →
responsive-layout (visible modular grid) → component-states/form-ux (sharp, hairline) →
micro-motion (mechanical grid reveal) → a11y-pass → deslop-ui audit vs this spec.
