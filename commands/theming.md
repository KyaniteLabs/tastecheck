---
description: Build coherent theme mappings from one semantic token system
argument-hint: "[site/app, optional]"
---

Load and apply the **theming** skill (`~/.agents/skills/theming/SKILL.md`).

Define semantic roles once, then map only the modes the product requires. Test real
foreground/background pairs, user preference, first paint, browser controls, and forced
colors as distinct concerns. Report missing roles instead of hard-coding exceptions.

Return one evidence row per supported mapping and environment, with a repair for each failure.

Target: $ARGUMENTS
