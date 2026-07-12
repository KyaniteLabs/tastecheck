---
description: Add every interactive state (hover/focus/active/disabled/loading/selected/error)
argument-hint: "[file/path or text, optional]"
---

Load and apply the **component-states** skill (`~/.agents/skills/component-states/SKILL.md`).

Return the state matrix with `:focus-visible`, matching ARIA, and evidence. A missing
semantic token is a reported gap, not an invented color.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's self-check before reporting.
