---
description: Build the spacing scale + section rhythm and tokenize every gap
argument-hint: "[file/path or area, optional]"
---

Load and apply the **spacing-system** skill (`~/.agents/skills/spacing-system/SKILL.md`).

Pick the base from content density, emit the canonical `--space-1…9` +
`--space-section: clamp(48px, 32px + 4vw, 96px)` tokens, apply proximity rules, state the content-derived section
rhythm, and check every off-scale margin/padding/gap with evidence.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting.
