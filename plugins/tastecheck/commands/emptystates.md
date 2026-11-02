---
description: Design the moments when data is absent, delayed, filtered, or failed
argument-hint: "[file/path or text, optional]"
---

Load and apply the **empty-states** skill (`~/.agents/skills/empty-states/SKILL.md`).

Map the applicable states—first use, no results, permission, loading, partial data, and
outage—before designing them. Give each state an honest explanation, useful next action,
recovery path, and accessible announcement. Return the state matrix and implemented result.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's single authoritative self-check before reporting.
