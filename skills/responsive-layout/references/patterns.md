# Responsive Layout — Patterns & Decisions

Read when building a specific layout. The goal: reach for an intrinsic pattern first,
add breakpoints only where content demands.

## Grid vs Flexbox — the decision

- **Flexbox** = content-driven, one dimension at a time. Use when items should size to
  *their content* and wrap (nav bars, tag lists, toolbars, button rows, the sidebar
  pattern). Flex decides sizes from the items.
- **Grid** = layout-driven, two dimensions. Use when *you* define the structure
  (page shells, card galleries, dashboards, any row+column relationship). Grid decides
  the structure and items fit into it.
- Rule of thumb: "I have these items, lay them out" → Flex. "I have this layout, place
  things in it" → Grid. They compose — Grid for the page, Flex inside cells.

## The core intrinsic patterns (mostly no media queries)

**Auto-fit grid** — responsive card grid that wraps itself:
```css
grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
```
`auto-fit` collapses empty tracks; `min(16rem,100%)` stops overflow on tiny screens.
Use `auto-fill` instead of `auto-fit` if you want empty columns preserved.

**The Sidebar** — two columns that become one when space runs out, no query:
```css
.with-sidebar { display:flex; flex-wrap:wrap; gap:1.5rem; }
.sidebar { flex:1 1 16rem; }
.content { flex:999 1 60%; min-width:0; }
```

**The Switcher** — N columns above a threshold, 1 below, purely intrinsic:
```css
.switcher { display:flex; flex-wrap:wrap; gap:1rem; }
.switcher > * { flex-grow:1; flex-basis: calc((40rem - 100%) * 999); }
```
(When container <40rem, basis goes huge → items stack; above, they sit in a row.)

**The Stack** — consistent vertical rhythm between flow children:
```css
.stack > * + * { margin-block-start: 1rem; }
```

**The Cluster** — wrapping group with even gaps (tags, button rows):
```css
.cluster { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
```

These five cover most UI. They flex with zero breakpoints — add a query only to change
the *shape* (e.g. nav → hamburger), not to do work the patterns already do.

## Breakpoint strategy

- **Mobile-first, `min-width` only.** Base = smallest. Each query adds.
- **Pick the value from content**, then express in `em` (so breakpoints scale with user
  font-size): `@media (min-width: 48em)`. Common landmarks ≈ 40em/48em/64em/80em, but
  use what *your* content needs.
- Don't target device names — there is no "tablet width". Resize until it breaks; break
  there.
- Keep the count low. If you have six breakpoints, the layout probably isn't intrinsic
  enough — push more into Grid/Flex/clamp.

## Units & viewport

- **`fr`** for grid track shares; **`%`** sparingly; **`min()/max()/clamp()`** for
  fluid sizing (`width: min(100% - 2rem, 72rem)`).
- **`ch`** for measure (text width — see web-typography); **`rem`** for spacing.
- **Viewport height:** prefer **`dvh`/`svh`/`lvh`** over `vh` on mobile — `100vh`
  overflows under mobile browser chrome; `100dvh` accounts for it.
- Keep a `min-width: 0` (or `overflow: hidden`/`min-inline-size:0`) on flex/grid
  children with long content — the #1 cause of mystery horizontal scroll.

## Navigation

- Small screens: collapse to a disclosure ("hamburger") or a bottom bar; ensure the
  toggle is keyboard-operable and labeled (see a11y-pass).
- Use a real breakpoint where the full nav stops fitting — test by counting items, not
  by device.
- Avoid hiding important nav behind a menu on *wide* screens just for symmetry.

## Images & media

- `img { max-width:100%; height:auto; }` baseline so images never overflow.
- Use `srcset`/`sizes` to serve right-sized images per viewport (perf + sharpness).
- Reserve space with `aspect-ratio` (or width/height attrs) to prevent layout shift
  (CLS) as images load.
- `object-fit: cover` for art-directed crops; `<picture>` for true art direction.

## Overflow debugging (the horizontal-scroll hunt)
```css
* { outline: 1px solid red; }      /* find the overflowing element */
```
Common causes: a child without `min-width:0` in flex/grid; a fixed-px element wider than
the viewport; an image without `max-width:100%`; `100vw` (includes scrollbar) — use
`100%`; un-wrapped long strings/URLs (`overflow-wrap:anywhere`).
