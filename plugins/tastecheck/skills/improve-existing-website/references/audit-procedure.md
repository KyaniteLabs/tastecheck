# The Audit Procedure — what to extract, in what order

Read when starting the inspection. The goal is **evidence before opinion**: every claim
about "the intended system" must trace to something you actually observed.

## 1. Render reality first (10 minutes, before any CSS reading)

- Open the real site (or built files) at **390px, 768px, and 1280px**. Screenshot each
  if you can. Note what breaks, what holds, and what the page *seems to want to be*.
- Tab through the page once. Note focus visibility, skip targets, keyboard traps.
- Toggle dark mode / `prefers-reduced-motion` if the site claims to support them.

## 2. Extract the de-facto tokens (measure, don't guess)

Pull from computed styles / stylesheets, in this order:

| Dimension | What to record | Drift smell |
|---|---|---|
| Color | every distinct color value, grouped by usage (bg/text/accent/border) | >12 distinct grays; near-duplicate hexes (`#666`, `#676767`) |
| Type | families, the actual size set in use, line-heights | 3+ families; sizes like 13/14/15/16/17px (no scale) |
| Spacing | margins/paddings on repeated components | 19px here, 24px there, 17px there (no scale) |
| Radius | every border-radius in use | 4 different radii on the same kind of card |
| Shadow | every box-shadow | heavy shadow on everything (template residue) |
| Breakpoints | every @media width | device-named soup (767.98px…) |

Record counts. "The site uses 23 grays" is an audit finding; "the colors feel messy" is not.

## 3. Inventory the component habits

List repeated UI (buttons, cards, nav, forms, tables). For each: how many visual
variants exist, and do the variants look *decided* (primary/secondary) or *accidental*
(five button styles from five eras)?

## 4. Read the content & voice

Headline register, CTA verbs, error messages, empty states. Is there a voice trying to
exist? Capture 3 short quotes that typify it.

## 5. Capture the business signals

What does the page sell/do? What's the visual hierarchy *currently* prioritizing, and
does that match what the business clearly wants prioritized? (The #1 improvement on
real sites is usually hierarchy, not aesthetics.)

## Output of the audit

Fill the "likely system" block in SKILL.md step 3 — every line annotated with its
evidence: `Type stance: editorial serif display (the H1 and pull-quotes already use
Lora; body is system) — KEEP, formalize`. Then the signal/drift split
(`signal-vs-drift.md`) before touching anything.
