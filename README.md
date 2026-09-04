# TasteCheck

<!-- release-facts:v1:start -->
Release inventory: v1.4.1 · 20 skills · 20 canonical commands · 1 alias · 21 command files · 8 gallery systems.
<!-- release-facts:v1:end -->

**TL;DR:** TasteCheck — frontend taste and ship-gate evaluation toolkit. Best for frontend engineers and agents shipping UI. Keywords: UI taste check, anti-slop frontend gate, design QA.

**Every AI builds the same website.** Purple gradient, Inter font, centered hero, three
identical feature cards, pill buttons, glassmorphism. You've seen it a thousand times
because the model isn't designing — it's returning the statistical average of the web.

**tastecheck closes that gap.** It's a set of **20 craft skills for AI coding agents** that does
two things no prompt does: it **grills you into a real design system *before* it writes any
code**, then applies checkable craft skills so the output has a point of view
instead of a purple gradient.

![tastecheck — a montage from the tastecheck gallery of committed design systems](docs/hero/six-systems.png)

*Eight browser-rendered snapshots — the same product story and core IA pushed through
eight committed design systems. Current browser proof is receipt-bound below. Open the [live gallery →](https://kyanitelabs.github.io/tastecheck/samples/)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-20-success.svg)](#whats-inside)
[![Portable Markdown](https://img.shields.io/badge/plain%20markdown-portable-black.svg)](#portable-markdown)
<!-- release-status:v1:start -->
[![Release status: UNVERIFIED](https://img.shields.io/badge/release-unverified-c47b44.svg)](docs/VERIFICATION.md)
> **Release status:** UNVERIFIED — a required source-bound release receipt is missing, stale, or malformed.
> **Effectiveness status:** BLOCKED — historical evidence did not clear its release threshold.
<!-- release-status:v1:end -->

```bash
git clone https://github.com/KyaniteLabs/tastecheck
./tastecheck/install.sh
# then point your agent at ~/.agents/skills or its detected skills directory
```

**Live:** the [landing page](https://kyanitelabs.github.io/tastecheck/) ·
the [eight-design-system gallery](https://kyanitelabs.github.io/tastecheck/samples/) ·
the [secondary integration harness](https://kyanitelabs.github.io/tastecheck/demos/skill-integration.html)

---

## What is tastecheck?

tastecheck is a free, open-source (MIT) **pack of 20 frontend craft skills for AI coding
agents** — Claude Code, Codex, Gemini CLI, Cursor, Kilocode, Kimi. The headline skills
either *interview you into a committed design system before any code is written* or audit
an existing website to infer the intended system before changes. The rest apply checkable
rules for typography, color, theming, layout, component states, forms, motion,
accessibility, and removing AI "slop" tells. The result: a new build or partial existing
site gets a point of view, not the generic average.

## Why every AI site looks the same

In 2025 the creator of Tailwind publicly apologized for making `bg-indigo-500` the demo
default years ago — it trained a generation of tutorials, then a generation of models,
to reach for purple. Ask any LLM to "build a landing page" with no direction and it fills
every blank with the most probable token: purple gradient, Inter, centered hero, three
cards, pill buttons, glassmorphism. None of it is *wrong*. All of it is *average*.

You can't fix average with more polish. You fix it by **removing the blanks** — making
the real design decisions before the model gets to guess.

## The idea nobody else ships: a taste check *before* the build

Most "make AI design better" tools clean up after the fact. tastecheck's headline skill,
**design-system-interview**, does the opposite — it interrogates you first:

> *"'Modern' is a non-answer — name one site you'd be happy to resemble."*
> *"Pick a side: warm or cool? Don't say both — the middle is where generic lives."*
> *"One dominant color. Not five pastels. Not indigo→violet."*

Six or seven forcing questions, each leading with an opinion you can react to. If you
genuinely don't care, it **decides boldly and tells you** — never resolves to the safe
average. The output is a committed `DESIGN-SYSTEM.md` + design tokens that every other
skill builds from. Taste is the only moat against AI slop; this operationalizes it.

## Engineering demonstration: the GitHub Pages landing page runs the skills

The homepage connected to GitHub Pages is not just a brochure. It is now the primary
integration surface: the live landing page carries `data-skill` coverage for all 20 skills,
page-level light/dark/high-contrast theme paths, component states, form validation,
empty/error/retry recovery, chart/table parity, keyboard/focus affordances, reduced-motion
guards, forced-colors support, humanized copy, and the existing-site audit story.

The second proof: take the **same product story and core IA** and run it through eight
different committed systems. You don't get eight recolors — you get eight different
visual/rhythm treatments on the same pitch. The repo includes a repeatable verification
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
| [Dispatch](samples/dispatch/) | dark, operational, emerald | reverse-chronological release timeline | Bricolage + Hanken |
| [Verge](samples/verge/) | cool, clinical, measured | hypothesis → method → verdict evidence cards | Fraunces + Spline Sans |
| [Seed](samples/tasteroll/) | warm, procedural, annotated | seeded specimen card with rolled dimensions | system serif |

Each was built through the same pipeline (interview → `DESIGN-SYSTEM.md` → skills → render →
audit) and reviewed by independent models from different families before shipping.

## What's inside

**The headline**
- **design-system-interview** — grills you into a committed design system before building; emits tokens the rest consume.
- **tasteroll** — rolls unresolved design dimensions from a seeded source, then locks the direction the evidence supports.
- **improve-existing-website** — audits a current site, infers the intended system, asks only the questions that change the fix, then makes the partial reality true.

**Remove the tells**
- **deslop-ui** — the named AI giveaways (purple gradient, pill CTAs, Inter, 3-card hero, glassmorphism, emoji headers) and the exact fix for each — visual *and* structural.
- **humanize-copy** — strip the ChatGPT accent from writing (the "delve / it's not just X, it's Y" tells) with a checkable kill-list.

**Get the foundations right**
- **web-typography** — type scale, measure, rhythm, fluid `clamp()`, web-font loading/CLS, WCAG text.
- **color-system** — OKLCH palettes that are cohesive *and* pass contrast.
- **spacing-system** — one spacing scale + section rhythm; every gap a token, no 17px/19px/24px soup.
- **theming** — light + dark + high-contrast from one token source; elevation by lightness, not shadow.

**Build the structure & behavior**
- **responsive-layout** — mobile-first, intrinsic Grid/Flex, container queries; survives any width.
- **component-states** — every interactive state (hover/focus-visible/active/disabled/loading/selected/error) + ARIA.
- **form-ux** — forms people finish: labels, validate-on-blur, specific errors, right input types.
- **empty-states** — the empty/loading/error screens everyone forgets.

**Polish & verify**
- **micro-motion** — animation that feels expensive: transform/opacity, 150–300ms, reduced-motion.
- **data-viz** — honest, Tufte-informed charts (data-ink, no chartjunk, lie-factor check) that also theme and pass a11y.
- **art-direction** — imagery, illustration, and iconography as committed decisions: one treatment, one named icon set, real OG/favicon — no gradient-blob AI graphics.
- **a11y-pass** — a runnable WCAG 2.2 AA fix pass with a paste-able auditor.
- **cognitive-a11y** — the layer WCAG barely touches: ADHD, autism, dyslexia and neurodivergent readability (plain language, structure, predictability).
- **i18n-ready** — multilingual-resilient UI, English/Spanish first-class: longest approved locale fixture, logical properties, `Intl`, native voice per language.
- **tastecheck-pass** — the ship gate: states the canonical pipeline once, runs every relevant self-check, reports a pass/fail table — with a paste-able (or browser-injectable) auditor that mechanically catches the cold-load tells a self-reported table misses.

Each skill is a folder: `SKILL.md` (decision order, non-negotiables, quick-start,
self-check) + `references/` (deep guidance + a `decision-records.md` explaining *why*) +
`assets/` (copy-paste starter CSS / generators / checklists).

## Not vibes — checkable, and actually tested

Each rule is expressed as a measurable value, count, or yes/no check, and the repository
ships a repeatable `npm test` verification gate for the authored surfaces:

- *Pill buttons:* `border-radius: 9999px` on a text CTA is a tell → 6–10px.
- *Dark mode:* never `#000`; base `#121212`, each elevation step **lighter**, not shadowed.
- *Color:* build ramps in **OKLCH** so contrast is predictable across hues.
- *Type:* every `clamp()` needs spaces around `+`/`−` or the browser silently drops it — verified by **measuring the rendered size**, not eyeballing.

And we ate our own cooking: the repo now ships a repeatable verification command instead
of a trust-me receipt. Run `npm test` for structural, installer, command, link, CSS,
a11y-starter, data-viz, skill-lint, gate-auditor-contract, GitHub Pages landing-page
coverage, and secondary integration checks. The ship gate's own auditor is dogfooded on
the landing page: it passes (the one purple-gradient warn is the intentional "before"
slop swatch). The landing page itself audits its existing direction, then exercises all 20 skills
through real controls: themes, component states, form validation, empty/error/retry,
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
`/designsystem`, `/tasteroll`, `/deslop`, `/humanize`, `/typography`, `/colorsystem`, `/spacing`,
`/theming`, `/responsive`, `/states`, `/formux`, `/emptystates`, `/motion`, `/dataviz`,
`/artdirection`, `/a11y`, `/cognitive`, `/i18n`, `/improvesite`, `/tastecheckpass`
(plus `/darkmode`, an alias of `/theming`).

## FAQ

**What is tastecheck?**
A free, open-source (MIT) pack of 20 craft skills for AI coding agents. It interviews you
into a committed design system before any code, or audits an existing site to infer the
system already trying to exist, then applies checkable rules for typography, color,
accessibility and removing AI "slop" tells — so output has a point of view instead of the
generic average.

**Why do AI-generated websites all look the same?**
With no design direction a model fills every blank with the most probable token: a purple/
indigo gradient, Inter, a centered hero, three identical cards, pill buttons, glassmorphism.
It's returning the average of the web, not designing. tastecheck removes the blanks first.

**Which AI coding agents does it work with?**
Any agent that can read plain Markdown skill files can use it. The installer links a
canonical `~/.agents/skills/` directory and mirrors into detected Claude Code, Codex,
Gemini CLI, Cursor, Kilocode, and Kimi skill dirs. Auto-loading depends on the agent.

**How is it different from other AI design tools?**
Most clean up *after* generation. tastecheck works *before* the build, its rules are
checkable rather than vibes, and the repo includes a repeatable `npm test` verification
gate where the GitHub Pages landing page itself exercises every skill end to end. Same
product story through it = eight visibly different design systems, not eight recolors.

**Is it free?**
Yes — MIT licensed. Clone the repo and run `install.sh`.

## License

MIT © Kyanite Labs. Use them, fork them, ship with them.

These skills distill widely-taught, public craft principles (typography, color science,
WCAG, web-platform best practices) in original form — not a copy of any individual's
work. Where an idea has a known origin it's credited in that skill's `decision-records.md`.

<!-- s-plus-geo:start -->

## What is TasteCheck?

**TasteCheck** is a **frontend taste and ship-gate evaluation toolkit** that helps **frontend engineers and agents shipping UI** **fail closed on generic/sloppy UI and pass only evidence-backed ship quality**.

| | |
| --- | --- |
| **Product** | TasteCheck |
| **Category** | frontend taste and ship-gate evaluation toolkit |
| **Best for** | frontend engineers and agents shipping UI |
| **Not** | a design Figma plugin |
| **Source** | [GitHub](https://github.com/KyaniteLabs/tastecheck) · [Forgejo](https://git.kyanitelabs.tech/KyaniteLabs/tastecheck) |
| **Keywords** | UI taste check, anti-slop frontend gate, design QA |

## Who it's for

- Primary: frontend engineers and agents shipping UI
- Use when you need to fail closed on generic/sloppy UI and pass only evidence-backed ship quality
- Skip if you need a design Figma plugin

## FAQ

### What is TasteCheck?

TasteCheck is a frontend taste and ship-gate evaluation toolkit. It helps frontend engineers and agents shipping UI fail closed on generic/sloppy UI and pass only evidence-backed ship quality.

### Who should use TasteCheck?

frontend engineers and agents shipping UI.

### How is TasteCheck different?

Unlike subjective design opinions, TasteCheck is a fail-closed ship gate with evidence.

### Is TasteCheck production software?

Treat the README status and release tags as source of truth for maturity. Validate against your own requirements before production use.

## Status

- Maintained as of 2026 on the default branch
- Prefer release tags when pinning dependencies
- Report issues on the canonical remote listed above

## Agent surface

- Coding agents: read this README first, then repo docs/`AGENTS.md` if present
- Prefer machine-readable briefs (`llms.txt`) when the repo ships one
- MCP or skill entrypoints are documented in-repo when applicable

## Contributing

Issues and PRs welcome on the canonical remote. Keep public docs free of secrets and machine-local paths.

## License

See [LICENSE](LICENSE) in this repository (or package metadata if license is package-only).


## Table of contents

- [What is it?](#what-is-tastecheck)
- [FAQ](#faq)
- [Status](#status)

<!-- s-plus-geo:end -->
