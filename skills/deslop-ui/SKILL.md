---
name: deslop-ui
description: >-
  Strip the "AI slop" tells out of any UI so it stops looking machine-generated.
  Apply this whenever you generate, review, or polish a website, landing page,
  dashboard, or component in HTML/CSS/React/Vue/Svelte/Tailwind — and ESPECIALLY
  right after an LLM produces frontend code, because models converge on the same
  giveaways: the indigo→violet "purple gradient", pill-shaped CTA buttons
  (border-radius 9999px), Inter/Roboto everywhere, the centered-hero +
  three-icon-cards layout, glassmorphism on everything, uniform shadow-2xl, the
  default Tailwind slate palette, and emoji section headers. Trigger it on cues
  like "make this look less AI", "this looks generic/templated", "deslop this",
  "remove the AI look", "why does my site look like every other AI site", or just
  after building any UI. It is a checkable catalog of named anti-patterns, each
  with the specific value to change and the fix — not vibes. Provider- and
  framework-agnostic.
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
  fully-round for tags, chips, avatars, icon buttons — not text CTAs.
- **Everything same radius** — every card, input, button at `rounded-xl`. **Fix:**
  one radius system with 2–3 steps (e.g. 6px controls / 12px cards), applied by role.
- **Uniform heavy shadow** — `shadow-2xl` (or `shadow-lg`) on every card. **Fix:**
  one elevation system; most surfaces flat or `shadow-sm`; reserve big shadow for
  truly-floating elements (modals, popovers).

### Typography
- **Inter / Roboto / Open Sans / Arial / system default** as the headline face.
  The "safe font" tell. **Fix:** one distinctive display face with personality
  (e.g. editorial: Fraunces, Newsreader; technical: IBM Plex; geometric: Space
  Grotesk *used decisively* — note even Space Grotesk is now an over-default).
  Pair on contrast. (See the `web-typography` skill for the full system.)
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

Then the **commitment check** (the positive half — see `references/design-direction.md`):
9. Can you name the aesthetic in one phrase ("1970s ski lodge", "Swiss editorial",
   "terminal/brutalist")? If not, you've only removed defaults, not designed.
10. Is there one dominant color and one real accent — not five timid pastels?
11. Does typography have real size/weight contrast (3×+ / 800-vs-300)?

## Reference files

- `references/anti-patterns.md` — the full catalog with before/after code snippets
  and the reasoning behind each tell. Read when reviewing real code or when you need
  the copy-paste fix.
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
