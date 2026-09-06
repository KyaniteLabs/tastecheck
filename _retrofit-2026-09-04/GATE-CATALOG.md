# TasteCheck Pass closed check catalog

Generated from `skills/tastecheck-pass/assets/check-catalog.json` by `_retrofit-2026-09-04/generate-gate-catalog.mjs`.
Catalog ID: `tastecheck-pass-v1`; schema version: 1; source SHA-256: `f9d1a0ff231bd8e0582c7fdc886ebed809589f4f4dc02dbf777017bad079bfbe`.

This is the complete enumeration: 27 check IDs, each listed exactly once. The JSON catalog remains authoritative; this document makes its closed contents reviewable without relying on prose references.

| # | Check ID | What it verifies | Stage | Required | Applicability | n/a policy | Judgment |
| ---: | --- | --- | --- | :---: | --- | --- | --- |
| 1 | `direction:system` | Committed design system or inferred system | direction | yes | always | forbidden | subjective |
| 2 | `foundation:color` | Color roles and contrast foundations | foundations | yes | always | forbidden | deterministic |
| 3 | `foundation:typography` | Typography and reading constraints | foundations | yes | always | forbidden | deterministic |
| 4 | `foundation:spacing` | Spacing and density system | foundations | yes | always | forbidden | deterministic |
| 5 | `foundation:theming` | Theme role mappings | foundations | yes | always | forbidden | deterministic |
| 6 | `structure:responsive-layout` | Responsive layout | structure | yes | always | forbidden | deterministic |
| 7 | `structure:component-states` | Component lifecycle states | structure | yes | always | forbidden | deterministic |
| 8 | `structure:form-ux` | Form behavior and recovery | structure | yes | always | forbidden | deterministic |
| 9 | `structure:empty-states` | Empty, loading, permission, and error states | structure | yes | always | forbidden | deterministic |
| 10 | `surface:micro-motion` | Purposeful motion and interruption policy | surface | no | optional_subject: motion | subject_absence | subjective |
| 11 | `surface:data-viz` | Data visualization and uncertainty treatment | surface | no | optional_subject: data-viz | subject_absence | subjective |
| 12 | `surface:art-direction` | Imagery, illustration, and iconography system | surface | no | optional_subject: art-direction | subject_absence | subjective |
| 13 | `verification:a11y` | Accessibility audit | verification | yes | always | forbidden | deterministic |
| 14 | `verification:cognitive-a11y` | Cognitive accessibility friction | verification | no | optional_subject: cognitive-friction | subject_absence | subjective |
| 15 | `verification:i18n` | Locale and bidirectional resilience | verification | no | optional_subject: multilingual | subject_absence | subjective |
| 16 | `verification:deslop-ui` | Against-spec deslop audit | verification | yes | always | forbidden | subjective |
| 17 | `verification:humanize-copy` | Humanize-copy audit | verification | yes | always | forbidden | subjective |
| 18 | `browser:rendering` | Browser rendering at required widths | browser | yes | always | forbidden | subjective |
| 19 | `browser:zoom-400` | 400 percent zoom | browser | yes | always | forbidden | subjective |
| 20 | `browser:keyboard` | Keyboard and focus path | browser | yes | always | forbidden | subjective |
| 21 | `browser:theme-contrast` | Theme contrast measurements | browser | yes | always | forbidden | deterministic |
| 22 | `browser:reduced-motion` | Reduced-motion behavior | browser | yes | always | forbidden | deterministic |
| 23 | `browser:cold-load` | Cold-load audit | browser | yes | always | forbidden | subjective |
| 24 | `browser:shadow-iframe` | Shadow-root and iframe coverage | browser | no | optional_subject: shadow-or-iframe | subject_absence | subjective |
| 25 | `gate:artifact-spec` | Real artifact and spec identity | gate | yes | always | forbidden | deterministic |
| 26 | `gate:required-evidence` | Required browser and numeric evidence ran | gate | yes | always | forbidden | deterministic |
| 27 | `gate:blocker-handoff` | Every blocker has an owner, repair, rerun, and acceptance rule | gate | yes | always | forbidden | subjective |
