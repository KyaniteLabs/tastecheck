---
description: Run the tastecheck ship gate — every relevant skill self-check, with a pass/fail report
argument-hint: "[project/page to gate, optional]"
---

Load and apply the **tastecheck-pass** skill (`~/.agents/skills/tastecheck-pass/SKILL.md`).

Confirm the DESIGN-SYSTEM.md (or inferred system) exists, execute every pipeline-relevant skill's self-check against the actual artifact, run the measurable checks (a11y auditor, 320px + 400% zoom, keyboard pass, per-theme contrast, reduced motion), audit against the committed spec, and deliver the pass/fail table. Fix or surface every ✗.

Target: $ARGUMENTS (if empty, gate the most recent build in context).
