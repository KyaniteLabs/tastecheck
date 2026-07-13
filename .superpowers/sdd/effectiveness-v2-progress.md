# Effectiveness v2 progress ledger

## Worker attempts

| Worker | Executor | Outcome | Tokens in | Tokens out | Turns | Recorded basis |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `w-645a-task` | `zai-glm` | `false_success` | 0 | 0 | 0 | Dispatch status reported `done` with exit code 0, but zero tokens and zero turns; protocol classifies this as a failed attempt. |

## Gates

| Gate | State | Receipt |
| --- | --- | --- |
| Latest design architect review | approved | Fresh post-critic review returned `APPROVE` on the exact current corrected design and plan, including executable aggregate-test and adversarial-QA gates. |
| Latest plan critic review | approved | Fresh sequential critic review returned `APPROVE` after the fresh architect approval; all prior critic findings were verified resolved. |
| Implementation | ready | Sequential architect then critic approval passed on the exact latest bytes. |
| Fake-executor rehearsal | pending | — |
| Existing suite | pending | — |
| Clean-clone reconstruction | pending | — |
| Independent code review | pending | — |
| Adversarial QA | pending | — |
| Public leak audit | pending | — |
| Production external calls | prohibited | All stop gates must pass first. |

## Task checkpoints

| Task | TDD receipt | Independent review | State |
| --- | --- | --- | --- |
| 1. Closed contracts and protocol freeze | RED: missing `contracts.mjs`; GREEN: `npm run test:effectiveness-v2` | `APPROVE` after commitment/validator freezing, exact-version, nested-contract, viewport, and opaque-slot corrections | ready to commit |
| 2. Registry, historical quarantine, and admission ledger | RED: missing `registry.mjs`; GREEN: `node tools/evals/v2/test-registry.mjs` plus Task 1 suite | `APPROVE` after capability isolation, adapter-byte binding, recursive indirection quarantine, full-chain locked ledger durability, and closed corpus corrections | ready to commit |
| 3. Shared attempted-call and generation runner | RED: missing `admission.mjs`; GREEN: `node tools/evals/v2/test-generation.mjs` and aggregate v2 suite | `APPROVE` after immutable cap/membership, closed routing receipts, strict result shape, and persistence-uncertainty terminality corrections | ready to commit |
| 6. One-time synthesis and scoped public claims | RED: missing `synthesis.mjs`, `reservation.mjs`, `project-claim.mjs`; GREEN: `node tools/evals/v2/test-synthesis.mjs` plus aggregate v2 suite (6 test modules) | Pending independent review | ready to commit |

## FINAL sequential architect+critic APPROVE correction (Task 6)

Incorporated into design, plan, and implementation:

- Unmask rows require `scenario_id` + `generation_seed` (already encrypted).
- `synthesize`/`openUnmask` interfaces accept canonical `repoRoot`, `protocol`, `registryManifest`.
- `scenario_registry_sha256 = sha256(canonicalJson(manifest))` binds run-ID derivation,
  committed initial `run_initialized` ledger root, unique `production_admitted` event,
  and every external-call admission equality check.
- `verifyFrozenRegistryAtCloseout` runs after committed reservation + clean HEAD and
  BEFORE any opening-attempt, seed read, decrypt, or grouping. Rejects drift with
  terminal `production_incomplete` and zero secret access/output.
- `openUnmask` verifies exact registry scenario IDs × protocol.seeds coordinates (48
  rows/24 units, slots 0/1, baseline+candidate once each, coordinate↔unit bijection),
  recomputes HMAC tokens, groups by authenticated scenario_id, canonical-sorts.
- Adversarial tests: invented 12 IDs with recomputed tokens, forged registry, ID
  substitution, swapped hashes, manifest reorder digest determinism, missing/duplicate
  coordinate, ledger/admission drift, committed scenario/anchor mutation with manifest
  unchanged, add/remove/wrong filename/symlink/embedded-ID/alternate-root, spy seed
  reader uncalled.
