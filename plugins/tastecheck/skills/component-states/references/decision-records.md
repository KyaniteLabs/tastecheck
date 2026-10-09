# Component States — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of established interaction-state
guidance (Material states, NN/g button states, WCAG focus criteria, 2024–2026).
Credited ideas, own expression.

## Meta-patterns

### MP-1 · An interactive element is a set of states, not one picture
Rendering only the default is the core defect. **Consequence:** treat "build a button"
as "build its state matrix"; default-only is incomplete, not done.

### MP-2 · Feedback is the contract of interactivity
Every user action expects a visible response (hover affordance, pressed confirmation,
loading acknowledgement). **Consequence:** missing feedback = the UI feels broken even
when it works. Always confirm the action.

### MP-3 · Keyboard and pointer are different users
Hover serves pointers; focus serves keyboards; touch has neither hover nor precise
focus. **Consequence:** never put essential meaning in hover; always provide a visible
`:focus-visible` state; sometimes hover and focus should match (menus).

### MP-4 · Disabled is a communication, not just a lockout
A greyed control that doesn't say why is a dead end. **Consequence:** make disabled
obvious and explain the blocker, or keep it enabled and validate on click.

### MP-5 · Visual state and assistive state must agree
A sighted user and a screen-reader user must perceive the same state. **Consequence:**
pair every visual state with the right ARIA (`aria-pressed/selected/current/busy/
invalid`) and never rely on color alone.

## Decision records

### DR-1 · Never default-only
- **Why (MP-1):** completeness. **Apply:** minimum hover + focus-visible + active +
  disabled on every control; add loading/selected/error where relevant.

### DR-2 · :focus-visible, never bare outline:none
- **Why (MP-3):** keyboard usability + WCAG 2.4.7. **Apply:** visible ring ≥3:1 via
  `:focus-visible`; if removing default outline, replace it.

### DR-3 · Confirm async with loading
- **Why (MP-2):** prevent double-submit, acknowledge. **Apply:** disable + spinner/label
  + `aria-busy`; or optimistic UI with rollback.

### DR-4 · Disabled explains itself
- **Why (MP-4):** no dead ends. **Apply:** clear disabled styling + reason, or enabled +
  validate-on-click (see form-ux).

### DR-5 · State never by color alone; always meets contrast
- **Why (MP-5):** CB users + WCAG 1.4.1/1.4.11. **Apply:** pair color with icon/shape/
  position; verify ≥3:1 UI / ≥4.5:1 text.

### DR-6 · ARIA matches the visual
- **Why (MP-5):** parity. **Apply:** map each visual state to its ARIA attribute.

## Principle, not property
Distills shared interaction-state practice; credit lineage (Material, NN/g, WCAG) where
natural; never copy prose. Your components are your own.
