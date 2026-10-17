# Responsive Layout — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of established responsive practice
(mobile-first method, intrinsic/“every-layout” patterns, CSS container queries, WCAG
reflow, 2024–2026). Credited ideas, own expression.

## Meta-patterns

### MP-1 · The web is intrinsically fluid; fight it and you lose
The browser already reflows content; rigid pixel layouts override that and break.
**Consequence:** let content flow by default; add structure with relative units and
intrinsic patterns; intervene with breakpoints only where flow alone fails.

### MP-2 · Design for ranges, not devices
There is no "phone" or "tablet" width — only a continuum. **Consequence:** breakpoints
come from where *your content* breaks, not from device names. Resize until it looks
wrong; break there.

### MP-3 · Mobile-first is a constraint that clarifies
Starting small forces content priority and yields additive, simpler CSS. **Consequence:**
base styles = smallest screen; enhance up with `min-width`. Never strip a desktop layout
down with `max-width`.

### MP-4 · Components live in containers, not viewports
A reusable component's width is set by its slot, not the window. **Consequence:** use
container queries for anything reused in different-width contexts; viewport queries are
for page-level shape changes.

### MP-5 · Reflow is the accessibility floor
Zoom and small screens are the same problem; content must remain usable without 2-D
scrolling. **Consequence:** verify 320px and 400% zoom; multi-column must collapse to
single, not shrink to unreadable.

## Decision records

### DR-1 · Mobile-first min-width
- **Why (MP-3):** simpler, additive. **Apply:** base = smallest; enhance up; em-based
  breakpoints.

### DR-2 · Intrinsic before breakpoints
- **Why (MP-1):** fewer breakpoints, fewer bugs. **Apply:** auto-fit grid, sidebar,
  switcher, clamp — add a query only to change shape.

### DR-3 · Content-driven breakpoints
- **Why (MP-2):** device sizes are a moving target. **Apply:** break where it visually
  breaks, whatever the px.

### DR-4 · Container queries for reusables
- **Why (MP-4):** correct context adaptation. **Apply:** `container-type: inline-size` +
  `@container` on components used in multiple slots.

### DR-5 · min-width:0 + max-width:100% to stop overflow
- **Why (MP-1/MP-5):** flex/grid children default to min-content and overflow.
  **Apply:** `min-width:0` on children; `max-width:100%` on media; `dvh` for height.

### DR-6 · Verify the extremes
- **Why (MP-5):** reflow is the floor. **Apply:** test 320px + 400% zoom; no 2-D scroll.

## Principle, not property
Distills shared responsive-design practice; credit lineage (mobile-first, intrinsic
layout community, CSS WG) where natural; never copy prose. Your layouts are your own.
