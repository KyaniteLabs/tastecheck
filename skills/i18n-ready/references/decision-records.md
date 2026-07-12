# Decision Records — i18n-ready

## Meta-patterns

- **MP-1 · Structure before translation.** A UI that survives the longest approved locale fixture and mirrors
  via logical properties makes every future language cheap; translating into a rigid
  UI makes every language a renovation.
- **MP-2 · Languages are voices, not encodings.** The deliverable per language is the
  brand's voice in that language — which is a writing task, not a mapping task.
- **MP-3 · Mechanical things go to the platform.** `Intl` knows more about Spanish
  date formats than any hand-rolled string ever will. Hand-formatting is a bug farm.

## ADRs

**ADR-1 — Self-labeled language toggle, no flags.**
*Why:* flags map to countries (which flag for Spanish — Spain? Mexico? the US, where
40M+ speak it?); the user looking for their language may not read the current one.
*Apply:* "Español" / "English", each rendered in its own language, `lang`-attributed.

**ADR-2 — Formality (tú/usted) is decided once, in DESIGN-SYSTEM.md.**
*Why (MP-2):* drifting between tú and usted across a flow reads as machine output and
breaks trust; the choice encodes brand personality (warm vs institutional). *Apply:*
record it next to the voice decisions; `humanize-copy` enforces it.

**ADR-3 — Accents survive ALL-CAPS and folding.**
*Why:* "dropping accents on capitals" is a typewriter-era myth; modern usage keeps
them (RAE). Search/slug folding is a separate, deliberate layer. *Apply:* check caps
headers, buttons, and `text-transform: uppercase` output for `Á/É/Í/Ó/Ú/Ñ`.

**ADR-4 — Logical properties in all NEW code; migrate old code opportunistically.**
*Why (MP-1):* identical cost today, free mirroring later; but a mass rewrite of working
physical CSS is churn. *Apply:* lint new diffs for `-left/-right` spacing; convert old
code when you touch it anyway.

**ADR-5 — Pseudo-localization before real localization.**
*Why (MP-1):* expansion bugs are cheaper to find with accented, bracketed pseudo-strings
than with a paid translation round. *Apply:* run a pseudo-pass using the longest approved
locale fixture over key screens before commissioning translations.
