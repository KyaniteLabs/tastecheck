# TasteCheck

TasteCheck is a frontend taste and ship-gate toolkit for AI coding agents and frontend engineers who want evidence-backed UI quality.

<!-- release-facts:v1:start -->
Release inventory: v1.4.1 · 20 skills · 20 canonical commands · 1 alias · 21 command files · 8 gallery systems.
<!-- release-facts:v1:end -->

<!-- release-status:v1:start -->
[![Release status: UNVERIFIED](https://img.shields.io/badge/release-unverified-c47b44.svg)](docs/VERIFICATION.md)
> **Release status:** UNVERIFIED — a required source-bound release receipt is missing, stale, or malformed.
> **Effectiveness status:** BLOCKED — historical evidence did not clear its release threshold.
<!-- release-status:v1:end -->

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-20-success.svg)](#the-20-skills-what-each-checks)
[![Portable Markdown](https://img.shields.io/badge/plain%20markdown-portable-black.svg)](#install)

## TasteCheck at a glance

| Fact | Current release truth |
|---|---|
| Version | v1.4.1 |
| Skills | 20 frontend craft skills |
| Commands | 20 canonical Claude Code slash commands |
| Alias | 1 approved alias: `/darkmode` for `/theming` |
| Command files | 21 total command files |
| Gallery | 8 committed browser-rendered design systems |
| License | MIT; see [`LICENSE`](LICENSE) |
| Install | `git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh` |

## What is TasteCheck?

TasteCheck is a frontend taste and ship-gate toolkit for AI coding agents and frontend engineers who need evidence-backed UI quality before shipping. It turns a brief or an existing site into an explicit design direction, carries that direction through checkable craft skills, and reports the evidence needed for a ship or hold decision.

TasteCheck is plain Markdown with no runtime or SDK. Any coding agent that can read Markdown skill files can use it; the installer also creates the canonical `~/.agents/skills/` path and mirrors skills into detected agent homes.

TasteCheck addresses a common failure mode in agent-built interfaces: when hierarchy, density, type, color, and structure remain implicit, familiar defaults accumulate. The interview or existing-site audit makes those decisions explicit before implementation.

## Quickstart

Clone the repository and run the installer:

```bash
git clone https://github.com/KyaniteLabs/tastecheck
./tastecheck/install.sh
```

Then ask your coding agent to read the relevant `SKILL.md`, or point it at the canonical `~/.agents/skills/` directory.

## The 20 skills: what each checks

| Skill | What it checks |
|---|---|
| [design-system-interview](skills/design-system-interview/SKILL.md) | Design direction for vague or generic frontend requests, including type, color, density, and tokens. |
| [tasteroll](skills/tasteroll/SKILL.md) | Context-aware design exploration that audits broken work, rolls valid candidates, and locks the direction that works. |
| [improve-existing-website](skills/improve-existing-website/SKILL.md) | Existing-site evidence, recognizable identity, scope, and redesign risk before changes. |
| [color-system](skills/color-system/SKILL.md) | OKLCH palettes, ramps, semantic tokens, theme colors, and contrast. |
| [web-typography](skills/web-typography/SKILL.md) | Contextual type systems, resilient font loading, multilingual glyphs, wrapping, and readable hierarchy. |
| [spacing-system](skills/spacing-system/SKILL.md) | Layout rhythm, density, gaps, spacing scales, and deliberate exceptions. |
| [theming](skills/theming/SKILL.md) | Semantic mappings across light, dark, forced-colors, saved preferences, contrast, and no-flash behavior. |
| [responsive-layout](skills/responsive-layout/SKILL.md) | Narrow containers, long or translated content, zoom, reflow, and overflow without device-specific breakpoints. |
| [component-states](skills/component-states/SKILL.md) | Interactive state matrices for controls, keyboard behavior, and ARIA. |
| [form-ux](skills/form-ux/SKILL.md) | Forms, field labels, autocomplete, validation, mobile input behavior, errors, and disabled submits. |
| [empty-states](skills/empty-states/SKILL.md) | Empty, loading, error, retry, first-run, offline, permission, and layout-stability states. |
| [micro-motion](skills/micro-motion/SKILL.md) | Purposeful feedback and transitions without jank, interruption bugs, or hidden no-JS content, including reduced motion. |
| [data-viz](skills/data-viz/SKILL.md) | Honest, accessible, themed charts, metrics, direct labels, and data tables. |
| [art-direction](skills/art-direction/SKILL.md) | Imagery, illustration, iconography, hero images, favicons, OG cards, and generic AI imagery. |
| [a11y-pass](skills/a11y-pass/SKILL.md) | WCAG 2.2 AA fixes for web UI, including keyboard, screen readers, contrast, labels, focus, landmarks, target size, reduced motion, and ARIA. |
| [cognitive-a11y](skills/cognitive-a11y/SKILL.md) | Readability and predictability for ADHD, autism, dyslexia, and neurodivergent users. |
| [i18n-ready](skills/i18n-ready/SKILL.md) | Locale expansion, language attributes, logical properties, RTL, formats, bilingual copy, and language toggles. |
| [deslop-ui](skills/deslop-ui/SKILL.md) | Generated-UI tells such as purple gradients, pill CTAs, default type, centered heroes, card grids, glassmorphism, and template sameness. |
| [humanize-copy](skills/humanize-copy/SKILL.md) | Landing, docs, README, UI, release, and social copy for LLM tells and robotic prose. |
| [tastecheck-pass](skills/tastecheck-pass/SKILL.md) | Evidence-backed ship or hold decisions, fail-closed release gates, and actionable cross-skill verification reports. |

## How the gate works

TasteCheck carries design intent through a shared pipeline: establish or infer the design system, check foundations, check structure and behavior, check surface decisions, run accessibility and language checks, remove visual and copy tells, and finish with `tastecheck-pass`.

The `tastecheck-pass` skill states the canonical pipeline, runs the relevant self-checks, reports a pass/fail table, and uses an auditor for cold-load issues that a self-reported checklist can miss. The current public release status remains source-bound: release evidence is **UNVERIFIED**, and historical effectiveness is **BLOCKED**.

Run the repository’s repeatable engineering checks with `npm test`. Those checks cover repository contracts, installation, links, authored demo surfaces, and verification plumbing; they are not a universal effectiveness claim.

## Gallery

The gallery contains 8 committed browser-rendered design systems for the same product story and core information architecture. It demonstrates variance, not a menu to copy: derive a new direction from the user’s answers.

| System | Territory | Signature structure |
|---|---|---|
| [Copper](samples/copper/) | dark, warm, geological | irregular tessellated bento with structural basalt columns |
| [Swiss](samples/swiss/) | light, austere, exact | exposed column grid carrying the content |
| [Maximal](samples/maximal/) | loud, kinetic | display word bleeding into a magenta block with sticker-wall collage |
| [Concrete](samples/concrete/) | raw, mechanical, monochrome | ruled spec sheet with a dense ledger table and hazard accent |
| [Clay](samples/clay/) | warm, soft, humanist | alternating zig-zag card flow with organic pebble shapes |
| [Dispatch](samples/dispatch/) | dark, operational, emerald | reverse-chronological release timeline |
| [Verge](samples/verge/) | cool, clinical, measured | hypothesis-to-verdict evidence cards |
| [Seed](samples/tasteroll/) | warm, procedural, annotated | seeded specimen card with rolled dimensions |

Open the [live landing page](https://kyanitelabs.github.io/tastecheck/), [live gallery](https://kyanitelabs.github.io/tastecheck/samples/), or [secondary integration harness](https://kyanitelabs.github.io/tastecheck/demos/skill-integration.html).

## Install

The one-line install path is:

```bash
git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh
```

The installer creates canonical links in `~/.agents/skills/` and mirrors them into detected agent skill directories. Claude Code also receives the 20 canonical slash-command wrappers; `/darkmode` is the sole approved alias, targeting `/theming`.

## FAQ

### What is TasteCheck?

TasteCheck is a frontend taste and ship-gate toolkit for AI coding agents and frontend engineers who want evidence-backed UI quality before shipping.

### Who should use TasteCheck?

TasteCheck is for frontend engineers and AI coding agents that need to turn design intent into checkable frontend work.

### What does TasteCheck check?

TasteCheck checks design direction, typography, color, spacing, theming, layout, states, forms, empty states, motion, visualization, art direction, accessibility, cognitive accessibility, internationalization, copy, and the final release gate.

### How is TasteCheck different from a design prompt?

TasteCheck makes design decisions explicit before implementation and checks the resulting frontend against those decisions instead of relying on subjective polish.

### Is TasteCheck free?

Yes; TasteCheck is open source under the MIT license in [`LICENSE`](LICENSE).

### How do I install TasteCheck?

Clone the repository and run `./tastecheck/install.sh`.

### Is TasteCheck proven effective?

The current public release status is source-bound: engineering release evidence is UNVERIFIED and historical effectiveness is BLOCKED.

## License

TasteCheck is MIT licensed; the authoritative terms are in [`LICENSE`](LICENSE).

<!-- s-plus-geo:start -->

## What is TasteCheck?

**TasteCheck** is a **frontend taste and ship-gate evaluation toolkit** that helps **frontend engineers and agents shipping UI** **fail closed on generic/sloppy UI and organize evidence for scoped ship-quality decisions**. Subjective checks remain accountable human judgments.

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
- Use when you need to fail closed on generic/sloppy UI and organize evidence for a scoped ship-quality decision
- Skip if you need a design Figma plugin

## FAQ

### What is TasteCheck?

TasteCheck is a frontend taste and ship-gate evaluation toolkit. It helps frontend engineers and agents shipping UI fail closed on generic/sloppy UI and organize evidence for scoped ship-quality decisions, while accountable reviewers make subjective calls.

### Who should use TasteCheck?

frontend engineers and agents shipping UI.

### How is TasteCheck different?

Unlike subjective design opinions alone, TasteCheck is a fail-closed ship gate that organizes evidence and records accountable human review where judgment is required.

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
