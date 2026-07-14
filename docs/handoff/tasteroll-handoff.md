# Tasteroll — Session Handoff Document

**Date:** 2026-07-14
**Author:** Simon Gonzalez de Cruz + GJC session
**Status:** Architecture designed, v1.4.1 shipped with first implementation, needs creative overhaul of the demo experience and copy

---

## What TasteCheck Is

TasteCheck is an open-source pack of 20 craft skills for AI coding agents (Claude Code, Codex, Gemini, Cursor). The skills stop AI from building generic "AI slop" websites by interviewing or auditing the user into a real design system first, then applying checkable rules for typography, OKLCH color, accessibility, and anti-slop patterns. MIT license. Repo at `/Users/simongonzalezdecruz/workspaces/tastecheck`, Forgejo at `git.kyanitelabs.tech:KyaniteLabs/tastecheck.git`, GitHub mirror at `github.com/KyaniteLabs/tastecheck`. Main branch is protected — PRs only.

Current version: **v1.4.2** (tagged on both remotes). 20 skills, 8 gallery samples.

## What Tasteroll Is

Tasteroll is the 20th skill — the flagship new feature. It combines three things:

1. **TasteCheck** (the design-rule system that constrains output to be tasteful)
2. **Chance** (Simon's separate randomness/divination engine at `/Users/simongonzalezdecruz/workspaces/chance` — Rust library with dice, cards, runes, I Ching, MCP server, HTTP API)
3. **An audit-driven workflow** that separates mandatory fixes from aesthetic choices

### The 7-Phase Pipeline

This was designed collaboratively through conversation between Simon and the agent. It is NOT up for reinterpretation — this is the agreed architecture:

```
1. AUDIT     → scan what exists → mandatory findings (craft-only)
2. INTAKE    → infer from conversation/repo OR 3-question mini-interview
3. FIX       → resolve all findings (seed-independent, non-negotiable)
4. GENERATE  → fresh candidates for open dimensions (context-aware, AI-derived)
5. ROLL      → seeded pick between valid alternatives (using Chance or inline PRNG)
6. LOCK      → keep what works, re-roll what doesn't, converge
7. GATE      → relaxed gate (readable + WCAG AA + self-contained + inert)
```

### Critical Design Principle: Findings vs. Choices

**Audit findings are invariants, not variables.** They get resolved no matter what Chance picks. Chance never gets to "decide" whether contrast fails or states are missing. Those are fixed before the dice touch anything.

**Chance only operates on the degrees of freedom above the floor.** The output separates:
- **Resolved findings** (deterministic, same every time regardless of seed)
- **Rolled choices** (random, tied to the seed)

### The Bounded Answer Space

Options are NOT a static file. They are generated fresh at roll time from the project context (audit findings + intake). The `assets/design-rails.json` file defines CONSTRAINTS (measure 58–75ch, line-height 1.5–1.8, one accent max, corner radius from {0,2,4,6}), not option lists.

### Interaction Modes

1. **One-shot**: single roll, take it or leave it
2. **Iterative**: roll → lock dimensions → re-roll unlocked → converge (progressive commitment, like Coolors' spacebar but across the entire design system)
3. **Shotgun**: roll N seeds at once, compare side by side

### Relationship to Chance

Chance (`github.com/simongonzalezdecruz/chance`) is a multi-source randomness engine. The tasteroll skill includes an inline xoshiro128++ PRNG (`assets/tasteroll-engine.js`) as a zero-dependency fallback. If Chance is available (via MCP or as a local dependency), prefer it for multi-source entropy mixing, divination-method-themed randomness, and reproducible audit trails.

### Relationship to Rutile/FeatherMark

The feature originated as C8 ("Chance-Styled Notes") in Rutile's SPEC (§8, decisions LD-8b and LD-9). Rutile is Simon's local-first Markdown editor (`/Users/simongonzalezdecruz/workspaces/feathermark`). The back-port plan is documented in `docs/plan/tasteroll-integration.md` in the FeatherMark repo. PR #25 merged the plan.

In Rutile, the user writes a note, clicks a dice button, and the note's HTML export gets a randomly-generated-but-constrained design system. The key Rutile constraints: self-contained HTML (no JS, no external requests), the "fire budget" (one high-chroma moment max), and Chance consumed as a Rust library dependency.

## What's Shipped vs. What Needs Work

### Shipped (v1.4.2, PRs #28–#33)

- `skills/tasteroll/SKILL.md` — full 7-phase pipeline documented
- `skills/tasteroll/assets/design-rails.json` — constraints, audit scope, intake questions, compatibility rules
- `skills/tasteroll/assets/tasteroll-engine.js` — xoshiro128++ PRNG with roll, lock, unlock, reroll, shotgun
- `skills/tasteroll/contract.json` — contract with handoff graph wired
- `samples/tasteroll/index.html` — "Seed / Procedural specimen" gallery sample (coral/sage aesthetic, seed 77 display, roll results table)
- `tasteroll.html` — dedicated feature page at repo root (live demo, pipeline explainer, competitive comparison)
- Landing page (`index.html`) — tasteroll cell in bento grid with dice button
- Rutile DESIGN-SYSTEM.md updated with C8 reference to tasteroll
- Rutile `docs/plan/tasteroll-integration.md` — full integration plan

### What Simon Has Explicitly Said Needs Work

1. **The demo on `tasteroll.html` is not good enough.** Simon's feedback progression:
   - "the live demo needs to be much more visual and realistic"
   - "that's very wrong. it should literally do what the app will do. chance etc"
   - The current version shows a 5-step machine (broken page → audit → fix → roll → result). Simon has not confirmed this version is right.

2. **The demo should connect to Chance.** Simon wants the real Chance engine involved, not just an inline PRNG. Chance has an HTTP API (Rust/Axum, port 8080 by default) with `/pick` and `/roll` endpoints, but it kept crashing on startup in this session.

3. **The xoshiro128++ algorithm name should not appear in user-facing copy.** It's an implementation detail. The visible copy should communicate value, not internals.

4. **The tasteroll sample (`samples/tasteroll/index.html`) needs refinement.** It was created by a Grok executor agent. The concept (specimen card with seed 77 display) is good but the execution may need polish.

5. **Copy and documentation need updating across the board** — README, llms.txt, CHANGELOG all need to reflect the final tasteroll design.

### What Simon Has NOT Yet Decided

- **Seed derivation**: content hash (reproducible per project) vs. timestamp (fresh each roll) vs. explicit user seed input
- **Candidate generation runtime**: on-device model vs. Niko's GPU over tailnet (for Rutile integration)
- **Audit scope for notes**: should it be simplified for the Rutile note-export context vs. full web-project audit
- **The exact visual design of the tasteroll feature page** — Simon hasn't approved any version of `tasteroll.html` yet

## Key Files

| File | Purpose |
|------|---------|
| `skills/tasteroll/SKILL.md` | The skill definition — 7-phase pipeline, rails, gate, handoff |
| `skills/tasteroll/assets/design-rails.json` | Hard constraints (NOT option lists), audit scope, intake questions |
| `skills/tasteroll/assets/tasteroll-engine.js` | xoshiro128++ PRNG with lock/reroll/shotgun |
| `skills/tasteroll/contract.json` | Contract for routing/handoff |
| `samples/tasteroll/index.html` | Gallery sample — "Seed / Procedural specimen" |
| `tasteroll.html` | Feature page with live demo (NEEDS REWORK per Simon) |
| `index.html` | Landing page with tasteroll cell in bento grid |
| `/Users/simongonzalezdecruz/workspaces/chance/` | The Chance randomness engine (Rust, separate repo) |
| `/Users/simongonzalezdecruz/workspaces/feathermark/docs/plan/tasteroll-integration.md` | Rutile C8 integration plan |

## Verification

- `npm test` — core test suite (passes)
- `npm run verify:v1` — full verification gate (passes)
- `node tools/lint-skills.mjs` — skill lint (20 skills, 0 failures)
- Forgejo PRs via API: `security find-internet-password -s git.kyanitelabs.tech -w`
- Main branch is protected — always branch from `origin/main`, PR, merge via API

## How to Serve the Demo Locally

```bash
cd /Users/simongonzalezdecruz/workspaces/tastecheck
python3 -m http.server 8765
# Then open http://localhost:8765/tasteroll.html
```

## Chance API (when working)

```bash
cd /Users/simongonzalezdecruz/workspaces/chance
cargo run -- serve --port 8080
# Endpoints: /pick (POST {"items":[...],"count":1}), /roll (POST {"dice":[...]})
```
Note: Chance API kept crashing on startup in this session. Needs investigation — possibly a tokio runtime issue with background processes.

## Session Context

- Local server running on port 8765 (TasteCheck files)
- Simon's machine: macOS, Apple M4, iTerm.app
- Simon uses `bun` first, GJC at `~/.bun/bin/gjc`
- `grok -p "prompt"` CLI available at `/opt/homebrew/bin/grok` (Grok Build TUI, single-turn mode) — but balance is exhausted
- MiniMax API available via `MINIMAX_API_KEY` env var (model: `MiniMax-Text-01`, endpoint: `api.minimaxi.chat`)
- GJC executor agents use `zai/glm-5.2` model
- GJC task config routes executor→MiniMax, planner→Grok
