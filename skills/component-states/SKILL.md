---
name: component-states
description: >-
  Every interactive element has more than one state — design all of them. Apply
  this whenever you build or review a button, link, input, select, checkbox,
  toggle, card, menu item, tab, or any clickable/focusable component. Use it to
  avoid the usual failure: shipping only the default state and forgetting hover,
  focus, active/pressed, disabled, loading, selected, and error — so the UI feels
  dead, gives no feedback, traps users on a greyed-out button, or is unusable by
  keyboard. Trigger on cues like "build a button/input/component", "add hover/
  focus states", "the button gives no feedback", "handle the loading state",
  "disabled state", "make this interactive", or just after building any control.
  Gives the full state matrix per component, the exact CSS pseudo-classes,
  focus-visible rules, and a checklist — not vibes. Framework-agnostic. Pair with
  form-ux, empty-states, micro-motion, a11y-pass.
---

# Component States

A button isn't one thing — it's six. The most common UI defect from LLMs and rushed
builds is shipping **only the default state**: a control that looks right at rest but
doesn't respond to hover, shows no focus ring for keyboard users, gives no pressed
feedback, has a greyed-out disabled state with no explanation, and no loading state
during async work. The result feels dead and is often unusable by keyboard.

This skill is the **state matrix**: for each interactive component, every state that
must exist, what it should communicate, and the exact CSS to express it. All checkable.

## The universal state matrix

Every interactive element should account for these (not all apply to every component):

| State | Trigger | Must communicate | CSS |
|-------|---------|------------------|-----|
| **Default** | rest | "this is here / interactive" | base styles |
| **Hover** | pointer over | "you can interact" (pointer devices only) | `:hover` |
| **Focus** | keyboard tab / programmatic | "this is where you are" (keyboard) | `:focus-visible` |
| **Active / pressed** | during click/tap | "your action registered" | `:active` |
| **Disabled** | not available | "not available, and why" | `:disabled` / `[aria-disabled]` |
| **Loading** | async in progress | "working, wait" | a `data-loading` / `aria-busy` class |
| **Selected / current** | chosen / active page | "this is the active one" | `[aria-selected]`/`[aria-current]` |
| **Error / invalid** | failed validation | "something's wrong here" | `[aria-invalid]` |

The first five are the baseline for *any* control. Add selected (tabs, nav, options)
and error (form fields) where they apply.

## Non-negotiables

- **Never ship default-only.** At minimum every interactive element needs hover, focus,
  active, and (if it can be) disabled.
- **Use `:focus-visible`, not `:focus`, for the ring** — so keyboard users get a clear
  indicator while mouse users don't get a "stuck" outline. **Never** `outline: none`
  without a replacement; a visible focus indicator is a WCAG requirement.
- **Hover is not focus.** Pointer hover effects don't help keyboard users; you need a
  *separate* focus style. Don't rely on hover to convey anything essential (it doesn't
  exist on touch).
- **Disabled must be obvious and, ideally, explained.** Reduced contrast + `cursor:
  not-allowed` + `disabled`/`aria-disabled`. Better: keep the control enabled and
  explain what's missing (see `form-ux`) — a silent grey button is a dead end.
- **Async actions need a loading state.** Disable re-submit, show a spinner/label
  change, set `aria-busy`. Don't leave the user clicking a button that looks idle.
- **State changes must meet contrast.** Hover/active/selected colors still need ≥3:1
  for UI and ≥4.5:1 for text (see `color-system`/`a11y-pass`). Don't signal state by a
  color change so subtle it's invisible — or by color alone.
- **Pressed/active feedback should be instant** (~100–150ms, transform-based — see
  `micro-motion`).

## Quick-start: a fully-stated button

```css
.btn {
  --btn-bg: var(--color-primary, #2563eb);
  background: var(--btn-bg);
  color: #fff;
  border: 1px solid transparent;
  border-radius: 8px;                 /* not pill — see deslop-ui */
  padding: 0.6em 1.1em;
  cursor: pointer;
  transition: background-color 150ms ease, transform 120ms ease;
}
.btn:hover  { background: color-mix(in oklab, var(--btn-bg) 88%, black); }
.btn:active { transform: scale(0.97); }                 /* pressed feedback */
.btn:focus-visible {                                    /* keyboard focus only */
  outline: 2px solid var(--color-focus, #1d4ed8);
  outline-offset: 2px;
}
.btn:disabled,
.btn[aria-disabled="true"] {
  opacity: 0.5; cursor: not-allowed; filter: grayscale(0.2);
}
.btn[data-loading="true"] { color: transparent; pointer-events: none; position: relative; }
.btn[data-loading="true"]::after {                      /* spinner */
  content: ""; position: absolute; inset: 0; margin: auto;
  width: 1em; height: 1em; border: 2px solid #fff; border-right-color: transparent;
  border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .btn:active { transform: none; }
  .btn[data-loading="true"]::after { animation-duration: 1.2s; }
}
```
```html
<button class="btn" data-loading="false">Save</button>
<button class="btn" disabled>Save</button>
<!-- async: set data-loading="true" + aria-busy="true" while saving -->
```

## State by component (what each one needs)

- **Button:** default/hover/focus/active/disabled/loading. (+ `aria-pressed` for toggle
  buttons.)
- **Link:** default/hover/focus/active + **visited** (where meaningful); keep underline
  or another non-color cue.
- **Text input / textarea:** default/focus/disabled/**error**/**filled**/readonly;
  focus ring + clear error styling tied to a message (see `form-ux`).
- **Checkbox / radio:** default/hover/focus/checked/disabled/indeterminate (checkbox)/
  error. Style the real input or a properly-labeled custom control — keep it focusable.
- **Toggle/switch:** off/on/focus/disabled; communicate on/off by position *and* not by
  color alone.
- **Select / combobox:** default/focus/open/disabled/selected-option/error.
- **Tab / nav item:** default/hover/focus/**current** (`aria-current="page"` /
  `aria-selected`); the active one must be clearly distinct.
- **Card / list item (if interactive):** default/hover/focus/active/selected; make the
  whole thing keyboard-focusable if it's clickable.
- **Menu item:** default/hover/focus/disabled; hover and keyboard focus should look the
  same here so arrow-key users see the highlight.

## Reference files

- `references/states.md` — each state's purpose and pitfalls in depth, the
  hover-vs-focus distinction, loading/optimistic patterns, toggle/selected semantics,
  contrast for states, and the ARIA attributes that pair with each visual state.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (per interactive element)

1. Does it have hover, **`:focus-visible`**, and active styles (not just default)?
2. Is the focus indicator visible and ≥3:1 (no bare `outline:none`)?
3. Is there a disabled state that's obvious — and ideally explained, not a silent grey?
4. For async actions: a loading state that prevents double-submit + `aria-busy`?
5. For tabs/nav/options: a clear selected/current state with `aria-current`/`aria-selected`?
6. For inputs: an error state tied to a message + `aria-invalid`?
7. Do all state colors meet contrast and not rely on color alone?
8. Pressed feedback instant; motion respects `prefers-reduced-motion`?

## How to deliver

- When you build any control, deliver the full matrix and say so: "button with hover/
  focus-visible/active/disabled/loading; tab nav with aria-current."
- These are exactly the states LLMs skip (see `deslop-ui` "functional slop") — treat
  them as part of building the component, not a later pass.
- Pair with `form-ux` (input/error states), `empty-states` (loading at the region
  level), `micro-motion` (transitions), `a11y-pass` (focus + ARIA verification),
  `color-system` (state colors with contrast).
