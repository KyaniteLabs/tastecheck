# Effectiveness v2 progress ledger

## Worker attempts

| Worker | Executor | Outcome | Tokens in | Tokens out | Turns | Recorded basis |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `w-645a-task` | `zai-glm` | `false_success` | 0 | 0 | 0 | Dispatch status reported `done` with exit code 0, but zero tokens and zero turns; protocol classifies this as a failed attempt. |
| `w-6a50-task` | `zai-glm` | `failed_stale` | 0 | 0 | 0 | Produced partial Task 7 WIP, then stopped advancing for more than three minutes. Wrapper kill left child processes; both child and tee were killed before another writer started. |
| `w-6014-task` | `zai-glm` | `failed_provider_529` | 101449 | 38500 | 75 | Produced Task 7A foundation WIP, then exhausted ten automatic retries on provider overload before tests or commit. |
| `w-dc42-task` | `zai-glm` | `failed_provider_529` | 0 | 0 | 0 | Routed continuation immediately repeated the same provider overload; stopped early and orphan children were killed. |
| `task7a_native_finish` | native fallback | `partial_then_exited` | — | — | — | Dispatch was unavailable in practice after two consecutive 529 failures. Native fallback produced the focused Task 7A test and hardening but exited before refreshing the validator digest, report, or commit; controller resumed from the failing assertion. |

## Gates

| Gate | State | Receipt |
| --- | --- | --- |
| Latest design architect review | approved | Fresh post-critic review returned `APPROVE` on the exact current corrected design and plan, including executable aggregate-test and adversarial-QA gates. |
| Latest plan critic review | approved | Fresh sequential critic review returned `APPROVE` after the fresh architect approval; all prior critic findings were verified resolved. |
| Implementation | ready | Sequential architect then critic approval passed on the exact latest bytes. |
| Fake-executor rehearsal | implemented | Focused rehearsal proves exact 48/96/24/4/96/16 counts, 160 contiguous fake ordinals, zero real calls, zero render ordinals, and terminal failures at 1/49/80/160; independent review remains required. |
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
| 5. Machine-only blind judge protocol | RED/GREEN recorded in Task 5 implementer report; aggregate v2 suite | `APPROVE` after packet-set formula, closed arm allowlist, and arm identity corrections | committed and pushed (`37c4f30`) |
| 6. One-time synthesis and scoped public claims | RED: missing `synthesis.mjs`, `reservation.mjs`, `project-claim.mjs`; GREEN: `node tools/evals/v2/test-synthesis.mjs` plus aggregate v2 suite | `APPROVE` after admitted-ledger registry binding correction | committed and pushed (`48ea9a0`) |
| 7A. Validator, resolver, executor, and admission foundations | RED: inherited rehearsal test failed on invalid provider regex; GREEN: `node tools/evals/v2/test-foundation.mjs` reports external calls 0 and aggregate v2 suite passes 7 modules | `APPROVE` after trusted selection recomputation, explicit generator identity, judge-owned settings/tool/time binding, semantic five-file closure, and viewport-cardinality fixes | ready to commit |
| 7B. Exact call schedule, receipt, and route binding | RED: `node tools/evals/v2/test-schedule.mjs` failed on missing `lib/schedule.mjs`, then missing `run-judges.mjs`; GREEN: focused test reports fake calls 160 / real calls 0, aggregate v2 suite passes 8 modules, and `git diff --check` passes | `APPROVE` after canonical-plan reconstruction, durable prepacket/judgment schedule readback, and exact generation executor-class binding fixes | ready to commit |
| 7C. Full fake-executor rehearsal and operator contract | RED: `node tools/evals/v2/test-rehearsal.mjs` failed because `rehearse.mjs` was absent; GREEN: exact success report, atomic pre-admission ordering, contiguous ordinals, pre-admission stop, and injected failures at 1/49/80/160 pass with zero real calls | pending | ready for independent review |

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
