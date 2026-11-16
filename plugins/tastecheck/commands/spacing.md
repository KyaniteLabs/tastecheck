---
description: Give a UI a deliberate spacing scale, density, and sectional rhythm
argument-hint: "[file/path or area, optional]"
---

Load and apply the **spacing-system** skill (`~/.agents/skills/spacing-system/SKILL.md`).

Choose density from the content and task. Build the canonical spacing tokens, define
section rhythm, apply proximity rules, and account for off-scale gaps instead of blindly
normalizing them. Return the token scale, rhythm rules, and repaired examples.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting.
