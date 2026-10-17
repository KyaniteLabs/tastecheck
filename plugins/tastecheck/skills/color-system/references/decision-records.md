# Color System — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of current color-system practice
(OKLCH/perceptual-color discourse and WCAG, 2024–2026). Credited ideas, own expression.

## Meta-patterns

### MP-1 · Perception ≠ math; pick the space that matches the eye
HSL/hex lightness isn't perceptual, so equal numbers look unequal and contrast becomes
unpredictable. **Consequence:** build in OKLCH where L is perceptual; ramps become even
and contrast predictable.

### MP-2 · Generate from a system; don't hand-pick
Random hex values have no relationship, so they clash and go muddy. **Consequence:**
fix a hue, step lightness, curve chroma. A palette is a function, not a mood board.

### MP-3 · One dominant color, neutrals do the work
The timid even palette (five equal pastels) reads as AI slop and has no hierarchy.
**Consequence:** commit to one dominant + sharp accent; most surface area is tinted
neutral.

### MP-4 · Chroma can't be constant across lightness
High chroma is impossible near white/black and looks wrong if forced. **Consequence:**
taper chroma — peak in mid-L, drop at the ends.

### MP-5 · Accessibility is a property of pairs, not colors
A color isn't "accessible" alone; a *pair* (fill on surface) has a contrast ratio.
**Consequence:** verify the actual pairs you ship, including on tinted/raised surfaces.

### MP-6 · Tokens decouple meaning from value
Hard-coded colors make theming and consistency impossible. **Consequence:** palette
layer + semantic layer; components reference roles only.

## Decision records

### DR-1 · Build ramps in OKLCH, constant hue, stepped L
- **Why (MP-1):** even, contrast-predictable ramps. **Apply:** 10 stops, ΔL ~0.07.

### DR-2 · Curve the chroma
- **Why (MP-4):** avoid neon-light / muddy-dark. **Apply:** C rises to mid then falls.

### DR-3 · Tint the neutrals
- **Why (MP-3):** dead gray looks accidental. **Apply:** neutrals = brand hue at C≈0.01.

### DR-4 · Commit to one dominant + accent
- **Why (MP-3):** hierarchy and non-slop. **Apply:** accent shares L/C range, differs H.

### DR-5 · Verify pairs, not colors
- **Why (MP-5):** compliance is per-pair. **Apply:** body ≥4.5:1, large/UI ≥3:1 on real
  surfaces; states by L-nudge; focus ring ≥3:1.

### DR-6 · Semantic tokens only in components
- **Why (MP-6):** theming + consistency. **Apply:** `--color-primary`, not `--brand-600`,
  in markup.

### DR-7 · Never color alone for meaning
- **Why:** CVD users. **Apply:** icon/text + color; CVD-simulator check.

## Principle, not property
Distills shared color-system and accessibility practice; credit lineage (OKLCH authors,
WCAG) where natural; never copy prose. Your palette and code are your own.
