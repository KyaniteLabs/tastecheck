# Meta-Patterns & Decision Records

This file is the *distilled reasoning* behind web typography — the recurring patterns
and the "why" behind each decision, synthesized from the public body of typographic
thought (Warde, Tschichold, Bringhurst, Lupton, Spiekermann; and the web-era writers
Brown, Rutter, Santa Maria, Butterick, Reichenstein). **It is an independent synthesis
of principles, not a reproduction of anyone's text.** Ideas are attributed so you know
the lineage; the expression and the web translation are this skill's own.

Read this when you need to make a *novel* judgment the specific rule-files don't
cover — the meta-patterns tell you how the experts would reason about it.

---

## Part 1 — The five meta-patterns (how the whole field thinks)

These are the patterns *behind* the rules. Internalize these and you can derive the
rules yourself in situations no checklist anticipated.

### MP-1 · Type serves the reading; the typography itself should go unnoticed
The oldest idea in the field (Beatrice Warde's "invisible typography" argument, echoed
by Tschichold's later work and by Butterick): the reader should absorb the *content*,
not admire the *type*. **Consequence:** default to restraint. Decoration that draws
attention to itself is a cost paid against comprehension. When a typographic choice and
readability conflict, readability wins — *unless* the brief is explicitly expressive
(a poster, a hero, an art piece), where the type may legitimately perform.

### MP-2 · The eye is the final authority; numbers are only starting points
Bringhurst and Lupton both insist on *seeing*, not just measuring. Metrics (66ch, 1.5
leading, a 1.25 ratio) are calibrated defaults, not laws — they get you 90% there fast,
then you trust the eye for the last 10%. **Consequence:** ship the systematic default,
then look at the real text in the real layout and adjust. "It computes correctly" is
not "it reads well." Optical adjustments (negative tracking on huge headings,
`text-box-trim` alignment, x-height-based size tweaks between paired fonts) exist
precisely because mechanical correctness ≠ optical correctness.

### MP-3 · Contrast through difference, harmony through system
Every good hierarchy and every good font pairing is the same move: make things
*different enough to be distinguishable* while keeping them *part of one system*. Two
near-identical sans-serifs fail (difference without reason); a serif + sans pairing
works (clear difference, unified by matched x-height and proportion). **Consequence:**
when something looks accidental, you usually have too little contrast (raise it to a
clear step) or too little system (derive both ends from one scale/ratio/family).

### MP-4 · Rhythm and proportion over absolute measurement
From the modular scale (Brown) back to classical canons of page proportion: sizes and
spaces should relate to each other by *ratio*, not be chosen independently. A page
feels "designed" when its measurements echo each other. **Consequence:** never
hand-pick a one-off `27px`; derive it from the scale. Tie vertical space to the type
(`em`, `lh`, multiples of the baseline) so rhythm is structural, not sprinkled on.

### MP-5 · On the web, you design defaults for a medium you don't control
This is the web-native meta-pattern that updates all the print-era thinking (Rutter,
Santa Maria, Reichenstein). The reader controls the viewport, the zoom level, the font-
size preference, the connection speed, the device, even whether your font loads. Print
typographers set *absolutes*; web typographers set *resilient defaults* and let the
system flex. **Consequence — the big one:** accessibility and performance are not
separate engineering concerns bolted on after design — they *are* typography on the
web. A font that blocks zoom, a `vw` size that ignores user preference, or a web font
that reflows the page on load is **bad typography**, full stop, not merely "a bug."

---

## Part 2 — Decision records (principle → why → rejected alternatives → apply)

ADR-style entries for the recurring decisions. Each links a concrete rule back to the
meta-pattern that justifies it, so the rule is memorable rather than arbitrary.

### DR-1 · Size body text in `rem`, not `px`
- **Decision:** body and most sizes in `rem`.
- **Why (MP-5):** `px` silently overrides the user's chosen browser font-size; `rem`
  honors it. Control you don't need to keep, you relinquish to the reader.
- **Rejected:** `px` ("pixel-perfect") — perfect only for one user who never zooms.
- **Apply:** `font-size` in `rem`; `em` for size-relative spacing; `px` only for
  hairlines/physical details. Never disable zoom in the viewport meta tag.

### DR-2 · Fluid sizing must keep a `rem` term (`clamp(rem, rem + vw, rem)`)
- **Decision:** fluid type via `clamp()`, never pure `vw`.
- **Why (MP-4 + MP-5):** ratio-based smooth scaling *without* breaking zoom — pure
  `vw` ignores zoom/user-size and fails WCAG 1.4.4.
- **Rejected:** stepped media-query sizes (janky), pure `vw` (inaccessible).
- **Apply:** generate the scale (Utopia); confirm every step has a `rem` term.

### DR-3 · Cap the measure at ~66ch
- **Decision:** `max-width: ~66ch` on text containers (45–75 range).
- **Why (MP-1):** beyond ~75 chars the return sweep loses its place — friction the
  reader feels but can't name. Highest-leverage readability fix.
- **Rejected:** full-bleed text (looks "full," reads poorly); fixed `px` widths (don't
  scale with font / zoom — violates MP-5).
- **Apply:** `ch` so the limit tracks the font; ~40–50ch per column in multi-column.

### DR-4 · Line-height unitless; ~1.5 body, ~1.1–1.25 large headings
- **Decision:** unitless `line-height`, looser for body, tighter for big type.
- **Why (MP-2 + MP-4):** unitless recomputes per element's own size (structural
  rhythm). Wide/long text needs more leading to find the next line; large type already
  has separation, so default leading makes it look disconnected — the eye says so.
