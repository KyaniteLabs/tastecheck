---
name: deslop-ui
description: >-
  Anti-slop UI review for generated or generic frontend work. Use after LLM UI
  output, or for requests to remove AI tells: purple gradients, pill CTAs,
  default type, centered heroes, three-card grids, glassmorphism, and template sameness.
---

# Deslop UI

Slop is predictable, uncommitted design, not merely ugly design. Audit surface, structure, and
voice against the brief; repair with a specific, verifiable choice.

## Repair order and evidence contract

1. Establish brief, preserved signals, and artifact; separate surface, structural, and verbal findings.
2. Cite selector, section, phrase, screenshot, or browser observation; assign P0–P3.
3. Choose a brief-bound direction, prescribe repairs, and reinspect the same views.

`n/a` requires an absent subject. Stop before changing a coherent brief-supported brand
choice; ask for direction when brief or acceptance criteria are absent.

## Diagnose cause, then tell

Make two passes: **intent** (job, audience, hierarchy, retained signals, signature) and
**behavior** (first view, transitions, narrow view; trace code to selector/token or screenshot
geometry). Test whether a neutral replacement changes meaning or performance.
Preserve a documented functional pill, gradient, table, or system font; repair
implementation, not role.

Rank P0 meaning/interaction/accessibility/fact, P1 direction/hierarchy, P2 repeated default,
then P3 polish. Every P0–P2 packet names subject, observation+brief, mechanism, preserved
signal, concrete replacement+owner, and after-state observation (including narrow view). Make
one causal structural repair when the skeleton is generic.

## Fast audit and self-check

Render before acting; grep is only a lead. Check these detector/decision pairs:

| Plane | Detector | Required repair decision |
|---|---|---|
| surface | unsupported purple/white gradient, default neutral tokens, equal-weight palette | dominant field, purposeful accent, semantic tokens, contrast |
| type/shape | unexamined default type, timid hierarchy, pill CTA, universal radius/shadow | type stance and role-based scale/radius/elevation |
| structure | centered hero → one CTA → equal cards, uniform section rhythm | replacement topology, lead/supporting evidence, narrow reading order |
| decoration/function | default glass/blobs/emoji/gradient text, static forms, placeholder copy | brief-supported atmosphere or none; route behavior/copy to the owning skill |

Every finding needs subject, P0–P3, observed evidence, preserved signal, replacement, and
after-state proof. Verify surface, structural stack/rhythm, and verbal claims (hand factual
prose to `humanize-copy`). A named direction states aesthetic, dominant field/accent job, type
stance, and signature move. Re-run original views.

## Reference files

- `references/anti-patterns.md` — full detector catalog and fixes.
- `references/structural-tells.md` — structural audit and dated attractors.
- `references/design-direction.md` — positive direction method.
- `references/decision-records.md` — novel-case ADR rules.

## How to deliver

Deliver prioritized repairs and named direction; state what changed, why, what survives,
and after-state proof. Respect existing tokens; pair with `web-typography`, `color-system`,
and `micro-motion` as needed.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: A rendered or coded interface feels generic and needs a structural, visual, and verbal anti-slop audit. (+1 in contract.json); avoid: The task is a greenfield aesthetic interview before a page exists. (+1 in contract.json)
- Exclude: Do not replace a coherent brand system merely because it is not your preference. (+2 in contract.json)
- Stop / handoff: Stop before changing a coherent branded choice that is supported by the brief. (+2 in contract.json); receives [design-system-interview, improve-existing-website, art-direction, responsive-layout] -> sends [web-typography, color-system, humanize-copy, tastecheck-pass, a11y-pass, empty-states, form-ux, micro-motion]
- Output: prioritized anti-slop repair specification and committed direction
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
