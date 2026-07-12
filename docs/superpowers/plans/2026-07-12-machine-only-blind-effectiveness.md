# Machine-only Blind Effectiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and execute a sealed, machine-only, two-family blind evaluation comparing TasteCheck 1.1 with the frozen 1.0 baseline across 24 preregistered comparison units.

**Architecture:** Add a release-isolated `contracts/v2/effectiveness/` boundary and a focused `tools/evals/v2/` pipeline. The pipeline freezes source/corpus/protocol identities, records arm-parity generation receipts, creates opaque packets and machine-anchor controls, validates two-family judge batches, and synthesizes exactly once under the committed decision rule. Existing V1 and Taste Oracle evidence remain read-only inputs and can never be promoted.

**Tech Stack:** Node.js ESM, JSON Schema 2020-style contracts compiled with AJV 8, Playwright 1.61 for render evidence, SHA-256 content binding, Node's built-in assertions and subprocess APIs, existing Kilo/Dispatch command-line access for external model execution.

## Global Constraints

- Historical W1, full19, and V5 bytes and thresholds are immutable.
- Baseline source is `0f99603a603b0243345e7320a52702df67a2194e`; candidate source is `08591213f562073f9ddb0ff9012ec0e3f8ed09c2`.
- Production has exactly 12 scenarios, two seeds, two arms, two evaluator families, two judge identities per family, 48 generations, 96 production judgments, and 16 anchor judgments. Each judgment is one fresh external call.
- Incremental pay-per-call spend is `$0`; at most 160 external calls are admitted.
- No human-calibration field or human-preference claim is permitted in the effectiveness-v2 namespace.
- Both families must independently clear the frozen rule; pooled votes cannot rescue disagreement.
- Historical failure, production failure, and inconclusive output remain publishable evidence and are never rerun for a preferred result.
- Forgejo is canonical; GitHub is mirror-only. No push, PR, merge, tag, or public claim occurs until implementation, review, and QA gates are clean.

---

### Task 1: Closed effectiveness contracts and protocol freeze

**Files:**
- Create: `contracts/v2/effectiveness/protocol.schema.json`
- Create: `contracts/v2/effectiveness/generation-receipt.schema.json`
- Create: `contracts/v2/effectiveness/judge-result.schema.json`
- Create: `contracts/v2/effectiveness/synthesis.schema.json`
- Create: `contracts/v2/effectiveness/public-claim.schema.json`
- Create: `evals/v2/fixtures/protocol-valid.json`
- Create: `tools/evals/v2/lib/contracts.mjs`
- Create: `tools/evals/v2/test-contracts.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadSchema(name)`, `validateContract(name, value)`, `canonicalJson(value)`, `sha256(value)`, and `freezeProtocol(protocol)`.
- `freezeProtocol` returns `{ protocol, canonical_sha256 }` and rejects source hashes, counts, thresholds, call caps, or human-related fields that differ from the design.

- [ ] **Step 1: Write the failing contract test**

```js
import assert from "node:assert/strict";
import { freezeProtocol, validateContract } from "./lib/contracts.mjs";
import fixture from "../../../evals/v2/fixtures/protocol-valid.json" with { type: "json" };

assert.equal(validateContract("protocol", fixture).valid, true);
assert.throws(() => freezeProtocol({ ...fixture, max_external_calls: 161 }), /160/);
assert.throws(() => freezeProtocol({ ...fixture, human_calibration: true }), /unknown|human/i);
assert.throws(() => freezeProtocol({ ...fixture, baseline_revision: "f".repeat(40) }), /baseline/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tools/evals/v2/test-contracts.mjs`

Expected: failure because `tools/evals/v2/lib/contracts.mjs` and the schemas do not exist.

- [ ] **Step 3: Implement closed schemas and contract helpers**

