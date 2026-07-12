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
