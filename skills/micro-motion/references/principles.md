# Micro-Motion — Principles & Performance

Read when building or debugging motion. Two halves: make it *smooth* (performance) and
make it *feel right* (animation principles).

## Performance: why transform/opacity only

The browser renders in stages: layout → paint → composite. Animating a property that
changes geometry (`width`, `height`, `top/left`, `margin`, `padding`) forces **layout**
every frame (reflow) → jank. Animating `color`/`background`/`box-shadow` forces
**paint**. But `transform` and `opacity` are handled by the **compositor** on the GPU —
no layout, no paint — so they hit 60fps even on weak devices.

Rules:
- Movement → `transform: translate()`. Size → `transform: scale()`. Fade → `opacity`.
- Avoid animating layout props. If you must change real size/position, use **FLIP** or
  the **View Transitions API** (animates a before/after snapshot via transforms).
- `will-change: transform` *sparingly* on elements about to animate (it promotes a
  layer; overuse wastes memory). Remove it after, or use only on known-hot elements.
- `box-shadow` animation is paint-heavy; fake elevation changes by cross-fading a
  pseudo-element shadow (`opacity`) instead.

### FLIP (animate layout changes smoothly)
First, Last, Invert, Play: measure start (First) and end (Last) positions, apply an
inverting `transform` so it *looks* unmoved, then transition the transform to zero.
Libraries (Motion's `layout`, GSAP Flip) do this for you.

### View Transitions API (modern, progressive)
```css
@view-transition { navigation: auto; }           /* same-document/MPA */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--dur-slow); }
```
`document.startViewTransition(() => updateDOM())` for SPA state changes. Browser support
is growing (Chromium shipped, others progressing) — treat as progressive enhancement;
the DOM update still happens without it.

## Animation principles applied to UI

A few of Disney's 12 principles translate directly:
- **Slow in / slow out (easing):** real objects accelerate and decelerate → never
  linear. Ease-out for entering, ease-in for leaving.
- **Anticipation:** a tiny pre-move (e.g. scale to 0.97 on press) signals an action is
  happening.
- **Follow-through / overshoot:** a *small* overshoot can feel lively — but on serious/
  professional UI keep it subtle; big bouncy springs read as toy-like. Match energy to
  brand.
- **Staging:** direct attention through one causal sequence at a time; animate only
  elements that explain that sequence.

## Choreography & stagger

When multiple elements enter, stagger them so the eye follows a path:
```css
.item { opacity:0; transform: translateY(10px); animation: rise var(--dur-base) var(--ease-out) forwards; }
.item:nth-child(1){ animation-delay: 0ms; }
.item:nth-child(2){ animation-delay: 60ms; }
.item:nth-child(3){ animation-delay: 120ms; }   /* ~50–80ms steps */
@keyframes rise { to { opacity:1; transform:none; } }
```
Keep total orchestration under ~800ms or it feels slow. Exits usually skip the stagger
(faster, all at once).

## What to animate per interaction

| Interaction | Animate | Duration | Easing |
|-------------|---------|----------|--------|
| Hover (button/link) | bg/transform | 150ms | ease-out |
| Press | `scale(0.97)` | 120–150ms | ease-out |
| Dropdown/popover | opacity + scale from origin | 180–220ms | ease-out |
| Modal in / out | opacity + translateY/scale | 250 / 200ms | out / in |
| Toast | slide+fade in, fade out | 220 / 150ms | out / in |
| Tab/segment switch | transform indicator | 200ms | ease-in-out |
| Content loading | skeleton shimmer | loop | linear (only here) |
| Page/route | view transition / staggered reveal | 300–500ms | ease-out |

## Self-check
- [ ] Only `transform`/`opacity` animated (layout changes via FLIP/View Transitions).
- [ ] Durations 150–500ms by type; nothing sluggish (>500ms) for UI feedback.
- [ ] Non-linear easing (ease-out entrances, ease-in exits); linear only for loops.
- [ ] Every active transition explains the same current action or a distinct user-facing change.
- [ ] `prefers-reduced-motion` path: movement gated, fade or none remains, no breakage.
- [ ] No scroll-jacking; no unstoppable looping motion.
