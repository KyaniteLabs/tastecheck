# Spec: Tasteroll live whole-page dice demo

**Status:** ready-for-agent  
**Source:** Wayfinder map [Live whole-page dice demo](../wayfinder/MAP.md) (T01–T14)  
**Surface:** `tasteroll.html` only  
**Mode:** Decision-locked product + implementation spec (build is the next effort)

---

## Problem Statement

Visitors (and Simon) need to *feel* tasteroll — not watch a pipeline slideshow. Today `tasteroll.html` is an unapproved 5-step wizard theater, and the landing bento only prints roll chips without re-skinning a real page. That under-sells both **TasteCheck** (constrained craft) and **Chance** (real entropy). People should smash a dice on a real product page and see the **entire page** become a different high-quality design every time, because rolls only move inside TasteCheck rules.

## Solution

Ship a **literal live whole-page dice demo** on **`tasteroll.html`**:

- Stable product story (TasteCheck × Chance) and fixed section inventory.
- Fixed **header strip** with dice, roll id, and optional locks — chrome never rolls away.
- Each visit loads a **random legal roll**; each dice click re-rolls **unlocked** dimensions from a **Chance-minted inventory of roll results** (not prebuilt HTML pages).
- A whole-page **apply** path maps `ref × vibe × mode × sig` into visual system **and** layout structure under an always-on quality floor (rails + anti-slop + a11y).
- Dual-product honesty: inventory ordered/ids by **real Chance** at mint time; visitors do not need a live Chance server.

## User Stories

1. As a visitor, I want to open `tasteroll.html` and immediately see a complete, tasteful page, so that the first impression is craft — not a broken specimen or empty shell.
2. As a visitor, I want each visit to start on a random legal design, so that reloads feel alive without me clicking first.
3. As a visitor, I want a persistent dice control that never disappears when the page re-rolls, so that I always know how to try again.
4. As a visitor, I want clicking the dice to change the entire page’s look and structure, so that I experience constrained randomness as a product, not as text chips.
5. As a visitor, I want the product story and section meanings to stay the same across rolls, so that I can still understand what tasteroll is.
6. As a visitor, I want layout structure to change with rolls (not only colors), so that each roll feels like a different design world.
7. As a visitor, I want typography, density, radius personality, and surfaces to change with rolls, so that the visual system is part of the dice, not a fixed skin.
8. As a visitor, I want every roll to remain readable and high-contrast, so that “always quality” is believable.
9. As a visitor, I want never to see classic AI-slop tells on the rolled page (purple gradients, glass, pill-999 CTAs, centered three equal cards as the hero pattern), so that TasteCheck’s anti-slop claim holds on the proof surface.
10. As a keyboard user, I want skip link, main landmark, visible focus, and reachable controls on every roll, so that access is not optional on the demo.
11. As a visitor who prefers reduced motion, I want roll transitions to respect `prefers-reduced-motion`, so that the demo is not hostile.
12. As a visitor, I want to lock a dimension I like (ref, vibe, mode, or sig), so that I can re-roll only what still feels wrong.
13. As a visitor, I want to unlock a locked dimension, so that I can explore again without reloading.
14. As a visitor, I want full re-roll of all unlocked dimensions on each click, so that smashing the dice is the default path.
15. As a visitor, I want to see the current roll id / seed in the header, so that I can talk about a specific result.
16. As a visitor, I want a shareable URL that reopens the same roll, so that I can send a design to someone else.
17. As a visitor, I want the header strip itself not to restyle into unreadability when the page rolls, so that controls stay trustworthy.
18. As a visitor, I want copy that introduces **both** TasteCheck and Chance, so that I understand the dual product.
19. As a visitor, I want Chance credited honestly (minted with Chance; not a live API dependency on every click), so that I am not misled about how the demo works.
20. As a visitor, I want no algorithm names (e.g. PRNG internals) in visible UI copy, so that the page sells value, not implementation trivia.
21. As a visitor, I want links to install / skill docs / gallery sample, so that I can go deeper after the demo.
22. As a visitor, I want the page to work when served as static site files, so that GitHub Pages and local `http.server` both work without a Chance process.
23. As an implementer, I want a frozen roll payload matching the landing UI chips (`ref`, `vibe`, `mode`, `sig`), so that demo and landing share one language.
24. As an implementer, I want each chip’s apply meaning defined (ref = layout world, vibe = personality, mode = surfaces, sig = signature move), so that I do not invent a third system.
25. As an implementer, I want inventory rows to be **roll results only**, so that I do not pre-generate 1536 full HTML documents.
26. As an implementer, I want inventory mint to use real Chance for order/ids over the legal set, so that Chance is dogfooded at authoring time.
27. As an implementer, I want soft “story” pair bans rejected, so that Chance is not neutered by arbitrary vibe policing.
28. As an implementer, I want illegal mint rows only when unrenderable or structurally impossible, so that quality stays a render/gate concern.
29. As an implementer, I want up to **1536** legal tuples when all recipes exist, so that inventory size matches the face product, not a vanity 1000.
30. As an implementer, I want a build-time renderer-ready filter, so that partial layout recipes do not ship broken rolls.
31. As an implementer, I want a fixed section inventory, so that apply restructures presentation without inventing or deleting product content.
32. As an implementer, I want self-contained page assets (system fonts and/or repo-bundled fonts only; no CDN CSS/JS), so that the page matches TasteCheck shipping norms.
33. As an implementer, I want `overflow-x: hidden` and responsive behavior, so that layout rolls do not break the viewport.
34. As a maintainer, I want inventory regeneration when faces or recipes change, so that the deck stays honest.
35. As a maintainer, I want the 7-phase agent skill left intact, so that this demo does not redesign tasteroll’s agent architecture.
36. As Simon, I want this surface on `tasteroll.html` only, so that the main landing keeps its existing job.
37. As Simon, I want no audit→fix→roll wizard as the primary UX, so that the demo is the product feel, not a tutorial machine.
38. As a visitor with locks set, I want re-rolls to never change locked dimensions, so that progressive commitment works.
39. As a visitor walking a shuffled deck, I want not to immediately repeat the same roll when alternatives remain, so that exploration feels broad.
40. As a visitor at the end of a shuffled deck, I want reshuffle (or equivalent) so that infinite clicking still works.
41. As a screen-reader user, I want roll changes announced politely (live region for roll id/chips), so that state changes are perceptible.
42. As a visitor, I want dual mode (light/dark/dual) to remain a first-class die face, so that surface posture is part of the roll language already on the landing.
43. As an implementer, I want accent contrast rules derived from mode at render time, so that dual/light/dark stay WCAG-safe without inventory bans on mode.
44. As a visitor, I want the demo to still load if inventory is present but Chance is offline, so that the public site never hard-depends on a local Rust server.
45. As a reviewer, I want acceptance checks tied to external behavior (DOM/URL/contrast/section presence), so that agents can verify without snapshotting private helpers.

