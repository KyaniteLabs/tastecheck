# Structure & Rhythm — committing the layout, not just the tokens

The hardest lesson: a committed palette and type system still produces **slop if the
*structure* defaults to the template** (centered hero → 3-step → uniform grid). The
interview must extract *structural* decisions too, and the `DESIGN-SYSTEM.md` must record
them. Color and font are the easy half; structure and rhythm are where pages actually
escape the average. Read this when running the interview and when writing the spec.

## Why this matters
We shipped pages that were palette-correct and type-correct and *still* generic, because
the layout was the AI-SaaS skeleton. Structure is a first-class design decision — treat it
like color, not an afterthought. (See `deslop-ui` → `structural-tells.md` for the failure
catalogue this prevents.)

## The structure & rhythm questions (add to the interview)

Ask these alongside the visual ones; land each on a committed answer in the spec.

1. **Composition — symmetric or asymmetric?** "Centered single-column (calm, classic) or
   asymmetric/offset (dynamic, editorial)?" Default to *committing to one*; reflexive
   centered is a tell. → records `composition: asymmetric|centered, with <focal logic>`.
2. **Spatial motif — what organizes the layout?** Is there a structural idea from the
   references — a grid, a tessellation/bento, columns, a diagonal, overlap/collage? "Your
   references had basalt + Voronoi → cells as layout, not wallpaper." → records the motif.
3. **Rhythm — metronomic or syncopated?** "Should sections feel even and regular, or
   varied — different widths, densities, treatments?" Syncopation (varied section
   treatments) is the antidote to the template stack. → records `rhythm` + how sections vary.
4. **Density — spacious or dense?** (also a visual question, but it's structural too).
5. **The ONE structural signature.** "What's the single memorable structural move —
   oversized index numerals, an exposed grid, a tessellated showcase, a split hero?"
   Designed pages have one; slop has none. → records the signature.
6. **Section inventory — what sections, in what order?** Don't default to the SaaS stack.
   Decide which sections the *content* needs and how they're treated, varied deliberately.

## Recording it in DESIGN-SYSTEM.md
Add a **Structure** block to the committed spec, e.g.:
```
## Structure & rhythm
- Composition: asymmetric; focal point upper-left, content left-anchored.
- Spatial motif: Voronoi/basalt cells used as the showcase layout (irregular bento).
- Rhythm: syncopated — hero (full-bleed), problem (split), interview (transcript),
  skills (tessellated bento), install (band). No two sections share a treatment.
- Density: spacious in hero, dense in the bento.
- Signature: oversized corroded index numerals + iridescent cell edges.
- Section order: hero → problem(2 slops) → interview transcript → skills bento → install.
  (NOT the generic hero→3-step→card-grid skeleton.)
```

## The rule
**If you can't name the structural choice, it's a default — and a default is slop.**
The other skills (responsive-layout, the page build) execute this structure; `deslop-ui`
audits the built page against it. Structure is committed here, first.

## Self-check (structure half of the interview)
- [ ] Composition decided (asymmetric vs centered) — not reflexive-centered.
- [ ] A spatial motif named (or deliberately "none, pure type").
- [ ] Rhythm decided (syncopated vs even) and how sections vary.
- [ ] One structural signature chosen.
- [ ] Section inventory/order decided by content, not the SaaS template.
- [ ] All recorded in the DESIGN-SYSTEM.md Structure block.
