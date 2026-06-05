# frontend-skills

**Ten model-agnostic frontend craft skills for AI coding agents** — typography, color,
dark mode, layout, component states, forms, empty/loading/error states, motion, and
accessibility. Each skill is a folder of plain-Markdown instructions an agent loads
when it's relevant: named anti-patterns, real values, before/after, and a self-check —
not vibes.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-10-success.svg)](#the-skills)
[![Agent-agnostic](https://img.shields.io/badge/works%20with-any%20AI%20coding%20agent-black.svg)](#works-with-any-agent)
[![Verified](https://img.shields.io/badge/verified-end--to--end-brightgreen.svg)](docs/VERIFICATION.md)

> Works with Claude Code, Codex, Gemini CLI, Cursor, Kilocode, Kimi, or any agent that
> can read a Markdown instruction file. No SDK, no runtime, no lock-in.

---

## Why

Ask any LLM to "build a landing page" and you get the statistical average of its
training data: the indigo→violet gradient, pill buttons, Inter everywhere, a centered
hero over three identical cards, no focus states, no empty states, text that fails
contrast. The model isn't a designer — it's a pattern matcher, and the median pattern
is generic.

These skills supply the craft the model doesn't have: the specific, checkable rules
that separate a polished interface from AI slop. They're written to be loaded *as the
agent works*, so the guidance arrives exactly when a decision is being made.

## The skills

| Skill | What it does |
|-------|--------------|
| **web-typography** | Type scale, measure, rhythm, font pairing, fluid `clamp()`, web-font loading/CLS, WCAG text. |
| **deslop-ui** | Strip the AI tells (purple gradient, pill CTAs, Inter, 3-card hero, glassmorphism, emoji headers) and commit to a real direction. |
| **dark-mode** | Dark themes that don't suck: surface ramp, elevation-by-lightness, off-white text, desaturated accents, contrast. |
| **color-system** | OKLCH palettes that are cohesive *and* pass contrast: ramp math, tinted neutrals, semantic tokens. |
| **responsive-layout** | Layouts that survive any width: mobile-first, intrinsic Grid/Flex, content-driven breakpoints, container queries. |
| **component-states** | Every interactive state — default/hover/focus-visible/active/disabled/loading/selected/error — with matching ARIA. |
| **form-ux** | Forms people finish: persistent labels, validate-on-blur, specific inline errors, right input types, focus-to-error. |
| **empty-states** | The empty / loading / error screens everyone forgets: skeletons, guided no-results, blameless errors with retry. |
| **micro-motion** | Animation that feels expensive: transform/opacity only, 150–300ms, ease-out, the 30% rule, reduced-motion. |
| **a11y-pass** | A runnable WCAG 2.2 AA fix pass: keyboard, focus, names, semantics, contrast, live regions, target size, zoom. |

Each skill folder contains:
- `SKILL.md` — the loadable instruction file (decision order, non-negotiables, quick-start, self-check)
- `references/` — deep guidance + a `decision-records.md` (the *why* behind each rule)
- `assets/` — copy-paste starter CSS / checklists / generators

## What "not vibes" means

Every rule is **checkable** — a value, a count, or a yes/no — and most come with a
before/after and a self-check the agent runs on its own output. Examples:

- *Pill buttons:* `border-radius: 9999px` on a text CTA is an AI tell → use 6–10px.
- *Dark mode:* never `#000`; base `#121212`, each elevation step **lighter**, not shadowed.
- *Color:* build ramps in **OKLCH** (perceptual lightness) so contrast is predictable.
- *Motion:* animate only `transform`/`opacity`; 150–300ms; respect `prefers-reduced-motion`.
- *A11y:* every control keyboard-operable with a visible `:focus-visible` ring ≥3:1.

## Quick start

### Any agent (auto-trigger)
```bash
git clone https://github.com/KyaniteLabs/frontend-skills
./frontend-skills/install.sh          # symlinks skills into your agent(s)
```
`install.sh` detects `~/.claude`, `~/.codex`, `~/.gemini`, `~/.cursor`, `~/.kilocode`,
`~/.kimi` and links the skills into each one's `skills/` directory. Then just work —
the agent loads a skill when your request matches it ("fix this dark mode", "the
headings wrap badly", "make this accessible").

### Claude Code (slash commands too)
`install.sh` also offers to copy the `commands/` into `~/.claude/commands/`, giving you
`/typography`, `/deslop`, `/darkmode`, `/colorsystem`, `/responsive`, `/states`,
`/formux`, `/emptystates`, `/motion`, `/a11y`.

### Manual / single skill
Point your agent at any `skills/<name>/SKILL.md`, or copy a folder into your project.

## Works with any agent

Skills are just Markdown — no code to run, no API. The format follows the
`SKILL.md` + `references/` + `assets/` convention; any agent that can read files can use
them. Claude Code and compatible tools auto-discover them from a `skills/` directory;
others can be pointed at a `SKILL.md` directly.

## How they fit together

A complete UI build chain:

> **deslop-ui** (don't look AI) → **color-system** · **web-typography** · **dark-mode**
> (foundations) → **responsive-layout** (structure) → **component-states** · **form-ux** ·
> **empty-states** (behavior) → **micro-motion** (polish) → **a11y-pass** (verify)

## Verified, not asserted

Every skill in this package was verified end-to-end before publishing: structure and
cross-references validated, executable assets run, all CSS rendered in Chromium with
zero console errors at mobile/tablet/desktop + dark mode, and the output reviewed
visually. See **[docs/VERIFICATION.md](docs/VERIFICATION.md)** and the rendered
**[demos/](demos/)** (screenshots in [docs/screenshots/](docs/screenshots/)).

## License

MIT © Kyanite Labs. Use them, fork them, ship with them.

The skills distill widely-taught, public craft principles (typography, color science,
WCAG, web-platform best practices) expressed in original form — not a copy of any
individual's work. Where an idea has a known origin it's credited in that skill's
`decision-records.md`.
