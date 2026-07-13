# Art-Direction Patterns

Worked imagery and iconography patterns for common web UI scenarios. Each pattern
names the visual job, the treatment decision, and the reject criterion.

## Hero imagery

**Job:** orient the viewer and establish the product's visual stance in one glance.

| Pattern | When | Treatment | Reject when |
|---------|------|-----------|-------------|
| Documentary detail | Product has a physical or tangible artifact | Tight crop of the real thing, shallow depth of field, natural light | The photo repeats the headline without adding evidence |
| Diagrammatic illustration | Product is abstract, technical, or process-led | Custom line-art or isometric diagram showing the mechanism | The diagram is decorative — explains nothing the copy doesn't |
| Editorial crop | Product is experiential, lifestyle, or narrative | Wide crop with human context, text-safe negative space | The crop is stock-generic (smiling-people-at-laptop) |
| Deliberately none | Content is authoritative by restraint (documentation, spec sheets, data) | Typography and structure carry the weight; no image | A decorative image would dilute the authoritative tone |

## Icon systems

**Job:** communicate state, category, or action faster than text at small sizes.

- Commit to one icon set (stroke weight, corner radius, grid size). Mixing Lucide
  outline icons with Material filled icons reads as uncommitted.
- Test at the smallest rendered size (usually 16px). If two icons become
  indistinguishable, simplify or differentiate by shape, not detail.
- Use decorative icons with `aria-hidden="true"` when adjacent text labels them.
  Interactive icon-only buttons need `aria-label`.
- Never use emoji as UI icons — rendering varies by platform and they carry
  unintended tonal meaning.

## Favicon derivation

**Job:** brand recognition in a 16×16 pixel square, repeated across every browser tab.

1. Extract the single most identifiable element from the visual stance — a color,
   a glyph, a shape.
2. Draw it on the committed background at 16×16 actual pixels. If it's illegible,
   reduce to one element.
3. Ship SVG primary (scales to Retina, supports dark mode via `@media (prefers-color-scheme: dark)`
   inside the SVG), PNG fallback at 32×32.
4. Apple Touch Icon (180×180) needs more padding than the favicon — the OS rounds
   corners and applies a background. Test on a real device.

## OG / social preview image

**Job:** communicate the product's value when shared on social platforms.

- Canvas: 1200×630px (Twitter/Facebook/LinkedIn safe area).
- Include the product name, a one-line value prop, and the committed visual
  treatment (color, type, imagery).
- Leave a safe margin — platforms crop edges unpredictably.
- Generate dynamically per-page when possible (og:image should reflect the
  specific content, not always the homepage hero).

## Removing AI-generated imagery

**Job:** replace generic AI-blob graphics with committed, source-tracked assets.

- Identify the AI tells: impossible geometry, melted text in images, generic
  gradient meshes, eerily smooth surfaces, inconsistent lighting.
- Replace with: a documented stock source with license, a commissioned
  illustration brief, a deliberate typographic treatment, or a data visualization.
- Never swap one AI image for another AI image and call it fixed — the problem
  is the uncommitted, average quality, not the specific pixels.

## Decorative vs informational imagery

| Type | Alt text | Purpose | Example |
|------|----------|---------|---------|
| Informational | Concise description of what the image communicates | Adds evidence the text doesn't | Product screenshot, data chart, team photo |
| Decorative | `alt=""` (empty) or `aria-hidden="true"` | Visual rhythm, mood, brand texture | Background pattern, section divider, accent illustration |
| Functional | Action description | Acts as a button or link | Logo linking home, icon-only CTA |

When in doubt: if removing the image loses task-relevant information, it needs
real alt text. If removing it changes nothing functionally, it's decorative.