## Implementation Decisions

### Seams (approved)

1. **Inventory mint** — Build-time: face cartesian (≤1536) ∩ renderer-ready → Chance-ordered roll-result artifact.
2. **Apply / whole-page render** — Runtime: one roll result → entire page visual system + layout under quality floor; header strip excluded.
3. **Demo interaction** — Dice, locks, shuffle deck, shareable id/URL, random first load.

Primary product seam: **apply**. Mint and interaction exist to feed/drive it.

### Surface and chrome

- Only **`tasteroll.html`** is the whole-page re-roll surface.
- **Fixed header strip:** dice, roll id/seed, lock chips for ref/vibe/mode/sig; not part of the rolled tree.
- Landing `index.html` may keep its chip preview; it is not this demo’s primary surface.

### Stable content and section inventory (T14 default)

Fixed IA (always present; apply may restructure *how* they appear, not delete them):

1. **Header strip** (control chrome — outside roll)
2. **Hero** — product name + one-line promise
3. **What it is** — TasteCheck × Chance dual product
4. **How the dice works** — roll / lock / re-roll in plain language
5. **Quality floor** — rails + anti-slop + a11y as the reason every roll stays good
6. **Install / skill** — path into the pack
7. **Sample / gallery** — link to procedural specimen or gallery
8. **Footer**

Copy identity is the **real tasteroll product page**, not a fictional third product.

### Roll payload (landing-aligned)

| Dim | Faces |
|-----|--------|
| **ref** | mineral, Swiss, brutalist, folio, shipping, clinical, humanist, maximalist |
| **vibe** | warm, serious, playful, refined, stark, editorial, operational, decorative |
| **mode** | light, dark, dual |
| **sig** | needle, rule, display-word, color-block, bento, timeline, annotation, sixling |

### Apply contract

| Dim | Whole-page effect |
|-----|-------------------|
| **ref** | Layout world + material language (largest structural swing) |
| **vibe** | Personality of type / weight / radius / motion restraint within rails |
| **mode** | Light / dark / dual surface recipe (accent lightness rules at render) |
| **sig** | One committed signature move |

