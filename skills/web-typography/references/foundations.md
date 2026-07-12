# Typographic Foundations (for the web)

The enduring principles — from Ellen Lupton's *Thinking with Type* / *Type on Screen*,
Robert Bringhurst's *The Elements of Typographic Style*, and Matthew Butterick's
*Practical Typography* — translated into screen-era decisions. Read this when
**choosing or pairing fonts**, or when a layout "feels off" but no single rule is
obviously broken. These are judgment tools, not lint rules.

## Lupton's three lenses: Letter → Text → Grid

Lupton organizes typography into three scales. Work outward; problems at a smaller
scale can't be fixed at a larger one.

- **Letter** — the glyph and its anatomy: x-height, ascenders/descenders, counters,
  contrast, weight, stress. On screen, **x-height matters more than point size**: a
  font with a large x-height (Inter, Source Sans, system-ui) reads larger and clearer
  at the same `font-size` than one with a small x-height (e.g. Garamond). When two
  fonts "look different sizes" at the same px, that's x-height — use `size-adjust`
  or simply pick a different size per font.
- **Text** — words in lines and blocks: the things readers actually feel. This is
  where most web typography is won or lost: **measure** (line length), **leading**
  (line-height), alignment, spacing between paragraphs, and contrast of hierarchy.
- **Grid** — the spatial system that organizes blocks: columns, margins, vertical
  rhythm, and the relationships between elements. On the web the grid is fluid, so
  think in *proportions and tokens*, not fixed pixel coordinates.

## Legibility vs. readability

Two different things, both required:

- **Legibility** = can you distinguish the characters? A property of the typeface
  and its rendering (weight, contrast, hinting, size, contrast-with-background).
- **Readability** = is sustained reading comfortable? A property of the *setting* —
  measure, leading, alignment, hierarchy. A perfectly legible font is unreadable at
  a 120-character measure with tight leading.

You can have one without the other. Display type can be highly legible and
deliberately hard to read at length; that's fine for a hero, fatal for an article.

## Measure (line length) — the highest-leverage decision

The eye makes a "return sweep" at the end of each line. Too long and it loses its
place; too short and rhythm breaks and hyphenation explodes.

- **Target 45–75 characters per line; ~66 is the classic ideal** (Bringhurst).
- Implement with `max-width` on text containers using the `ch` unit:
  `max-width: 66ch`. `1ch` = width of the `0` glyph, so it scales with the font.
- For multi-column layouts aim for **40–50ch per column**.
- This single rule fixes more "hard to read" complaints than any font change.

## Leading (line-height)

- **Body: ~1.4–1.6** (1.5 is the safe default and the WCAG text-spacing target).
- **Longer measures need more leading**; short measures can take less. The wider the
  line, the more vertical separation the eye needs to find the next line.
- **Large headings: 1.0–1.25.** Big type already has visual separation; default 1.5
  leading makes headlines look airy and disconnected.
- Always **unitless** so it scales per element (see `modern-css.md`).

## Hierarchy — make the eye's path obvious

Readers scan before they read. Hierarchy is how you tell them what to look at first.
Build contrast on as few axes as needed, in this rough order of strength:

1. **Size** — strongest signal, but don't rely on it alone; jumps should follow your
   scale, not be arbitrary.
2. **Weight** — bold vs regular is a clean, space-efficient contrast; often better
   than size for inline emphasis or small UI.
3. **Space** — whitespace *around* an element groups and separates (Gestalt
   proximity). Often the most elegant hierarchy tool and the most under-used.
4. **Color / value** — a muted secondary text color (not pure grey-on-grey;
   maintain contrast) separates metadata from content.
5. **Case & style** — small caps, italics, tracking on caps. Subtle; use last.

Restraint is the rule: **2–3 levels of contrast per view.** If everything is
emphasized, nothing is. The underlying principle (widely taught, Lupton among
others): hierarchy exists to guide the reader logically through the content — its
job is clarity, not decoration.

## Pairing fonts

The reliable strategies, roughly safest-first:

1. **One family, many weights/styles** — a single well-built family (ideally a
   variable font) across weights and a true italic. Almost always looks intentional.
   Start here.
2. **Superfamily** — a family designed with matching serif + sans (e.g. IBM Plex,
   Source Serif/Sans, Lora + a matching sans). Built-in harmony.
3. **Contrast pairing** — a distinctive **display/serif for headings** + a clean,
   neutral **sans for body** (or vice-versa). The reason it works is *contrast with
   harmony*: different enough to signal hierarchy, but matched in x-height,
   proportion, and mood.

Practical guidance:
- **Pair on contrast, not similarity.** Two slightly-different sans-serifs look like
  a mistake; a serif + sans reads as deliberate.
- **Match x-heights** so body and headings feel like one system.
- **Body font is the workhorse** — pick it for readability at small sizes first,
  personality second. Save personality for the display face.
- **Limit to two families** (plus a mono for code). Each web font is a performance
  cost (see `font-loading.md`).
- When in doubt, a great **system font stack** (see `../assets/starter.css`) beats a
  mediocre web font: zero load time, no layout shift, native feel.

## Alignment & rags

- **Left-aligned, ragged right** is the default for Latin web text. It gives even
  word spacing and a predictable left edge for the return sweep.
- **Never justify body text on the web.** Browser justification has no good
  hyphenation/penalty engine, so it opens vertical "rivers" of whitespace. (If you
  must justify for a specific editorial look, pair with `hyphens: auto` and test.)
- **Centered text** is for short runs only — a hero headline, a quote, a caption.
  Centering multiple lines of body text destroys the left edge and tires the reader.
- Watch **widows** (a lone word on the last line) and **orphans** (a single line of
  a paragraph stranded). `text-wrap: pretty` now handles most of this automatically
  (see `modern-css.md`).

## Spacing rhythm

- **Space paragraphs *or* indent them, never both.** Web convention is space between
  (`margin-block` ≈ `1em`); indentation (`text-indent`) is a print-novel idiom that
  rarely fits screen UI.
- Establish a **spacing scale** derived from your type (e.g. multiples of `0.25rem`
  or of the body `line-height`) so vertical space feels systematic, not ad-hoc.
- The space *above* a heading should be larger than the space *below* it, so the
  heading binds to the content it introduces (proximity again).

## "Web Design is 95% Typography" (Oliver Reichenstein / iA)

The famous provocation: since most of the web is words, getting type right *is*
getting design right. The corollary for this skill — when a page feels generic or
unpolished, the fix is usually **measure, scale, leading, and a confident font
choice**, not more color, shadows, or decoration. Fix the type first.
