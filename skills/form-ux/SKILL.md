---
name: form-ux
description: >-
  Forms people actually finish. Apply this whenever you build or review a form,
  input, sign-up/login, checkout, settings, or any field collection in
  HTML/React/Vue/etc. Use it to avoid the usual failures: no labels (or
  placeholder-as-label), validation that only fires on submit, vague errors
  ("Invalid input"), error messages not tied to their field, required fields
  unmarked, multi-column layouts that break the eye, wrong input types/keyboards
  on mobile, no autofill/autocomplete, disabled submit with no explanation, and
  inaccessible fields. Trigger on cues like "build a form", "sign-up / login form",
  "checkout", "add validation", "the form is confusing / people drop off", "fix
  these inputs", or "make this form accessible". Gives checkable rules — label
  patterns, when to validate, error-message formula, input types, accessibility —
  not vibes. Framework-agnostic. Pair with empty-states, micro-motion, humanize-copy.
---

# Form UX

Every product has forms, and forms are where users quit. The failures are consistent
and fixable: a field with no real label, an error that appears only after submit and
just says "Invalid", a required field you discover by failing, a mobile keyboard that's
the wrong type. None of that is a taste problem — it's a set of known rules. This skill
is those rules, each checkable.

Governing principle: **a form's job is to be completed.** Reduce effort, prevent
errors before they happen, and when an error does happen, make it instantly clear what
to fix and how.

## Non-negotiables

- **Every field has a visible, persistent `<label>`.** Placeholders are not labels —
  they vanish on input, fail contrast, and hurt accessibility. If you use the floating-
  label pattern, the label must remain visible after input. Associate with `for`/`id`.
- **Validate at the right time:** on **blur** (when the user leaves a field) for format
  checks, and again on **submit**. Don't validate on every keystroke (yelling while
  they type) — *except* to relax: clear an existing error as soon as it's fixed.
- **Error messages are specific, adjacent, and helpful.** Next to the field, not in a
  far-off summary alone; say what's wrong AND how to fix it: "Enter a valid email like
  name@example.com", not "Invalid input".
- **Mark required vs optional explicitly.** Whichever is rarer, mark it. Don't make
  users discover required fields by failing. `aria-required` + a visible marker.
- **Right input type & autocomplete.** `type="email|tel|number|url|password"`,
  `inputmode`, and `autocomplete="email|name|one-time-code|cc-number…"` so mobile shows
  the right keyboard and browsers autofill. This alone raises completion noticeably.
- **One column.** Multi-column forms break the vertical reading flow and cause skipped
  fields. Single column, logically grouped. (Exception: short related pairs like
  city/state, expiry/CVC.)
- **Never disable the submit button silently.** A greyed-out submit with no reason is a
  dead end; either keep it enabled and show errors on click, or clearly say what's
  missing.
- **Accessible by construction:** label association, `aria-invalid` on errored fields,
  `aria-describedby` pointing to the message, errors announced (`role="alert"`), focus
  moved to the first error on failed submit, visible `:focus-visible`.

## The error-message formula

`[What's wrong] + [how to fix it] (+ example)`, in plain language, blameless.

- ✗ "Invalid input" → ✓ "Enter a valid email like name@example.com"
- ✗ "Error" → ✓ "Password needs at least 8 characters"
- ✗ "Field required" (generic) → ✓ "Enter your full name"
- ✗ "Wrong" → ✓ "Card number should be 16 digits"

Tie each message to its field visually and programmatically. On submit failure, also
provide a summary at the top linking to each errored field (good for long forms and
screen readers), but the inline message is the primary.

## Quick-start: an accessible field

```html
<div class="field" data-invalid="false">
  <label for="email">Email <span class="req" aria-hidden="true">*</span></label>
  <input id="email" name="email" type="email" inputmode="email"
         autocomplete="email" required aria-required="true"
         aria-describedby="email-err" />
  <p id="email-err" class="error" role="alert" hidden>
    Enter a valid email like name@example.com
  </p>
</div>
```
```js
const input = document.querySelector('#email');
input.addEventListener('blur', validate);          // validate on leave
input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')==='true') validate(); }); // relax on fix
function validate() {
  const ok = input.validity.valid;
  input.setAttribute('aria-invalid', String(!ok));
  const err = document.querySelector('#email-err');
  err.hidden = ok; input.closest('.field').dataset.invalid = String(!ok);
}
```

## Reduce effort (completion-rate wins)

- Ask for the **fewest fields possible**; every field costs completions. Defer optional
  data to later.
- **Smart defaults & autofill** — detect country/currency, prefill where safe, support
  password managers and OTP autofill (`autocomplete="one-time-code"`).
- **Format as they go** where helpful (card number spacing) but don't block typing.
- **Show password-reveal toggles**; don't disable paste on password fields.
- **Inline help** for unusual fields (why you need it, format hints) via
  `aria-describedby`, not a tooltip-only.
- **Preserve input on error** — never clear the form. (See `empty-states` for error
  handling.)
- **Save progress** on long/multi-step forms; show a step indicator.

## Reference files

- `references/patterns.md` — field types, label/validation patterns in depth, multi-
  step forms, mobile specifics, autocomplete token reference, and a11y wiring.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before shipping a form)

1. Every field has a visible persistent label (no placeholder-as-label)?
2. Required/optional marked explicitly (and `aria-required`)?
3. Validation on blur + submit, relaxes on fix, not on every keystroke?
4. Errors specific + adjacent + "how to fix", tied via `aria-describedby`, `role="alert"`?
5. Correct `type`/`inputmode`/`autocomplete` on every field?
6. Single column; minimal fields; input preserved on error?
7. Submit never silently disabled; focus moves to first error on failed submit?
8. `:focus-visible` rings; works by keyboard and screen reader?

## How to deliver

- Build forms with validation, error states, and a11y wired from the start (these are
  the exact things models skip — see `deslop-ui` "functional slop").
- State what you did: "labels persistent, validate-on-blur, inline errors with fixes,
  email/tel types + autocomplete, single column, focus-to-error on submit."
- Pair with `empty-states` (submission error/success states), `humanize-copy` (error
  wording), `micro-motion` (gentle error reveal, not jarring).
