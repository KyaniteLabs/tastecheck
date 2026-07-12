---
description: Make a layout survive narrow, wide, embedded, and zoomed contexts
argument-hint: "[file/path or text, optional]"
---

Load and apply the **responsive-layout** skill (`~/.agents/skills/responsive-layout/SKILL.md`).

Preserve the reading order and task hierarchy with intrinsic layout and content-led
breakpoints. Test narrow and wide containers, long content, embedded slots, input
methods, and 400% zoom. Return the failures found, repairs made, and viewport evidence.

Target: $ARGUMENTS (if empty, apply to the current file / most recent work in context).

Run the skill's single authoritative self-check before reporting.
