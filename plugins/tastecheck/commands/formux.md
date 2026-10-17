---
description: Repair a form around completion, recovery, and trust
argument-hint: "[file/path or text, optional]"
---

Load and apply the **form-ux** skill (`~/.agents/skills/form-ux/SKILL.md`).

Walk the form from entry through success, interruption, and error recovery. Fix field
semantics, labels, validation timing, messages, autofill, focus, and preserved input.
Return the field/state matrix, the repaired path, and any remaining blockers.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's single authoritative self-check before reporting.
