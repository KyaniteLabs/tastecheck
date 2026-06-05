---
description: Build an OKLCH palette that's cohesive and passes contrast
argument-hint: "[file/path or text, optional]"
---

Load and apply the **color-system** skill (`~/.agents/skills/color-system/SKILL.md`).

Generate or fix the palette: OKLCH ramp, tinted neutrals, semantic tokens, verified contrast pairs.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting. Report what you changed and why, in the skill's terms.
