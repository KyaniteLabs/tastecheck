---
id: T09
title: Roll payload
type: wayfinder:grilling
status: closed
resolved: 2026-07-14
---

# Roll payload

## Question

What dimensions are in each roll result? Is the product a fixed list of 8 aesthetics?

## Resolution

**No — the real skill is not 8 aesthetics.** GENERATE builds fresh 2–5 faces per dimension from context; rails constrain; Chance picks among candidates.

**Demo deck (frozen for static page)** matches the **landing UI** already shipping in `index.html`:

| Dim | Faces (landing) |
|-----|-----------------|
| **ref** | mineral, Swiss, brutalist, folio, shipping, clinical, humanist, maximalist |
| **vibe** | warm, serious, playful, refined, stark, editorial, operational, decorative |
| **mode** | light, dark, dual |
| **sig** | needle, rule, display-word, color-block, bento, timeline, annotation, sixling |

Raw face product before legal pruning: \(8×8×3×8 = 1536\). Optimal inventory size = **deduped legal cover**, not vanity padding.

Schema may expand later; v1 demo payload is these four.
