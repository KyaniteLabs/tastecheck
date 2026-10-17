# Deslop UI — Committing to a Direction (the positive half)

Removing tells stops a UI from looking *wrong*. It doesn't make it look *designed*.
The difference between "not-slop" and "good" is **commitment to a specific aesthetic**.
Read this when building from scratch or when a deslopped page still feels generic.

The core insight (consistent across Anthropic's frontend guidance and every designer
who's written about AI slop): models converge on the average because the prompt left
the choice to them. Taste is *constraint*. Your job is to supply the direction the
model won't.

## The method: name → steal → state → execute

1. **Name the aesthetic in one phrase.** If you can't, you haven't decided. Good
   phrases are concrete and cultural, not adjectives:
   - "1970s ski lodge — burnt orange, avocado, warm browns"
   - "Swiss editorial — black/white, Helvetica-grade grid, red accent"
   - "terminal / brutalist — monospace, hairlines, high-contrast, no shadows"
   - "Japanese print — asymmetric, deep negative space, one ink color"
   - "solarpunk — warm optimistic yellows/greens, organic shapes"
   Avoid "modern, clean, sleek" — that *is* the average; it's how you get slop.

2. **Steal taste from references.** You (or the model) can't invent taste, but you can
   apply identified patterns. Find 2–3 real designs (Awwwards, Mobbin, a brand you
   admire) and *describe what makes them work* in design language: layout structure,
   type pairing, color relationship, spacing, motion. Feed that as the constraint.

3. **State the choices before writing code.** Commit explicitly: dominant color +
   accent, display + body fonts, radius scale, elevation scale, one signature move.
   Writing them down stops mid-build drift back to defaults.

4. **Execute with one signature move.** Designed pages usually have one memorable
   thing — a bold type treatment, an unexpected color, a distinctive grid, one
   well-orchestrated load animation. Pick one; don't scatter five micro-effects.

## The four dimensions to direct (or the model averages them)

- **Typography** — distinctive face, real contrast, decisive use. Defer to
  `web-typography`. Avoid Inter/Roboto/Arial; vary even your anti-defaults.
- **Color & theme** — one dominant color, sharp accent, neutrals tinted toward it.
  CSS variables for consistency. Defer to `color-system`. Avoid timid even palettes
  and the purple gradient.
- **Motion** — one high-impact moment (a staggered page-load reveal) beats scattered
  hover fidgets. CSS-first; respect `prefers-reduced-motion`. Defer to `micro-motion`.
- **Backgrounds** — atmosphere and depth over flat default *or* cliché blobs: a
  committed color field, subtle texture/pattern, or a relevant image.

## The distilled anti-slop direction prompt

Use/adapt this as a system or task instruction for any model generating frontend.
It pairs positive direction with explicit prohibitions — both matter, because
transformers can down-weight named patterns during inference.

```
You converge toward generic "on-distribution" output — the "AI slop" look. Avoid it.
Make a distinctive, committed interface:

- Typography: a beautiful, unique face with real contrast. NOT Inter, Roboto, Arial,
  Open Sans, or system default. State your font choice before coding.
- Color: commit to ONE dominant color + a sharp accent, via CSS variables. NOT a
  timid even palette. NOT an indigo→violet gradient, especially on white.
- Layout: NOT centered-hero-plus-three-icon-cards. Use asymmetry, varied emphasis,
  whitespace as structure.
- Motion: one well-orchestrated load (staggered reveals) over scattered micro-effects.
  Respect prefers-reduced-motion.
- Backgrounds: atmosphere/depth, not flat default and not floating gradient blobs.
- Shape: text CTAs at 6–10px radius, not pill (9999px). One elevation system, mostly
  flat — not shadow-2xl on everything.

First, name the aesthetic in one concrete phrase (e.g. "1970s ski lodge", "Swiss
editorial"). Then list your color/font/radius/elevation choices. Then build to them.
Do not drift back to defaults mid-build.
```

## Why "just avoid defaults" fails alone

If you only subtract (no purple, no Inter, no pills) but don't add a direction, the
model picks the *next* most common option — which is also a default (hence everyone's
"anti-slop" page now using Space Grotesk + teal). Subtraction without commitment just
moves the average. Always pair the prohibitions with a named, stated direction.
