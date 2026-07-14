# Wayfinder map: Live whole-page dice demo

**Tracker:** Local markdown (`docs/wayfinder/`) — canonical in-repo.  
**Repo:** TasteCheck · workspaces/tastecheck  
**Status:** Spec published — wayfinder decisions complete; implementation is next (`docs/spec/tasteroll-live-demo.md`)

## Destination

A **decision-locked written specification** for a **literal live whole-page dice demo** on **`tasteroll.html` only**: visitors smash the dice and the **entire page** re-rolls every TasteCheck-allowed visual/layout dimension under hard rails, always high quality. Inventory of **roll results** is minted with **real Chance**; the page applies them. **This map does not implement the page** — build is a later handoff from the locked spec (destination mode **A+C**).

## Notes

- **Domain:** TasteCheck craft rails + Chance entropy; dual-product intro
- **Skills:** grilling, domain-modeling; later write the product spec from closed tickets; then implementation outside this map
- **Architecture:** 7-phase tasteroll skill remains FINAL for the agent skill; this map is about the felt demo surface, not redesigning the skill pipeline
- **Do not revive:** wizard/pipeline theater, fixed 8-aesthetics-only costume system, silent fake Chance as the public story
- **Standing truth:** options are not a static global menu in the real skill (GENERATE is context-fresh); the demo freezes a landing-aligned discrete deck for a static page

## Decisions so far

- [Destination and delivery mode](./tickets/T01-destination-mode.md) — Spec + decision lock only (A+C); no build in this map.
- [Demo surface](./tickets/T02-demo-surface.md) — `tasteroll.html` only; landing points, does not re-roll.
- [What the dice may change](./tickets/T03-roll-scope.md) — Visual system + layout structure (A+B); not copy rewrite; not product identity swap.
- [Click and lock model](./tickets/T04-click-and-lock.md) — Full re-roll of unlocked dims; optional locks; shuffled deck + shareable roll id.
- [Control chrome](./tickets/T05-control-chrome.md) — Fixed header strip (dice, seed/id, locks); chrome is not part of the roll.
- [Quality floor](./tickets/T06-quality-floor.md) — Always-on rails + anti-slop banlist + a11y; this is the demo; no quality opt-out.
- [First load](./tickets/T07-first-load.md) — Random legal inventory entry every visit.
- [Chance and inventory](./tickets/T08-chance-inventory.md) — Real Chance mints roll results only; runtime draws inventory; not full prebuilt designs; not live Chance required for visitors.
- [Roll payload](./tickets/T09-roll-payload.md) — Landing UI aligned: ref x vibe x mode x sig (not a neutered 8-aesthetic-only system).
- [Apply contract](./tickets/T10-apply-contract.md) — What each chip does on the whole page (ref/vibe/mode/sig).
- [Stable content](./tickets/T11-stable-content.md) — Real tasteroll product page copy/IA; design re-rolls around fixed product story.
- [Legal compatibility matrix for the demo deck](./tickets/T12-legal-matrix.md) — Illegal only if unrenderable/structurally impossible; soft taste bans void; full cover **1536** when all recipes exist.
- [Spec artifact path and shape for handoff](./tickets/T13-spec-artifact.md) — `docs/spec/tasteroll-live-demo.md` + ready-for-agent issue.
- [Fixed section inventory of the product page](./tickets/T14-section-inventory.md) — Hero, dual product, dice how-to, quality, install, sample, footer.

## Not yet specified

- Exact mint script path under tools/ (implementer choice within defaults in the locked spec)

## Spec handoff

- [Tasteroll live whole-page dice demo](../spec/tasteroll-live-demo.md) — locked to-spec; ready-for-agent
- [Implementation tickets](../impl/tasteroll-live-demo/README.md) — I01–I07; GitHub map in GITHUB.md

## Out of scope

- Implementing `tasteroll.html` inside this wayfinder map (build after spec handoff)
- Making `index.html` the primary whole-page re-roll surface
- Browser-side live LLM GENERATE of open-ended aesthetic phrases
- 5-step audit-fix-roll wizard theater as the demo UX
- Requiring live public Chance API on every visitor click
- Expanding inventory with duplicate roll tuples for vanity size
- Rutile/FeatherMark integration details (separate product surface)
- Redesigning the 7-phase agent skill pipeline
