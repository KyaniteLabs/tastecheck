# Accessible Typography (WCAG 2.2)

Read this **before claiming type work is done**, and any time the task mentions
accessibility, a11y, contrast, or compliance. Accessible type isn't a separate
feature — it's what "readable" means for everyone. Most of these are also just good
typography. Build them in from the first version, not as a bolt-on pass.

## Contrast (WCAG 1.4.3 / 1.4.6 / 1.4.11)

Text must stand out enough from its background.

- **Normal text: ≥ 4.5:1** contrast ratio (AA). **Large text: ≥ 3:1** (AA).
  "Large" = **≥ 24px (1.5rem) regular**, or **≥ 18.66px (1.17rem) bold**.
- **AAA** (stricter, for body-heavy reading): 7:1 normal, 4.5:1 large.
- **UI components & graphics: ≥ 3:1** (1.4.11) — includes icons, form borders,
  focus indicators, chart strokes.
- **Don't use opacity to mute text** on unknown backgrounds — it changes the actual
  contrast. Use a real color that you've checked, or `color-mix()` against the known
  background. On dynamically-colored backgrounds, pick from the high-contrast end of
  your palette and verify ≥ 4.5:1 against the *computed* background.
- **Placeholder text** is text — it must meet contrast too. Don't rely on faint
  placeholders to convey labels.
- Note: APCA (the perceptual contrast model proposed for WCAG 3) is more accurate
  for real readability but is **not yet the legal standard** — meet WCAG 2.x ratios
  for compliance, and you can use APCA as an additional quality check.

## Resize text to 200% (WCAG 1.4.4)

Users must be able to enlarge text to 200% without loss of content or function.

- **Size text in `rem`/`em`, never `px`.** `px` ignores the user's browser font-size
  setting. `rem` honors it.
- **Never lock font-size to pure `vw`** — viewport units don't respond to zoom or
  user font-size (see `fluid-scale.md`). Always keep a `rem` term in `clamp()`.
- Don't set `maximum-scale=1` or `user-scalable=no` in the viewport meta tag — it
  disables pinch-zoom and fails this criterion. Use
  `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Layouts must **reflow** (1.4.10): no horizontal scrolling at 320px-equivalent /
  400% zoom. Use fluid measure (`max-width: 66ch`), not fixed pixel widths.

## Text spacing override (WCAG 1.4.12)

Users with low vision or dyslexia may force their own spacing. Your layout must not
break (no clipped or overlapping text) when **all** of these are applied:

- `line-height` ≥ **1.5×** font size
- spacing after paragraphs ≥ **2×** font size
- `letter-spacing` ≥ **0.12em**
- `word-spacing` ≥ **0.16em**

Test by injecting this and confirming nothing clips or overlaps:

```css
* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-block-end: 2em !important; }
```

The practical lesson: **avoid fixed-height text containers** and `overflow: hidden`
on text. Let containers grow with their content.

## Readability for dyslexia & low vision

- **Don't justify body text** — uneven word spacing ("rivers") is hard for everyone
  and especially disorienting for dyslexic readers. Left-align, ragged right.
- **Keep a comfortable measure** (45–75 chars) — long lines are the most-cited
  readability barrier.
- **Generous leading** (≥1.5 body) and clear paragraph spacing.
- **Adequate body size** — `1rem` (16px) minimum for body; many designs read better
  at `1.125rem`. The OMC rule of thumb: never put human-readable text below 10px,
  and that floor is for incidental labels, not body copy.
- A "dyslexia font" is not required and evidence is mixed; a clean, high-x-height
  sans with good spacing helps more. Don't override the user's font if they've set one.
- Avoid ALL-CAPS for long runs — it removes word-shape cues and slows reading. Caps
  are fine for short labels (add `letter-spacing` ~0.05–0.1em; see `modern-css.md`).
- Don't rely on **color alone** to convey meaning (1.4.1) — pair color with text,
  weight, underline, or an icon (e.g. link underlines, error icons).

## Motion (WCAG 2.3.3 / prefers-reduced-motion)

If text animates (typing effects, scroll-reveal, marquee, variable-font animation),
respect the user's OS setting:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Avoid auto-scrolling/looping text (carousels, marquees) — it fails 2.2.2 (pause,
stop, hide) unless the user can stop it.

## Semantics that affect type

- Use real heading elements (`h1`–`h6`) in order — don't fake hierarchy with a
  styled `<div>`. Screen-reader users navigate by headings.
- Set the document language (`<html lang="en">`) so the right hyphenation, quotes,
  and font fallbacks apply.
- Use `<strong>`/`<em>` for meaningful emphasis (conveyed to AT), and `<b>`/`<i>`
  only for stylistic offset without added importance.

## Quick a11y pass before "done"

1. Contrast: body ≥ 4.5:1, large ≥ 3:1, UI/icons ≥ 3:1 — checked against actual bg.
2. Zoom to 200% (and 400%): text scales, layout reflows, no horizontal scroll.
3. Apply the 1.4.12 text-spacing override: nothing clips or overlaps.
4. `rem`-based sizes; no pure-`vw` font-size; zoom not disabled in viewport meta.
5. Real headings in order; body ≥ 16px; not justified; reasonable measure.
6. `prefers-reduced-motion` honored if any text animates.
