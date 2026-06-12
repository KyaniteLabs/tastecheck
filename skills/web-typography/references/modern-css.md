# Modern CSS Typography Features

Read this when reaching for a polish feature, and to check whether something needs
**progressive enhancement**. Rule of thumb: everything here should *improve* a page
that already reads correctly without it. Never make core readability depend on a
feature with partial support — let it enhance, then degrade gracefully.

Support status below reflects early 2026. Verify anything marked "newer" on
[caniuse.com](https://caniuse.com) / [MDN](https://developer.mozilla.org) for the
project's browser targets.

## Better line breaking: `text-wrap`

- **`text-wrap: balance`** — evens out line lengths across a short block; ideal for
  **headings, blockquotes, card titles** so you don't get one long line + one orphan
  word. Browsers cap it (~6 lines) so it's cheap. *Support: all current evergreen
  browsers.* Apply to `h1–h4`, `figcaption`, `.subtitle`.
- **`text-wrap: pretty`** — optimizes the **whole paragraph** to avoid orphans
  (short last lines) and bad rags; best for **body copy**. *Support: broad in current
  evergreen browsers; older engines simply ignore it (graceful).* Apply to `p`, `li`.

```css
h1, h2, h3, h4, blockquote, figcaption { text-wrap: balance; }
p, li { text-wrap: pretty; }
```

Both degrade to normal wrapping where unsupported — safe to use freely.

## Half-leading control: `text-box-trim` / `text-box-edge`

Removes the extra space above the cap height and below the baseline that line-height
adds ("half-leading"), so text aligns optically to its container — huge for buttons,
chips, headings, and precise vertical centering.

```css
h1 {
  text-box-trim: trim-both;
  text-box-edge: cap alphabetic;   /* trim to cap height (top) and baseline (bottom) */
}
/* shorthand */
.btn { text-box: trim-both cap alphabetic; }
```

*Support: newer — shipped in Safari and Chromium; check Firefox status for your
targets.* **Progressive enhancement only:** without it you get normal (slightly
looser) spacing, which is fine. Don't rely on it for layout that breaks otherwise.
Related: **`margin-trim`** removes margins of first/last children inside a container
(also newer).

## OpenType features — use the font's real typography

Modern fonts ship features that browsers can switch on. Prefer the high-level
`font-variant-*` properties (they're clearer and more robust) over raw
`font-feature-settings`.

```css
/* Tabular figures so numbers line up in columns (tables, prices, dashboards) */
table, .tabular { font-variant-numeric: tabular-nums; }
/* Old-style figures for flowing body text (numbers with ascenders/descenders) */
.prose { font-variant-numeric: oldstyle-nums; }
/* Proper small caps (not CSS-faked) */
.label { font-variant-caps: small-caps; }
/* Fractions, ordinals, slashed zero */
.recipe { font-variant-numeric: diagonal-fractions; }
.code   { font-feature-settings: "zero" 1; }   /* slashed zero, when no standard prop */
/* Ligatures (usually on by default; control if needed) */
.headline { font-variant-ligatures: common-ligatures discretionary-ligatures; }
```

- **Kerning** is on by default; `font-kerning: normal` to be explicit.
- Use **`font-feature-settings`** only for features lacking a `font-variant-*`
  equivalent (e.g. stylistic sets `"ss01"`, slashed zero `"zero"`), because it
  overrides rather than composes.

## Tracking (letter-spacing) — sparingly and intentionally

- **Large display / headings:** often benefit from *slightly negative* tracking
  (`letter-spacing: -0.01em` to `-0.02em`) — big type looks too loose at default.
- **ALL-CAPS and small caps:** add *positive* tracking (`0.05em`–`0.1em`) — caps are
  designed to sit in words, so they need air when set as standalone labels.
- **Body text:** leave at `0`. Don't track body copy; it harms readability.

## Drop caps: `initial-letter`

```css
p.lead::first-letter {
  initial-letter: 3;        /* sink the first letter 3 lines deep */
  margin-inline-end: 0.1em;
}
```

*Support: Safari/Chromium with prefixes historically; check current state.* Pure
enhancement — without it the letter is just normal size.

## Hanging punctuation

```css
blockquote, p { hanging-punctuation: first last; }
```

Hangs opening quotes/bullets into the margin so the text edge stays optically
straight. *Support: Safari only at time of writing* — treat as a nice-to-have that
does nothing elsewhere.

## Truncation: `line-clamp`

```css
.card-excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* Newer standard shorthand (check support): */
.card-excerpt { line-clamp: 3; }
```

The `-webkit-` form is universally supported despite the prefix. Use for card
excerpts; don't clamp essential content (it's hidden from sighted users though still
in the DOM — fine for AT, but don't hide something the user needs to act on).

## Font-relative & typographic units

Use these to keep spacing tied to the type, so it scales coherently:

- **`rem`** — root font-size. Default unit for `font-size` and most spacing (zoom-safe).
- **`em`** — local font-size. Good for spacing that should track an element's own
  size (e.g. button padding, `margin-block: 1em` on paragraphs).
- **`ch`** — width of `0`. Use for **measure**: `max-width: 66ch`.
- **`lh` / `rlh`** — current / root line-height. Great for vertical rhythm:
  `margin-block: 1lh` spaces by exactly one line. *Support: newer evergreen.*
- **`cap`** — cap height; **`ex`** — x-height; **`ic`** — width of a CJK ideograph.
  Niche but precise for aligning icons to caps, etc.
- **`cqi`/`cqw`** — container inline size, for component-level fluid type (see
  `fluid-scale.md`).

## `color-mix()` for tints & accessible muting

Derive secondary text colors from your palette instead of hard-coding greys, and
keep them tied to the background so contrast holds:

```css
:root { --color-text: #1a1a1a; --color-bg: #fff; }
.muted { color: color-mix(in oklab, var(--color-text) 70%, var(--color-bg)); } /* readable secondary text */
```

Prefer mixing in `oklab`/`oklch` for perceptually even results. Still **verify
contrast** (see `accessibility.md`) — `color-mix` makes it easy to mute text below
4.5:1 by accident.

## Progressive-enhancement pattern

When using a newer feature, gate truly support-dependent layout with `@supports`,
but for features that degrade harmlessly (`text-wrap`, `hanging-punctuation`,
`initial-letter`) just apply them directly:

```css
@supports (text-box-trim: trim-both) {
  .btn { text-box: trim-both cap alphabetic; padding-block: 0.5em; }
}
```

The page must read well in the `@supports`-false branch. Enhancement, never dependency.
