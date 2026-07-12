---
description: Run the tastecheck ship gate — every relevant skill self-check, with a pass/fail report
argument-hint: "[project/page to gate, optional]"
---

Load and apply the **tastecheck-pass** skill (`~/.agents/skills/tastecheck-pass/SKILL.md`).

The gate is fail-closed: no bare checkmarks, unsupported `n/a`, inferred
execution, or missing provenance. Deliver the canonical evidence ledger and a
presentation report separately.

Run the projected pipeline against the actual artifact; attach measured browser,
keyboard, contrast, zoom, and motion evidence. A claimed pass cannot override a finding.

Target: $ARGUMENTS (if empty, gate the most recent build in context).
