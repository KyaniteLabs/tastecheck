---
name: dark-mode
description: >-
  Dark mode that doesn't suck. Apply this whenever you add, fix, or review a dark
  theme for a website or app in CSS/Tailwind/React/etc. Use it to avoid the
  classic failures: pure-black backgrounds (#000) that vibrate against white text,
  saturated colors that glow and smear, shadows that disappear, elevation faked
  with shadows instead of lighter surfaces, brand colors that fail contrast on
  dark, and images/illustrations that blind the user. Trigger on cues like "add
  dark mode", "the dark theme looks bad/harsh", "fix dark mode contrast",
  "everything glows in dark mode", "support prefers-color-scheme", or "make a
  proper light/dark toggle". It gives checkable values (surface ramps, exact
  hex/OKLCH, contrast targets, elevation-by-lightness) plus token architecture —
  not vibes. Framework-agnostic. Pair with color-system for the palette and
  web-typography for text.
---

# Dark Mode

Dark mode isn't "light mode with the colors flipped." Flipping `#fff`↔`#000` and
calling it done is the #1 reason dark themes look harsh and amateur. Good dark mode
is its own design system with its own rules — because the eye behaves differently on
a dark field: pure white text on pure black vibrates, saturated colors bloom and
smear, and drop-shadows (which rely on darkness) stop reading as depth.

This skill gives the concrete rules and values that make dark mode comfortable, plus
the token architecture so light and dark stay in sync. Every rule is checkable.

## The decision order

1. **Surfaces first** — define a dark surface *ramp* (not one black). Background is
   the darkest; every elevation step gets *lighter*, not a shadow.
2. **Text** — off-white on dark-gray, at the right contrast (not pure white on pure
   black). Use opacity-tiers or explicit grays for secondary text.
3. **Color** — desaturate and lighten every accent for the dark field; re-check
   contrast against dark surfaces (a brand color that passes on white often fails).
4. **Elevation & depth** — communicate with lighter surfaces (and subtle borders),
   not shadows. Shadows still help for truly-floating UI but are secondary.
5. **Tokens** — semantic variables (`--surface`, `--text`, `--accent`) that swap by
   theme, so components never hard-code a color.
6. **Media** — dim images/illustrations, handle transparent PNGs, fix code blocks.

## Non-negotiables (the rules that prevent harsh dark mode)

- **Never pure black (`#000`) for large surfaces.** Pure black + pure white maxes out
  contrast so edges vibrate and eye strain spikes; it also makes shadows invisible.
  Base background ≈ `#121212`–`#1a1a1a` (Material's baseline is `#121212`).
- **Never pure white (`#fff`) for body text.** Use off-white ≈ `#e6e6e6`–`#ececec`.
  Aim for high-but-not-maximum contrast (roughly 15:1, not 21:1).
- **Desaturate accents.** Saturated colors "vibrate"/bloom on dark. Lower chroma and
  raise lightness versus the light-mode version. (OKLCH makes this one-line; see
  `color-system`.)
- **Elevation = lighter surface, not shadow.** On dark, higher = lighter. Shadows
  barely show on dark, so a card that's "raised" should be a lighter gray than its
  background. (This is the single biggest "looks pro vs amateur" tell.)
- **Re-test all contrast on the dark surfaces.** WCAG still applies: body ≥ 4.5:1,
  large/UI ≥ 3:1 — measured against the actual dark surface, not assumed.
- **Don't ship one theme as the inverse of the other.** Tokens swap; values are tuned
  per theme. Test both.

## Quick-start: surface ramp + tokens

A comfortable dark palette uses a *ramp* of surfaces. Each elevation step is lighter.

```css
:root {
  color-scheme: light;
  --bg:        #ffffff;
  --surface-1: #f7f7f8;   /* cards */
  --surface-2: #efeff1;   /* raised */
  --text:      #1a1a1a;
  --text-muted:#5b5b5e;
  --border:    #e3e3e6;
  --accent:    oklch(0.55 0.16 250);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;                 /* themes native form controls + scrollbars */
    --bg:        #121212;               /* never #000 */
    --surface-1: #1e1e20;               /* +1 elevation = lighter */
    --surface-2: #26262a;               /* +2 elevation = lighter still */
    --text:      #ececec;               /* never #fff */
    --text-muted:#a0a0a6;
    --border:    #34343a;               /* subtle border doubles as elevation cue */
    --accent:    oklch(0.72 0.12 250);  /* lighter + less chroma than light mode */
  }
}
/* Manual override (class on <html>) beats the media query when user toggles */
:root[data-theme="dark"] { /* …same dark block… */ }

body { background: var(--bg); color: var(--text); }
.card    { background: var(--surface-1); border: 1px solid var(--border); }
.card.raised { background: var(--surface-2); }
```

`color-scheme` is important and often missed: it tells the browser to render native
form controls, scrollbars, and `<input>` defaults in dark — without it those stay
blindingly light. A more complete starter (toggle JS, elevation overlay model, media
handling) is in `assets/dark-starter.css`.

## Reference files

- `references/surfaces-and-elevation.md` — the surface ramp, the elevation-by-
  lightness model (incl. Material's translucent-white-overlay technique), borders,
  and why shadows fail on dark. Read when building the surface system.
- `references/color-and-contrast.md` — desaturating accents, semantic state colors
  (success/error/warning) on dark, contrast re-testing, OKLCH conversions, and
  handling brand colors that fail. Read when colors look wrong or glow.
- `references/decision-records.md` — meta-patterns and ADR-style rules for novel cases.

Also handle, when present: **images** (dim slightly with reduced brightness/opacity
or a multiply overlay), **transparent PNGs/logos** (may need a light-mode variant or
a subtle backplate), **code blocks** (use a true dark syntax theme, not inverted
light), **borders** (lean on subtle light borders for separation since shadows weaken).

## How to deliver

- State the surface ramp and contrast targets you used. "Bg #121212, cards #1e1e20
  (+1 elevation via lightness), text #ececec at ~15:1, accent desaturated to OKLCH
  0.72/0.12."
- Implement **both** a `prefers-color-scheme` default **and** a manual toggle that
  persists (the override class wins). Don't trap the user in OS preference.
- Verify contrast on the dark surfaces and check `color-scheme` is set so native
  controls follow.
- Pair with `color-system` (palette generation) and `web-typography` (text on dark
  often wants slightly lower weight, since light text on dark appears heavier).
