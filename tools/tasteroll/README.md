# tasteroll inventory tools (I01)

Build-time mint and external validation of the **roll-result inventory** for
the tasteroll live demo: every legal roll result `ref × vibe × mode × sig`
(8 × 8 × 3 × 8 = **1536** with the current recipes) as compact, data-only
rows. No HTML, CSS, or prebuilt pages live here — the demo page (I02+) is the
consumer, not this directory.

- Artifact: `skills/tasteroll/assets/tasteroll-inventory.json`
- Rows: exactly `{ id, ref, vibe, mode, sig }`
- Envelope: `schema_version`, `kind: "tasteroll-live-demo-inventory"`,
  `description`, `minted_with`, `seed`, `legal_fingerprint`, `face_product`,
  `count`, `faces`, `rolls`

## Commands

```bash
npm run mint:tasteroll     # (re)mint the artifact
npm run test:tasteroll     # external validator (also part of npm test / CI)
node tools/tasteroll/test-inventory.mjs --artifact /tmp/some-mint.json
                            # validate a mint written elsewhere
```

## Mint paths

The mint prefers **real Chance** for shuffle, order, and id assignment. If a
`chance` binary is on `PATH`, it runs `chance --seed <seed> shuffle <indices…>`
over the legal-set indices; the returned permutation fixes the row order and
the ids (`r0001…` zero-padded, unique, assigned in mint order). The artifact
records which path minted it in `minted_with`:

| `minted_with`     | meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `chance`          | real Chance CLI performed the seeded shuffle                    |
| `fallback-seeded` | documented CI fallback (below) performed the seeded shuffle     |

### CI fallback (documented behavior, not a stub)

When the `chance` binary is unavailable — as on stock CI runners — the mint
automatically engages a **deterministic seeded Fisher–Yates shuffle** (sha256
hash chain, seed recorded in the artifact) over the same legal set. The
fallback guarantees:

- the **full legal cover** (every legal combo exactly once — it never shrinks
  to a stub deck),
- valid, unique, zero-padded `r####` ids in mint order,
- an envelope identical in schema to a Chance mint, with
  `minted_with: "fallback-seeded"` so the path is auditable.

Only the row **order** differs between paths; the legal cover, schema, and
fingerprint are identical. To mint with real Chance, put the `chance` CLI on
`PATH` (Chance is the kyanitelabs randomness engine) and re-run
`npm run mint:tasteroll` — the artifact then records `minted_with: "chance"`.

## Legality

The legal set is `known-face cartesian ∩ renderer-ready`, defined in
`faces.mjs` (`legalRolls()`). **Soft taste bans are void**: no combo is
dropped for taste and none is added beyond the legal cover. A combo becomes
illegal only when it is structurally unrenderable — an engineering fact,
expressed as an exclusion in `legalRolls()` and documented in the artifact.

## Regeneration / staleness

The mint embeds `legal_fingerprint`: a sha256 over the face sets, their
revision, and the legal cover itself. The validator recomputes it from the
current sources and **fails on any mismatch**. Editing `tools/tasteroll/faces.mjs`
(faces or recipe exclusions) therefore marks the committed artifact stale:

```bash
$ npm run test:tasteroll
test-inventory: FAIL — stale inventory: legal set changed since mint
(artifact abc123…) != current def456…) — re-run: npm run mint:tasteroll
```

Fix: `npm run mint:tasteroll`, commit the regenerated artifact together with
the faces/recipes change.

## Build wiring

- `test:tasteroll` runs inside `npm run test:structural`, hence inside
  `npm test`.
- The `verify` GitHub workflow runs it explicitly in the `structural` job, so
  a missing or stale artifact fails CI.