Every schema uses `additionalProperties: false`. The protocol requires the exact source revisions, six named strata, two scenarios per stratum, seeds `[101,202]`, `comparison_units: 24`, `generation_calls: 48`, `production_judgments: 96`, `anchor_judgments: 16`, `max_external_calls: 160`, `incremental_spend_cap_usd: 0`, family quorum `2`, judge executions per family `2`, candidate preference floor `18`, scenario-majority floor `8`, absolute mean floor `4`, dimension floor `3`, and `human_calibration_claimed: false`.

```js
export function freezeProtocol(protocol) {
  const validation = validateContract("protocol", protocol);
  if (!validation.valid) throw new TypeError(formatErrors(validation.errors));
  const expected = {
    baseline_revision: "0f99603a603b0243345e7320a52702df67a2194e",
    candidate_revision: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
    comparison_units: 24,
    max_external_calls: 160,
    incremental_spend_cap_usd: 0,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (protocol[key] !== value) throw new TypeError(`${key} must equal ${value}`);
  }
  return { protocol: structuredClone(protocol), canonical_sha256: sha256(canonicalJson(protocol)) };
}
```

- [ ] **Step 4: Verify GREEN and run mutation checks**

Run: `node tools/evals/v2/test-contracts.mjs`

Expected: `effectiveness-v2 contract tests passed` after tests mutate every frozen count, threshold, revision, unknown field, and human-related field and observe rejection.

- [ ] **Step 5: Add `test:effectiveness-v2` to `package.json` and commit**

```json
"test:effectiveness-v2": "node tools/evals/v2/test-contracts.mjs"
```

Commit: `feat: freeze effectiveness v2 contracts`

---

### Task 2: Scenario registry, corpus separation, and admission ledger

**Files:**
- Create: `evals/v2/scenarios/greenfield-editorial-commerce.json`
- Create: `evals/v2/scenarios/greenfield-data-product.json`
- Create: `evals/v2/scenarios/brownfield-generic-saas.json`
- Create: `evals/v2/scenarios/brownfield-dense-operations.json`
- Create: `evals/v2/scenarios/accessibility-checkout-form.json`
- Create: `evals/v2/scenarios/accessibility-data-table.json`
- Create: `evals/v2/scenarios/verbal-pricing-page.json`
- Create: `evals/v2/scenarios/verbal-error-recovery.json`
- Create: `evals/v2/scenarios/orchestration-design-system.json`
- Create: `evals/v2/scenarios/orchestration-audit-handoff.json`
- Create: `evals/v2/scenarios/render-dashboard.json`
- Create: `evals/v2/scenarios/render-marketing-page.json`
- Create: `evals/v2/scenario-registry.json`
- Create: `evals/v2/protocol.json`
- Create: `evals/v2/anchors/tie-identical-a.json`
- Create: `evals/v2/anchors/tie-identical-b.json`
- Create: `evals/v2/anchors/broken-complete-a.json`
- Create: `evals/v2/anchors/broken-complete-b.json`
- Create: `tools/evals/v2/lib/registry.mjs`
- Create: `tools/evals/v2/lib/ledger.mjs`
- Create: `tools/evals/v2/test-registry.mjs`

**Interfaces:**
- `loadRegistry(root)` returns the hash-sorted 12-scenario registry.
- `validateCorpusSeparation(registry)` rejects duplicate hashes and normalized semantic-near duplicates across scenarios and anchors.
- `appendEvent(path, previous, event)` returns a canonical hash-chained event and refuses deletion, reorder, or mismatched predecessor hashes.

- [ ] **Step 1: Write failing registry and ledger tests**

```js
const registry = loadRegistry(root);
assert.equal(registry.scenarios.length, 12);
assert.deepEqual(Object.values(groupByStratum(registry)).map((rows) => rows.length), [2,2,2,2,2,2]);
assert.throws(() => validateCorpusSeparation(duplicateFixture), /duplicate|overlap/);
const first = appendEvent(undefined, null, { type: "protocol_frozen", at: "2026-07-12T00:00:00Z" });
assert.throws(() => appendEvent(undefined, { ...first, event_sha256: "0".repeat(64) }, { type: "production_admitted" }), /predecessor/);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-registry.mjs`

