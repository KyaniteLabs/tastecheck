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

Tasteroll audits what exists, asks at most three questions, fixes what is broken, then rolls
valid alternatives. Lock what works; re-roll what does not. **Project constraints produce taste
even when choices are random.**

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

## 1. Audit (mandatory fixes)

Scan rendered surfaces, source CSS, repo files, and content. Resolve every
**non-negotiable** craft finding before rolling:

- **Contrast**: body < 4.5:1 or UI < 3:1 on actual surfaces
- **Spacing**: no scale, arbitrary margins with no token system
- **States**: interactive elements missing hover/focus/active/disabled
- **Tells**: named AI slop patterns present (gradient, centered hero, 3 cards)
- **Accessibility**: missing alt, unlabeled controls, broken heading order
- **Structure**: missing main landmark, no skip link, no focus-visible

Flag findings outside craft scope (bad copy, content gaps, broken features) and hand them off;
tasteroll does not fix them.

A single-word "preserve" overrides an intentional low-contrast or missing-state choice;
otherwise resolve every finding.

For greenfield, scan brief/content for contradictions, missing scope, and vague direction.

## 2. Intake

Choose by available signal:

**Infer** (default): read the conversation and scan repo files (README, CSS, package.json,
content). Skip questions when product and audience are clear.

**Mini-interview** (fallback): ask three questions when inference is thin:

1. **What are you building?** → unlocks structure, density, IA
2. **Who is it for?** → unlocks personality, accessibility posture, complexity
3. **One word for how it should feel?** → unlocks aesthetic, accent direction

Three answers cover the brief without the full 11-field `design-system-interview`.

## 3. Fix (deterministic)

Resolve every finding here. Separate seed-independent "resolved findings" from random
"rolled choices" in the output.

## 4. Generate

For each open dimension (personality, aesthetic, type, color_mode, density, rhythm,
signature, imagery, motion, accent), generate **2–5 candidate options** from audit/intake
context at roll time; no static list.

Candidates must satisfy **compatibility rules** in `assets/design-rails.json`: compact
density/metronomic rhythm, airy/syncopated, brutalist/restrained motion, etc. No conflicts.

Respect **locked dimensions** from previous rolls.

## 5. Roll (seeded pick)

The PRNG (`assets/tasteroll-engine.js`) picks one candidate per open dimension. Same seed
+ candidates → same roll, always; seeds make rolls reproducible/shareable.

If Chance (kyanitelabs/chance) is available via MCP, prefer it for multi-source entropy
mixing and reproducible audit trails; the inline engine is the fallback.

## 6. Lock and re-roll

Mode:

- **One-shot**: roll once; take it or re-roll from scratch.
- **Iterative**: roll → review → lock working dimensions → re-roll unlocked only →
  converge. Each re-roll increments the seed and excludes shown directions.
- **Shotgun**: roll N seeds → compare side by side → pick one to develop.

Locked dimensions and resolved findings persist; only open dimensions vary.

## 7. Gate

Tasteroll output is a personal artifact/prototype, not shipped; use a lighter gate than
`tastecheck-pass`:

- **Readable**: start with body ≥ 1rem, measure 58–75ch, and line-height ≥ 1.5; a brief may
  justify another measure with rendered evidence
- **WCAG AA**: body ≥ 4.5:1, UI ≥ 3:1 (verified on the rolled surfaces)
- **Self-contained**: no external requests in exports
- **Inert**: no scripts in exported HTML
- **Keyboard-reachable**: all interactive elements focusable with visible focus

Escalate **shipped public surfaces** to `tastecheck-pass`.

## Invariants

Invariant floors and brief defaults live in `assets/design-rails.json`. Contrast, keyboard
reachability, self-containment, and truthful findings stay invariant. Briefs may override
measure, line-height, weight, density, texture, radius, accent count, and section rhythm
only with reasons and rendered proof.

Rails contain no option lists; generate options fresh.

## Difference

- **v0 / LLM generators**: no seed, audit, rules, reproducibility
- **Coolors**: random colors, no system, structure, gate
- **Tasteroll**: audit fixes + context-aware candidates + seeded pick + lock/reroll +
  complete design system + quality gate

## References

- `assets/design-rails.json` — dimensions, floors, defaults, scope, questions, rules.
- `assets/tasteroll-engine.js` — pasteable xoshiro128++ PRNG with lock, reroll, shotgun,
  and exclude operations.

## How to deliver

Deliver seed, deterministic findings, seed-dependent choices, DESIGN-SYSTEM.md, gate evidence,
and `design-system-interview` handoff fields.

"Roll again" increments the seed; never silently reuse it with different answers.

## Evidence

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
