---
name: art-direction
description: >-
  Imagery, illustration, and iconography direction for web UI. Use for hero
  images, photo treatment, illustration style, icon sets, favicons, OG/social
  cards, decorative graphics, image-shaped holes, and removing generic AI imagery.
---

# Art Direction

Art direction gives imagery a job in the interface: orient, explain, establish trust, or create a controlled emotional cue. It is not a list of visual adjectives.

## Set the visual job before selecting assets

Write a one-line stance: audience, moment, desired response, and what imagery must communicate that copy cannot. Then choose one primary treatment and one fallback. A treatment can be documentary detail, diagrammatic illustration, editorial crop, icon system, or deliberately no image.

| Decision | Specify | Reject when |
| --- | --- | --- |
| Subject | people, object, place, or abstract concept | it repeats the headline without adding evidence |
| Point of view | distance, angle, energy, inclusion | it turns a serious task into decoration |
| Composition | focal zone, text-safe area, responsive crop | the message disappears at narrow widths |
| Surface | palette, texture, line weight, lighting | it conflicts with product semantic states |
| Rights | source, license, attribution, expiry | ownership or reuse is unknown |

## Turn the stance into an asset contract

For each proposed asset, record its source, allowed use, focal subject, crop anchors for wide and narrow layouts, overlay treatment, and alt decision. If no approved library exists, deliver a search brief or commissioning brief—not fabricated filenames or claimed licenses.

- Make the narrow crop independently legible; do not assume a desktop crop merely shrinks.
- Reserve readable text space in the composition before applying an overlay.
- Prefer a coherent series over unrelated stock images. Inclusion must be credible to the subject and setting.
- Use decorative alt only when removing the image loses no task-relevant information. Otherwise state the information in concise alt text or adjacent copy.

## Prove it in the rendered layout

Show one wide and one narrow composition with the real headline, navigation, and state colors present. Check that focal content survives crops, overlays preserve text contrast, repeated cards do not create visual noise, and icons remain distinguishable at their rendered size.

Deliver a small treatment board with: stance, primary/fallback treatment, two representative assets or search terms, crop notes, rights status, alt strategy, and the reject criterion. Treat source URLs, licenses, and approval status as evidence—not ornamental credits.

Use [decision records](references/decision-records.md) when competing treatments require a documented trade-off.

## Favicons and app icons

Ship an SVG favicon primary (`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`)
with a PNG fallback. Derive the mark from the committed stance; test legibility at 16×16
actual pixels — a single bold glyph outperforms a detailed logo. Apple Touch Icon (180),
manifest icons (192/512), and OG preview are separate deliverables with their own crop and
contrast needs. See [patterns](references/patterns.md) for worked examples.

## Ship check

- [ ] The treatment explains a product or content need that copy alone cannot.
- [ ] Every selected image has source, rights, crop, and alt decisions.
- [ ] The narrow composition and text-over-image state have been reviewed.
- [ ] A missing or unlicensed asset is represented as a brief, not an invented deliverable.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A product needs a committed imagery, illustration, or iconography system with source and rights decisions.; avoid: The request is only a color, type, or layout decision.
- Exclude: Do not use placeholder imagery when the brief requires a real asset plan. (+1 in contract.json)
- Stop / handoff: Stop when source or rights constraints cannot be verified. (+1 in contract.json); receives [design-system-interview, improve-existing-website, tasteroll] -> sends [responsive-layout, a11y-pass, deslop-ui, tastecheck-pass]
- Output: source-aware visual treatment and asset plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
