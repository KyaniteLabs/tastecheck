# I03 — Apply one roll end-to-end

**What to build:** The highest-leverage slice: take **one** inventory roll result and apply it to the **entire** product page (visual system + layout structure). Header strip does not re-roll. Quality floor always on (rails, anti-slop banlist, a11y on rolled surface). Recipes may be coarse but must cover each face class enough to prove A+B change (not color-only). After this ticket, smashing “apply this roll” (even if not full deck UX) must feel like the real demo.

**Blocked by:** I01, I02.

**Status:** ready-for-agent  
**Leverage:** **Highest** — proves the product thesis.

## Parent

- Spec: `docs/spec/tasteroll-live-demo.md`
- Issue: https://github.com/KyaniteLabs/tastecheck/issues/7

## Acceptance criteria

- [ ] Given a roll result, the whole page (below header) updates visual system and layout structure
- [ ] Stable section inventory remains present (may restructure presentation, not delete product blocks)
- [ ] Header strip remains usable and is not part of the rolled tree
- [ ] Different ref and/or sig produce structurally distinct layouts (not palette-only)
- [ ] Mode changes surface recipe; vibe changes personality within rails
- [ ] Anti-slop patterns absent on rolled surface; contrast/a11y floor holds after apply
- [ ] External behavior checks only (DOM/section/contrast heuristics)

## Blocked by

- I01 — Roll-result inventory mint
- I02 — Product page shell + fixed header chrome
