# Design System — {Project Name}

**Status:** {approved | approval-ready | blocked}
**Next move:** {first build action, or unresolved decision + owner}

`approved` = confirmed and buildable. `approval-ready` = recommendations complete but
awaiting confirmation; no implementation handoff. `blocked` = contradiction or missing
authority prevents a safe recommendation.

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
- **Neutrals:** {true neutral | temperature/hue bias} because {content or brand reason}
- **Mode:** {light only / light+dark}
- **Contrast notes:** {measured foreground/background pairs and any remediation}

## Spacing scale and shape (→ spacing-system, components)
- **Density:** {spacious | dense}
- **Corner radius:** controls {0–4|8–12|16+}px · cards {…}px · intentional exceptions {none | named component + reason}
- **Elevation:** {flat+borders | layered shadow scale}

## Motion (→ micro-motion)
- **Level:** {restrained | lively | none}

## Language (→ i18n-ready, if multilingual)
- **Languages:** {e.g. EN + ES} · UI must hold the longest approved locale fixture

## Refusals (what we will NOT do)

Name only defaults this brief has actually ruled out:

- {refusal} → use {committed alternative}
- {refusal} → use {committed alternative}
- {refusal} → use {committed alternative}

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

## Open decisions

| Decision | Current recommendation | Evidence | Owner / confirmation needed |
| --- | --- | --- | --- |
| {none, or unresolved decision} | {specific recommendation} | {source} | {person or condition} |

## Build order
design-system-interview (this) → color-system + web-typography + theming +
spacing-system → responsive-layout → component-states + form-ux + empty-states →
micro-motion + data-viz + art-direction → a11y-pass + cognitive-a11y (+ i18n-ready if
multilingual). Audit with deslop-ui + humanize-copy **against this spec**, not the
average; gate the ship with tastecheck-pass.
