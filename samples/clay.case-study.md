> **⚠ ILLUSTRATIVE CASE STUDY — DO NOT IMPLEMENT OR CHOOSE FROM THIS.** This file is one
> of five worked examples that exist only to demonstrate how differently the same content
> can come out of the design-system-interview. It is **not** a menu option, not a starter,
> and not this (or any) project's design system. Derive a NEW system from the actual
> user's interview answers. If you arrived here looking for a project's DESIGN-SYSTEM.md,
> this is not it.

# Sample E — "Clay" (soft / humanist) — Design System (from a simulated interview)

> **North star:** Calm, warm, human. The quiet-premium lane — soft edges, warm light, lots
> of air, a steady reading rhythm. Reassuring, unhurried, gentle. The deliberate opposite of
> Concrete's severity and Maximal's volume — and explicitly NOT the cream-Fraunces editorial
> slop (no serif, no oversized italics).

## Simulated brief (who this is for)
Wellness, journaling, healthcare, education — products where people need to feel at ease.
References: *handmade ceramics · warm daylight · stationery · Muji calm · soft risograph
pastels (but with enough contrast).* Personality poles: **warm · gentle · humanist ·
spacious · trustworthy.** Stop-scroll = warmth + breathing room. Must not be: cold, loud,
corporate, serif-editorial.

## Direction
- **Aesthetic:** soft humanist — rounded shapes, warm low-contrast palette, generous space,
  a calm vertical rhythm with a gentle alternating (zig-zag) flow.
- **Signature move:** the **alternating soft-card flow** — content steps left/right down the
  page in rounded, warmly-tinted panels, not a grid/bento/ledger. One recurring soft pill
  shape (the "clay pebble").

## Type (web-typography)
- **Display + body:** **Mulish** (400/600/800) — a soft humanist sans (NOT a serif; that
  avoids the editorial-slop tell). Large, friendly headings at 800; airy body at 400 with a
  relaxed 1.7 line-height. Calm scale (no extreme contrast).

## Color (color-system) — warm, low-contrast, but ≥ AA
- Ground warm **linen `#faf6f0`**; ink **`#2b2622`** (warm near-black, not pure).
- **Sage `#4f6f4a`** (primary) + **terracotta `#b5532f`** (accent) — earthy, muted-but-real
  (NOT timid pastel-on-pastel). Soft tinted panels `#f0ebe2` / `#eef1ea`.
- Pastel tints are backgrounds only; text always uses ink or the darkened sage/terracotta.
  Verify every pair ≥ 4.5:1 (warm low-contrast is the risk — check, don't eyeball).

## Shape & density
- **Soft everywhere: 18–28px radius, pill buttons are fine HERE** (on-brief warmth, not a
  tell). Soft 1px warm borders or none; at most a very soft diffuse shadow. Roomy padding,
  wide line-spacing. Calm, not dense.

## Motion (micro-motion)
- Gentle and slow: soft fade-up entrances (~400ms ease-out), a barely-there pebble drift.
  Nothing springy or sharp. Fully `prefers-reduced-motion` gated; content visible without JS.

## Texture
- Optional faint paper warmth only. No grain noise, no gloss. Softness comes from color,
  radius, and space — not texture.

## Refusals
No serif / no Fraunces / no oversized italics (must not read as the editorial slop) · no
cold grays · no harsh pure-black-on-white · no dense grids · no loud saturated color · no
gradients. Soft where Concrete is raw and Swiss is austere.

## Build order
This → color-system (warm sage+terracotta, all pairs contrast-checked) → web-typography
(Mulish, calm scale, 1.7 body) → responsive-layout (alternating soft-card flow that stacks
cleanly) → component-states/form-ux (soft, rounded, large targets) → micro-motion (gentle,
gated) → a11y-pass (warm low-contrast is the risk) → deslop-ui audit vs THIS spec.
