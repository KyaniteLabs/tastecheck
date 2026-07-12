---
description: Complete and verify every meaningful state of an interactive component
argument-hint: "[file/path or text, optional]"
---

Load and apply the **component-states** skill (`~/.agents/skills/component-states/SKILL.md`).

Inventory states from the component’s actual behavior, then implement and verify each
applicable pointer, keyboard, loading, selection, disabled, success, and error state.
Return the state matrix with matching semantics and evidence. Report a missing semantic
token as a system gap instead of inventing a one-off color.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's self-check before reporting.
