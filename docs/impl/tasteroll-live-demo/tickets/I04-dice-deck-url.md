# I04 — Dice deck + random load + shareable URL

**What to build:** Full smash-the-dice interaction on top of apply: random legal entry on first load; shuffled deck walk on dice; avoid immediate repeat while alternatives remain; reshuffle when exhausted; roll id in header; shareable URL restores the same roll; polite live region for roll state. Still no locks required.

**Blocked by:** I03 (parallel with I05).

**Status:** ready-for-agent  
**Leverage:** High — makes the demo interactive and shareable.

## Parent

- Spec: `docs/spec/tasteroll-live-demo.md`
- Issue: https://github.com/KyaniteLabs/tastecheck/issues/7

## Acceptance criteria

- [ ] First load applies a random legal inventory entry
- [ ] Dice advances the deck and re-applies the whole page
- [ ] No immediate repeat while other entries remain (best-effort / deck walk)
- [ ] Deck reshuffles (or equivalent) when exhausted
- [ ] Header shows current roll id
- [ ] URL with roll id reloads that roll
- [ ] Screen-reader-friendly announcement of roll changes
- [ ] Works as static files without a live Chance server

## Blocked by

- I03 — Apply one roll end-to-end
