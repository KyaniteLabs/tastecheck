---
name: tastecheck
description: >-
  Use when frontend/UI work is claimed done or ready to ship. Run the Tastecheck
  browser ship gate on the real rendered page and report a fail-closed SHIP / HOLD
  verdict with evidence.
---

# Tastecheck ship gate (Hermes)

Three laws:
1. **Checkmarks are not execution evidence.** A check counts only if it ran and you can cite what it saw.
2. **Verdict first, fail closed.** Lead with SHIP or HOLD. A required probe that failed or could not run is HOLD.
3. **`n/a` means the subject is absent**, never "not tested".

## Workflow
1. Find the real artifact: a running dev-server URL (`http://localhost:...`) or built HTML (`dist/index.html`).
2. Call `tastecheck_audit` with `target` set to it.
3. Report: `SHIP` or `HOLD` on the first line, then each hold reason with its evidence, then the `evidence_dir` (evidence.json + screenshots).
4. On HOLD, propose the smallest fixes; re-run the audit after the user approves and applies them.
5. If the audit could not run (no Node >=22 / no Chrome), say so: the verdict is **HOLD (not run)**, not SHIP.

`tastecheck_profile` (read-only) shows template tells the user keeps on purpose; they only change template-tell judgments.
The full 20-skill pack (color, typography, spacing, a11y, deslop…) installs via the Tastecheck CLI (`tastecheck install`), outside this plugin.
