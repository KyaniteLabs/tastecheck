# Deslop UI — Meta-Patterns & Decision Records

The reasoning behind the catalog, so you can judge novel tells the rule-list doesn't
name. Independent synthesis of public commentary on AI design slop (Anthropic's
frontend guidance, Adam Wathan / Tailwind on the indigo default, and the broader
designer discourse of 2025–2026). Principles and credited ideas — not a copy of
anyone's text.

## Meta-patterns

### MP-1 · Slop is predictability, not ugliness
The tells aren't individually ugly — `rounded-full`, a shadow, indigo are all fine in
isolation. They read as "AI" because they're the *most probable* choice, so they
appear together, everywhere. **Consequence:** the fix is differentiation, not polish.
Ask "is this the obvious default?" more than "is this pretty?"

### MP-2 · Ambiguity is filled with the average
A model fills any unspecified design decision with the statistical mean of its training
data. Vague prompt → average output. **Consequence:** slop is a *prompt/constraint*
failure as much as a taste failure. Supplying specific constraints is the highest-
leverage fix; deslopping after the fact is the second-best.

### MP-3 · Subtraction moves the average; commitment escapes it
Banning the top default just promotes the second default (indigo gone → teal; Inter
gone → Space Grotesk). **Consequence:** always pair prohibitions with a *named,
committed direction*. "Not X" is necessary but never sufficient.

### MP-4 · Function is part of the look
LLMs train on static markup, not interaction, so generated UIs ship without required
markers, validation, error/empty/loading states. A "form" that doesn't behave like one
reads as fake even if it's styled well. **Consequence:** deslopping includes behavior,
not just CSS — wire states, not just shapes.

### MP-5 · Taste is constraint, supplied by a human or a reference
Models don't have taste; they recombine patterns. Good AI design = a human (or a cited
reference) supplying judgment and the model executing at speed. **Consequence:** steal
taste deliberately (name an aesthetic, describe a reference) rather than asking the
model to "be creative", which just returns the average.

## Decision records

### DR-1 · Pill radius is for non-text controls only
- **Why (MP-1):** `9999px` on a text CTA is the single most probable button style →
  pure tell.
- **Apply:** text CTAs 6–10px; full-round only for chips/tags/avatars/icon buttons.

### DR-2 · One committed hue, not the purple gradient
- **Why (MP-1/MP-3):** indigo→violet is the flagship default; swapping to another
  gradient without commitment just relocates the average.
- **Apply:** one dominant brand hue + sharp accent; gradients within-hue, off-white.

### DR-3 · Systems over uniform application
- **Why (MP-1):** one radius / one shadow class applied to everything signals "no
  system." Real design has scales applied by role.
- **Apply:** 2–3-step radius and elevation scales, assigned by element role; default flat.

### DR-4 · Break the template skeleton
- **Why (MP-1):** centered hero + 3 equal icon cards is the most-cloned layout.
- **Apply:** asymmetry, varied card sizes (bento), varied emphasis, whitespace as
  structure.

### DR-5 · Direct the four dimensions before generating
- **Why (MP-2):** typography, color, motion, background are where the model averages
  hardest if left unspecified.
- **Apply:** state font/color/motion/background choices up front (see
  `design-direction.md` prompt).

### DR-6 · Deslop behavior, not just style
- **Why (MP-4):** missing states are slop the user feels.
- **Apply:** required markers, validation, error/empty/loading — pull `form-ux`,
  `empty-states`.

### DR-7 · Name the aesthetic
- **Why (MP-3/MP-5):** a one-phrase concrete name is the smallest unit of committed
  taste; without it you've only subtracted.
- **Apply:** "1970s ski lodge", "Swiss editorial", "terminal/brutalist" — concrete,
  not "modern/clean/sleek".

## Principle, not property
This catalog distills shared, widely-discussed observations about AI design defaults.
Attribute ideas to their lineage when natural (Tailwind's indigo default; Anthropic's
frontend guidance); never reproduce a source's prose, examples, or designs. Build your
own work, informed by the field.