- **Rejected:** fixed `line-height: 24px` (inherits a frozen pixel value, breaks on
  resized children); one leading value for all sizes (ignores the optical reality).

### DR-5 · Derive sizes from one ratio; never hand-pick
- **Decision:** a single modular ratio (default Major Third 1.25) drives the scale.
- **Why (MP-4):** proportion is what makes a page read as composed vs. arbitrary.
- **Rejected:** per-element ad-hoc sizes; multiple competing ratios in one system.
- **Apply:** smaller ratio for small screens, larger for big — fluid `clamp()` does
  this transition for free.

### DR-6 · Pair fonts on contrast + shared system, max two families
- **Decision:** one family/superfamily, or a serif+sans contrast pair; cap at two
  (plus mono).
- **Why (MP-3 + MP-5):** contrast signals hierarchy, shared metrics keep it coherent;
  each web font is also a real performance/CLS cost.
- **Rejected:** two similar sans (reads as a mistake); many families (incoherent + slow).
- **Apply:** match x-heights; pick the *body* font for small-size readability first,
  personality second. A great system stack beats a mediocre web font.

### DR-7 · Hierarchy = information architecture; use the fewest axes
- **Decision:** 2–3 levels of contrast per view, built on size/weight/space first.
- **Why (MP-1 + MP-3):** the reader scans before reading; hierarchy is wayfinding, not
  ornament. Over-emphasis flattens to no emphasis.
- **Rejected:** emphasizing everything; relying on color alone (fails MP-5 / WCAG 1.4.1).
- **Apply:** prefer weight and whitespace before reaching for more sizes or colors.

### DR-8 · Left-align ragged; never justify body on the web
- **Decision:** body text left-aligned, ragged right.
- **Why (MP-2 + MP-5):** browser justification has no real hyphenation/penalty engine,
  so it opens "rivers" the eye trips on; even word spacing matters more than a straight
  right edge. Centering destroys the left edge the return sweep relies on.
- **Rejected:** `text-align: justify` for "tidiness"; centered multi-line body.
- **Apply:** justify only with `hyphens: auto` for a deliberate editorial look, tested.

### DR-9 · A web font must cause zero layout shift
- **Decision:** pair `font-display` with a metric-matched fallback
  (`size-adjust` + ascent/descent/line-gap overrides).
- **Why (MP-5):** an uncontrolled swap reflows the page (bad CLS) — i.e. the type
  literally jumps under the reader. That's a typographic failure, not just an
  engineering one.
- **Rejected:** default FOIT (hides text); `swap` alone (visible reflow); shipping
  many static weights (use one variable font).
- **Apply:** generate overrides with Fontaine / `next/font` / the fallback generator —
  don't guess them; preload only first-viewport fonts; verify CLS ≈ 0.

### DR-10 · Newer CSS features enhance, never gate, readability
- **Decision:** `text-wrap: pretty/balance`, `text-box-trim`, `hanging-punctuation`,
  `initial-letter`, `lh`/`cap` units etc. go in as progressive enhancement.
- **Why (MP-5):** support varies; the page must read correctly for the reader whose
  browser lacks the feature. Enhancement is a gift to some, never a debt for others.
- **Rejected:** layouts that *depend* on a partially-supported feature.
- **Apply:** apply harmless-degraders directly; gate layout-affecting ones behind
  `@supports`; always check the false branch reads well.

---

## Part 3 — Using this without copying anyone

When you apply or extend this skill: **express principles in your own words, attribute
the lineage of an idea when it's natural, and never reproduce a source's prose,
examples, or layouts.** The value here is the *distilled reasoning*, which is shared
professional knowledge — what you build with it should be your own work, informed by
the field, not a copy of any one person's.
