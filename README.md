# TasteCheck

**TasteCheck is a design-quality system for coding agents.** Nineteen connected
skills turn product evidence into a design direction, carry that direction through the
frontend, and issue an evidence-backed ship decision at the end.

It starts before the first component. Instead of letting “modern” silently become the
usual font, gradient, hero, and card grid, TasteCheck recommends concrete alternatives
and asks the few questions that would actually change the build.

![TasteCheck — one product story rendered through six committed design systems](docs/hero/six-systems.png)

*Six real browser renders — the same product story shaped by six different structures,
type systems, color systems, and rhythms. Open the
[live gallery →](https://kyanitelabs.github.io/tastecheck/samples/)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-19-success.svg)](#whats-inside)
[![Portable Markdown](https://img.shields.io/badge/plain%20markdown-portable-black.svg)](#portable-markdown)
[![Verified](https://img.shields.io/badge/verified-npm%20test-brightgreen.svg)](docs/VERIFICATION.md)

> **Evidence boundary:** repository checks verify installation, contracts, links, and
> demo behavior. A machine-only blind evaluation protocol (effectiveness v2) is built,
> rehearsed, and adversarially tested — 160 simulated calls, 0 real calls — but production
> evaluation has not started. Effectiveness remains unproven. See
> [docs/EFFECTIVENESS-V2.md](docs/EFFECTIVENESS-V2.md) for the protocol.

```bash
git clone https://github.com/KyaniteLabs/tastecheck
./tastecheck/install.sh
# then point your agent at ~/.agents/skills or its detected skills directory
```

**Live:** the [landing page](https://kyanitelabs.github.io/tastecheck/) ·
the [six-design-system gallery](https://kyanitelabs.github.io/tastecheck/samples/) ·
the [secondary integration harness](https://kyanitelabs.github.io/tastecheck/demos/skill-integration.html)

---

## What is TasteCheck?

TasteCheck is a free, open-source pack for Claude Code, Codex, Gemini CLI, Cursor,
Kilocode, Kimi, and any agent that can read Markdown. It supports two entry points:

- New work: `design-system-interview` turns a brief into a committed
  `DESIGN-SYSTEM.md` before implementation.
- Existing work: `improve-existing-website` identifies the system already trying to
  exist, then proposes the smallest repairs that make it coherent.

The remaining skills own one craft concern each—type, color, spacing, themes, layout,
states, forms, empty states, motion, imagery, data visualization, copy, visual anti-slop,
technical and cognitive accessibility, internationalization, and final verification.

## The failure mode

When a brief leaves hierarchy, density, type, color, structure, and behavior undecided,
an agent has to fill the gaps. Familiar defaults are individually defensible; repeated
together, they make unrelated products feel interchangeable. Polishing that output does
not recover the missing intent.

TasteCheck moves the work upstream. It reads the evidence, recommends a direction, and
turns the answer into decisions the rest of the build can consume:

> **What I see:** this product is a fast operational instrument, not a showroom.
>
> **My recommendation:** compact editorial hierarchy with one high-signal accent.
>
> **Choose:** dense and immediate / paced and explanatory / redirect me.

The result is not a mood board. It is a source-controlled design artifact, semantic
tokens, explicit refusals, structural rules, and a clear first implementation move.

## Engineering demonstration: one page represents the full system

The GitHub Pages homepage is the primary integration surface. It carries `data-skill`
coverage for all 19 concerns and demonstrates named interactions for
page-level light/dark/high-contrast theme paths, component states, form validation,
empty/error/retry recovery, chart/table parity, keyboard/focus affordances, reduced-motion
guards, forced-colors support, humanized copy, and the existing-site audit story.

The second demonstration takes the same product story through six committed systems.
They differ in composition and reading rhythm, not only color. The repo includes a repeatable verification
gate for local links, install paths, command targets, CSS parse traps, starter accessibility,
homepage skill coverage, and chart data-table parity.

- **[▶ Open the live landing page](https://kyanitelabs.github.io/tastecheck/)** · source in [`index.html`](index.html)
- **[▶ Open the live gallery](https://kyanitelabs.github.io/tastecheck/samples/)** · source in [`samples/`](samples/)
- **[▶ Open the secondary integration harness](https://kyanitelabs.github.io/tastecheck/demos/skill-integration.html)** · source in [`demos/skill-integration.html`](demos/skill-integration.html)

| System | Territory | Signature structure | Type |
|---|---|---|---|
| [Copper](samples/copper/) | dark, warm, geological | irregular tessellated bento + structural basalt columns | Redaction + Archivo |
| [Swiss](samples/swiss/) | light, austere, exact | exposed 12-column subgrid the content sits on | Hanken Grotesk |
| [Maximal](samples/maximal/) | loud, kinetic | display word bleeding into a magenta block; sticker-wall collage | Bricolage Grotesque |
| [Concrete](samples/concrete/) | raw, mechanical, monochrome | ruled spec-sheet + dense ledger table; achromatic + one hazard accent | Space Grotesk + Space Mono |
| [Clay](samples/clay/) | warm, soft, humanist | alternating zig-zag soft-card flow with organic "pebble" shapes | Mulish |
| [Dispatch](samples/dispatch/) | dark, operational, exact | release timeline with status-led reading order | system sans + mono |

Each follows the same pipeline: direction → `DESIGN-SYSTEM.md` → implementation skills →
render → audit → ship gate.

## What's inside

**Choose the direction**
- **design-system-interview** — converts a new brief into a committed, build-ready system.
- **improve-existing-website** — audits a current site, infers the intended system, asks only the questions that change the fix, then makes the partial reality true.

**Remove the tells**
- **deslop-ui** — the named AI giveaways (purple gradient, pill CTAs, Inter, 3-card hero, glassmorphism, emoji headers) and the exact fix for each — visual *and* structural.
- **humanize-copy** — strip the ChatGPT accent from writing (the "delve / it's not just X, it's Y" tells) with a checkable kill-list.

**Get the foundations right**
- **web-typography** — type scale, measure, rhythm, fluid `clamp()`, web-font loading/CLS, WCAG text.
- **color-system** — evidence-led OKLCH ramps, semantic roles, gamut checks, and measured contrast.
- **spacing-system** — one spacing scale + section rhythm, with deliberate exceptions instead of 17px/19px/24px soup.
- **theming** — supported theme mappings from one token source, with explicit preference and forced-colors behavior.

**Build the structure & behavior**
- **responsive-layout** — intrinsic Grid/Flex and container queries tested at the product's supported widths and zoom levels.
- **component-states** — every interactive state (hover/focus-visible/active/disabled/loading/selected/error) + ARIA.
- **form-ux** — forms people finish: labels, truthful validation timing, specific errors, recovery, and correct input semantics.
- **empty-states** — the empty/loading/error screens everyone forgets.

**Polish & verify**
- **micro-motion** — purposeful feedback with interruption rules, measured performance, and an equivalent reduced-motion path.
- **data-viz** — honest, Tufte-informed charts (data-ink, no chartjunk, lie-factor check) that also theme and pass a11y.
- **art-direction** — imagery, illustration, and iconography as committed decisions: one treatment, one named icon set, real OG/favicon — no gradient-blob AI graphics.
- **a11y-pass** — a runnable WCAG 2.2 AA fix pass with a pasteable auditor.
- **cognitive-a11y** — the layer WCAG barely touches: ADHD, autism, dyslexia and neurodivergent readability (plain language, structure, predictability).
- **i18n-ready** — multilingual-resilient UI, English/Spanish first-class: longest approved locale fixture, logical properties, `Intl`, native voice per language.
- **tastecheck-pass** — the ship gate: states the canonical pipeline once, runs every relevant self-check, reports a pass/fail table — with a pasteable (or browser-injectable) auditor that mechanically catches the cold-load tells a self-reported table misses.

Each skill is a folder: `SKILL.md` (decision order, non-negotiables, quick-start,
self-check) + `references/` (deep guidance + a `decision-records.md` explaining *why*) +
`assets/` (copy-paste starter CSS / generators / checklists).

## What “verified” means here

The repository ships a repeatable `npm test` gate for its authored surfaces. Where a
claim can be measured, the skill asks for the measurement rather than a checkmark:

- *Pill buttons:* `border-radius: 9999px` on a text CTA is a tell → 6–10px.
- *Dark themes:* tune surfaces, text, and accents together; measure each real pair instead of inverting the light palette.
- *Color:* use **OKLCH** to reason about lightness and chroma, then measure each rendered pair.
- *Type:* every `clamp()` needs spaces around `+`/`−` or the browser silently drops it — verified by **measuring the rendered size**, not eyeballing.

Run `npm test` for structural, installer, command, link, CSS,
a11y-starter, data-viz, skill-lint, gate-auditor-contract, GitHub Pages landing-page
coverage, and secondary integration checks. The ship gate's own auditor is dogfooded on
the landing page: it passes (the one purple-gradient warn is the intentional "before"
slop swatch). The page represents all 19 skill concerns and provides real controls for
themes, component states, form validation, empty/error/retry,
chart/table parity, copy, accessibility, cognitive readability, motion, and responsive
layout. Browser/manual QA remains documented separately in [docs/VERIFICATION.md](docs/VERIFICATION.md)
and the rendered [demos/](demos/).

## Portable Markdown

Skills are plain Markdown — no SDK, no runtime. The installer always links a canonical
`~/.agents/skills/` directory and also links detected homes for **Claude Code, Codex,
Gemini CLI, Cursor, Kilocode, and Kimi** when those directories already exist. Automatic
loading depends on each agent's skill support; otherwise point the agent at the relevant
`SKILL.md` directly. Claude Code also gets optional slash commands.

## How it all fits together

> **design-system-interview / improve-existing-website** (decide or infer taste) →
> **color-system · web-typography · spacing-system · theming** (foundations) →
> **responsive-layout** (structure) → **component-states · form-ux · empty-states**
> (behavior) → **micro-motion · data-viz · art-direction** (surface) → **a11y-pass ·
> cognitive-a11y · i18n-ready** (verify) — with **deslop-ui** and **humanize-copy**
> auditing the result against *your committed spec*, not the average, and
> **tastecheck-pass** gating the ship. (The canonical pipeline lives in
> `skills/tastecheck-pass/SKILL.md`; every other description is a summary of it.)

## Install

```bash
git clone https://github.com/KyaniteLabs/tastecheck
./tastecheck/install.sh        # symlinks skills into every agent it detects
```

The installer creates canonical links in `~/.agents/skills/` and mirrors them into detected
agent skill directories. In agents with skill auto-loading enabled, matching requests can
load the relevant skill; otherwise use the `SKILL.md` path directly. In Claude Code you
also get slash commands:
`/designsystem`, `/deslop`, `/humanize`, `/typography`, `/colorsystem`, `/spacing`,
`/theming`, `/responsive`, `/states`, `/formux`, `/emptystates`, `/motion`, `/dataviz`,
`/artdirection`, `/a11y`, `/cognitive`, `/i18n`, `/improvesite`, `/tastecheckpass`
(plus `/darkmode`, an alias of `/theming`).

## FAQ

**What is TasteCheck?**
A free, open-source pack of 19 connected frontend craft skills for coding agents. It
turns evidence into direction, carries that direction through implementation, and ends
with an evidence-backed ship decision.

**Why do AI-generated websites all look the same?**
With no design direction a model fills every blank with the most probable token: a purple/
indigo gradient, Inter, a centered hero, three identical cards, pill buttons, glassmorphism.
It's returning the average of the web, not designing. TasteCheck removes the blanks first.

**Which AI coding agents does it work with?**
Any agent that can read plain Markdown skill files can use it. The installer links a
canonical `~/.agents/skills/` directory and mirrors into detected Claude Code, Codex,
Gemini CLI, Cursor, Kilocode, and Kimi skill dirs. Auto-loading depends on the agent.

**How is it different from a prompt pack?**
The skills share one design artifact, token vocabulary, handoff order, and release gate.
They are designed to work as a system rather than as unrelated style prompts.

**Is it free?**
Yes — MIT licensed. Clone the repo and run `install.sh`.

## License

MIT © Kyanite Labs. Use them, fork them, ship with them.

These skills distill widely-taught, public craft principles (typography, color science,
WCAG, web-platform best practices) in original form — not a copy of any individual's
work. Where an idea has a known origin it's credited in that skill's `decision-records.md`.
