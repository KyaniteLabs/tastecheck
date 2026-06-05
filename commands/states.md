---
description: Add every interactive state (hover/focus/active/disabled/loading/selected/error)
argument-hint: "[file/path or text, optional]"
---

Load and apply the **component-states** skill (`~/.agents/skills/component-states/SKILL.md`).

Fill the state matrix for the target control(s); use :focus-visible; wire matching ARIA.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting. Report what you changed and why, in the skill's terms.
