# Web-Font Loading & Performance

Read this whenever a project loads a custom web font, or has slow-text / layout-shift
issues. Fonts are usually the heaviest typography decision for performance and the
#1 typography cause of **Cumulative Layout Shift (CLS)**. The two goals: text is
**visible fast**, and swapping the real font in **shifts nothing**.

## The fastest font is no font

A good **system font stack** downloads nothing, renders instantly, never causes CLS,
and feels native to each OS. Make this the default and only reach for a web font when
the brand genuinely needs it. (Stacks are in `../assets/starter.css`; see also
[modernfontstacks.com](https://modernfontstacks.com).)

## Format & delivery

- **WOFF2 only.** It's the smallest format and is supported everywhere that matters.
  Don't ship WOFF1/TTF/EOT fallbacks in 2025 unless you have a proven legacy need.
- **Self-host** rather than using Google Fonts' CDN:
  - **Privacy/GDPR:** Google Fonts' hosted CSS exposes user IP to a third party; a
    German court ruled this can violate GDPR. Self-hosting avoids it entirely.
  - **Performance:** third-party origins cost an extra DNS+TLS connection and can't
    be `preload`ed as reliably. Self-hosting from your own origin is faster.
  - Tools: [Fontsource](https://fontsource.org) (npm packages of open fonts) or
    `@fontsource-variable/*` for variable versions; or download from the foundry.
- **Subset** to the characters/scripts you use (e.g. Latin only) to cut file size,
  and split by `unicode-range` so the browser only downloads ranges it needs:

```css
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+2000-206F;   /* Latin + common punctuation */
  font-display: swap;
}
```

## `font-display`: control the FOIT/FOUT tradeoff

While a web font loads the browser must either hide text (FOIT — flash of *invisible*
text) or show a fallback then swap (FOUT — flash of *unstyled* text). Choose per font:

- **`swap`** — show fallback immediately, swap when ready. Best for **body text**:
  content is always readable. Risk: a visible swap / reflow — fix with metric matching
  below.
- **`optional`** — show fallback; only use the web font if it's basically instant
  (cached); otherwise skip it this load. **Best for performance/CLS** — near-zero
  layout shift, font appears on the next navigation. Good when the exact font on
  first paint isn't critical.
- **`fallback`** — tiny block period then behaves like swap. A middle ground.
- Avoid **`block`** and the default `auto` (FOIT) for content text — they hide text.

## Preload the one critical font

Tell the browser to fetch the above-the-fold font early, in parallel with CSS:

```html
<link rel="preload" href="/fonts/brand-latin.woff2" as="font" type="font/woff2" crossorigin>
```

Preload **only** the 1–2 fonts actually used in the first viewport (e.g. the body
regular and maybe the H1 weight). Preloading everything competes for bandwidth and
hurts more than it helps. `crossorigin` is required even for same-origin fonts.

## Variable fonts — usually the right choice

A **variable font** packs many weights/widths/optical sizes into one file along
continuous *axes*. One ~40–80KB file can replace 6–8 static weight files.

```css
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand-variable.woff2") format("woff2");
  font-weight: 100 900;            /* declare the supported range */
  font-stretch: 75% 125%;
  font-display: swap;
}
h1 { font-weight: 800; }                         /* prefer standard properties... */
.fine { font-variation-settings: "opsz" 12, "wght" 360; }  /* ...low-level for custom/opsz axes */
```

- Common axes: `wght` (weight), `wdth` (width), `opsz` (optical size — see below),
  `ital`/`slnt`. Custom axes use uppercase tags.
- Prefer standard CSS properties (`font-weight`, `font-stretch`,
  `font-optical-sizing`) over `font-variation-settings` where they exist — they
  animate and inherit more predictably. Use `font-variation-settings` only for
  axes without a standard property.
- **Optical sizing**: `font-optical-sizing: auto` (default for variable fonts with
  an `opsz` axis) makes small text sturdier and display text more refined
  automatically. Keep it on.

## Eliminating font-driven CLS: metric-matched fallbacks

This is the technique most projects miss. When the real font swaps in, if it has
different metrics (x-height, line height, character width) than the fallback, the
text reflows → layout shift → bad CLS. Fix it by **adjusting the fallback's metrics
to match the web font**, so the swap is invisible:

```css
/* The real web font */
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand.woff2") format("woff2");
  font-display: swap;
}
/* A fallback alias whose metrics are tweaked to match "Brand" */
@font-face {
  font-family: "Brand-fallback";
  src: local("Arial");
  size-adjust: 105.2%;        /* scales the fallback so x-heights match */
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
body { font-family: "Brand", "Brand-fallback", sans-serif; }
```

- `size-adjust` scales the fallback glyphs so the apparent text size (x-height)
  matches the web font — the biggest lever.
- `ascent-override` / `descent-override` / `line-gap-override` match the line box
  height so wrapping and vertical position don't jump.
- **Don't compute these by hand.** Generate them:
  - **[Fontaine](https://github.com/unjs/fontaine)** auto-generates metric-matched
    fallback `@font-face` rules at build time (Nuxt/Vite/etc.).
  - **`next/font`** (Next.js) does this automatically — it self-hosts the font and
    injects a metric-adjusted fallback. Prefer it in Next projects.
  - The [Fallback Font Generator](https://screenspan.net/fallback) computes the
    override values for a given web font + fallback pair.

## `font-synthesis` and faux styles

If a family lacks a true bold or italic, browsers *synthesize* one (mechanically
slanting/thickening) — which looks bad and harms legibility. Either load the real
weight/style or, to be safe and surface gaps, set `font-synthesis: none`.

## Checklist for a project that loads a web font

1. WOFF2, subset, self-hosted (Fontsource or foundry). Variable font if multiple weights.
2. `font-display: swap` (content) or `optional` (CLS-critical).
3. `preload` the 1–2 first-viewport fonts with `crossorigin`.
4. Metric-matched fallback (`size-adjust` + overrides) via Fontaine / next/font — verify CLS ≈ 0.
5. `font-optical-sizing: auto`; `font-synthesis: none`.
6. Re-check Lighthouse/Web Vitals: LCP text paints on the fallback, CLS unaffected by swap.
