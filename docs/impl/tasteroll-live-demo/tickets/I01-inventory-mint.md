# I01 — Roll-result inventory mint

**What to build:** A build-time inventory of legal roll results for the live demo deck (`ref × vibe × mode × sig`, up to 1536 when all recipes exist). Each row is only a roll result (id + four faces), not a prebuilt page. Order/ids come from real Chance when available at mint time; full legal cover still ships if Chance is unavailable in CI (documented fallback that does not shrink to a stub deck). Regeneratable when faces or recipes change. Verifiable without the page UI.

**Blocked by:** None — can start immediately (parallel with I02).

**Status:** ready-for-agent  
**Leverage:** Foundation — unblocks apply; pure dual-product dogfood of Chance at authoring time.

## Parent

- Spec: `docs/spec/tasteroll-live-demo.md`
- Issue: https://github.com/KyaniteLabs/tastecheck/issues/7

## Acceptance criteria

- [ ] Inventory artifact exists and lists only known faces for ref, vibe, mode, sig
- [ ] Schema is roll-result-only (no full HTML/CSS payloads per row)
- [ ] Cardinality is the legal/renderer-ready cover (≤1536); no vanity padding; no soft taste-ban pruning
- [ ] Mint path prefers real Chance for shuffle/order/ids when available
- [ ] Documented fallback still produces a full legal cover when Chance cannot run
- [ ] External check: validate schema + face membership + id uniqueness (no private helper assertions)

## Blocked by

None — can start immediately.