Schema may expand later; v1 is these four.

### Legal set / inventory

- Soft taste pair-bans: **void**.
- Illegal only if **unrenderable** or **structurally impossible** (engineering).
- When all recipes exist: **1536** legal roll results.
- Inventory stores **roll results only** (e.g. `{ id, ref, vibe, mode, sig }`), not full page HTML.
- **Real Chance** used at mint to shuffle/order/assign ids over the legal set.
- Runtime: shuffled deck per visit; shareable id in URL + header; no live Chance required for visitors.
- Optional build-time ∩ `renderer_ready(ref, sig)`.

### Interaction

- Full re-roll of unlocked dims on dice click.
- Optional per-dim locks.
- Random legal entry on first load.
- Prefer avoid immediate repeat while alternatives remain; reshuffle when deck exhausted.

### Quality floor (always on — this is the demo)

- Design rails (measure, line-height, radius set, one accent, contrast mins, density bounds, compatibility as applicable at render).
- Anti-slop banlist on rolled surface and chrome.
- A11y: skip, main, focus-visible, keyboard reachability, reduced-motion; contrast floors after every apply.
- No quality opt-out checkbox.

### Assets / packaging

- Self-contained: no external CDN fonts/CSS/JS; system stacks and/or repo `site/fonts/`.
- `overflow-x: hidden` on html.
- Value copy only; no PRNG algorithm names in visible UI.

### Relationship to agent skill

- 7-phase tasteroll skill architecture remains FINAL for agents.
- Demo freezes a discrete deck for a static page; it does **not** run browser-side LLM GENERATE.
- Honest copy: agent skill generates fresh faces per project; this page demonstrates constrained whole-page apply of a Chance-minted deck.

### Mint pipeline (fog resolved at default level)

- Inventory artifact regenerated when faces or recipes change.
- Exact script path left to implementer under repo tools/assets conventions; must invoke real Chance for ordering/ids when available at mint time, with a documented fallback only for mint CI if Chance cannot run (must still produce a full legal cover, not a tiny stub deck).

### Dual-product credit (fog default)

- Header may show Chance/TasteCheck credit; body **What it is** section carries the dual-product narrative.

## Testing Decisions

### What makes a good test

- Assert **external behavior only**: URL/query roll id, visible section presence, lock behavior, inventory file schema, contrast/a11y floor checks, absence of banlist patterns, that header controls remain after apply.
- Do **not** assert private helper names, PRNG internals, or pixel-perfect screenshots as the sole gate.
- Prefer highest seams: inventory artifact validity; apply(result) → DOM contracts; interaction flows.

### Modules / surfaces under test

1. **Inventory mint** — schema, cardinality ≤1536, only known faces, optional renderer-ready subset, stable ids.
2. **Apply** — given a roll result, required sections exist; ref/sig change structural markers; mode changes surface tokens; locked dims unchanged across re-roll; quality floor heuristics pass.
3. **Interaction** — dice advances; locks stick; shareable URL restores roll; reduced-motion path does not require animation.

### Prior art

- Landing page already exercises chip roll/lock UI patterns (`index.html` tasteroll cell) — demo must go further (whole-page apply).
- Skill assets: design rails and tasteroll engine as conceptual reference for lock/reroll — demo inventory path supersedes live Chance each click for visitors.
- Repo verification culture: pack-level verify gates; this feature may add focused smoke/DOM checks rather than expanding the full gate until implementer chooses.

## Out of Scope

- Implementing inside the wayfinder planning map itself (this spec is the handoff).
- Making `index.html` the primary whole-page re-roll surface.
- Browser-side live LLM GENERATE of open-ended aesthetic phrases.
- 5-step audit→fix→roll wizard as primary UX.
- Requiring live public Chance HTTP on every visitor click.
- Soft taste ban matrices and vanity inventory padding.
- Rutile/FeatherMark integration.
- Redesigning the 7-phase agent skill pipeline.
- Closing every optional product fog (exact mint script name, microcopy tone) beyond defaults above.

## Further Notes

- Wayfinder source of truth for decisions: `docs/wayfinder/` (T01–T14).
- Canonical in-repo spec path: `docs/spec/tasteroll-live-demo.md` (this file).
- Supersedes prior ralplan wizard/specimen approaches and the voided 951 soft-ban matrix.
- Success for Simon: smash dice many times → always a different high-quality whole page; dual product clear; no theater.
