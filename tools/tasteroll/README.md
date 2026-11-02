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

The envelope is a **closed set**: no other top-level key is allowed, and the
metadata is typed (`description` is a string when present — the only optional
field; `legal_fingerprint` is a 64-char lowercase hex sha256; counts are
integers). Roll results live only in `rolls[]` rows, so a page/HTML/CSS
payload cannot ride in beside the data — the validator rejects any unknown
root key (`pages`, `html`, `css`, …), not just HTML-bearing row content.

## Commands

```bash
npm run mint:tasteroll     # (re)mint the artifact
npm run test:tasteroll     # external validator + regression battery (also part of npm test / CI)
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

## Regression battery

`tools/tasteroll/test-inventory-regressions.mjs` pins the closed-envelope
contract with black-box cases against the real CLI (`test-inventory.mjs
--artifact <fixture>`). It runs as the second half of `test:tasteroll`, so it
is wired into `npm test` and the `verify` workflow:

- **valid controls** — the committed artifact, a fresh fallback mint (chance
  stripped from `PATH`), and an envelope without the optional `description`;
- **must reject** — unknown root keys carrying page payloads (`pages`, `html`,
  `css`, `prebuilt`) or benign names (`notes`), an object/array-valued
  `description`, string-typed scalars (`schema_version`, `count`), a non-hex
  `legal_fingerprint`, a smuggled payload key inside `faces`, row-level extra
  keys, and non-object roots (array, null, string).
