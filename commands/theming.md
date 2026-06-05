---
description: Build a theme system — light + dark + high-contrast from one token source
argument-hint: "[site/app, optional]"
---

Load and apply the **theming** skill (`~/.agents/skills/theming/SKILL.md`).

Define semantic tokens once; map light (off-white baseline, not #fff glare), dark (tuned not inverted — #121212, elevation by lightness, off-white text, accents +L/−C), and high-contrast (prefers-contrast + forced-colors). prefers-color-scheme default + persistent toggle; verify contrast per theme. Pairs with color-system, a11y-pass, cognitive-a11y.

Target: $ARGUMENTS
