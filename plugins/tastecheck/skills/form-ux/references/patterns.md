# Form UX — Patterns in Depth

Read when building real forms. Specifics on labels, validation, mobile, multi-step,
autocomplete, and accessibility wiring.

## Labels: the patterns, ranked

1. **Top-aligned visible label** (default best) — label above the field. Fastest to
   scan, works on mobile, never clips. Use this unless you have a reason not to.
2. **Floating label** — label sits as placeholder, animates above on focus/input. OK in
   2026 *if* the label ends up visible and the empty-state still reads as a label, not
   just a hint. Don't use a pure shrinking placeholder that disappears.
3. **Placeholder-as-label** — never. It vanishes on input (memory burden), usually
   fails contrast, and breaks screen readers. Placeholders are for *examples* only
   ("name@example.com"), supplementary to a real label.
4. **Left-aligned label** — slows scanning; avoid except dense settings forms.

Always associate: `<label for="x">` + `<input id="x">` (or wrap the input in the label).

## Validation timing

- **On blur:** validate format/required when the user leaves the field. This is the
  sweet spot — not nagging mid-typing, but catching errors before submit.
- **On input (relax only):** once a field is in an error state, re-validate on each
  keystroke so the error clears the instant it's fixed. Don't *create* errors on input.
- **On submit:** validate everything; block submit; move focus to the first error;
  render a summary linking to each error for long forms.
- **Async/server validation** (username taken, card declined): show a pending indicator
  on the field, then the result; preserve all other input.

## Error messages

Formula: **what's wrong + how to fix + (example)**. Plain, blameless, specific.
Tie to the field: visually adjacent + `aria-describedby` + `aria-invalid="true"` +
`role="alert"` (so it's announced when it appears). Color is not enough — include an
icon and text (don't rely on red alone).

## Input types & mobile

Set the right type and inputmode so the mobile keyboard matches:
| Data | type | inputmode | autocomplete |
|------|------|-----------|--------------|
| Email | email | email | email |
| Phone | tel | tel | tel |
| Number/qty | text | numeric | — (text+numeric avoids spinner quirks) |
| URL | url | url | url |
| Password | password | — | current-password / new-password |
| OTP code | text | numeric | one-time-code |
| Name | text | — | name (or given-name/family-name) |
| Address | text | — | street-address, postal-code, country |
| Card | text | numeric | cc-number, cc-exp, cc-csc |

Autocomplete tokens are a big completion win — browsers/password managers fill fields
correctly. Use the standard token names.

Mobile specifics: large enough tap targets (min ~44px), enough spacing, avoid tiny
selects (consider native pickers), don't disable zoom, ensure the focused field isn't
hidden behind the keyboard.

## Multi-step / long forms

- Break into logical steps with a **progress indicator** ("Step 2 of 4").
- **Save progress** so a refresh/back doesn't wipe everything.
- Validate each step before advancing; allow going back without data loss.
- Show a review step before final submit for high-stakes forms (checkout).

## Controls

- **Radio vs select:** ≤5 options → radios (all visible); more → select. Never a select
  for 2 options (use radios/toggle).
- **Checkbox** for independent booleans; **toggle** for instant on/off settings.
- **Don't disable submit silently** — either keep enabled and validate on click, or
  show exactly what's missing. A dead grey button is a top drop-off cause.
- **Destructive actions** need confirmation and clear labeling.

## Accessibility wiring (summary)
- `<label for>`/`id` on every control; group related with `<fieldset>`/`<legend>`.
- `aria-required`, `aria-invalid`, `aria-describedby` (help + error).
- Errors `role="alert"`; on failed submit, move focus to first error; summary links to
  fields.
- Visible `:focus-visible`; full keyboard operability; don't trap focus.
- Sufficient contrast on labels, borders (≥3:1), and error text (≥4.5:1).
