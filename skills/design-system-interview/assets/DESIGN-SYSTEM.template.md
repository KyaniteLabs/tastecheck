# Design System — {Project Name}

> **North star (one line):** {e.g. "1970s ski-lodge editorial — warm, dense, classic,
> burnt-orange anchor, Fraunces display, sharp 4px corners, signature = oversized serif numerals."}

## Direction
- **Reference(s):** {the site/brand/object whose feel we're borrowing}
- **Aesthetic:** {named concrete phrase — NOT "modern/clean"}
- **Personality (poles chosen):** {warm/cool} · {serious/playful} · {minimal/maximal} ·
  {classic/experimental} · {refined/raw} · {dense/spacious}
- **Signature move:** {the one memorable thing}

## Type (→ web-typography)
- **Display:** {face} — {why}
- **Body:** {face}
- **Contrast intent:** {scale ratio, weight extremes}

## Color (→ color-system)
- **Dominant hue:** {name / approx OKLCH H}
- **Accent:** {name / H}
- **Neutrals:** tinted toward {hue}; no dead gray; never indigo→violet default
- **Mode:** {light only / light+dark}

## Shape & density (→ components)
- **Density:** {spacious | dense}
- **Corner radius:** controls {0–4|8–12|16+}px · cards {…}px (CTAs never pill)
- **Elevation:** {flat+borders | layered shadow scale}

## Imagery & iconography (→ art-direction)
- **Imagery stance:** {photography + treatment | illustration + style | type/texture only | none}
- **Icon set:** {named set} at {stroke weight} — one set, no emoji-as-icons
- **Image-shaped holes:** {what fills hero/cards/empty states}

## Motion (→ micro-motion)
- **Level:** {restrained | lively | none}

## Language (→ i18n-ready, if multilingual)
- **Languages:** {e.g. EN + ES} · UI must hold at ~+25% string length

## Refusals (what we will NOT do)
- No {Inter/Roboto/Arial} — using {our faces}
- No indigo→violet gradient / purple-on-white
- No centered-hero + three-identical-cards
- No pill CTAs / glassmorphism-by-default / shadow-2xl-on-everything
- {project-specific refusals}

## Tokens
See `tokens.css` (primitive → semantic). Components reference semantic tokens only.

## Build order
design-system-interview (this) → color-system + web-typography + theming +
spacing-system → responsive-layout → component-states + form-ux + empty-states →
micro-motion + data-viz + art-direction → a11y-pass + cognitive-a11y (+ i18n-ready if
multilingual). Audit with deslop-ui + humanize-copy **against this spec**, not the
average; gate the ship with tastecheck-pass.
