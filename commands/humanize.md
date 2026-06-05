---
description: Remove the ChatGPT accent from prose (kill-list + rhythm + stance)
argument-hint: "[file/path or text, optional]"
---

Load and apply the **humanize-copy** skill (`~/.agents/skills/humanize-copy/SKILL.md`).

Run the target through the Kill List and rhythm/stance rules; rewrite tells into specifics.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Follow the skill's decision order and run its self-check before reporting. Report what you changed and why, in the skill's terms.
