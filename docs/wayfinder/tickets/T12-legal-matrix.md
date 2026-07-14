---
id: T12
title: Legal compatibility matrix for the demo deck
type: wayfinder:grilling
status: closed
assignee: grok-session
blocked_by: []
claimed: 2026-07-14
resolved: 2026-07-14
supersedes_draft: hard-pair-bans-v1
---

# Legal compatibility matrix for the demo deck

## Question

Which combinations of **ref × vibe × mode × sig** are illegal for inventory mint, and what is the resulting inventory cardinality?

## Context

- Raw deck size is 1536 (see [T09](./T09-roll-payload.md)).
- Quality floor is always on at render ([T06](./T06-quality-floor.md)) — rails, anti-slop, a11y.
- Apply contract ([T10](./T10-apply-contract.md)) maps each dim to whole-page effects.

## Resolution (final — option A after challenge)

### Philosophy

**Illegal = unrenderable or structurally impossible only.**

- Soft “story” bans (e.g. brutalist + playful, clinical + warm) are **not** TasteCheck law. They were draft taste guesses and are **rejected**.
- Craft quality is enforced by the **render/gate path** (rails, banlist, a11y), not by pruning vibe labels.
- Chance still only sees the **legal set** — but that set is the full cartesian product of faces the **renderer can honor**, not a curated vibe police list.

### What is illegal at mint

A tuple `(ref, vibe, mode, sig)` is **illegal** only if:

1. **Missing recipe** — the build does not yet implement that `ref` layout world and/or that `sig` move (and the combination cannot be composed), **or**
2. **Structural impossibility** — the apply contract defines two faces that **cannot coexist in one layout model** for engineering reasons (e.g. if a future rule said “folio is exclusively single-column editorial” and “bento is exclusively multi-cell app grid” and the renderer has no combined mode).  
   **v1 default:** no structural impossibilities are pre-declared among the landing faces. All 8×8×3×8 faces are intended to be composable: ref = layout world, vibe = personality within rails, mode = surface recipe, sig = one overlay move.

### What is NOT illegal

- Any ref × vibe pairing (including “odd” ones)
- Any vibe × sig pairing
- Any mode pairing (light / dark / dual always free)
- Anything that “feels off” but still passes rails + banlist + a11y when rendered

### Cardinality

| | count |
|--|------:|
| Full face cartesian | **1536** |
| Soft pair bans | **0** (removed) |
| **Legal inventory when all recipes exist** | **1536** |
| Legal inventory during partial renderer | **\|cartesian ∩ renderer_ready\|** (build-time filter only) |

Optimal inventory size for this project = **full legal cover of renderer-ready tuples** (up to 1536), deduped, Chance-ordered/ids only. No vanity padding; no taste-ban shrink.

### Mint rule

```
candidates = cartesian(ref, vibe, mode, sig)   // 1536
legal      = { t in candidates | renderer_can_honor(t) }
inventory  = Chance.shuffle(legal)             // + stable ids
// render(t) always applies T06 floor; reject/regenerate only if gate fails
```

### Explicitly voided prior draft

The hard pair-ban tables (ref↔vibe, ref↔sig, vibe↔sig) that produced **951** legal rows are **void**. Do not implement them.

### Open follow-on (not this ticket)

If implementation discovers a true structural impossibility (two faces that cannot share one DOM model), document it as a one-line ban with an **engineering reason**, not a vibe reason, and regenerate inventory.
