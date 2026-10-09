# Accessibility Pass — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of WCAG 2.2, the ARIA Authoring
Practices, and WebAIM/established a11y guidance (2024–2026). Facts/standards and method
— credited lineage, own expression.

## Meta-patterns

### MP-1 · Accessibility is usability for the full range of humans
It's not a special-needs add-on; it's whether anyone using a keyboard, screen reader,
low vision, or a phone in the sun can use the thing. **Consequence:** treat a11y as part
of "does it work", not a separate phase; most fixes help everyone.

### MP-2 · Semantics carry accessibility for free; ARIA is a patch
Native elements come with role, state, and keyboard behavior built in. **Consequence:**
use the right HTML element first; reach for ARIA only when HTML can't express it. Bad
ARIA is worse than none.

### MP-3 · The keyboard is the universal input
Screen readers, switch devices, and power users all rely on keyboard operability and
visible focus. **Consequence:** the keyboard pass is the highest-yield test; if it works
by keyboard with visible focus, most of a11y follows.

### MP-4 · If a change isn't perceivable, it didn't happen
A visual-only update (toast, error, new route) is invisible to SR users. **Consequence:**
announce dynamic changes (live regions) and manage focus on navigation/modals.

### MP-5 · Automated tools are a floor, not a ceiling
Scanners catch ~a third of issues and can't judge focus order, alt quality, or ARIA
sense. **Consequence:** always add the manual keyboard + screen-reader spot check before
claiming accessible.

## Decision records

### DR-1 · Keyboard-first audit
- **Why (MP-3):** highest yield. **Apply:** tab through everything; fix reachability,
  order, traps, modal focus.

### DR-2 · Semantic HTML before ARIA
- **Why (MP-2):** built-in correctness. **Apply:** `<button>/<a>/<nav>/<label>`; ARIA
  only to fill genuine gaps; follow APG patterns for custom widgets.

### DR-3 · Visible focus, never removed
- **Why (MP-3):** WCAG 2.4.7/2.4.11. **Apply:** `:focus-visible` ≥3:1; scroll-margin so
  it's not obscured.

### DR-4 · Names on everything
- **Why (MP-1):** unnamed = unusable for SR. **Apply:** alt, labels, icon-button
  aria-label, meaningful links.

### DR-5 · Announce + manage focus on change
- **Why (MP-4):** perceivability. **Apply:** live regions for async/errors; focus to
  new view/modal; return focus on close.

### DR-6 · Contrast AA + never color-only
- **Why (MP-1):** low-vision/CB users. **Apply:** 4.5:1/3:1; pair color with text/icon/
  shape.

### DR-7 · Manual check before claiming accessible
- **Why (MP-5):** tools miss most. **Apply:** automated scan + keyboard + SR spot check;
  report what's verified.

## Principle, not property
Distills public standards (WCAG 2.2, ARIA APG) and shared a11y practice — facts and
methods, not anyone's prose. Credit the standards; write your own implementation.
