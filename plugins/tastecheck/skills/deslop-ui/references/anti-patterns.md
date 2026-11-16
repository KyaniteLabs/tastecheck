# Deslop UI — Anti-Pattern Catalog (with before/after)

The full reference for each AI visual tell: what it looks like in code, why it reads
as machine-generated, and the concrete fix. Read this when reviewing real code or
when you want the copy-paste correction. Everything here is checkable.

Background, in one line: a model asked to "build a landing page" with no constraints
returns the statistical average of its training data (Tailwind tutorials, 2019–2024).
That average is purple, centered, Inter, pill-buttoned. Deslopping = replacing the
averages with committed choices.

---

## 1. The purple gradient (the flagship tell)

**Before**
```css
.hero { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); }
/* or Tailwind */ <section class="bg-gradient-to-br from-indigo-500 to-purple-500">
```
**Why it's a tell:** Tailwind shipped `bg-indigo-500` as the demo default ~2020; it
saturated tutorials and GitHub, so LLMs learned "modern UI = indigo/violet." Adam
Wathan publicly apologized for it in 2025. Indigo→violet on white is now the single
most recognizable AI fingerprint.
**Fix:** commit to one brand hue. If you gradient, stay within-hue or to an analogous
neighbor, keep the spread small, and don't put it on a white page.
```css
:root { --color-primary: oklch(0.62 0.13 195); }            /* one committed hue (teal) */
.hero { background: var(--color-primary); color: white; }    /* or a subtle within-hue gradient */
```

## 2. Pill CTA buttons

**Before** `<button class="rounded-full px-6 py-3 bg-indigo-500">Get started</button>`
**Why:** `border-radius: 9999px` on a text action button is template DNA. Fully-round
reads "generic component library."
**Fix:** 6–10px for text CTAs. Keep `rounded-full` for chips, tags, avatars, and
icon-only buttons.
```html
<button class="rounded-lg px-5 py-2.5">Get started</button>   <!-- ~8px -->
```

## 3. Same radius everywhere

**Before:** every card, input, modal, button = `rounded-xl`.
**Why:** uniformity signals "no system, just a default applied globally."
**Fix:** a small radius scale by role.
```css
:root { --radius-control: 6px; --radius-card: 12px; --radius-pill: 9999px; }
.btn, .input { border-radius: var(--radius-control); }
.card        { border-radius: var(--radius-card); }
.chip        { border-radius: var(--radius-pill); }
```

## 4. Uniform heavy shadow

**Before:** `class="shadow-2xl"` (or `shadow-lg`) on every card.
**Why:** real interfaces have an elevation *system*; most things sit flat. Big shadow
on everything = "I applied one class everywhere."
**Fix:** one elevation scale; default flat or hairline; reserve depth for floating UI.
```css
:root { --shadow-card: 0 1px 2px rgb(0 0 0 / .06); --shadow-float: 0 8px 24px rgb(0 0 0 / .12); }
.card  { box-shadow: none; border: 1px solid var(--color-border); }
.modal { box-shadow: var(--shadow-float); }
```

## 5. Safe/default fonts

**Before:** `font-family: Inter, Roboto, system-ui` for everything.
**Why:** the "safe fonts" appear in thousands of examples; zero personality.
**Fix:** one distinctive display face, paired on contrast with a clean body face.
State the choice. (Defer to the `web-typography` skill for the full system.)
```css
/* editorial example */ --font-display: "Fraunces", Georgia, serif;
--font-body: "IBM Plex Sans", system-ui, sans-serif;
```
Note: even "anti-default" picks become defaults — Space Grotesk is now over-used by
models. Vary intentionally.

## 6. Timid type scale

**Before:** H1 `text-2xl font-semibold`, body `text-base`.
**Why:** small contrast = nothing leads; the page reads flat and templated.
**Fix:** real jumps — 3×+ size between display and body, weight extremes.
```css
h1 { font-size: clamp(2.5rem, 1.8rem + 3.5vw, 5rem); font-weight: 800; }
p  { font-size: 1.125rem; font-weight: 400; }
```

## 7. The centered-hero + three-icon-cards skeleton

**Before:** centered headline + subtext + one CTA, then a 3-column grid of identical
icon+title+blurb cards.
**Why:** the literal SaaS template skeleton; the most cloned layout in the corpus.
**Fix:** break it. Asymmetric/split hero, off-center focal point, varied card sizes
(bento), whitespace as structure, varied emphasis.
```html
<!-- split, asymmetric hero -->
<section class="grid md:grid-cols-[1.3fr_1fr] gap-12 items-end">
  <div><h1>…</h1><p>…</p><button>…</button></div>
  <figure><img …></figure>
</section>
<!-- bento features, not 3 equal boxes -->
<div class="grid md:grid-cols-3 gap-4">
  <article class="md:col-span-2 md:row-span-2">…lead feature…</article>
  <article>…</article><article>…</article>
</div>
```

## 8. `min-h-screen` flex-center on everything

**Before:** every `<section class="min-h-screen flex items-center justify-center">`.
**Why:** dead-center everything = no compositional intent.
**Fix:** intentional rhythm; left-anchored content; section heights that fit content.

## 9. Glassmorphism by default

**Before:** `backdrop-blur-lg bg-white/10 border border-white/20` on all cards.
**Why:** trendy effect applied indiscriminately; screams "vibe-coded 2024".
**Fix:** at most once, with purpose (sticky nav over a photo). Default cards are solid.

## 10. Background blobs / floating orbs

**Before:** absolutely-positioned blurred gradient circles drifting behind the hero.
**Why:** the canonical AI-hero decoration.
**Fix:** real atmosphere — subtle noise/texture, a committed flat field, or a relevant
image. Often: nothing is better.

## 11. Emoji section headers

**Before:** `<h2>🚀 Features</h2>`, `<h2>✨ Why us</h2>`.
**Why:** emoji-as-iconography is a chat-output tell, not design.
**Fix:** real headings; a consistent SVG icon set if you want marks, aligned and sized.

## 12. Gradient text headlines

**Before:** `bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent`.
**Why:** the purple tell, applied to type.
**Fix:** solid color; subtle within-hue gradient only if it serves the brand.

## 13. Functional slop (invisible until used)

- **No form states:** no required markers, validation, error/empty/loading. **Fix:**
  add them — see `form-ux` and `empty-states`.
- **Placeholder content left in:** "Lorem ipsum", "John Doe" ×3, "Company Name".
  **Fix:** realistic, varied content (names, lengths, avatars).
- **No focus states / a11y:** missing `:focus-visible`, ARIA, alt text. **Fix:**
  visible focus rings, labels, alt — run `a11y-pass`.

---

## The grep pass (fast detection in a codebase)

```bash
grep -rniE "rounded-full|9999px" src | grep -iE "button|btn|cta"        # pill CTAs
grep -rniE "indigo|violet|#6366f1|#a855f7|from-indigo|to-purple" src     # purple
grep -rniE "shadow-2xl|shadow-lg" src                                     # heavy shadow
grep -rniE "backdrop-blur|bg-white/10|bg-white/20" src                    # glassmorphism
grep -rniE "min-h-screen.*flex.*items-center" src                         # center-everything
grep -rniE "font-(inter|roboto)|'Inter'|\"Inter\"" src                    # safe fonts
grep -rnE "<h[1-6][^>]*>[[:space:]]*" src | grep -E "[😀-🫿☀-➿]"  # emoji headers (two-stage for portability)
```
These are starting signals, not proof — confirm in context before changing.
