# Decision Records — improve-existing-website

Meta-patterns and ADR-style rules for novel cases. Use these to derive answers the
other files don't directly cover.

## Meta-patterns (how a restorer thinks)

- **MP-1 · Evidence before opinion.** Every system claim traces to an observation
  (a count, a screenshot, a computed style). If you can't cite it, you can't claim it.
- **MP-2 · Preserve first, then formalize, then remove.** The order matters: identify
  what must survive before deciding what dies. Deletion is easy; un-deletion isn't.
- **MP-3 · The site outranks the textbook.** When an existing, working, on-brand
  pattern conflicts with a tastecheck default (e.g. the brand legitimately uses pills),
  the committed existing identity wins — record it as a project refusal.
- **MP-4 · Smallest coherent set.** Ship the minimum change that makes the inferred
  system *true*, not the maximum change the audit could justify.

## ADRs

**ADR-1 — At most three questions, each one solution-changing.**
*Why:* the site already answers most interview questions; re-asking burns trust and
time (MP-1). *Apply:* before asking anything, write down how the answer would change
the work. If it wouldn't, don't ask.

**ADR-2 — Contrast, keyboard, and reflow failures are fixed without asking.**
*Why:* they're defects, not taste (MP-4); no answer changes the fix. *Apply:* WCAG-level
problems go straight into the change set, reported after.

**ADR-3 — Brand-adjacent changes (logo-near colors, heading faces, voice) get asked.**
*Why:* what looks like drift may be an attachment or a legal/brand constraint (MP-2).
*Apply:* present as recommendation + default: "Lobster hurts readability at small
sizes; I'd swap to X which keeps the warmth — keep or swap?"

**ADR-4 — Output is tokens + components, not one-off CSS.**
*Why:* polishing instances leaves the next page broken (MP-2). *Apply:* repeated
choices become semantic tokens (canonical names from the design-system-interview
contract); one-off fixes are allowed only on one-off elements.

**ADR-5 — Scope is visible.** *Why:* "improve" silently becoming "redesign" is the
top failure (MP-4). *Apply:* state up front what fraction of the surface you expect to
touch; stop and confirm if reality exceeds it.
