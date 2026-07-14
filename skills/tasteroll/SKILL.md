---
name: tasteroll
description: >-
  Rapid prototyping through constrained randomness. Audits what exists, fixes
  what is broken, generates fresh design candidates from context, then rolls
  the dice between valid alternatives. Lock what works, re-roll what doesn't,
  converge on a direction. Use for design exploration, rapid prototyping, or
  when a user wants surprise within guardrails.
---

# Tasteroll (roll for taste, keep what sticks)

Most design generators either ask you everything (the full interview) or nothing
(press a button, hope for the best). Tasteroll is the middle path: it audits
what exists, asks at most three questions, fixes what is broken, then rolls
between valid alternatives. Lock what works, re-roll what doesn't.

The thesis: **constraints produce taste, even when the choices are random** —
but only if the constraints come from the actual project, not a fixed list.

## The pipeline

```
1. AUDIT     → scan what exists → mandatory findings (craft-only)
2. INTAKE    → infer from context/repo OR 3-question mini-interview
3. FIX       → resolve all findings (seed-independent, non-negotiable)
4. GENERATE  → fresh candidates for open dimensions (context-aware)
5. ROLL      → seeded pick between valid alternatives
6. LOCK      → keep what works, re-roll what doesn't, converge
7. GATE      → relaxed gate (readable + WCAG AA + self-contained + inert)
```

## 1. Audit (findings are mandatory fixes)

Scan rendered surfaces, source CSS, repo files, and content structure. Findings
are **non-negotiable** — they get resolved before the dice touch anything,
regardless of seed. The audit scope is **craft-only**:

- **Contrast**: body < 4.5:1 or UI < 3:1 on actual surfaces
- **Spacing**: no scale, arbitrary margins with no token system
- **States**: interactive elements missing hover/focus/active/disabled
- **Tells**: named AI slop patterns present (gradient, centered hero, 3 cards)
- **Accessibility**: missing alt, unlabeled controls, broken heading order
- **Structure**: missing main landmark, no skip link, no focus-visible

Findings outside craft scope (bad copy, content gaps, broken features) are
**flagged and handed off** — not fixed by tasteroll.

A finding can be overridden with a single-word "preserve" if the low contrast
or missing state is an intentional aesthetic choice. Without an override, every
finding is resolved.

For greenfield (nothing to audit), this phase scans the brief and content for
contradictions, missing scope, and vague direction instead of rendered surfaces.

## 2. Intake (context for candidate generation)

Two paths, chosen by signal availability:

**Infer** (default): read the conversation so far + scan repo files (README,
existing CSS, package.json, content). If there is enough signal to know what
the product is and who it is for, skip the questions.

**Mini-interview** (fallback): three questions when inference is thin:

1. **What are you building?** → unlocks structure, density, IA
2. **Who is it for?** → unlocks personality, accessibility posture, complexity
3. **One word for how it should feel?** → unlocks aesthetic, accent direction

Each question unlocks different axes. Three answers give real coverage without
the weight of the full 11-field `design-system-interview`.

## 3. Fix (deterministic, seed-independent)

Every audit finding is resolved here. This step produces the same output
regardless of seed — it is a floor, not a variable. The output section
separates "resolved findings" (deterministic) from "rolled choices" (random).

## 4. Generate (fresh candidates, context-aware)

For each open design dimension (personality, aesthetic, type, color_mode,
density, rhythm, signature, imagery, motion, accent), the AI generates **2–5
candidate options** from the audit findings + intake context. These are not
from a static file — they are produced at roll time from what the agent knows
about the project.

Candidates must satisfy the **compatibility rules** (see `assets/design-rails.json`):
compact density pairs with metronomic rhythm; airy pairs with syncopated;
brutalist aesthetics pair with restrained motion; etc. The generation step
must not produce candidates that contradict each other.

Candidates must also respect any **locked dimensions** from previous rolls.

## 5. Roll (seeded pick)

