# Accessibility Audit — Issues & Fixes (WCAG 2.2 AA)

Run top-down; fix as you go. Each item: the test, the failure, the fix with code.

## 1. Keyboard operability & focus order (highest impact)
**Test:** unplug the mouse. Tab/Shift-Tab through everything; Enter/Space to activate;
Arrows within composite widgets (menus, tabs, radios).
**Failures & fixes:**
- Clickable `<div>`/`<span>` not reachable → use `<button>`/`<a href>`. If truly stuck
  with a div: `tabindex="0"` + `role` + key handlers for Enter/Space — but prefer native.
- Illogical order → fix DOM order (don't patch with positive `tabindex`; avoid
  `tabindex` > 0 entirely).
- Keyboard trap (focus can't leave a widget) → ensure Esc/Tab exits; only modals should
  trap, and they must release on close.
- Custom widgets → follow the ARIA Authoring Practices keyboard model (e.g. tabs:
  Arrow to move, Enter/Space to select).

## 2. Focus visibility (WCAG 2.4.7 / 2.4.11)
**Test:** every Tab stop shows a clear indicator; it's not hidden behind sticky bars.
**Fix:**
```css
:focus-visible { outline: 2px solid var(--color-focus, #1d4ed8); outline-offset: 2px; }
```
Never `outline:none` without replacement. For sticky headers, add `scroll-margin-top`
to focus targets so they aren't obscured (2.4.11):
```css
:target, a, button { scroll-margin-top: 5rem; }
```

## 3. Accessible names
- **Images:** informative → descriptive `alt` ("Bar chart: revenue up 30% in Q2");
  decorative → `alt=""` (or `role="presentation"`); complex → longer description nearby.
- **Icon-only buttons:** `aria-label="Close"`; ensure the icon SVG is `aria-hidden="true"`.
- **Inputs:** `<label for>`/`id`, or wrap; never placeholder-as-label (see form-ux).
- **Links:** meaningful text; avoid "click here"/"read more" alone (or add
  `aria-label`); a link's purpose should be clear from its text.
- **Buttons:** text content or `aria-label`; verify with the accessibility inspector.

## 4. Semantic structure
- **Headings:** exactly one `<h1>`; don't skip levels (h2→h4); headings describe
  sections, not styled for size (use CSS for size — see web-typography).
- **Landmarks:** `<header> <nav> <main> <footer>` (and `<aside>`); one `<main>`. Lets SR
  users jump by region.
- **Lists/tables:** real `<ul>/<ol>` and `<table>` with `<th scope>` + `<caption>` for
  data tables (not layout tables).
- **Buttons vs links:** `<a>` navigates (has href, goes somewhere); `<button>` acts
  (submits, toggles, opens). Don't swap them.

## 5. Color & contrast (1.4.3 / 1.4.11 / 1.4.1)
- Text ≥ 4.5:1, large (≥24px / ≥18.66px bold) ≥ 3:1; UI components, icons, focus rings,
  chart strokes ≥ 3:1. Measure with a checker (see color-system).
- **No color-only meaning:** error isn't just red — add icon/text; links in body text
  get an underline or other non-color cue; chart series get labels/patterns.
- Don't mute text with opacity below thresholds.

## 6. Forms (see form-ux for full)
- Every field labeled; required marked (not color-only); instructions before the input.
- Errors: `aria-invalid="true"` + message tied via `aria-describedby` + announced
  (`role="alert"`); on submit, move focus to first error; summary for long forms.
- Group related controls with `<fieldset>`/`<legend>` (radios, checkboxes).
- WCAG 2.2: don't force redundant entry (3.3.7); allow paste/password managers in auth
  (3.3.8).

## 7. Dynamic content (SPA / async / toasts)
- **Announce updates** SR users can't see happen:
```html
<div aria-live="polite" role="status">Saved.</div>   <!-- non-urgent -->
<div aria-live="assertive" role="alert">Upload failed.</div>  <!-- urgent -->
```
  The live region must exist in the DOM before you write into it.
- **Route changes (SPA):** move focus to the new page's `<h1>`/main and/or announce the
  new title — otherwise SR/keyboard users are stranded.
- **Modals/dialogs:** `role="dialog"` + `aria-modal="true"` + label; trap focus inside;
  Esc closes; **return focus** to the trigger on close; mark background `inert`/
  `aria-hidden`.
- **Disclosure/accordion:** `aria-expanded` on the trigger; `aria-controls` the panel.

## 8. Media & motion
- Video: captions (1.2.2) + audio description where needed; audio: transcript.
- `prefers-reduced-motion`: gate non-essential motion (see micro-motion).
- No content flashing more than 3×/sec (2.3.1 — seizure risk).
- Autoplaying audio/carousels: provide pause/stop (2.2.2).

## 9. Touch & target size (WCAG 2.2)
- Interactive targets ≥ **24×24 CSS px** (2.5.8), or adequate spacing; aim 44px for
  primary touch actions.
- Drag actions need a single-pointer alternative (2.5.7).
- Don't rely on path-based or multipoint gestures without a simple alternative (2.5.1).

## 10. Zoom & reflow
- Text resizable to 200% (1.4.4); page usable at 400% zoom / 320px with no horizontal
  scroll (1.4.10 — see responsive-layout).
- Don't set `user-scalable=no`/`maximum-scale=1`.
- Survives the 1.4.12 text-spacing overrides (see web-typography).

## Manual test scripts
- **Keyboard:** Tab through start→end and back; activate each control; open/close every
  menu/modal; confirm focus returns sensibly.
- **Screen reader:** VoiceOver (⌘F5 mac) or NVDA; navigate by heading (H), landmark, and
  form field; confirm names/roles/states read correctly; trigger an async update and
  confirm it's announced.
- **Zoom:** browser zoom 400%; check reflow, no clipping, focus not obscured.
- **Contrast/CVD:** checker on text + UI; CVD simulator for color-only reliance.
- **Automated:** axe/Lighthouse/WAVE — fix findings, but treat as a floor, not proof.
