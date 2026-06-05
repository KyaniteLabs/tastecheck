# Sample C — "Riot" (maximal / expressive) — Design System (from a simulated interview)

> **North star:** Loud, joyful, high-energy. Saturated color blocks, oversized
> characterful display type, asymmetric collage layout, movement everywhere (tasteful).
> It should feel *alive and confident* — a risograph poster that learned restraint only
> where restraint helps reading. The deliberate opposite of Swiss calm and copper hush.

## Simulated brief (who this is for)
A creative/consumer product (community, music, design tool) for people who want
personality. References: *risograph print · 90s rave flyers · Memphis design · bold
sportswear graphics · Bricolage/Clash display lettering.* Personality poles: **warm-ish ·
playful · MAXIMAL · experimental · raw-but-crafted · energetic.** Stop-scroll = bold type
+ saturated color + motion. Must not be: timid, corporate, monochrome.

## Direction
- **Aesthetic:** expressive maximal / playful-geometric — color-blocked, asymmetric,
  collage rhythm, but with a disciplined type system so it's *bold, not messy*.
- **Signature move:** **oversized display words that bleed into color blocks**, with one
  recurring geometric shape (circle/blob) and animated entrances.

## Type (web-typography)
- **Display:** **Bricolage Grotesque** (700/800) — characterful, wide, contemporary.
  **Body:** a clean grotesque (Hanken Grotesk 400/600) so dense text stays readable.
  Extreme size contrast; display set huge and tight.

## Color (color-system)
- **High-chroma multi-accent** (this is the ONE system that's allowed >1 accent, by brief):
  an electric primary + two saturated partners, blocked not blended. Start from OKLCH:
  e.g. **electric magenta `#ff3d8b`**, **acid yellow `#ffd23e`**, **cobalt `#2b5cff`** on
  an off-black or warm-cream ground (pick one; high contrast either way).
- Color carries energy, but **text contrast still ≥4.5** (dark text on yellow blocks,
  light on magenta/cobalt). Verify each pairing. Color is never the *only* signal.
- NOT: pastel timidity, indigo→violet gradient, one-accent minimalism (that's B).

## Shape & density
- **Rounded-bold (16–24px) and hard shapes mixed** by role; **flat fills, color blocks,
  thick rules**; deliberate overlap/collage. Energetic density, generous in the hero.

## Motion (micro-motion)
- Forward and lively: staggered bold entrances, a looping ambient shape drift, springy
  hovers (still ≤300ms, transform/opacity). The most-animated of the three — but fully
  `prefers-reduced-motion` gated.

## Texture
- Risograph grain / halftone (procedural, honest) over color blocks; misregistration
  feel. Distinct from copper's basalt and B's grid.

## Refusals
No timid pastels · no monochrome · no indigo→violet · no corporate restraint · no
serif-editorial. Maximal where copper is hushed and B is austere.

## Build order
This → color-system (3-hue high-chroma, all pairings contrast-checked) → web-typography
(Bricolage display + Hanken body) → responsive-layout (asymmetric collage that still
reflows) → component-states/form-ux (bold, rounded) → micro-motion (lively, gated) →
a11y-pass (contrast is the risk here) → deslop-ui audit vs this spec.
