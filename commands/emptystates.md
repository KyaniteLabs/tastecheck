---
description: Add the empty/loading/error states for a data region
argument-hint: "[file/path or text, optional]"
---

Load and apply the **empty-states** skill (`~/.agents/skills/empty-states/SKILL.md`).

Distinguish first-use, no-results, permission, loading, and outage. Attach an
evidence-backed next action to each applicable state.

Design all three states for the target: loading skeleton, empty-with-action, blameless error with retry; wire a11y announcements.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's single authoritative self-check before reporting.
