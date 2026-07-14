You are working on TasteCheck — an open-source pack of 20 craft skills for AI coding agents that stops them building generic "AI slop" websites. Your job is to rework the tasteroll feature page and demo.

## Context

Tasteroll is the 20th skill. It combines three things:
1. **TasteCheck** — design rules that constrain output to be tasteful
2. **Chance** — a randomness/divination engine (separate Rust project with dice, cards, runes, I Ching, MCP server, HTTP API on localhost:8080)
3. **An audit-driven workflow** — mandatory fixes are separated from aesthetic choices

The tasteroll pipeline is a 7-phase process. This architecture is FINAL — do not redesign it:

```
1. AUDIT     → scan what exists → mandatory findings (craft-only: contrast, spacing, states, slop tells, a11y)
2. INTAKE    → infer from conversation/repo OR 3-question mini-interview
3. FIX       → resolve all findings (seed-independent, non-negotiable — these are the FLOOR)
4. GENERATE  → fresh candidates for open dimensions (context-aware, AI-derived — NOT from a static option list)
5. ROLL      → seeded pick between valid alternatives (using Chance or inline xoshiro128++ PRNG)
6. LOCK      → keep what works, re-roll what doesn't, converge (progressive commitment)
7. GATE      → relaxed gate (readable + WCAG AA + self-contained + inert)
```

Critical principle: **audit findings are invariants, not variables.** They get fixed no matter what the dice roll. Chance only operates on the degrees of freedom ABOVE the floor. The output separates "resolved findings" (deterministic) from "rolled choices" (seed-dependent).

## What You Need to Build

The file `tasteroll.html` at the repo root needs a complete rework. The current version is a 5-step wizard that Simon (the owner) has not approved. His feedback:

1. "the live demo needs to be much more visual and realistic"
2. "it should literally do what the app will do. chance etc"
3. The xoshiro128++ algorithm name must NOT appear in user-facing copy
4. It should feel like the real product, not a toy

### What "real" means

The demo should show the ACTUAL workflow end-to-end on real content:
- Start with a real page that has real problems (bad contrast, purple gradient, pill buttons, ChatGPT copy, missing states)
- Run a REAL audit on it — scan and report actual findings
- Apply mandatory fixes — show what changed and why
- Roll the dice — generate a complete design system using seeded randomness
- Apply that design system to the SAME content — the page transforms
- Let the user lock dimensions they like and re-roll the rest
- Each roll should produce a VISUALLY DIFFERENT result — not just a color swap, but different layout, different typography, different structure

### Each aesthetic must produce a different LAYOUT

When the roll picks "brutalist" the page should look fundamentally different from when it picks "humanist" or "maximalist" — not just different colors on the same structure. Think of the 8 gallery samples in `samples/` — each one is a completely different visual world applied to the same product story.

### Chance integration

If the Chance API is running (localhost:8080, endpoints `/pick` and `/roll`), the demo should try to use it for randomness and display "Powered by Chance" when connected. If not running, fall back to the inline PRNG silently. The Chance API is a Rust/Axum server — start it with `cd /Users/simongonzalezdecruz/workspaces/chance && cargo run -- serve --port 8080`.

### Design constraints for the page itself

- Self-contained: no external fonts, CSS, or JS (system font stacks only, or the repo's bundled fonts in `site/fonts/`)
- Must pass a basic accessibility check (contrast ≥ 4.5:1, has `<main>`, has skip link, has `:focus-visible`, has `prefers-reduced-motion`)
- `overflow-x: hidden` on html
- No purple/indigo gradients, no glassmorphism, no pill buttons (999px radius), no centered hero with 3 equal cards
- Match the TasteCheck landing page aesthetic (dark copper/basalt theme using OKLCH)
- The page itself should demonstrate good taste — it IS a TasteCheck product

## Key Files to Read

- `tasteroll.html` — the current version you're replacing
- `skills/tasteroll/SKILL.md` — the full skill definition (7-phase pipeline, design rails, gate)
- `skills/tasteroll/assets/design-rails.json` — hard constraints and audit scope
- `skills/tasteroll/assets/tasteroll-engine.js` — the PRNG engine with lock/reroll/shotgun
- `samples/copper/index.html` — reference for a high-quality TasteCheck sample page
- `samples/tasteroll/index.html` — the gallery sample ("Seed / Procedural specimen")
- `index.html` — the main landing page (for design language reference)
- `site/tokens.css` — design tokens
- `site/fonts/` — bundled fonts (Redaction, Archivo)

## The 8 Aesthetics and Their Visual Properties

| Aesthetic | Palette | Layout style | Font | Radius |
|-----------|---------|-------------|------|--------|
| mineral | copper gold on warm dark (#1a1410/#c9921e) | asymmetric column-rule hero | serif display | 5px |
| grid | cool blue on dark (#0f1419/#3b82f6) | visible 6-column subgrid | sans | 2px |
| maximalist | hot magenta on dark (#14101a/#ff3d8b) | rotated stickers, oversized word, color blobs | sans bold | 4px |
| brutalist | hazard orange on black (#0c0c0c/#ff4d00) | dense monospace log, heavy rules | mono | 0px |
| humanist | sage green on dark (#1a1f1a/#6b9a6a) | soft rounded cards, grouped clusters | sans | 10px |
| operational | emerald on dark (#0a0f0d/#2dd4a8) | left-rail timeline with status dots | sans | 4px |
| clinical | teal on ice-white (#f7f9fa/#0d7490) | numbered annotations, bar charts, evidence cards | serif | 2px |
| folio | warm brown on dark (#1c1814/#b5532f) | editorial column, generous margins, drop accent | serif | 2px |

## Local Server

```bash
cd /Users/simongonzalezdecruz/workspaces/tastecheck
python3 -m http.server 8765
# Open http://localhost:8765/tasteroll.html
```

## Important Rules

- Do NOT change any files other than `tasteroll.html`
- Do NOT run tests, linters, or formatters
- The page must work standalone when served from the repo root
- Keep it under 500 lines if possible — dense, not bloated
- The xoshiro128++ name must NOT appear anywhere in visible text
- Write copy that communicates VALUE, not implementation details
