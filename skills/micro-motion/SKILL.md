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

- **Use `transform` and `opacity`.** Avoid geometric properties; use transforms, FLIP,
  or View Transitions for real size or position changes.
- **Ease by direction.** Ease-out enters, ease-in exits, ease-in-out moves; linear is
  for a purposeful continuous loop only.
- **Design reduced motion as an equivalent state.** Keep labels, choices, focus, and
  final content; remove spatial movement.
- **Gate waiting states behind a JS-added root hook.** Static CSS must not leave content
  at `opacity: 0` when JavaScript fails, in reader mode, crawlers, or captures.
- **Make looping motion controllable and never scroll-jack.**

## Easing & duration tokens

Use semantic duration/easing tokens: acknowledgement `120–160ms`, insertion/menu
`160–220ms`, confirmation/route `220–320ms`. Motion never delays committed state, focus,
or the next keyboard action.

## Settlement policy

For replaceable Save, assign monotonic ids: `N+1` invalidates `N`; only the latest request may
set status or own its live announcement. Replay stale `N` as both success and error after
`N+1` starts; neither may change status or announce. Only `N+1` settles. Cancel superseded
motion without changing the usable state.

## The reduced-motion contract (always include)

**This skill owns reduced-motion for the whole project** — define it once here, not
per-skill. The primary pattern: gate the *movement* behind `no-preference`, so
reduced-motion users still get a (motionless) fade and never a broken layout:

```css
/* PRIMARY: design the reduced variant — keep a gentle fade, drop the movement.
   The waiting state hangs off a .js hook the boot script adds to <html>
   (document.documentElement.classList.add('js')) — so when the script never
   runs, nothing was ever hidden and the page still reads complete. */
@media (prefers-reduced-motion: no-preference) {
  html.js .reveal { opacity: 0; transform: translateY(12px); transition:
            opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
  html.js .reveal.in { opacity: 1; transform: none; }
}
```

For a legacy retrofit only, the emergency global kill switch in
`references/principles.md` is permitted after documenting why the primary pattern cannot
be used; it removes useful transitions, so it is not the default.

## How to deliver

- State purpose, tokens, interruption, reduced path, and JS-disabled behavior.
- Default to CSS; use a motion library only for gestures, springs, or layout animation.
- Verify compositor-only properties, reduced motion, no scroll-jacking, and <800ms load motion.

## Decision order and evidence contract

Identify purpose, trigger, interruption, and token; define the reduced equivalent; then record
replayable evidence before decorative detail. Do not hide meaning, trap focus, or withhold content.

## Interruption, evidence, and completion contract

Define the settled usable state before choosing an entrance. For each interaction, state
the trigger, observable end state, supersession rule, and when focus or the next keyboard
action becomes available. A motion plan is incomplete until its interrupted path reaches
the same usable state without a stale overlay, old save confirmation, misplaced list item,
or delayed destructive confirmation.

For a Save, insertion, destructive confirmation, and route transition, emit one distinct
evidence row for each; emit one fifth global row for reduced motion and JS-disabled safety.
Do not merge them into a generic ledger. Each interaction row names its causal order (committed
state/focus before optional feedback), duration band, interruption that converges on the same
usable state, and replay. The global row proves movement is gated by
`prefers-reduced-motion: no-preference` and reveal waiting states by `html.js`, so reduced
motion retains meaning and a JS-disabled page is complete.

| Required row | Replay proof |
| --- | --- |
| Save | Start `N`, start `N+1`, then settle `N` once as success and once as error; only `N+1` may change status or announce. |
| Insertion | Insert, sort or navigate before feedback ends; final DOM order remains readable. |
| Destructive confirmation | Open, then Escape/Cancel/repeat delete/navigate; every exit reaches the same closed, focused state. |
| Route | Start a second navigation before the first settles; destination DOM and heading focus win without a stale layer. |
| Global safety | Check compositor-only properties, reduced motion, and JS-disabled reveal; no essential content depends on animation. |

Reject `component-states` as the primary route when the state model already exists: it owns
which states exist, not their timing, causal order, or interruption convergence. Keep this
boundary narrow: this skill choreographs those behaviors around an already-defined component
state. If the state, focus policy, or request ownership is unknown, stop for
`component-states` or the owning interaction specification rather than inventing it here;
handoff final focus and live-region verification to `a11y-pass`.

## Self-check

- [ ] Animate only `transform`/`opacity` (compositor) — nothing animates layout props
- [ ] Durations/easings are tokens (`--dur-*`/`--ease-*`); entrances ~200–300ms ease-out (custom curve, not linear)
- [ ] `prefers-reduced-motion` path tested (motion off or cross-fade) — content never depends on it
- [ ] Page reads complete with JS disabled — no content left at stylesheet opacity 0 waiting for a reveal that never comes
- [ ] Save replay covers stale success and stale error; only the latest request owns status and its single live announcement
- [ ] Five distinct replayable rows cover Save, insertion, destructive confirmation, route, and global reduced-motion/JS-disabled safety
- [ ] Each row states causal order, a duration band, and interruption convergence on the usable state
- [ ] `component-states` is explicitly rejected as the primary route with its state-model boundary stated
- [ ] No scroll-jacking; total page-load motion < ~800ms; nothing flashes > 3×/s
- [ ] Stated the tokens used and what to look at

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: An interface needs purposeful transition, feedback, choreography, or reduced-motion behavior.; avoid: The request is only static visual styling or decorative animation without an interaction purpose.
- Exclude: Do not add motion without a user-facing purpose. (+2 in contract.json)
- Stop / handoff: Stop when no purpose or interruption policy exists. (+1 in contract.json); receives [component-states, design-system-interview] -> sends [a11y-pass, tastecheck-pass]
- Output: purposeful motion choreography and token plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
