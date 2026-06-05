# Form UX — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of established form-design guidance
(NN/g form & error guidelines, accessibility standards, 2024–2026). Credited ideas,
own expression.

## Meta-patterns

### MP-1 · A form's only goal is completion
Every design choice either helps or hurts the user finishing. **Consequence:** judge
each field/label/validation by "does this reduce effort or error?" Cut anything that
doesn't.

### MP-2 · Prevent errors before correcting them
The best error is the one that never happens. **Consequence:** clear labels, format
hints, right input types, smart defaults, and inline validation prevent errors;
good messages are the fallback.

### MP-3 · An error must point to its cause and its fix
A message far from its field, or that only says "invalid", makes the user hunt.
**Consequence:** adjacent + specific + "how to fix", tied programmatically for AT.

### MP-4 · Memory and effort are costs
Placeholders-as-labels force memory; extra fields force effort; wrong keyboards force
fiddling. **Consequence:** persistent labels, minimal fields, correct input types and
autocomplete.

### MP-5 · Accessibility is the same thing as usability here
Label association, focus management, announced errors help everyone, not just AT users.
**Consequence:** build the a11y wiring as the default structure, not a later pass.

## Decision records

### DR-1 · Persistent visible labels
- **Why (MP-4):** no memory burden, a11y. **Apply:** top-aligned default; floating only
  if it stays visible; never placeholder-as-label.

### DR-2 · Validate on blur + submit; relax on fix
- **Why (MP-2/MP-1):** catch early without nagging. **Apply:** blur + submit create
  errors; input only clears them.

### DR-3 · Error = what + how + example, adjacent & wired
- **Why (MP-3):** instant fix. **Apply:** inline message, `aria-describedby`,
  `aria-invalid`, `role="alert"`; summary for long forms.

### DR-4 · Right type/inputmode/autocomplete
- **Why (MP-2/MP-4):** fewer errors, higher completion. **Apply:** standard tokens; OTP
  and card tokens included.

### DR-5 · One column, fewest fields
- **Why (MP-1/MP-4):** flow + effort. **Apply:** single column; defer optional data;
  group short related pairs only.

### DR-6 · Submit never silently disabled
- **Why (MP-1):** dead-ends kill completion. **Apply:** validate on click or state
  what's missing; focus to first error.

## Principle, not property
Distills shared form-UX practice; credit lineage (NN/g, WCAG) where natural; never copy
prose. Your forms are your own.
