---
name: i18n-ready
description: >-
  Multilingual-resilient web UI, English/Spanish first-class. Use for
  localization, translation, text expansion, lang attributes, logical
  properties, RTL readiness, locale formats, bilingual copy tells, hreflang,
  and language toggles.
---

# i18n-Ready (bilingual by design, not by patch)

Localization "later" is how UIs break: a button that fit "Save" truncates "Guardar
cambios," a hardcoded `padding-left` mirrors wrong, dates read as the wrong day, and
the Spanish copy sounds like a machine translated the English one — because it did.
This skill makes the UI **structurally indifferent to language** and the copy native
in each, with English/Spanish as the worked pair (the method generalizes).

Governing rule: **design for the longest honest string, then translate meaning, not
words.**

## The decision order

1. **Declare language everywhere it changes.** `<html lang="es">`; `lang` on any
   element that switches language inline (`<span lang="en">`). Screen readers switch
   pronunciation engines on this; spellcheck, hyphenation, and quotes follow it too.
2. **Build for expansion.** Spanish runs ~15–30% longer than English (German worse).
   No fixed widths on text containers; buttons/badges/tabs size to content
   (`min-width`, never `width`); test every label at +30% length; truncation is a
   *decision* (`text-overflow` + full text in `title`/tooltip), never an accident.
3. **Logical properties, not physical.** `margin-inline-start`, `padding-block`,
   `inset-inline-end`, `text-align: start` — the layout then mirrors for free if RTL
   ever arrives, and it's identical work today. Physical `left/right` spacing is debt.
4. **Locale-format everything mechanical.** Dates, numbers, currencies via
   `Intl.DateTimeFormat`/`Intl.NumberFormat` (`es-MX` ≠ `es-ES` — pick real locales,
   not bare `es`). Never hand-format `MM/DD/YYYY` into copy.
5. **Translate voice, not sentences.** Each language gets the brand voice natively
   re-expressed: idioms re-chosen (not calqued), formality decided (tú/usted is a
   *brand decision* — make it once, in DESIGN-SYSTEM.md), text re-run through
   `humanize-copy` thinking *in that language*.
6. **Wire the toggle honestly.** A visible language switch labeled in its own language
   ("Español", not a flag — flags are countries, not languages), persisted, reflected
   in `lang`, `hreflang` alternates for SEO, and per-language meta/OG.

## Non-negotiables

- **`lang` is correct on `<html>` and on every inline language switch.**
- **No fixed-width text containers; every control survives +30% string length.**
- **Logical properties for all inline-axis spacing/alignment** in new CSS.
- **No text in images** (untranslatable — see `art-direction`); no concatenated
  sentence fragments in code (`"Welcome " + name + "!"` breaks under grammar that
  reorders — use full templated strings per language).
- **Dates/numbers/currency via `Intl`**, with explicit real locales.
- **Spanish is not "translated English":** no calqued idioms, formality consistent
  (tú *or* usted, never drifting), accents/ñ correct everywhere including ALL-CAPS
  (`Á É Í Ó Ú` — dropping accents on caps is an error in modern usage), ¿¡ present.
- **Both languages get the cognitive pass** (`cognitive-a11y` plain-language rules
  apply per language — grade-8 Spanish, not grade-8 English run through a translator).

## Quick-start

```html
<html lang="es">
<button type="button" lang="en" aria-pressed="false">English</button>
<link rel="alternate" hreflang="en" href="https://example.com/en/" />
<link rel="alternate" hreflang="es" href="https://example.com/es/" />
```

```css
/* Logical, expansion-safe control */
.btn { padding-block: var(--space-2); padding-inline: var(--space-4);
       min-width: 6ch; width: auto; }
.label { margin-inline-start: var(--space-2); text-align: start; }
```

```js
new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(d); // 12 de junio de 2026
new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
```

## Self-check (per language, before shipping)

1. `lang` correct on `<html>` and all inline switches?
2. Every control tested at +30% string length — nothing truncates accidentally?
3. New CSS uses logical properties on the inline axis (grep for `-left`/`-right`)?
4. All dates/numbers/currency via `Intl` with explicit real locales?
5. No concatenated string fragments; no text baked into images?
6. Spanish reads native: formality consistent, no calques, accents correct in caps,
   ¿¡ present — and it passes the pub test *in Spanish*?
7. Language toggle self-labeled ("Español"), persisted, `hreflang` alternates present?
8. `cognitive-a11y` plain-language pass run per language, not just on the English?

## How to deliver

- State the locale decisions like tokens: "es-MX, tú, dates `dateStyle: long`,
  +30% expansion verified on nav/buttons/badges."
- The formality choice and language list live in `DESIGN-SYSTEM.md`; `humanize-copy`
  handles per-language voice; `web-typography` confirms the faces cover the glyphs;
  `a11y-pass` re-runs per language (labels and `aria-label`s translate too).

## Reference files

- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.
