---
description: Build the spacing scale + section rhythm and tokenize every gap
argument-hint: "[file/path or area, optional]"
---

Load and apply the **spacing-system** skill (`~/.agents/skills/spacing-system/SKILL.md`).

Pick the base from the density choice, emit the canonical `--space-1…8` + `--space-section` tokens, apply the proximity rule (related close, unrelated far, visible jumps), decide the section rhythm on purpose, and grep out every off-scale margin/padding/gap.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting.
