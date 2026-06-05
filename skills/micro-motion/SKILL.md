---
name: micro-motion
description: >-
  Animation that feels expensive, not annoying. Apply this whenever you add,
  tune, or review motion on the web — hovers, button/press feedback, page-load and
  scroll reveals, modal/drawer transitions, loading and skeleton states, list
  reordering, toasts. Use it to avoid the usual failures: everything animating at
  once, slow/laggy durations, linear easing, bouncy springs on serious UI,
  janky animation of layout properties (width/height/top/left) instead of
  transform/opacity, motion with no prefers-reduced-motion fallback, and gratuitous
  scroll-jacking. Trigger on cues like "add animations", "make it feel polished/
  premium", "the animations feel cheap/janky", "smooth transitions", "page load
  animation", "hover effects", or "respect reduced motion". Gives checkable values
  — durations, easing curves, the properties safe to animate, the 30% rule — plus a
  reduced-motion contract. Framework-agnostic (CSS-first; Motion/Framer notes).
---

# Micro-Motion

Good motion is felt, not noticed. It confirms actions, shows where things come from
and go, and guides the eye — in well under half a second. Bad motion is the opposite:
slow, everywhere at once, bouncy where it should be crisp, and animating the wrong
properties so it stutters. The line between "premium" and "cheap/annoying" is mostly
**duration, easing, restraint, and which property you animate** — all checkable.

The governing idea: **motion has meaning.** Every animation should answer "what just
happened / where did this come from / what should I look at?" If it answers nothing,
cut it.

## Non-negotiables (the rules that keep motion feeling good)

- **Animate `transform` and `opacity`, basically nothing else.** These are GPU-
  composited and don't trigger layout/paint, so they stay 60fps. Animating `width`,
  `height`, `top/left`, `margin` causes layout thrash and jank. Need a size/position
  change? Use `transform: scale()/translate()` (or the FLIP technique / View
  Transitions API), not the layout properties.
- **Durations: 150–300ms for most UI.** Hovers/small state ~150ms; entrances/modals
  ~200–300ms; larger/page transitions ~300–500ms max. Under ~100ms isn't perceived;
  over ~500ms feels slow. Exits are often slightly faster than entrances.
- **Easing: never linear for UI.** Real things accelerate and decelerate. Use
  ease-out for entrances (fast→settle), ease-in for exits, ease-in-out for moves.
  Linear is only for continuous loops (spinners, marquees).
- **Restraint — the 30% rule.** No more than ~30% of interactive elements on a screen
  should be animating. Don't animate everything; one well-orchestrated moment beats
  scattered fidgets.
- **Always provide a `prefers-reduced-motion` fallback.** Replace movement/scale with
  a simple opacity fade (or nothing). This is an accessibility requirement, not a
  nicety — large motion can trigger vestibular illness.
- **Never animate on a loop without reason, never scroll-jack.** Auto-playing infinite
  motion and hijacked scrolling are the top "annoying" complaints and can fail WCAG
  2.2.2 (pause/stop/hide).

## Easing & duration tokens (use these)

```css
:root {
  --dur-fast: 150ms;     /* hover, small toggles */
  --dur-base: 220ms;     /* entrances, dropdowns */
  --dur-slow: 320ms;     /* modals, drawers, page reveals */

  --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);    /* entrances — snappy then settle */
  --ease-in:   cubic-bezier(0.7, 0, 0.84, 0);     /* exits */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* moves between two states */
}
.btn { transition: transform var(--dur-fast) var(--ease-out),
                    background var(--dur-fast) var(--ease-out); }
.btn:active { transform: scale(0.97); }            /* press feedback, transform only */
```
The custom ease-out above ("the expensive one") starts fast and decelerates into
place — it's what makes motion read as crafted versus the mushy default `ease`.

## The reduced-motion contract (always include)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
/* Better: design the reduced variant — keep a gentle fade, drop the movement */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(12px); transition:
            opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
  .reveal.in { opacity: 1; transform: none; }
}
```
The pattern that matters: gate the *movement* behind `no-preference`, so reduced-motion
users still get a (motionless) fade and never a broken layout.

## Patterns that read as premium

- **Orchestrated page load:** one staggered reveal of hero elements via
  `animation-delay` (or stagger index), each 200–300ms ease-out, total under ~800ms.
  Far more delight than scattered hover effects (this is straight from Anthropic's
  frontend guidance).
- **Press feedback:** `transform: scale(0.97)` on `:active`, 150ms. Cheap, universal,
  satisfying.
- **Entrance from origin:** menus/popovers scale+fade *from* their trigger
  (`transform-origin`) so they feel connected, not teleported.
- **Skeletons over spinners** for content loading (see `empty-states`): a subtle
  shimmer communicates structure; spinners communicate "stuck."
- **List changes:** animate reorder/add/remove with FLIP or the View Transitions API,
  not by animating layout properties.

## Reference files

- `references/principles.md` — performance (compositor, transform/opacity, will-change,
  FLIP, View Transitions), the 12-principles-applied (easing, anticipation, follow-
  through), stagger, choreography, and what to animate per interaction type.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## How to deliver

- State the tokens used: "entrances 220ms ease-out (custom 0.16,1,0.3,1), press
  scale 0.97 at 150ms, one staggered hero load, full reduced-motion fallback."
- Default to **CSS** for HTML/components; reach for the Motion library (React) only
  when you need spring physics, gestures, or layout animations CSS can't do.
- Verify: nothing animates layout props; reduced-motion path tested; under the 30%
  rule; no scroll-jacking; total page-load motion < ~800ms.
- Pairs with `empty-states` (loading/skeleton), `deslop-ui` (one signature moment,
  not blob animations), `form-ux` (validation feedback motion).
