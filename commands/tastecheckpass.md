---
description: Decide whether finished frontend work can ship, with evidence
argument-hint: "[project/page to gate, optional]"
---

Load and apply the **tastecheck-pass** skill (`~/.agents/skills/tastecheck-pass/SKILL.md`).

Run the gate on the real artifact. Lead with **SHIP** or **HOLD**, the blocker count, and
the fastest credible path forward. Then attach the evidence table with measured browser,
keyboard, contrast, zoom, motion, cold-load, and against-spec results. Unsupported `n/a`
and claimed-but-unrun checks are failures.

Target: $ARGUMENTS (if empty, gate the most recent build in context).

This is step 3 of 3. For a browser evidence bag from a git checkout, run
`node skills/tastecheck-pass/assets/cdp-qa.mjs <url-or-path>` (v1.7.0: eight-section
harness; Node 22+ and local Chrome). It does not replace judging against the spec.
If the verdict is HOLD on generic-looking UI, route the repair to `/deslop`.
