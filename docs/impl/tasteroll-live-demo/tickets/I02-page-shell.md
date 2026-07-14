# I02 — Product page shell + fixed header chrome

**What to build:** Replace the wizard theater on the tasteroll feature page with a real product page: fixed section inventory (hero, what it is, how the dice works, quality floor, install/skill, sample/gallery, footer) plus a fixed header strip with dice, roll-id, and lock *slots*. Self-contained assets; control a11y floor (skip, main, focus-visible, keyboard). Header is outside the roll. No whole-page re-roll required yet — the shell must stand alone as a coherent product page.

**Blocked by:** None — can start immediately (parallel with I01).

**Status:** ready-for-agent  
**Leverage:** Foundation — surface for apply; kills wizard UX early.

## Parent

- Spec: `docs/spec/tasteroll-live-demo.md`
- Issue: https://github.com/KyaniteLabs/tastecheck/issues/7

## Acceptance criteria

- [ ] All eight stable sections are present and readable
- [ ] Fixed header strip with dice, roll id, and lock affordance slots
- [ ] Header is structurally separate from the rolled content region
- [ ] Self-contained (no CDN fonts/CSS/JS); overflow-x controlled
- [ ] Skip link, main landmark, focus-visible, keyboard-reachable controls
- [ ] No audit→fix→roll wizard as primary UX
- [ ] No PRNG algorithm names in visible copy

## Blocked by

None — can start immediately.
