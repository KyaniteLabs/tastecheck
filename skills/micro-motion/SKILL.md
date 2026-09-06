---
name: micro-motion
description: >-
  Use when an interface needs purposeful feedback, transitions, or reduced-motion
  behavior, especially when animation risks jank, interruption bugs, or hidden
  no-JS content.
---

# Micro-Motion

Motion confirms a change, origin, or what to notice next. If it answers none, cut it.

## Non-negotiables (the rules that keep motion feeling good)

- **Prefer compositor-safe properties.** Start with `transform` and `opacity`. Color, filter,
  SVG, or measured layout transitions need purpose and target-device trace.
- **Ease by direction.** Ease-out enters, ease-in exits, ease-in-out moves; linear is
  for a purposeful continuous loop only.
- **Design reduced motion as an equivalent state.** Keep labels, choices, focus, and content;
  remove spatial movement.
- **Let JavaScript opt elements into waiting states only after the observer is ready.**
  Static CSS must not hide content when JavaScript fails, initializes late, or restores
  from the back-forward cache.
- **Make looping motion controllable and never scroll-jack.**

## Easing & duration tokens

Use semantic duration/easing tokens: acknowledgement `120–160ms`, insertion/menu
`160–220ms`, confirmation/route `220–320ms`. These are starting bands; test on target
device. Motion never delays committed state, focus, or next keyboard action.

## Settle before styling

Define usable end state and interruption policy before an entrance. Superseded save, route,
insertion, or dismissal must converge on newest state without stale overlay, announcement,
focus jump, or success message. Motion reflects ownership, not decides it. Unknown
ownership/focus recovery goes to `component-states`.

## The reduced-motion contract

Define the project-level reduced-motion policy once; components reference it. For progressive
reveals, content starts visible. After the observer is attached, JavaScript marks only offscreen
pending elements; never hide an already intersecting element. Remove the marker on reveal and
page restoration.
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
be used; it removes useful transitions and is not the default.

## Decision order

1. Name the user-facing purpose: acknowledgement, continuity, spatial origin, or attention.
2. Name trigger, settled state, focus timing, and what wins when interrupted.
3. Choose the smallest property, duration, and easing that communicate that purpose.
4. Define reduced-motion and no-JS/restoration equivalents.
5. Replay rapid repeat, cancellation, navigation, and stale async completion.

For async feedback, tag each request; only its current owner updates status/live announcement.
For routes/overlays, cancel superseded animation and make destination DOM/focus authoritative.
For list changes, preserve readable DOM order when movement is interrupted.

## How to deliver

Deliver a choreography table: interaction, purpose, trigger, duration/easing, settled state,
interruption rule, and reduced equivalent. Add one safety row for JS-disabled/restoration.
Default to CSS; use a library only when gestures, springs, or layout coordination justify it.

## Self-check

- [ ] Properties are compositor-safe, or intentional alternative has a target-device trace
- [ ] Durations/easings are tokens (`--dur-*`/`--ease-*`); entrances ~200–300ms ease-out (custom curve, not linear)
- [ ] `prefers-reduced-motion` path tested (motion off or cross-fade) — content never depends on it
- [ ] Page reads complete with JS disabled, delayed initialization, and bfcache restore;
      pending markers are added only to offscreen elements after observer ownership and cleared on `pageshow`
- [ ] Rapid repeat, cancellation, stale completion, and navigation converge on the
      current usable state without stale focus, status, or layers
- [ ] No scroll-jacking or uncontrolled loops; flashing stays below the safety threshold
- [ ] Evidence names tokens, settled state, reduced equivalent, and replay result

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs purposeful transition, feedback, choreography, or reduced-motion behavior.; avoid: The request is only static visual styling or decorative animation without an interaction purpose.
- Exclude: Do not add motion without a user-facing purpose. (+2 in contract.json)
- Stop / handoff: Stop when no purpose or interruption policy exists. (+1 in contract.json); receives [component-states, design-system-interview, deslop-ui, tasteroll] -> sends [a11y-pass, tastecheck-pass]
- Output: purposeful motion choreography and token plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
