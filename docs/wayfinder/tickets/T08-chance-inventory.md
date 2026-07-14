---
id: T08
title: Chance and inventory
type: wayfinder:grilling
status: closed
resolved: 2026-07-14
---

# Chance and inventory

## Question

How does real Chance participate without freestyling useless design?

## Resolution

- **Mint time:** real Chance produces **roll results only** (dimension picks + ids/order) over the **TasteCheck-legal candidate set**.
- **Not pre-generated:** full page HTML/CSS designs.
- **Runtime:** page draws from inventory (shuffle + shareable id); visitors do not need live Chance.
- **Product story:** dual intro — TasteCheck rails + Chance entropy — without a live public API dependency on every click.
- **Safety:** Chance never sees open-ended “any CSS” lists; only legal faces/tuples. Useless landings are excluded before inventory commit.
