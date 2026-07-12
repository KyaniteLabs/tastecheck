# ADR 0001: Separate engineering readiness from effectiveness

- Status: accepted
- Date: 2026-07-11
- Decision owners: TasteCheck maintainers

## Context

The original release manifest mixed reproducible engineering checks with product-effectiveness claims. That made a mechanically sound release depend on legacy evaluation artifacts while also making it tempting to clear a red effectiveness result by editing a hash, assertion, threshold, or version string.

The historical evidence is unambiguous and immutable:

- the public W1 projection has 0/3 paired passes and 0/3 diversity passes;
- terminal V5 measured a 0.3 mean delta against a fixed 0.6 threshold;
- terminal V5 preferred the current source in 11/12 judgments but its declared rule makes preference descriptive rather than release-determinative;
- the terminal replay forbids rerun and cherry-picking regardless of result.

Those facts must remain visible without preventing a separately named engineering release.

## Decision

`contracts/v1/release-receipts.json` uses schema version 2 and contains two independent sections.

### Engineering readiness

Engineering readiness is computed. The manifest does not contain an editable readiness verdict. It must contain exactly six receipt cells:

| Cell | Registered producer |
| --- | --- |
| `context-budget` | `npm run eval:context-budget` |
| `browser` | `npm run release:browser-receipt` |
| `e2e` | `npm run release:e2e-receipt` |
| `mechanical` | `npm run release:mechanical-receipt` |
| `security` | `npm run release:security-receipt` |
| `clean-clone` | `npm run release:clean-clone-receipt` |

Each cell is bound to an exact repository-relative path, an allowlisted producer, immutable file bytes through SHA-256, and non-negotiable assertions registered in `tools/release/check.mjs`. The checker rejects missing producer commands, manual or unknown producers, orphan paths, duplicate or missing cells, weakened assertions, unknown manifest fields, malformed JSON, missing files, and stale hashes.

A receipt is not trusted merely because a file with a passing boolean exists. Its producer command must be registered and its receipt must declare the registered reproducibility and producer identity fields.

### Effectiveness claim

Effectiveness is derived independently from two public immutable projections:

- `evals/receipts/v1/immutable/w1-effectiveness.json`
- `evals/receipts/v1/immutable/terminal-v5-effectiveness.json`

The only supported claim for this release is `blocked`. The checker re-derives that status from the pinned source bytes and rejects any attempt to declare the pack effective, change the historical W1 counts, change the V5 delta or threshold, treat the descriptive 11/12 preference as the gate, remove the immutable stop rule, or substitute another source path.

Engineering readiness therefore makes no effectiveness claim. A future effectiveness claim requires a new, separately authorized evaluation protocol and contract version. It may not overwrite, rerun, reinterpret, or cherry-pick the W1 or V5 evidence.

## Receipt lifecycle

1. Run the registered producer from a clean, reviewable source revision.
2. Validate the receipt's producer-specific schema and public-safety rules.
3. Confirm its registered assertions pass.
4. Compute SHA-256 from the exact final bytes.
5. Update only that cell's manifest pin.
6. Run `node tools/release/test-check.mjs` and the complete release verification matrix.

Hashes are the last step, not a mechanism for turning a failed receipt green. Placeholder pins remain blocked until their registered producer creates a valid receipt.

## Consequences

- A release can be engineering-ready while effectiveness remains explicitly blocked.
- CI and maintainers receive precise failures for missing commands, missing evidence, stale bytes, contract drift, and unsupported claims.
- Historical thresholds and results remain durable evidence rather than mutable configuration.
- New engineering cells require an explicit registry and schema change; dropping a required cell cannot silently weaken the gate.
- A future effectiveness program must introduce new evidence and a new claim contract instead of modifying the historical record.
