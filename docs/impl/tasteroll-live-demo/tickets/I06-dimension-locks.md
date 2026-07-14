# I06 — Dimension locks

**What to build:** Optional progressive commitment: lock/unlock any of ref, vibe, mode, sig from the header; dice re-rolls only unlocked dimensions; locked values survive apply and URL share as appropriate. Builds on deck interaction.

**Blocked by:** I04.

**Status:** ready-for-agent  
**Leverage:** Medium — power-user convergence after smash-dice works.

## Parent

- Spec: `docs/spec/tasteroll-live-demo.md`
- Issue: https://github.com/KyaniteLabs/tastecheck/issues/7

## Acceptance criteria

- [ ] Each of the four dimensions can be locked and unlocked from the header
- [ ] While locked, dice never changes that dimension’s value
- [ ] Unlocked dimensions still change on dice
- [ ] Full unlock restores free re-roll of all dims
- [ ] Lock state is clear visually and to assistive tech

## Blocked by

- I04 — Dice deck + random load + shareable URL
