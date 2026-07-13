---
name: i18n-ready
description: >-
  Multilingual-resilient web UI, English/Spanish first-class. Use for
  localization, translation, text expansion, lang attributes, logical
  properties, RTL readiness, locale formats, bilingual copy tells, hreflang,
  and language toggles.
---

# i18n-Ready (bilingual by design, not by patch)

Design for the longest honest string, then translate meaning—not words. English/Spanish
is the worked pair; the structural method generalizes.

## Make a locale contract before translating or resizing

Record a locale contract before resizing or translating:

| Boundary | Required decision/evidence |
| --- | --- |
| locale/reader | concrete BCP 47 tag, fallback/owner, formality and regional vocabulary |
| content | whole-message keys, variables/plurals, protected legal/safety language |
| mechanics | formats and data source for date/time zone/number/currency/address/name |
| stress/direction | longest approved fixture by surface; current `dir`, RTL/bidi/logical-property path |

Never invent locale, idiom, translation, or formality; pending source/approval means
structural readiness only.

## The decision order

1. Set `<html lang>` and inline `lang` switches.
2. Test the longest approved fixture; text containers/content-sized controls avoid fixed
   widths. Intentional truncation exposes reachable full text.
3. Use logical inline/block properties for RTL readiness, and `Intl` with real locales
   for all mechanical formats.
4. Re-express native voice/idiom/formality (including tú/usted); do not calque.
5. When the product offers an in-product language choice, self-label and persist the
   control and update `lang`; provide `hreflang` and per-locale metadata for indexed
   locale routes where applicable.

## Non-negotiables

- Correct language attributes, longest-string-safe layout, and logical CSS—no text images
  or concatenated sentence fragments.
- Explicit-locale `Intl`; native Spanish with consistent formality, accents/ñ/¿¡, and
  `cognitive-a11y` pass per locale.

## Verify meaning, layout, and mechanics separately

Keep three evidence lanes distinct: **meaning** (native/approved intent, formality,
idiom, plural/protected wording); **layout** (longest fixtures in real views/states;
pseudo-localization finds width defects only); **mechanical** (`Intl`, time zones,
currencies, inputs, `lang`/`dir`, logical properties, toggle persistence). A date changing
calendar day is a data defect.

## Repair order and evidence

Require locale contract and approved fixtures first. Repair message boundaries, formats,
keys, wrapping, logical CSS/bidi, and native voice, then record separate three-lane checks
per locale/surface with reviewer/source authority.

## Self-check (per language, before shipping)

1. Correct `lang`, logical CSS, longest-fixture layout, and no fragmented/image text?
2. Explicit-locale `Intl`, native/formality-safe copy, and per-language cognitive pass?
3. Honest persisted toggle/metadata where applicable, with separate meaning/layout/mechanical proof?

## How to deliver

Deliver locale readiness: tag/fallback, formality source, longest fixture, three-lane
evidence, bidi/format risk, and owner. Keep locales in `DESIGN-SYSTEM.md` and hand off
voice/type/accessibility work.

## Reference files

- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.
- `assets/locale-fixtures.json` — EN/ES message keys, format examples, and longest-string stress fixtures.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A UI or copy system must survive English/Spanish expansion, locale formatting, bidi, or locale-native voice.; avoid: The request is only English copy polish or a non-locale accessibility defect.
- Exclude: Do not translate word-for-word when locale-native meaning is required. (+1 in contract.json)
- Stop / handoff: Stop when supported locales or source meaning are undefined. (+1 in contract.json); receives [humanize-copy, responsive-layout, form-ux, improve-existing-website, web-typography] -> sends [a11y-pass, tastecheck-pass]
- Output: multilingual resilience repair ledger
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
