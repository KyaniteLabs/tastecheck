---
name: deslop-ui
description: >-
  Anti-slop UI review for generated or generic frontend work. Use after LLM UI
  output, or for requests to remove AI tells: purple gradients, pill CTAs,
  default type, centered heroes, three-card grids, glassmorphism, and template sameness.
---

# Deslop UI

LLMs don't have taste; they have a statistical average. Ask one to "build a
landing page" and you get the median of every Tailwind tutorial scraped
2019–2024 — and that median is purple, centered, pill-buttoned, and Inter. This
skill is the **AI-tell detector for visual design**: a catalog of the specific
giveaways with the exact value to change, so a generated UI stops announcing that
a machine made it.

The mindset: **slop is not "ugly," it's "predictable."** The fix is rarely "more
polish" — it's *committing to specific, non-default choices*. Every rule here is
checkable (a value, a count, a yes/no), never a vibe. If you can't verify it, it
isn't in this skill.

## How to use this skill

1. **Scan** the UI/code against the **Tell Catalog** below — it's grep-able.
2. For each tell present, **apply the fix** (specific value, not "improve it").
3. Run the **self-check** at the end before claiming the UI is deslopped.
4. For the deeper "why" and how to make *committed* choices (not just avoid
   defaults), read `references/anti-patterns.md` and `references/design-direction.md`.

