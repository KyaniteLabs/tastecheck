---
name: responsive-layout
description: >-
  Layouts that don't break at any width. Apply this whenever you build or fix the
  structure of a web page or component in CSS/Tailwind/React/etc. — page shells,
  grids, navigation, sidebars, cards, hero sections, anything that must work from
  a 320px phone to an ultrawide monitor. Use it to avoid the usual failures:
  desktop-first CSS bolted onto mobile, fixed pixel widths that overflow, content
  that doesn't reflow, breakpoints picked from device names instead of where the
  content breaks, components that only adapt to the viewport (not their container),
  horizontal scrollbars, and layouts that collapse at zoom. Trigger on cues like
  "make this responsive", "it breaks on mobile / tablet", "fix the layout on small
  screens", "the sidebar overflows", "should I use grid or flexbox", "add
  breakpoints", or "this doesn't reflow". Gives the mobile-first method, intrinsic/
  fluid patterns, container queries, and a checklist — not vibes. Framework-agnostic.
  Pair with web-typography, deslop-ui, component-states.
---

# Responsive Layout

A responsive layout isn't "three breakpoints for phone/tablet/desktop." Devices come
in every size; designing for named devices guarantees it breaks on the ones you didn't
name. Modern responsive design is about **letting content reflow intrinsically** and
adding breakpoints **only where the content itself breaks** — plus, in 2026,
**container queries** so a component adapts to *its own* space, not just the window.

This skill is the method and the patterns that make a layout survive any width, zoom,
and device — each checkable.

## The decision order

1. **Mobile-first.** Write the base styles for the smallest screen, then *add*
   complexity upward with `min-width` queries. This forces content priority and
   produces simpler CSS than stripping a desktop layout down.
2. **Make it intrinsic before you reach for breakpoints.** Use Grid/Flex with
   `minmax()`, `auto-fit`, `clamp()`, and `%`/`fr` so the layout flexes *without* any
   media query. Many layouts need zero breakpoints.
3. **Add breakpoints where the content breaks, not at device sizes.** Resize the
   window; the moment the layout looks wrong is your breakpoint — whatever px that is.
4. **Use container queries for reusable components.** A card in a sidebar vs. a wide
   column should adapt to its container, not the viewport.
5. **Verify the extremes** — 320px wide, 200–400% zoom, and very wide — no horizontal
   scroll, no overflow, no collapse.

## Non-negotiables

- **Mobile-first (`min-width`), not desktop-first (`max-width`).** Base = smallest;
  enhance up. Mixing both directions is where responsive bugs breed.
- **No fixed pixel widths on layout containers.** Use `max-width` + `%`/`fr`/`auto`,
  `min()/max()/clamp()`. A `width: 1200px` container overflows a 360px phone.
- **Breakpoints come from content, not devices.** Don't hardcode 768/1024 because
  "tablet"; break where *your* content needs it. Devices change; content logic doesn't.
- **Prevent overflow at the source.** `min-width: 0` on flex/grid children (they
  default to `min-content` and refuse to shrink → overflow), `max-width: 100%` on
  media, wrap long text (`overflow-wrap: anywhere` where needed).
- **Reflow, don't shrink-to-unusable.** Multi-column → single column on small screens;
  don't just scale a desktop grid down until it's illegible (WCAG 1.4.10 reflow: usable
  at 320px / 400% zoom with no 2-D scrolling).
- **Container queries for components meant to be reused** in different-width slots.
- **Test 320px + zoom.** If it needs horizontal scrolling at 320px or 400% zoom, it
  fails reflow.

## Quick-start patterns (mostly breakpoint-free)

```css
/* 1. Auto-responsive grid — wraps with NO media queries.
      Cards are ≥ 16rem; fit as many per row as space allows. */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1.5rem;
}

/* 2. Sidebar + content that collapses on its own (the "sidebar" pattern) */
.with-sidebar { display: flex; flex-wrap: wrap; gap: 1.5rem; }
.with-sidebar > .sidebar { flex: 1 1 16rem; }     /* sidebar basis */
.with-sidebar > .content { flex: 999 1 60%; min-width: 0; }  /* takes the rest; min-width:0 prevents overflow */

/* 3. Fluid container — never wider than the viewport, capped, centered */
.container { width: min(100% - 2rem, 72rem); margin-inline: auto; }

/* 4. A breakpoint ONLY where content breaks (mobile-first, min-width) */
.layout { display: grid; gap: 1rem; }                 /* base: stacked */
@media (min-width: 48em) {                            /* where 2-col starts to make sense */
  .layout { grid-template-columns: 2fr 1fr; }
}
```

### Container query (component adapts to its slot, not the window)
```css
.card-wrap { container-type: inline-size; }
.card { display: grid; gap: 1rem; }
@container (min-width: 28rem) {          /* when the CARD's container is wide enough */
  .card { grid-template-columns: 8rem 1fr; }   /* go horizontal */
}
```
Container queries are supported in all current evergreen browsers. Prefer them for
anything you'll drop into multiple layout contexts.

## Reference files

- `references/patterns.md` — the core intrinsic patterns (auto-grid, sidebar, switcher,
  cluster, stack), Grid-vs-Flex decision rules, breakpoint strategy, units (`fr`,
  `min/max/clamp`, `dvh`/`svh`), nav patterns, images (`srcset`/`sizes`, aspect-ratio),
  and overflow debugging. Read when building a specific layout.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before claiming responsive)

1. Base styles are smallest-screen; enhancements use `min-width` (mobile-first)?
2. No fixed px widths on containers; using `max-width`/`clamp`/`fr`/`%`?
3. Did the layout flex intrinsically *before* you added breakpoints?
4. Breakpoints placed where content breaks (not at device names)?
5. `min-width: 0` on flex/grid children that contain long content/media?
6. Reusable components use container queries, not viewport queries?
7. At **320px** and **400% zoom**: no horizontal scroll, nothing clipped, usable?
8. Tested an in-between width (e.g. 600px, 900px), not just phone/desktop?

## How to deliver

- State the approach: "mobile-first, intrinsic auto-fit grid (zero breakpoints), one
  `min-width: 48em` break where the hero needed two columns, container query on the
  card so it works in the sidebar too."
- Prefer the breakpoint-free pattern when it exists — fewer breakpoints = fewer bugs.
- Verify the 320px and zoom extremes and report it.
- Pair with `web-typography` (fluid type), `deslop-ui` (break the rigid equal-grid),
  `component-states` (states must hold at every width).
