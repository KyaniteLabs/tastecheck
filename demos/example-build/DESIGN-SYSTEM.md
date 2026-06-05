# Design System — Prep (demo brand)

> **North star:** "Editorial luxury — warm near-black ink on ivory, ONE oxblood accent,
> high-contrast serif display, asymmetric split with generous space, signature =
> oversized index numerals set in the serif." (decided boldly per design-system-interview;
> no human to grill in a demo, so committed + announced — never resolved to the average.)

## Direction
- **Reference:** a Criterion Collection booklet × Aesop product page — printed, warm, confident.
- **Aesthetic:** editorial luxury (NOT "modern/clean").
- **Personality poles:** warm · serious · minimal · classic · refined · spacious.
- **Signature move:** oversized serif index numerals (01 / 02 …) as the structural motif.

## Type (web-typography)
- **Display:** Georgia/serif stack (high-contrast serif; stand-in for a licensed face like Fraunces).
- **Body:** system humanist sans for readability at 18–20px.
- **Scale:** perfect fourth (1.333), fluid clamp, body 18→20px. Real contrast (display ~4rem vs body 1.18rem).

## Color (color-system, OKLCH, contrast-verified)
- **Accent:** oxblood, H=25. Text/link uses accent-700; fills accent-600/700.
- **Neutrals:** warm (H=70), tiny chroma — ivory paper (ink-50) to near-black ink (ink-900).
- **NOT** indigo→violet; ONE dominant accent, neutrals do the work.
- **Verified pairs:** body 18.8:1, muted 16.9:1, oxblood text 14:1, oxblood UI 9.9:1, paper-on-oxblood 14:1. All ≥ WCAG AA.

## Shape & density
- **Density:** spacious (luxury = whitespace). **Corners:** sharp, 2px (never pill).
- **Elevation:** flat; hairline rules (1px ink-200), no drop shadows.

## Motion (micro-motion)
- Restrained: one staggered load reveal; 150–260ms ease-out; reduced-motion honored.

## Refusals
- No Inter/Roboto · no indigo→violet · no centered-hero+3-cards · no pill CTAs ·
  no glassmorphism · no shadow-2xl · no emoji headers.

## Build order applied
color-system (ramp+contrast) → web-typography (scale/measure) → responsive-layout
(asymmetric split, intrinsic) → component-states (button states) → micro-motion →
a11y semantics. deslop-ui audited against THIS spec.
