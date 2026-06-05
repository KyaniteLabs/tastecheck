# Accessibility Pass — Ship Checklist (WCAG 2.2 AA)

Run top-down before shipping any UI. Fix as you go.

## Keyboard (highest impact)
- [ ] Tab reaches every interactive element; Shift-Tab reverses
- [ ] Enter/Space activate; Arrows work in menus/tabs/radios
- [ ] Logical focus order (DOM order; no positive tabindex)
- [ ] No keyboard traps; modals trap then return focus on close
- [ ] Visible `:focus-visible` indicator ≥3:1 at every stop
- [ ] Focus not hidden behind sticky headers/footers (2.4.11)

## Names & semantics
- [ ] Every `<img>` has alt (informative) or alt="" (decorative)
- [ ] Every input has an associated `<label>`
- [ ] Icon-only buttons have `aria-label`; decorative icons `aria-hidden`
- [ ] Links have meaningful text (not "click here")
- [ ] Real `<button>`/`<a>` (not clickable divs)
- [ ] One `<h1>`, heading levels not skipped
- [ ] Landmarks: header / nav / main / footer

## Color & contrast
- [ ] Text ≥4.5:1, large ≥3:1, UI/icons/focus ≥3:1
- [ ] Nothing conveyed by color alone (add icon/text/shape)

## Forms
- [ ] Labels + required markers (not color-only)
- [ ] Errors: `aria-invalid` + `aria-describedby` + announced (`role="alert"`)
- [ ] Focus moves to first error on submit
- [ ] No redundant re-entry (3.3.7); paste allowed in auth (3.3.8)

## Dynamic & motion
- [ ] Async updates/toasts announced via `aria-live`/`role=status|alert`
- [ ] SPA route change moves focus / announces new view
- [ ] Modal: role=dialog, aria-modal, focus trap, Esc closes, background inert
- [ ] `prefers-reduced-motion` respected; nothing flashes >3×/sec

## Targets, zoom, media (WCAG 2.2)
- [ ] Interactive targets ≥24×24px (2.5.8); drag has pointer alternative (2.5.7)
- [ ] Usable at 200% text / 400% zoom; no horizontal scroll; zoom not disabled
- [ ] Video captions; audio transcript

## Verify
- [ ] Automated scan run (axe/Lighthouse/WAVE) and findings fixed
- [ ] Manual keyboard pass done
- [ ] Screen-reader spot check on key flows done
- [ ] Reported what's fixed + what remains, with WCAG refs
