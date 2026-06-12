> **⚠ ILLUSTRATIVE CASE STUDY — DO NOT IMPLEMENT OR CHOOSE FROM THIS.** This file is one
> of five worked examples that exist only to demonstrate how differently the same content
> can come out of the design-system-interview. It is **not** a menu option, not a starter,
> and not this (or any) project's design system. Derive a NEW system from the actual
> user's interview answers. If you arrived here looking for a project's DESIGN-SYSTEM.md,
> this is not it.

# Sample A — "Copper" (dark / editorial) — Design System (from a simulated interview)

> **North star:** A knowledgeable friend who turns your taste into a system. The site
> must feel **alive, material, and emergent** — built from cellular geometry and honest
> texture, syncopated (never metronomic), high-chroma on dark. Unique, beautiful,
> theory-correct. **Never boring, never cliché, never a template.**

## Who it's for (drives tone + density)
Vibe-coders and people who code but not front-end — *and* experts who must see zero
rookie mistakes. Voice: smart, warm, non-judgmental, trustworthy. It surfaces decisions
the user didn't know existed, and names the parts plainly.

## Taste DNA (synthesized from references)
basalt columns · Voronoi/cellular tessellation · parallel lines · natural + REAL texture
(no fake) · translucency + micro-shimmer iridescence · syncopation/rhythm · high-intensity
color · chemistry/reactions/oxidation · ceramics/fiber/3D-printing (material, made).

**→ Design consequences (these are the rules, not vibes):**
1. **Structure = cellular, not template.** The skills live in an *irregular tessellated
   bento* (varied cell sizes), not a uniform grid. Layout is asymmetric and syncopated.
   No centered-hero + 3-step + equal-card-grid skeleton. Kill it.
2. **Basalt as layout, not wallpaper.** Voronoi/columnar geometry is a structural motif
   (cell edges, vertical column rules = "parallel lines"), not just a background image.
3. **Material honesty.** Real generated texture (procedural basalt/glaze PNG) + grain.
   No stock noise, no glassmorphism-as-default.
4. **Alive.** Orchestrated staggered load reveal; the hero texture drifts slowly; hover
   life on cells. Motion is core, not decoration. All gated behind `prefers-reduced-motion`.
5. **High-chroma on dark.** One committed jewel accent + its reaction partner; iridescence
   lives in the texture, UI stays disciplined.

## Committed tokens

**Ground (dark, faint cool cast — clay):** bg `#0b0d12`, raised surfaces by *lightness*.

**Palette — default COPPER + VERDIGRIS** (the chemistry/oxidation reaction; most on-DNA,
furthest from both slops). Switchable (cobalt / magenta / amber / jade) but copper ships.
- accent (copper, jewel) `#e08a3a` · accent-deep `#6e3a14` · ink-on-accent `#1a0f05`
- reaction (verdigris) `#1fae8f` — used in texture + as secondary signal
- neutrals tinted warm toward the copper hue (NOT dead gray).

**Type (locked — you love it):** Display **Redaction** grade-0 (legible) for headlines;
grade-35/70 only as rare textural accent. Body **Archivo**. Fluid perfect-fourth scale.
Mono only for tiny code/labels — and **no mono-uppercase eyebrow tell.**

**Shape:** corners by role (controls 5px, cells 14px). Elevation by lightness + hairline,
**no gradient-glow buttons**. Radii vary by role (not everything one radius).

**Signature move:** corroded index numerals + iridescent basalt cell edges.

## Refusals (audit against these)
No centered-hero+3-step+equal-grid template · no mono-uppercase eyebrow · no gradient-glow
CTA · no indigo→violet · no cream/Fraunces editorial · no Inter · no uniform card grid ·
no dead-gray neutrals · no static page (must move) · no mobile nav removal · no contrast
fails · no sub-12px text · tap targets ≥24px.

## Build order
This system → color-system (copper ramp + contrast) → web-typography (scale) →
responsive-layout (asymmetric + tessellated, real mobile nav) → component-states/form-ux/
empty-states (real live demos in the bento) → micro-motion (orchestrated, alive) →
a11y-pass (gate) → deslop-ui audit against THIS spec.
