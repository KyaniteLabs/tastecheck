# Sample D — "Concrete" (brutalist / mechanical) — Design System (from a simulated interview)

> **North star:** Raw, structural, honest-as-poured-concrete. A spec sheet, not a brochure.
> Monochrome and mechanical — the only system in the set with **no chromatic palette**;
> contrast comes from black/white inversion and heavy rules, not color. Confident, austere,
> a little severe. The deliberate opposite of Clay's softness and Maximal's noise.

## Simulated brief (who this is for)
Engineers, infra/devtools, archivists — people who trust a system that shows its structure.
References: *Wim Crouwel grids · brutalist architecture · terminal/ledger printouts ·
ASCII spec sheets · Josef Müller-Brockmann at his most severe.* Personality poles:
**cool · serious · structural · raw-but-precise · mechanical.** Stop-scroll = oversized
monospace + exposed scaffolding. Must not be: cute, soft, decorative, gradient-y.

## Direction
- **Aesthetic:** mechanical brutalism — exposed structure, thick rules, ledger tables,
  index tags (`[00]`, `FIG.`), inversion blocks. Embraces the mono-uppercase label that
  other systems here ban — for THIS system it is on-brief, not a tell.
- **Signature move:** the **ledger** — content laid out as a ruled spec sheet/table with
  oversized monospace index numerals, not cards or bento.

## Type (web-typography)
- **Display:** **Space Grotesk** (700) — geometric, mechanical, tight.
  **Body + labels:** **Space Mono** (400/700) — true monospace; embrace its rhythm.
  Extreme size contrast; set the display huge and tight, body in mono at a steady measure.

## Color (color-system) — ACHROMATIC by intent
- Ground **concrete** `#e7e4dc`; ink **`#0a0a0a`**; paper-white `#f6f4ee` for inverted text.
- Single functional accent **hazard `#ff4d00`** — used ONLY for interactive/CTA and one
  rule, never decoration. Everything else is black / concrete / white.
- Inversion (black block + paper text) is the primary "color." Verify every pair ≥ 4.5:1
  (trivial here — it's near-pure black/white).

## Shape & density
- **Zero radius. Hard 90° corners.** Thick rules (2–3px black). Boxes share edges (no gaps
  on the ledger). Dense, tabular, aligned. Generous only in the hero.

## Motion (micro-motion)
- Minimal and mechanical: a hard, quick reveal (no easing-soft fades), ≤140ms, transform/
  opacity only. The least-animated of the five. Fully `prefers-reduced-motion` gated, and
  content visible without JS.

## Texture
- None. Flat ink on concrete. Honesty = no texture, no shadow, no gloss.

## Refusals
No color palette (achromatic + one hazard accent only) · no rounded corners · no soft
shadows · no gradients (the slop swatches are the only gradients, shown as specimens) ·
no centered-hero-3-card-grid · no decorative motion. Raw where Clay is soft.

## Build order
This → color-system (achromatic + hazard, all inversions checked) → web-typography
(Space Grotesk display + Space Mono body) → responsive-layout (ledger/table that reflows to
stacked rows) → component-states/form-ux (hard-edged, high-contrast) → micro-motion (hard,
minimal) → a11y-pass (gate) → deslop-ui audit vs THIS spec.
