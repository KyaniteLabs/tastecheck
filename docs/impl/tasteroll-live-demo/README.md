# Implementation tickets — Tasteroll live whole-page dice demo

Sliced from [docs/spec/tasteroll-live-demo.md](../../spec/tasteroll-live-demo.md)  
Parent: [GitHub #7](https://github.com/KyaniteLabs/tastecheck/issues/7)

## Leverage order

1. **Unblock apply** — mint ∥ shell (parallel)
2. **Prove the product** — apply one roll end-to-end (highest leverage)
3. **Amplify** — dice/URL ∥ full structural recipes (parallel)
4. **Refine** — locks
5. **Ship bar** — dual-product copy + quality smoke

## Dependency graph

```text
I01 inventory mint ──┐
                     ├─→ I03 apply one roll ──┬─→ I04 dice + URL ──→ I06 locks ──┐
I02 page shell ──────┘                       │                                  ├─→ I07 polish
                                             └─→ I05 full recipes ─────────────┘
```

**Frontier now:** complete on branch `feat/tasteroll-live-demo` (I01–I07 implemented).  
After both: I03.  
After I03: I04 and I05 (parallel).  
Then I06 (needs I04).  
Then I07 (needs I04 + I05).

## Index

| ID | Title | Leverage | Blocked by | GitHub | Status |
|----|-------|----------|------------|--------|--------|
| [I01](./tickets/I01-inventory-mint.md) | Roll-result inventory mint | Foundation | — | [#8](https://github.com/KyaniteLabs/tastecheck/issues/8) | done |
| [I02](./tickets/I02-page-shell.md) | Product page shell + header chrome | Foundation | — | [#9](https://github.com/KyaniteLabs/tastecheck/issues/9) | done |
| [I03](./tickets/I03-apply-one-roll.md) | Apply one roll end-to-end | **Highest** | I01, I02 | [#10](https://github.com/KyaniteLabs/tastecheck/issues/10) | done |
| [I04](./tickets/I04-dice-deck-url.md) | Dice deck + random load + shareable URL | High | I03 | [#11](https://github.com/KyaniteLabs/tastecheck/issues/11) | done |
| [I05](./tickets/I05-full-recipes.md) | Full ref/sig structural recipes | High | I03 | [#12](https://github.com/KyaniteLabs/tastecheck/issues/12) | done |
| [I06](./tickets/I06-dimension-locks.md) | Dimension locks | Medium | I04 | [#13](https://github.com/KyaniteLabs/tastecheck/issues/13) | done |
| [I07](./tickets/I07-copy-and-smoke.md) | Dual-product copy + quality smoke | Ship | I04, I05 | [#14](https://github.com/KyaniteLabs/tastecheck/issues/14) | done |

## Rules

- Vertical slices only; each ticket demoable/verifiable alone.
- No soft taste bans; illegal only unrenderable.
- Quality floor always on (rails + anti-slop + a11y).
- Visitors never require live Chance; mint uses real Chance when available.
- Do not redesign the 7-phase agent skill.
