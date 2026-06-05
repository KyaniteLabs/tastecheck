---
description: Add the empty/loading/error states for a data region
argument-hint: "[file/path or text, optional]"
---

Load and apply the **empty-states** skill (`~/.agents/skills/empty-states/SKILL.md`).

Design all three states for the target: loading skeleton, empty-with-action, blameless error with retry; wire a11y announcements.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting. Report what you changed and why, in the skill's terms.
