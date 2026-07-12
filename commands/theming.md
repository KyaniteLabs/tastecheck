---
description: Build a theme system — light + dark + high-contrast from one token source
argument-hint: "[site/app, optional]"
---

Load and apply the **theming** skill (`~/.agents/skills/theming/SKILL.md`).

Define semantic tokens once; map brief-derived light, tuned dark, and high-contrast
themes; respect `forced-colors`, preserve user preference without a flash, and measure
real pairs per theme. Stop for missing semantic roles rather than hard-coding colors.

Run the skill's single authoritative self-check and emit status, reason, remediation, evidence, and provenance for each applicable row.

Target: $ARGUMENTS
