---
name: cognitive-a11y
description: >-
  Cognitive accessibility pass for ADHD, autism, dyslexia, and neurodivergent
  users. Use for readability, plain language, predictability, sensory load,
  memory burden, time pressure, forms, onboarding, dashboards, docs, and flows.
---

# Cognitive Accessibility (ADHD · autism · dyslexia · neurodivergence)

`a11y-pass` covers mechanical WCAG defects. This pass asks whether someone can read,
understand, remember, and finish the task without avoidable cognitive cost. Profile
patterns are lenses for friction, never diagnoses or universal rules.

## The non-negotiables (help every profile)

- **Plain and structured:** literal, front-loaded language; short chunks; summaries,
  visible steps, and progress for long work.
- **Predictable and low-memory:** consistent labels/help; no surprise changes; carry
  forward information instead of requiring recall.
- **Calm and readable:** controllable motion, no sensory overload, readable ragged-left
  type (about 1.5 line-height and 45–75ch), and no justified/all-caps blocks.
- **Forgiving:** explain fixes, preserve work, allow pause/extension, and confirm or
  undo destructive actions.

## Profile lenses

Use `references/profiles.md` for detail. ADHD highlights distraction, progress, and
save/resume; autism highlights predictability and sensory control; dyslexia highlights
reading support and alternatives to text-only cues. Apply the shared rules to every
user, including kind, non-judgmental recovery.

## How to use this skill

### Map friction before profiles

Trace one real task from first read through interruption/error and recovery. Record the
observed friction and demand, a non-diagnostic profile hypothesis, the repair, and a
task-path observation that proves start, correction, or resume became easier. Then make
purpose and next action skimmable; externalize memory and progress; preserve work and
time control; and offer motion, density, and reading support without changing meaning.

## Reference files

- `references/profiles.md` — profile-specific barriers and repairs.
- `references/patterns.md` — checkable cross-cutting patterns and examples.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before claiming cognitively accessible)

- Plain, chunked, predictable, low-memory content with one clear next action?
- Calm, controllable sensory/readability conditions and kind, recoverable errors?
- A real path separates observed friction from hypothesis and proves start, recovery, or resume?

## How to deliver

Name the profiles and concrete moves. This is the cognitive layer; hand technical/WCAG defects to `a11y-pass`.

## Provenance — principle, not property
Grounded in the W3C Cognitive and Learning Disabilities Accessibility Task Force (COGA)
"Making Content Usable for People with Cognitive and Learning Disabilities" and
established neurodivergent-design practice. Independent synthesis, credited — not copied.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A flow imposes avoidable memory, attention, predictability, reading, or recovery load for ADHD, autistic, dyslexic, or other neurodivergent users.; avoid: The issue is only color contrast, semantic markup, or translation expansion.
- Exclude: Do not flatten personality or remove useful complexity without evidence. (+1 in contract.json)
- Stop / handoff: Stop when the task context or observed friction is unknown. (+1 in contract.json); receives [improve-existing-website, form-ux, empty-states, theming] -> sends [a11y-pass, humanize-copy, tastecheck-pass]
- Output: prioritized cognitive repair ledger preserving product voice
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
