---
description: Build an honest, Tufte-informed, accessible web chart (genre-first, no chartjunk)
argument-hint: "[the data / chart request]"
---

Load and apply the **data-viz** skill (`~/.agents/skills/data-viz/SKILL.md`).

Start from the comparison question and data quality. Report chart choice,
uncertainty, table parity, accessibility, and provenance with evidence.

Decide genre first (≤20 numbers → table; many series → small multiples; for time-series trends choose a line or sparkline from the comparison question, density, and reading surface; etc.), kill chartjunk, keep proportions honest (zero baselines, lie factor ≈1), direct-label not legend, use color-system tokens, verify theming + contrast, and ship a caption + accessible data table. If specialist Tufte assessment/rendering skills are available, use them for deep critique or publication SVGs.

Request: $ARGUMENTS

Run the skill's single authoritative self-check and emit status, reason, remediation, evidence, and provenance for each applicable row.
