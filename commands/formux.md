---
description: Make a form people actually finish (labels, validation, a11y)
argument-hint: "[file/path or text, optional]"
---

Load and apply the **form-ux** skill (`~/.agents/skills/form-ux/SKILL.md`).

Return the field/state matrix and evidence rows for completion, validation,
recovery, interruption, and autofill; do not emit a polish-only checklist.

Fix the form: persistent labels, validate-on-blur, specific inline errors, correct input types/autocomplete, single column, focus-to-error.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's single authoritative self-check before reporting.
