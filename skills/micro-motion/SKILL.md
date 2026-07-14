---
name: micro-motion
description: >-
  Use when an interface needs purposeful feedback, transitions, or reduced-motion
  behavior, especially when animation risks jank, interruption bugs, or hidden
  no-JS content.
---

# Micro-Motion

Motion confirms a change, its origin, or what to notice next. If it answers none of
those, cut it.

## Non-negotiables (the rules that keep motion feeling good)

- **Prefer compositor-safe properties.** Start with `transform` and `opacity`. Color,
  filter, SVG, or measured layout transitions are valid when the purpose requires them
  and a performance trace shows the target device can sustain the interaction.
- **Ease by direction.** Ease-out enters, ease-in exits, ease-in-out moves; linear is
  for a purposeful continuous loop only.
- **Design reduced motion as an equivalent state.** Keep labels, choices, focus, and
  final content; remove spatial movement.
- **Let JavaScript opt individual elements into waiting states only after the observer
  is ready.** Static CSS must not leave content hidden when JavaScript fails, initializes
  late, or restores from the back-forward cache.
- **Make looping motion controllable and never scroll-jack.**

## Easing & duration tokens

Use semantic duration/easing tokens: acknowledgement `120–160ms`, insertion/menu
`160–220ms`, confirmation/route `220–320ms`. Treat these as starting bands and test on
the target device. Motion never delays committed state, focus, or the next keyboard action.

## Settle before styling

Define the usable end state and interruption policy before choosing an entrance. A
superseded save, route, insertion, or dismissal must converge on the newest state without
a stale overlay, announcement, focus jump, or success message. Motion reflects state
ownership; it does not decide it. If ownership or focus recovery is unknown, hand off to
`component-states` before choreographing.

## The reduced-motion contract

Define the project-level reduced-motion policy once, then let components reference it.
For progressive reveals, content starts visible. After the observer is attached,
JavaScript marks only offscreen pending elements; never hide an element already
intersecting the viewport. It removes the marker on reveal and on page restoration.
Gate spatial movement behind `no-preference`:

```css
/* JavaScript marks only non-intersecting elements after the observer is ready. */
.reveal[data-reveal="pending"] { opacity: 0; }
.reveal:not([data-reveal="pending"]) { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .reveal[data-reveal="pending"] { transform: translateY(12px); }
  .reveal { transition: opacity var(--dur-base) var(--ease-out),
                        transform var(--dur-base) var(--ease-out); }
  .reveal:not([data-reveal="pending"]) { transform: none; }
}
```

For a legacy retrofit only, the emergency global kill switch in
`references/principles.md` is permitted after documenting why the primary pattern cannot
be used; it removes useful transitions, so it is not the default.

## Decision order

1. Name the user-facing purpose: acknowledgement, continuity, spatial origin, or attention.
2. Name trigger, settled state, focus timing, and what wins when interrupted.
3. Choose the smallest property, duration, and easing that communicate that purpose.
4. Define reduced-motion and no-JS/restoration equivalents.
5. Replay rapid repeat, cancellation, navigation, and stale async completion.

For async feedback, tag each request and let only the current owner update status or its
live announcement. For routes and overlays, cancel superseded animation and make the
destination DOM and focus authoritative. For list changes, preserve readable DOM order
even when visual movement is interrupted.

## How to deliver

Deliver a compact choreography table: interaction, purpose, trigger, duration/easing,
settled state, interruption rule, and reduced equivalent. Add one global safety row for
JS-disabled and restoration behavior. Default to CSS; use a library when gestures,
springs, or layout coordination justify its runtime and ownership complexity.

## Self-check

- [ ] Properties are compositor-safe, or an intentional alternative has a target-device trace
- [ ] Durations/easings are tokens (`--dur-*`/`--ease-*`); entrances ~200–300ms ease-out (custom curve, not linear)
- [ ] `prefers-reduced-motion` path tested (motion off or cross-fade) — content never depends on it
- [ ] Page reads complete with JS disabled, delayed initialization, and bfcache restore;
      pending markers are added only to offscreen elements after observer ownership and cleared on `pageshow`
- [ ] Rapid repeat, cancellation, stale completion, and navigation converge on the
      current usable state without stale focus, status, or layers
- [ ] No scroll-jacking or uncontrolled loops; flashing stays below the safety threshold
- [ ] Evidence names the tokens, settled state, reduced equivalent, and replay result

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs purposeful transition, feedback, choreography, or reduced-motion behavior.; avoid: The request is only static visual styling or decorative animation without an interaction purpose.
- Exclude: Do not add motion without a user-facing purpose. (+2 in contract.json)
- Stop / handoff: Stop when no purpose or interruption policy exists. (+1 in contract.json); receives [component-states, design-system-interview, deslop-ui, tasteroll] -> sends [a11y-pass, tastecheck-pass]
- Output: purposeful motion choreography and token plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
