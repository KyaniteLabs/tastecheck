# Design System — {Project Name}

## Design direction summary

> **North star (one line):** {a concrete, brief-derived direction}

- **Reference / anchor:** {source and what is being learned, not copied}
- **Aesthetic territory:** {named concrete phrase; not "modern" or "clean"}
- **Personality:** {chosen spectrum positions}
- **Structure and rhythm:** {composition, spatial motif, and cadence}
- **Signature:** {one distinctive, usable element}
- **Imagery and iconography:** {treatment and one coherent icon convention}

## Typography specimen (→ web-typography)
- **Display:** {face} — {why}
- **Body:** {face}
- **Contrast intent:** {scale ratio, weight extremes}

## Color palette (→ color-system)
- **Dominant hue:** {name / approx OKLCH H}
- **Accent:** {name / H}
- **Neutrals:** tinted toward {hue}; no dead gray; never indigo→violet default
- **Mode:** {light only / light+dark}
- **Contrast notes:** {measured foreground/background pairs and any remediation}

## Spacing scale and shape (→ spacing-system, components)
- **Density:** {spacious | dense}
- **Corner radius:** controls {0–4|8–12|16+}px · cards {…}px (CTAs never pill)
- **Elevation:** {flat+borders | layered shadow scale}

## Motion (→ micro-motion)
- **Level:** {restrained | lively | none}

## Language (→ i18n-ready, if multilingual)
- **Languages:** {e.g. EN + ES} · UI must hold the longest approved locale fixture

## Refusals (what we will NOT do)
- No {Inter/Roboto/Arial} — using {our faces}
- No indigo→violet gradient / purple-on-white
- No centered-hero + three-identical-cards
- No pill CTAs / glassmorphism-by-default / shadow-2xl-on-everything
- {project-specific refusals}

## Token block

```css
:root {
  /* Primitive tokens: color ramps, type values, space values, radii, elevation. */
  /* Semantic tokens: components reference roles only. */
}
```

## Component guidance notes

- {how components express density, shape, elevation, and interaction hierarchy}
- {responsive or accessibility constraint that downstream skills must preserve}

## Build order
design-system-interview (this) → color-system + web-typography + theming +
spacing-system → responsive-layout → component-states + form-ux + empty-states →
micro-motion + data-viz + art-direction → a11y-pass + cognitive-a11y (+ i18n-ready if
multilingual). Audit with deslop-ui + humanize-copy **against this spec**, not the
average; gate the ship with tastecheck-pass.
