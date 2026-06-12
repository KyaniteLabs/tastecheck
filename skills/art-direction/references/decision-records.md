# Decision Records — art-direction

## Meta-patterns

- **MP-1 · Treatment beats sourcing.** You rarely control the photo source; you always
  control the treatment. A committed recipe makes mixed sources cohere.
- **MP-2 · The image layer is tokens too.** Ratio, overlay color, radius, icon weight
  are values — record them in DESIGN-SYSTEM.md like any token, audit them like any token.
- **MP-3 · Absence is a stance.** "No imagery; typography and color carry it" is a
  strong committed answer, and the right one more often than teams expect.
- **MP-4 · Consistency is the giveaway.** Users can't name the icon set, but they feel
  three mixed ones instantly. Uniformity at the detail layer is what reads as "designed."

## ADRs

**ADR-1 — One stance per surface; mixing requires a written rule.**
*Why (MP-4):* stance-per-card is how template-fill looks. *Apply:* if photography AND
illustration coexist, the rule says which goes where ("photos for case studies,
illustration for concepts") — recorded in DESIGN-SYSTEM.md.

**ADR-2 — Emoji are content, never UI.**
*Why (MP-4):* emoji render differently per platform, carry no stroke/weight system, and
are the #1 icon slop tell. *Apply:* emoji allowed inside user content and copy where
voice calls for it; never as section markers or control icons (see `deslop-ui`).

**ADR-3 — OG/social card is part of v1.**
*Why (MP-2):* the card is the most-seen image of the site (every share) and the
most-forgotten. *Apply:* 1200×630, on-system type at readable size, contrast-checked;
generate it from the committed tokens, not a screenshot.

**ADR-4 — Text never lives inside images.**
*Why:* unzoomable, untranslatable, invisible to screen readers and to `i18n-ready`.
*Apply:* type is HTML; images are imagery. (Exception: the OG card, which is an image
by format — keep its text minimal and large.)

**ADR-5 — Dark mode re-tests the treatment.**
*Why (MP-1):* overlays and duotones tuned on light ground often muddy or bloom on dark.
*Apply:* re-check overlay opacity and image contrast per theme with `theming`.
