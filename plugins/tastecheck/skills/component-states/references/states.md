# Component States — In Depth

Read when building a specific control or debugging "it feels dead / unusable by
keyboard." Each state has a job; skipping one removes feedback the user relies on.

## Each state, its job, and its pitfall

- **Default** — communicates "this exists and is interactive." Pitfall: a button that
  looks like static text (no affordance). Give interactive things an affordance.
- **Hover** — "you can act on this" for *pointer* users. Pitfall: putting essential
  info only in hover (invisible on touch and to keyboard). Hover is an enhancement.
- **Focus** — "your keyboard is here." The most-skipped and most-critical state.
  Pitfall: `outline:none` with no replacement → keyboard users are lost (and it fails
  WCAG 2.4.7). Use `:focus-visible` so it shows for keyboard, not mouse clicks.
- **Active/pressed** — "your press registered," instant. Pitfall: no feedback, so users
  double-click. A quick `scale(0.97)` or color shift fixes it.
- **Disabled** — "not available." Pitfalls: (1) invisible — looks the same as enabled;
  (2) silent — no reason given. Reduce contrast + `not-allowed` cursor, and prefer
  explaining why (or keeping it enabled and validating on click).
- **Loading** — "working." Pitfall: button looks idle during async → repeat clicks,
  duplicate submits. Disable interaction, show spinner/label change, set `aria-busy`.
- **Selected/current** — "this is the active one" (tab, nav, chosen option). Pitfall:
  active item indistinguishable from the rest. Make it clearly distinct + ARIA.
- **Error/invalid** — "fix this." Pitfall: red border only (color-only, fails CB users)
  with no message. Pair with icon + text + `aria-invalid` (see `form-ux`).

## Hover vs focus — keep them separate, on purpose

- **Hover ≠ focus.** Mouse users hover; keyboard users focus. They are different inputs
  and need different (sometimes matching) styles.
- Use **`:focus-visible`** for the keyboard ring so a mouse click on a button doesn't
  leave a lingering outline, while Tab navigation does show one.
- For **menu items and listbox options**, make hover and focus look *the same* (a shared
  "highlighted" style) so arrow-key users see exactly what a mouse user would.
- Never convey required interactivity via hover alone — touch has no hover.

```css
/* shared highlight for menu items: hover OR keyboard focus */
.menu-item:hover,
.menu-item:focus-visible { background: var(--color-surface-2); }
```

## Loading & optimistic patterns

- **Button loading:** disable pointer events, swap label for spinner (or append one),
  set `aria-busy="true"`; restore on completion/error. Prevent double-submit.
- **Region loading:** use a skeleton (see `empty-states`), not a button spinner, for
  whole sections.
- **Optimistic UI:** for high-success actions (like, toggle), reflect the result
  immediately and reconcile on response, with a rollback on failure — feels instant,
  no spinner.

## Toggle / selected semantics (visual + ARIA must agree)

- Toggle button: `aria-pressed="true|false"`; show state by more than color (position,
  fill, check).
- Switch: role/`aria-checked`; communicate on/off by knob position, not just color.
- Tabs: `role="tab"` + `aria-selected`; the panel `aria-labelledby` the tab.
- Current nav link: `aria-current="page"`; style distinctly (not color-only).
- The visual selected state and the ARIA state must always match — screen-reader and
  sighted users should perceive the same thing.

## Contrast for states (don't make state invisible — or color-only)

- State changes still must meet contrast: UI/non-text ≥ 3:1, text ≥ 4.5:1 (see
  `color-system`, `a11y-pass`).
- Derive hover/active by nudging lightness (`color-mix`), not by adding opacity over
  arbitrary backgrounds.
- Never signal a state by **color alone** — pair with shape, icon, underline, position,
  or weight (WCAG 1.4.1). E.g. a selected tab gets an underline/indicator, not just a
  hue change.

## ARIA ↔ visual state cheat sheet
| Visual state | ARIA / attribute |
|---|---|
| disabled | `disabled` (native) or `aria-disabled="true"` |
| loading | `aria-busy="true"` |
| toggle on/off | `aria-pressed` |
| switch/checkbox | `aria-checked` / native `checked` |
| selected tab/option | `aria-selected` |
| current page/step | `aria-current` |
| invalid field | `aria-invalid="true"` + `aria-describedby` → message |
| expanded menu/accordion | `aria-expanded` |

## Self-check
- [ ] Hover, `:focus-visible`, active all present; focus ring visible & ≥3:1.
- [ ] Disabled obvious (and explained where possible), not a silent grey.
- [ ] Async → loading state, double-submit prevented, `aria-busy`.
- [ ] Selected/current and error states where applicable, with matching ARIA.
- [ ] No state by color alone; all state colors meet contrast.
- [ ] Menu/option hover and keyboard focus share a highlight.
