---
name: a11y-pass
description: >-
  The accessibility check everyone skips — a runnable fix pass to WCAG 2.2 AA.
  Apply this whenever you build or finish any web UI, or are asked to make
  something accessible/usable by everyone. Use it to catch and FIX the common
  failures: no keyboard operability, missing or invisible focus indicators,
  images without alt text, form inputs without labels, buttons/icons with no
  accessible name, color-only meaning, low contrast, heading levels skipped,
  div/span used as buttons, no landmarks, motion with no reduced-motion option,
  and dynamic updates that screen readers never announce. Trigger on cues like
  "make this accessible", "a11y", "accessibility audit/pass", "WCAG", "keyboard
  navigation", "screen reader", "add alt text / ARIA", "is this accessible", or
  before shipping any UI. Gives a prioritized, checkable audit + the exact fix for
  each issue — not vibes. Framework-agnostic. Complements web-design-guidelines
  (review) by being a focused fix pass; pairs with component-states, form-ux,
  color-system.
---

# Accessibility Pass (WCAG 2.2 AA)

Accessibility isn't a feature you add — it's whether people can actually use what you
built: with a keyboard, a screen reader, low vision, color blindness, a motor
impairment, or just a phone in bright sun. It's also law in many places (ADA/EN 301
549/AODA) and the same work that makes a UI usable for everyone. Most of it is cheap if
done as you build and painful if bolted on.

This skill is a **prioritized fix pass to WCAG 2.2 AA**: the issues that actually occur,
ordered by impact, each with the concrete fix. It's the focused *do-the-fixes* companion
to a review skill.

## The fastest high-impact checks (do these first)

These four catch the majority of real-world barriers:

1. **Keyboard:** Tab through the whole page. Can you reach and operate **everything**
   (links, buttons, inputs, menus, modals) with keyboard only, in a sensible order,
   with a **visible focus indicator** at every stop? If not, that's the top priority.
2. **Names:** Does every control have an accessible name? Every `<img>` an `alt`; every
   input a `<label>`; every icon-only button an `aria-label`; every link meaningful text
   (not "click here").
3. **Contrast:** Text ≥ 4.5:1 (large ≥ 3:1); UI/icons/focus rings ≥ 3:1. Nothing
   conveyed by **color alone**.
4. **Structure:** One `<h1>`, heading levels not skipped, real landmarks (`<header>`
   `<nav>` `<main>` `<footer>`), and semantic elements (`<button>`, not a clickable
   `<div>`).

## Non-negotiables (the fixes that matter most)

- **Everything works by keyboard.** All interactive elements reachable and operable via
  Tab/Enter/Space/Arrows; logical focus order; no keyboard traps. Modals trap focus
  *inside* while open and return it on close.
- **Visible focus, always.** A clear `:focus-visible` indicator ≥3:1; never
  `outline:none` without a replacement (WCAG 2.4.7 / 2.4.11).
- **Semantic HTML first, ARIA second.** Use the right element (`<button>`, `<a href>`,
  `<nav>`, `<label>`). "No ARIA is better than bad ARIA" — a native `<button>` beats
  `<div role="button">` + manual key handlers. Reach for ARIA only when HTML can't.
- **Every image/control has an accessible name.** Informative images: descriptive
  `alt`. Decorative: `alt=""`. Icon buttons: `aria-label`. Inputs: associated `<label>`.
- **Don't rely on color alone** (WCAG 1.4.1) — pair with text, icon, underline, shape.
- **Contrast meets AA** (1.4.3/1.4.11): text 4.5:1, large 3:1, UI/graphics 3:1.
- **Headings & landmarks** structure the page; don't skip levels; one `<h1>`.
- **Respect `prefers-reduced-motion`** (see `micro-motion`); no content flashing >3×/sec.
- **Announce dynamic changes** to screen readers: live regions (`aria-live`,
  `role="status"`/`role="alert"`) for async updates, errors, toasts (see `empty-states`).
- **Don't disable zoom**; layout reflows to 320px / 400% (see `responsive-layout`,
  `web-typography`).

## The prioritized audit (run top-down, fix as you go)

Detailed fixes in `references/audit.md`. The order is by user impact:

1. **Keyboard operability & focus order** — tab through; fix unreachable/trapped/illogical.
2. **Focus visibility** — ensure every focus stop shows a ≥3:1 indicator.
3. **Accessible names** — alt text, labels, `aria-label` on icon buttons, link text.
4. **Semantic structure** — real elements, headings in order, landmarks.
5. **Color & contrast** — ratios + no color-only meaning.
6. **Forms** — labels, error association, `aria-invalid`, instructions (see `form-ux`).
7. **Dynamic content** — live regions for updates; manage focus on route/modal changes.
8. **Media & motion** — captions/alt, reduced-motion, no flashing, pausable autoplay.
9. **Touch & target size** — targets ≥24×24 CSS px (WCAG 2.2 §2.5.8), spacing.
10. **Zoom & reflow** — 200% text / 400% zoom usable, no horizontal scroll.

## What's new in WCAG 2.2 (don't miss these)
- **2.4.11 Focus Not Obscured** — the focused element must not be hidden behind sticky
  headers/footers.
- **2.5.8 Target Size (Minimum)** — interactive targets ≥ 24×24 CSS px (or spacing).
- **2.5.7 Dragging Movements** — any drag action needs a single-pointer alternative.
- **3.3.7 Redundant Entry** — don't make users re-enter info already provided in a
  process.
- **3.3.8 Accessible Authentication** — don't require a cognitive test (e.g. solving a
  puzzle, retyping) with no alternative; allow paste/password managers.

## Tooling (use, but don't trust blindly)
- Automated (axe DevTools, Lighthouse, WAVE, Pa11y) catches ~30–40% of issues — run it,
  fix what it finds, but it **cannot** judge keyboard flow, focus order, alt-text
  quality, or whether ARIA makes sense. Those need the manual checks above.
- Manual: keyboard-only pass; a screen reader (VoiceOver/NVDA) on key flows; 400% zoom;
  a color-contrast checker; a CVD simulator.

## Reference files

- `references/audit.md` — the full prioritized audit with the exact fix and code for
  each issue (keyboard, focus, names, ARIA patterns, contrast, forms, live regions,
  modals, target size, reflow), plus the manual test scripts.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (the ship gate)

1. Full keyboard pass: everything reachable/operable, logical order, no traps?
2. Visible `:focus-visible` (≥3:1) at every stop; focus not obscured by sticky UI?
3. Every image has alt (or `alt=""`); every input a label; icon buttons named?
4. Semantic elements (real `<button>`/`<a>`), headings in order, landmarks present?
5. Contrast AA (4.5:1 / 3:1) and nothing color-only?
6. Form errors associated + announced; `aria-invalid` set?
7. Dynamic updates announced via live regions; focus managed on modal/route change?
8. Targets ≥24px; reduced-motion respected; usable at 400% zoom?
9. Ran an automated scan AND did the manual keyboard + screen-reader spot check?

## How to deliver

- Run the audit top-down and **fix as you go**, then report what was fixed and what
  remains, with WCAG references: "added skip link, focus rings, alt text on 6 images,
  labeled the search input, fixed the 2.9:1 muted text to 4.6:1; remaining: video needs
  captions."
- Prefer semantic HTML fixes over ARIA bolt-ons.
- Don't claim "accessible" from an automated scan alone — state that you did the manual
  keyboard + SR checks.
- Pair with `component-states` (focus/disabled), `form-ux` (labels/errors),
  `color-system` (contrast), `responsive-layout` + `web-typography` (zoom/reflow),
  `web-design-guidelines` (broader review).