The single most important move (from Anthropic's own frontend guidance): **don't
just remove defaults — commit to a direction.** Removing purple but staying
generic everywhere else still reads as slop. Pick a real aesthetic and follow it.

## The Tell Catalog (the named giveaways + the fix)

Each entry: **the tell → why it reads as AI → the fix (specific value).**

### Color
- **The purple gradient** — `linear-gradient` from indigo `#6366f1`/`#818cf8` to
  violet `#a855f7`/`#c084fc`, usually on the hero. *The* canonical AI tell (Tailwind's
  old `bg-indigo-500` default, which Adam Wathan publicly apologized for in 2025).
  **Fix:** choose one committed brand hue with intent; if you gradient, keep it
  within-hue or to an analogous neighbor, low spread, and not on white. Never ship
  indigo→violet on a white hero.
- **Default Tailwind slate/gray everything** — `bg-slate-50`, `text-gray-500`,
  `border-gray-200` untouched. **Fix:** define real semantic tokens; tint your
  neutrals slightly toward the brand hue so grays aren't dead CPU-gray.
- **Timid, evenly-distributed palette** — five pastels at equal weight, no anchor.
  **Fix:** one dominant color + sharp accent; most of the page is neutral.

### Buttons & shape
- **Pill CTAs** — `border-radius: 9999px` / `rounded-full` on primary action
  buttons. Reads as template. **Fix:** 6–10px (`rounded-md`/`rounded-lg`). Reserve
  fully-round for tags, chips, avatars, icon buttons — not text CTAs. (Exception
  that proves the rule: if the project's *committed* DESIGN-SYSTEM.md chooses pills
  as a deliberate signature, that's a choice, not a tell — slop is the *unchosen*
  default, never the documented decision.)
- **Everything same radius** — every card, input, button at `rounded-xl`. **Fix:**
  one radius system with 2–3 steps (e.g. 6px controls / 12px cards), applied by role.
- **Uniform heavy shadow** — `shadow-2xl` (or `shadow-lg`) on every card. **Fix:**
  one elevation system; most surfaces flat or `shadow-sm`; reserve big shadow for
  truly-floating elements (modals, popovers).

### Typography
- **Inter / Roboto / Open Sans / Arial / system default** as the unexamined
  hero/headline face on brand, marketing, portfolio, or launch surfaces. The
  "safe font" tell. **Fix:** one deliberate type stance: a distinctive display
  face when the surface needs brand personality, or an explicitly performance-first
  system stack for operational product UI. Pair on contrast. (See the
  `web-typography` skill for the full system.)
- **Timid scale** — H1 only ~1.5× body, weight 600 vs 400. **Fix:** real jumps
  (3×+ size between display and body) and weight extremes (800/900 vs 300/400).

### Layout
- **Centered hero + one CTA + three icon cards below.** The SaaS-template skeleton.
  **Fix:** break symmetry — asymmetric/split hero, off-center focal point, vary the
  card count and sizes (bento, not 3-equal-boxes), use whitespace as structure.
- **`min-h-screen` flex-center on every section.** Everything vertically dead-center.
  **Fix:** intentional vertical rhythm; left-anchored content; varied section heights.
- **Equal-weight 3-column grid for features.** **Fix:** vary emphasis — one hero
  feature larger, supporting ones smaller; or a list with a strong lead.

### Effects & decoration
- **Glassmorphism by default** — `backdrop-filter: blur()` + translucent white on
  cards everywhere. **Fix:** use at most once, on purpose (e.g. a sticky nav over
  imagery); never as the default card style.
- **Animated gradient blobs / floating orbs** in the background. Pure AI-hero cliché.
  **Fix:** real atmosphere — a subtle texture, a committed flat color field, or a
  relevant image; or nothing.
- **Emoji section headers** — "🚀 Features", "✨ Benefits", "💡 How it works".
  **Fix:** real headings; if you use icons, use a consistent icon set, sized and
  aligned, not emoji.
- **Gradient text on headlines** (`background-clip: text` indigo→pink). **Fix:**
  solid color; if you must, keep it subtle and within-hue.

### Function (the slop nobody sees until they use it)
- **Forms with no states** — no required markers, no validation, no error/empty
  states. LLMs copy static markup, not behavior. **Fix:** add required indicators,
  inline validation, error + empty + loading states. (See `form-ux`, `empty-states`.)
- **Fake/placeholder content left in** — "Lorem ipsum", "Company Name", three
  identical testimonials from "John Doe". **Fix:** real or realistic varied content;
  varied names, lengths, avatars.

## Self-check (run before claiming "deslopped")

Answer each; any "yes" in the first group means it's still slop:
1. Any pill-shaped **text** CTA (`rounded-full`/9999px)? → fix to 6–10px.
2. Indigo→violet gradient, especially on white? → recolor to committed hue.
3. Headline font Inter/Roboto/Arial/system? → swap to a distinctive face.
4. Layout = centered hero + 3 equal icon cards? → break the symmetry.
5. `shadow-2xl`/heavy shadow on most cards? → one elevation system, mostly flat.
6. Glassmorphism or gradient-blobs as default decoration? → remove or use once.
7. Emoji in section headers? → real headings/icon set.
8. Default untouched Tailwind slate/gray tokens? → semantic, hue-tinted tokens.

Then the **structural check** — sketch the page's section stack first; these can't be
grepped, which is exactly why generated pages pass the surface checks and still ship
the generic skeleton (any "yes" here is still slop):

9. Section stack = the SaaS template skeleton (nav → centered hero → "the problem" →
   3-step "how it works" → uniform card grid → testimonial/stat-counter band → CTA →
   footer)? → reorder, cut, or vary section treatment.
10. Any uniform equal-card grid — N identical bordered boxes (the "three cards", or
    6/9/12)? → irregular sizes, a lead item, or not a grid at all.
11. Every section the same rhythm (eyebrow → H2 → lede → grid, same padding, same
    shape)? → syncopate width, density, alignment, and treatment.
12. Image-shaped placeholder boxes where the committed spec promised real imagery?
    → ship the committed art direction or change the commitment (see `art-direction`).

Then the **commitment check** (the positive half — see `references/design-direction.md`):
13. Can you name the aesthetic in one phrase ("1970s ski lodge", "Swiss editorial",
    "terminal/brutalist")? If not, you've only removed defaults, not designed.
14. Is there one dominant color and one real accent — not five timid pastels?
15. Does typography have real size/weight contrast (3×+ / 800-vs-300)?

## Three planes of slop (don't stop at the surface)

Slop lives on three planes — fixing one leaves the others:
1. **Surface/visual** — palette, type, shape, effects (the Tell Catalog above).
2. **Structural** — the layout *skeleton* and rhythm. You can fix every pill button and
   still ship the generic SaaS skeleton (centered hero → 3-step → uniform card grid).
   This is the deepest layer and the one most AI pages never escape. The runnable
   checks are items 9–12 of the self-check above — they are part of every deslop pass,
   not optional reading; `references/structural-tells.md` is the full catalog with
   fixes. **Audit every page structurally, not just its parts.**
3. **Verbal** — the copy/voice (the ChatGPT accent). Hand to the **`humanize-copy`** skill.

And slop **moves**: each anti-slop choice becomes next year's default. `structural-tells.md`
carries a *dated* list of the current "tasteful-default" attractors (cream-Fraunces;
dark-neon-SaaS) to avoid by reflex. Rule: **subtraction moves the average; only commitment
escapes it** — pair every prohibition with a committed direction from `design-system-interview`.

## Reference files

- `references/anti-patterns.md` — the full catalog with before/after code snippets
  and the reasoning behind each tell. Read when reviewing real code or when you need
  the copy-paste fix.
- `references/structural-tells.md` — the **structural** plane: the SaaS-template skeleton,
  centered/symmetric layouts, uniform card grids, metronomic rhythm, and the dated
  current-attractor list. Read when reviewing a whole page, not just components.
- `references/design-direction.md` — the *positive* half: how to commit to an
  aesthetic, the "name the vibe / steal taste from references / state the choice
  before coding" method, and the distilled anti-slop direction prompt. Read when
  building from scratch, not just cleaning up.
- `references/decision-records.md` — meta-patterns (why models converge, why
  commitment beats avoidance) and ADR-style rules. Read for novel cases.

## How to deliver

- When you deslop, **say what you changed and why** in design terms: "pill CTA →
  8px radius; indigo→violet hero → single committed teal; Inter → Fraunces display."
- Removing tells is necessary but not sufficient. If the brief allows, **commit to a
  named direction** — that's what turns "not-slop" into "designed."
- Respect existing brand tokens; deslop *within* the project's system, don't invent a
  parallel one.
- Pair with `web-typography` (type), `color-system` (palette), `micro-motion`
  (animation) for a full pass.
