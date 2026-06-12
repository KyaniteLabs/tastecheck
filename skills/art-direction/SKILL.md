---
name: art-direction
description: >-
  Imagery, illustration, and iconography direction for web UI. Use for hero
  images, photo treatment, illustration style, icon sets, favicons, OG/social
  cards, decorative graphics, image-shaped holes, and removing generic AI imagery.
---

# Art Direction (imagery · illustration · iconography)

You can commit the type, the color, the layout — and one generic stock photo or a
mixed-style icon row undoes all of it. Imagery is the **largest unguarded slop
surface**: gradient-blob "AI illustrations," interchangeable laptop-and-coffee stock,
emoji standing in for icons, three icon sets at three stroke weights on one page.
This skill makes the image layer as *decided* as the tokens.

Governing rule: **every image-shaped hole gets one committed answer, applied
everywhere.** "We use duotone photography in the brand hue" is a system. "Whatever
fits each card" is slop with extra steps.

## The decision order

1. **Stance first (one of four).** For the whole surface, commit to: **photography**
   (with a named treatment), **illustration** (with a named style), **type/texture as
   imagery** (no pictures; typography, color fields, generated/abstract texture do the
   work), or **none** (ruthlessly clean). Mixed stances need a rule for *which goes
   where*, or they read as template-fill.
2. **Treatment makes ownership.** Raw stock reads as stock. A committed treatment —
   duotone in the brand hue, consistent crop ratio, grain, a drawn border, strict
   subject rules ("hands and materials, never faces-at-camera") — makes any source
   look designed. Define it as values: ratio, filter/overlay recipe, corner radius
   (from `--radius-card`).
3. **One icon set, by name, at one weight.** Pick a set (e.g. Lucide, Phosphor,
   Heroicons, Material Symbols — or the project's own), one stroke weight, 2 sizes
   (`1em` inline / a fixed UI size), one color rule (`currentColor` unless decided
   otherwise). Never mix sets; never use emoji as UI icons (see `deslop-ui`).
4. **The functional images.** Favicon + touch icon, OG/social card (1200×630, real
   type at readable size, on-system), and empty-state/error illustrations (consistent
   with the stance — see `empty-states`). These ship with v1, not "later."
5. **Performance & accessibility pass.** Dimensions on every `<img>` (no CLS),
   `loading="lazy"` below the fold, modern formats (AVIF/WebP with fallback),
   `srcset/sizes` for content images; meaningful `alt` for informative images,
   `alt=""` for decorative; never text-in-image for UI copy.

## Non-negotiables

- **No unowned imagery.** Every image passes the test: "could this exact image appear
  on a competitor's site?" If yes, treat it or cut it.
- **No AI-tell graphics:** gradient blobs/orbs, glossy 3-D mascots, fake screenshots
  with lorem ipsum, "diverse hands around a laptop" stock. (The named tells live in
  `deslop-ui`; this skill supplies the replacement.)
- **One icon set / one stroke weight / one color rule** — checkable by listing the
  imports.
- **Icons never carry meaning alone** — pair with text labels except in
  space-constrained, convention-backed cases (and then `aria-label` them).
- **Every `<img>` has explicit dimensions** (or `aspect-ratio`) — zero image-driven CLS.
- **OG card + favicon exist and are on-system** before anything ships.
- **Decorative images are `alt=""`** and never block content (no text baked into
  pictures).

## Quick-start: committed treatment + icon rules

```css
/* Photo treatment: duotone toward the brand hue + fixed ratio — ownership recipe */
.media { aspect-ratio: 3 / 2; overflow: hidden; border-radius: var(--radius-card); }
.media img { width: 100%; height: 100%; object-fit: cover;
             filter: grayscale(1) contrast(1.05); }
.media::after { content: ""; position: absolute; inset: 0;
                background: var(--color-primary); mix-blend-mode: color; opacity: .85; }

/* Icons: one set, currentColor, two sizes */
.icon       { width: 1em; height: 1em; stroke-width: 1.5; color: currentColor; }
.icon-ui    { width: 20px; height: 20px; }
```

```html
<img src="/img/team.avif" width="1200" height="800" alt="Two bakers shaping dough"
     loading="lazy" />
<img src="/img/divider.svg" alt="" role="presentation" />
```

## Self-check (before shipping the image layer)

1. One stance named (photography / illustration / type-texture / none) and applied
   consistently — with a written rule for any mixing?
2. A treatment recipe stated as values (ratio, filter/overlay, radius) — no raw stock?
3. Exactly one icon set at one stroke weight; zero emoji-as-icons; icons labeled or
   paired with text?
4. Favicon, touch icon, and a real on-system OG card shipped?
5. Every `<img>` dimensioned (no CLS), lazy below the fold, modern format, honest `alt`?
6. Would any image pass unnoticed on a competitor's site? → treat or cut it.
7. Empty/error illustrations match the stance (not a random undraw-style orphan)?

## How to deliver

- State the stance and recipe like tokens: "photography, duotone `--color-primary`,
  3:2, grain at 4%; icons Lucide 1.5px stroke, currentColor."
- The stance belongs in `DESIGN-SYSTEM.md` (the interview's imagery question feeds
  this skill); `deslop-ui` audits against it.
- Pair with `empty-states` (illustrations), `theming` (treatments must hold in dark
  mode — re-check overlay opacities), `a11y-pass` (alt text, contrast of text over
  images).

## Reference files

- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.