The PRNG (`assets/tasteroll-engine.js`) picks one candidate per open dimension.
Same seed + same candidates → same roll, always. The seed makes rolls
reproducible and shareable.

If Chance (kyanitelabs/chance) is available via MCP, prefer it for multi-source
entropy mixing and reproducible audit trails. The inline engine is the fallback.

## 6. Lock and re-roll (progressive commitment)

Three interaction modes:

- **One-shot**: single roll. Take it or re-roll from scratch.
- **Iterative**: roll → review → lock dimensions that work → re-roll unlocked
  dimensions only → converge. Each re-roll increments the seed and excludes
  already-shown directions for unlocked dimensions.
- **Shotgun**: roll N seeds at once → compare side by side → pick one to
  develop further.

Locked dimensions and resolved findings persist across all re-rolls. Only open
dimensions vary.

## 7. Gate (relaxed)

Tasteroll output is a personal artifact or prototype, not a shipped surface.
The gate is deliberately lighter than `tastecheck-pass`:

- **Readable**: body ≥ 1rem, measure 58–75ch, line-height ≥ 1.5
- **WCAG AA**: body ≥ 4.5:1, UI ≥ 3:1 (verified on the rolled surfaces)
- **Self-contained**: no external requests in exports
- **Inert**: no scripts in exported HTML
- **Keyboard-reachable**: all interactive elements focusable with visible focus

If the output will be a **shipped public surface**, escalate to `tastecheck-pass`.

## The design rails

The hard constraints live in `assets/design-rails.json`. These define what
dimensions exist, what values are always valid (measure 58–75ch, line-height
1.5–1.8, one accent max, corner radius from {0,2,4,6}), and the compatibility
rules between dimensions. Any roll that violates a rail fails the gate.

The rails file does NOT contain option lists. Options are generated fresh.

## What makes this different

- **v0 / LLM generators**: no seed, no audit, no rules, no reproducibility
- **Coolors**: random colors, no system, no structure, no gate
- **Tasteroll**: audit-driven fixes + context-aware candidates + seeded pick +
  lock/reroll + complete design system + quality gate

## Reference files

- `assets/design-rails.json` — dimensions, hard constraints, audit scope,
  intake questions, compatibility rules.
- `assets/tasteroll-engine.js` — pasteable xoshiro128++ PRNG with lock, reroll,
  shotgun, and exclude operations.

## How to deliver

Deliver: the seed, the resolved findings (deterministic), the rolled choices
(seed-dependent), the derived DESIGN-SYSTEM.md, and the relaxed-gate evidence.
Hand off to downstream skills (color-system, web-typography, spacing-system,
theming, etc.) with the same handoff fields as `design-system-interview`.

If the user says "roll again," increment the seed — never silently re-roll with
the same seed and present different answers.

## Completion evidence

| Status | Reason | Remediation | Evidence | Provenance |
| --- | --- | --- | --- | --- |
|  | audit — findings and their resolution status |  |  |  |
|  | intake — inference result or mini-interview answers |  |  |  |
|  | fixes — resolved findings (seed-independent) |  |  |  |
|  | roll — seed, locked dimensions, rolled choices |  |  |  |
|  | gate — relaxed-gate contrast, readability, self-containment |  |  |  |

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: Rapid design exploration or surprise direction without a full interview (+2 in contract.json); avoid: The user wants to commit to a specific direction by hand (+2 in contract.json)
- Exclude: Do not roll outside the design rails or bypass the audit findings (+3 in contract.json)
- Stop / handoff: Stop when the output will be a shipped public surface — escalate to tastecheck-pass strict gate (+1 in contract.json); receives [design-system-interview, improve-existing-website] -> sends [color-system, web-typography, spacing-system, theming, responsive-layout, art-direction, micro-motion, component-states, data-viz, empty-states, form-ux, humanize-copy]
- Output: A seeded DESIGN-SYSTEM.md with resolved findings, rolled choices, and gate evidence
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
