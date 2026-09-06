# Tastecheck self-pass report

Captured offline on 2026-09-06. Scope: `index.html`, the committed default-route captures at 390/768/1280, the closed 27-check catalog, and the existing local receipts. No installs or network access were used.

## Verdict

Release gate result: `HOLD`

Release eligible: `false`

Command run exactly:

`node skills/tastecheck-pass/assets/release-gate.mjs --input .checkyourself/tc-self-ledger.json --verifier-root . --artifact-root .`

The following are the release gate's remaining blockers verbatim:

- direction:system
- foundation:color
- foundation:typography
- foundation:spacing
- foundation:theming
- structure:responsive-layout
- structure:form-ux
- surface:micro-motion
- surface:data-viz
- surface:art-direction
- verification:a11y
- verification:cognitive-a11y
- verification:i18n
- verification:deslop-ui
- verification:humanize-copy
- browser:rendering
- browser:zoom-400
- browser:keyboard
- browser:theme-contrast
- browser:reduced-motion
- browser:cold-load
- browser:shadow-iframe
- gate:artifact-spec
- gate:required-evidence
- gate:blocker-handoff

## Ledger coverage

The catalog contains 27 checks. The ledger contains 11 evidence rows and a complete frozen subject inventory. Sixteen checks remain absent because their contracts require either an independent human review or live browser evidence that was not honestly available:

- direction:system
- surface:micro-motion
- surface:data-viz
- surface:art-direction
- verification:cognitive-a11y
- verification:i18n
- verification:deslop-ui
- verification:humanize-copy
- browser:rendering
- browser:zoom-400
- browser:keyboard
- browser:theme-contrast
- browser:reduced-motion
- browser:cold-load
- browser:shadow-iframe
- gate:blocker-handoff

The absent rows are deliberately not fabricated. Existing evidence was retained inside the applicable rows: `node tools/verify.mjs` passed in `.checkyourself/challenge-runs/S12.receipt.json`; the NIMA lane recorded 13 passed and 0 failed in `.checkyourself/challenge-runs/S11.receipt.json`; and the three committed capture hashes remain in the responsive evidence.

## Measured observations

- Color: OKLCH tokens were converted to rendered sRGB and checked with WCAG ratios. Dark `--ink` on `--bg` is 16.87:1 and dark `--line` on `--bg` is 1.57:1 (UI failure). Light text/body examples are 16.47:1 and 7.60:1; light `--line` is 2.30:1 (UI failure). The authored contrast mode measures 20.33:1 for ink/body and 8.39:1 for line/UI.
- Typography: body is 16px with unitless 1.6 leading; h1 is 48–96px; lede is 17.92–23.2px; h2 is 33.6–54.4px; lede measure is 42ch and section copy measure is 54ch. Five local font faces are declared, but live font readiness was not proven. The release-facts text at source lines 2–4 is outside `<html>` and clips in the 390px and 768px captures.
- Spacing: no `--space-*` ladder exists. Measured literal values include 6.4, 7.2, 8, 8.8, 10.4, 11.2, 12.8, 14.4, 16, 19.2, 22.4, 25.6, 30.4, 40, and 48px; section padding is 56–104px.
- Theming: dark, light, and prefers-contrast role blocks contain 10+ semantic values, but live per-theme state measurements and no-flash proof are absent.
- Responsive layout: captures are 390×2400, 768×2400, and 1280×2400. The 390px and 768px views show clipped pre-document release text; all three retain low-opacity scroll-reveal content in the lower page. The responsive CSS contains 6/4/2-column bento breakpoints at wide/900px/560px and a 1-column problem layout below 760px.
- Component states: Default, Loading, and Disabled are present on a native button; loading is 900ms; focus is a 2px copper outline with 3px offset. The retained NIMA receipt says 13 passed and 0 failed.
- Form UX: one visible `email` label, `type=email`, `autocomplete=email`, and `aria-describedby=email-msg`; messages cover empty, incomplete, valid, and error states with repair on input after error. There are zero submit controls, so submission recovery is false.
- Empty states: loading, empty, error, and retry are represented by four states; the region uses `role=status` and `aria-live=polite`; two recovery buttons are present.
- Static a11y: one main, one h1, one skip link, 10 named buttons, one labeled input, focus-visible CSS, reduced-motion CSS, and forced-colors CSS are present. The invalid pre-document text and capture defects keep the check failed.
- Artifact gate: `index.html` is 54,325 bytes with SHA-256 `82c6e974cd0b2d1954d034a6cd2ee3d6f0201de38b85c3f188262aa9b2ccd1d1`. The measured closure contains `favicon.ico` (70 bytes) and `index.html`, with manifest SHA-256 `b4534aa733c82de3ec4a9b2c37c3056482defb19cb4cc9b39ac0ce88a0ce33f3`. `site/DESIGN-SYSTEM.md` is 3,627 bytes with SHA-256 `f071b6c0d85d99c896fab00f3be9ea91c4080c247e3bdb208f28eaee0b869c4c`, but is not bound in the dependency manifest.

## Browser boundary

A fresh local Chrome/CDP launch aborted with SIGABRT before exposing DevToolsActivePort. The report therefore makes no claims for keyboard, 400% zoom, theme-contrast, reduced-motion setting, cold-load console state, shadow/iframe inspection, or the subjective browser-rendering review. The committed PNGs are used only where their dimensions, hashes, and visible source-derived defects are honestly measurable.

## Gate validation errors

The gate returned these validation errors verbatim:

- direction:system: missing ledger row
- surface:micro-motion: missing ledger row
- surface:data-viz: missing ledger row
- surface:art-direction: missing ledger row
- verification:cognitive-a11y: missing ledger row
- verification:i18n: missing ledger row
- verification:deslop-ui: missing ledger row
- verification:humanize-copy: missing ledger row
- browser:rendering: missing ledger row
- browser:zoom-400: missing ledger row
- browser:keyboard: missing ledger row
- browser:theme-contrast: missing ledger row
- browser:reduced-motion: missing ledger row
- browser:cold-load: missing ledger row
- browser:shadow-iframe: missing ledger row
- gate:blocker-handoff: missing ledger row

## IMPROVEMENTS

- Improve dependency closure discovery. Why it matters: inline CSS references to five fonts and the basalt image were absent from the measured two-asset closure, so the spec/asset relationship cannot be bound automatically. Concrete fix: make the artifact scanner parse inline `<style>` blocks and include `site/fonts/*`, `site/img/basalt-copper.png`, and `site/DESIGN-SYSTEM.md` in the declared manifest.
- Improve cold-load reveal behavior. Why it matters: the committed captures retain lower content at low opacity and narrow captures show the pre-document release text clipped, which blocks responsive and a11y confidence. Concrete fix: move release facts inside valid document structure, initialize reveal content visible until IntersectionObserver proves entry, then rerun 390/768/1280 and 320/400% browser legs.
- Improve offline browser evidence. Why it matters: the local Chrome SIGABRT removed live proof for six required browser legs. Concrete fix: add a supported browser-runner fallback or stable CDP launch preflight that records browser version, console, keyboard, theme, reduced-motion, zoom, cold-load, and shadow/iframe receipts without installing or using network.