Expected: missing module failure.

- [ ] **Step 3: Add 12 decision-complete scenarios and four anchors**

Each scenario declares `scenario_id`, `stratum`, `brief`, `starting_fixture`, `required_skills`, `forbidden_cues`, `render_required`, `hard_regressions`, and exact time/tool policy. The four anchors implement identical/tie, reversed identical/tie, broken-vs-complete, and reversed broken-vs-complete controls without using real production outputs.

- [ ] **Step 4: Implement deterministic registry hashing, semantic quarantine, and hash-chain ledger**

Normalization uses Unicode NFKC, lowercase, punctuation removal, whitespace collapse, and sorted token shingles. Exact hash equality or Jaccard similarity `>= 0.85` blocks corpus freeze.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node tools/evals/v2/test-registry.mjs && npm run test:effectiveness-v2`

Commit: `feat: preregister effectiveness v2 corpus`

---

### Task 3: Arm-parity generation runner and call-budget preflight

**Files:**
- Create: `tools/evals/v2/lib/admission.mjs`
- Create: `tools/evals/v2/lib/generate.mjs`
- Create: `tools/evals/v2/generate.mjs`
- Create: `tools/evals/v2/test-generation.mjs`
- Create: `evals/v2/fixtures/generator-success.json`
- Create: `evals/v2/fixtures/generator-false-success.json`

**Interfaces:**
- `admitCall(state, request)` returns the next call receipt only when total calls remain `<=160`, incremental spend remains `0`, protocol/source hashes match, and the provider is already provisioned.
- `classifyExecution(result)` returns `completed`, `transport_failed`, or `false_success`.
- `buildArmJob({ scenario, seed, arm, revision, protocol_sha256 })` emits identical arm policies except for the source revision and skill-pack content.

- [ ] **Step 1: Write failing admission and false-success tests**

```js
assert.equal(classifyExecution({ exit_code: 0, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [] }), "false_success");
assert.throws(() => admitCall({ admitted: 160, spend_usd: 0 }, request), /160/);
assert.throws(() => admitCall({ admitted: 0, spend_usd: 0.01 }, request), /incremental spend/);
assert.deepEqual(stripArmIdentity(buildArmJob(current)), stripArmIdentity(buildArmJob(baseline)));
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-generation.mjs`

- [ ] **Step 3: Implement preflight and generation receipts**

The CLI supports `preflight`, `plan`, and `run`. `plan` must show exactly 48 generation calls without starting a model. `run` refuses a dirty source tree, wrong revisions, absent provider receipt, or any pay-per-call requirement. A zero-turn/zero-token/no-artifact Dispatch result is persisted as `false_success` and never satisfies a job.

- [ ] **Step 4: Verify GREEN, including a fake executor E2E**

Run: `node tools/evals/v2/test-generation.mjs`

Expected: `effectiveness-v2 generation tests passed; 48 arm jobs; budget fail-closed`.

- [ ] **Step 5: Commit**

Commit: `feat: add sealed effectiveness generation runner`

---

### Task 4: Blind packet builder, machine anchors, and judge validation

**Files:**
- Create: `tools/evals/v2/lib/blind.mjs`
- Create: `tools/evals/v2/lib/judges.mjs`
- Create: `tools/evals/v2/build-packets.mjs`
- Create: `tools/evals/v2/validate-judges.mjs`
- Create: `tools/evals/v2/test-judges.mjs`

**Interfaces:**
- `buildBlindPackets({ protocol, registry, generations, nonce })` returns 24 opaque packets and a separate hash-bound unmask map.
- `validateJudgeBatch({ packetSet, anchorSet, results, families })` returns `{ valid, errors, admissible_results }`.
- `anchorExpectedVerdict(anchor)` is private operator logic and never appears in production packets.

- [ ] **Step 1: Write failing packet and adversarial judge tests**

```js
const built = buildBlindPackets(fixture);
assert.equal(built.packets.length, 24);
assert.equal(JSON.stringify(built.packets).includes("candidate"), false);
assert.equal(JSON.stringify(built.packets).includes("baseline"), false);
reject("one family", mutate(results, (r) => { r.evaluator_family = "family-a"; }), "family_quorum");
reject("failed tie anchor", mutate(results, failTieAnchor), "anchor_batch_invalid");
reject("missing exact evidence", mutate(results, dropCitation), "evidence_binding");
reject("human field", mutate(results, (r) => { r.human_calibration = {}; }), "unknown field");
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-judges.mjs`

- [ ] **Step 3: Implement deterministic label randomization, sealed unmasking, anchors, and validation**

Packets contain only opaque labels, exact artifact hashes, task/rubric content, and safe identifiers. Judge batches bind model/version, declared family, isolated invocation ID, packet digest, execution timestamp, citations, five quality dimensions, pairwise preference, hard-regression flags, and the four anchor results.

- [ ] **Step 4: Verify GREEN and mutation coverage**

Run: `node tools/evals/v2/test-judges.mjs`

Expected: all identity-leak, family-collapse, anchor, evidence, unknown-field, replay, and packet-hash mutations fail.

- [ ] **Step 5: Commit**

Commit: `feat: add machine-only blind judge protocol`

---

### Task 5: One-time synthesis and scoped public claims

**Files:**
- Create: `tools/evals/v2/lib/synthesis.mjs`
- Create: `tools/evals/v2/synthesize.mjs`
- Create: `tools/evals/v2/project-claim.mjs`
- Create: `tools/evals/v2/test-synthesis.mjs`
- Create: `evals/v2/fixtures/synthesis-pass.json`
- Create: `evals/v2/fixtures/synthesis-disagreement.json`

**Interfaces:**
- `synthesize({ protocol, packets, unmask, validatedBatches, ledger })` returns the closed synthesis contract.
- `projectPublicClaim(synthesis)` returns exact allowed copy and rejects human, universal, or skill-level promotion.

- [ ] **Step 1: Write failing decision-rule tests**

```js
assert.equal(synthesize(passFixture).status, "supported");
assert.equal(synthesize({ ...passFixture, familyB: below18 }).status, "inconclusive");
assert.equal(synthesize({ ...passFixture, hard_regressions: ["a11y"] }).status, "blocked");
assert.throws(() => synthesize(rerunFixture), /one-time|rerun/);
assert.match(projectPublicClaim(passSynthesis).claim, /frozen corpus/);
assert.doesNotMatch(projectPublicClaim(passSynthesis).claim, /human|all skills|all models/i);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-synthesis.mjs`

- [ ] **Step 3: Implement family-separated aggregation and exact decision rules**

Ties contribute `0.5` to each arm. Each family requires candidate preference score `>=18/24`, candidate-majority in `>=8/12` scenarios, absolute mean `>=4`, every dimension `>=3`, and zero hard regressions. `supported` requires both families; disagreement is `inconclusive`; integrity or hard-regression failures are `blocked`; incomplete evidence is `production_incomplete`.

- [ ] **Step 4: Verify GREEN and reconstruct from sealed fixtures**

Run: `node tools/evals/v2/test-synthesis.mjs`

- [ ] **Step 5: Commit**

Commit: `feat: synthesize scoped machine blind evidence`

---

### Task 6: External model adapters and production rehearsal

**Files:**
- Create: `tools/evals/v2/lib/providers.mjs`
- Create: `tools/evals/v2/run-judges.mjs`
- Create: `tools/evals/v2/rehearse.mjs`
- Create: `tools/evals/v2/test-rehearsal.mjs`
- Create: `docs/EFFECTIVENESS-V2.md`
- Modify: `package.json`

**Interfaces:**
- `discoverProvisionedFamilies()` returns public-safe provider capabilities without tokens or local paths.
- `runIsolatedJudge({ family, judgeIdentity, packetPath, protocolSha256, invocationId })` writes one raw result and receipt for exactly one production comparison or anchor in a fresh context.
- `rehearse()` runs the entire pipeline with fake executors and proves the production call graph without consuming external calls.

- [ ] **Step 1: Write failing provider and rehearsal tests**

```js
assert.deepEqual(sanitizeCapability(secretFixture), publicFixture);
assert.throws(() => selectFamilies([singleFamily]), /two provider families/);
assert.throws(() => selectFamilies([billableA, provisionedB]), /incremental spend/);
assert.deepEqual(rehearse().counts, { generations: 48, production_judgments: 96, anchor_judgments: 16, external_calls: 160 });
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-rehearsal.mjs`

- [ ] **Step 3: Implement adapters and dry-run rehearsal**

Dispatch is queried before executor/model selection. If Dispatch returns a false-success candidate, record it and use only a predeclared already-provisioned fallback family. Provider commands receive packet paths, not unmask data. The implementation never prints tokens, credentials, full environment values, or machine paths.

- [ ] **Step 4: Verify GREEN and run full fake-executor rehearsal**

Run: `node tools/evals/v2/test-rehearsal.mjs && npm run verify:v1`

- [ ] **Step 5: Add supported commands and commit**

```json
"eval:v2:preflight": "node tools/evals/v2/generate.mjs preflight",
"eval:v2:rehearse": "node tools/evals/v2/rehearse.mjs",
"eval:v2:generate": "node tools/evals/v2/generate.mjs run",
"eval:v2:judge": "node tools/evals/v2/run-judges.mjs",
"eval:v2:synthesize": "node tools/evals/v2/synthesize.mjs",
"verify:v2": "npm run test:effectiveness-v2 && node tools/evals/v2/rehearse.mjs"
```

Commit: `feat: add effectiveness v2 execution adapters`

---

### Task 7: Production execution, evidence closeout, review, and QA

**Files:**
- Create only after admission: `evals/v2/runs/<run-id>/...`
- Modify after result only: `docs/EFFECTIVENESS-V2.md`

**Interfaces:**
- The production CLI consumes only the frozen protocol and creates immutable run-scoped evidence.
- No tracked source file changes after production admission except the append-only public-safe evidence ledger and derived result documentation.

- [ ] **Step 1: Run non-consuming preflight**

Run: `pushing-dispatch route --mode breakout --task "TasteCheck v2 machine-only blind evaluation: select two already-provisioned independent provider families for isolated judging"`

Run: `npm run eval:v2:preflight`

Expected: exact source/corpus/protocol hashes, two admissible provider families, `incremental_spend_cap_usd=0`, `planned_external_calls=160`, and no production event.

- [ ] **Step 2: Execute generation once**

Run: `npm run eval:v2:generate`

Expected: 48 completed arm receipts or a terminal `production_incomplete` ledger; no silent retry.

- [ ] **Step 3: Build packets and execute two-family judges once**

Run: `node tools/evals/v2/build-packets.mjs && npm run eval:v2:judge`

Expected: four valid judge identities with 112 isolated calls containing 96 production and 16 anchor judgments, or terminal incomplete/invalid evidence.

- [ ] **Step 4: Unmask and synthesize exactly once**

Run: `npm run eval:v2:synthesize`

Expected: `supported`, `inconclusive`, `blocked`, or `production_incomplete`; the command refuses a second synthesis event.

- [ ] **Step 5: Verify, review, and adversarially QA**

Run: `npm run verify:v1 && npm run verify:v2 && npm run release:claims && git diff --check`

Then run an independent code review requiring `APPROVE` and architectural `CLEAR`, followed by adversarial QA covering dirty trees, source drift, label leakage, failed anchors, single-family output, missing citations, false-success dispatch, zero-cost cap, partial production, and repeat synthesis.

- [ ] **Step 6: Public leak audit and evidence commit**

Scan staged textual output for credentials, local paths, usernames, emails, temporary paths, private hosts, environment values, and process-only evidence. Commit only public-safe artifacts.

Commit: `eval: publish machine-only blind effectiveness result`
