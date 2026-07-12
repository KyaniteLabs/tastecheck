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
- Retries are prohibited. Every attempted call reserves its unique ordinal before execution; any failed attempt terminates `production_incomplete`.
- The frozen exclusion set is exactly `[]`; all 24 units, both arms, and every required viewport are mandatory. Missing evidence is `production_incomplete`, never denominator removal.
- A secret-seed commitment is committed and bound into protocol, admission, run ID, and initial ledger root before the first external call. Its single opening occurs only after the committed synthesis reservation.
- Packet cue handling is reject-only: accepted artifact bytes are never rewritten.
- No human-calibration field or human-preference claim is permitted in the effectiveness-v2 namespace.
- Both families must independently clear the frozen rule; pooled votes cannot rescue disagreement.
- Historical failure, production failure, and inconclusive output remain publishable evidence and are never rerun for a preferred result.
- Forgejo is canonical; GitHub is mirror-only. No push, PR, merge, tag, or public claim occurs until implementation, review, and QA gates are clean.

---

### Task 1: Closed effectiveness contracts and protocol freeze

**Files:**
- Create: `contracts/v2/effectiveness/protocol.schema.json`
- Create: `contracts/v2/effectiveness/execution-manifest.schema.json`
- Create: `contracts/v2/effectiveness/historical-authority.schema.json`
- Create: `contracts/v2/effectiveness/synthesis-reservation.schema.json`
- Create: `contracts/v2/effectiveness/generation-receipt.schema.json`
- Create: `contracts/v2/effectiveness/randomization-commitment.schema.json`
- Create: `contracts/v2/effectiveness/render-receipt.schema.json`
- Create: `contracts/v2/effectiveness/unmask.schema.json`
- Create: `contracts/v2/effectiveness/judge-result.schema.json`
- Create: `contracts/v2/effectiveness/synthesis.schema.json`
- Create: `contracts/v2/effectiveness/public-claim.schema.json`
- Create: `evals/v2/fixtures/protocol-valid.json`
- Create: `tools/evals/v2/lib/contracts.mjs`
- Create: `tools/evals/v2/test-contracts.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadSchema(name)`, `validateContract(name, value)`, `canonicalJson(value)`, `sha256(value)`, `freezeProtocol(protocol)`, and `freezeExecutionManifest(manifest)`.
- `freezeProtocol` returns `{ protocol, canonical_sha256 }` and rejects source hashes, counts, thresholds, call caps, or human-related fields that differ from the design.
- `freezeExecutionManifest` binds exact generator/evaluator provider, verified foundation lineage, model version, runtime, adapter and prompt digests, identity tuples, render versions, font digest, viewports, tool policy, and time budget before production.

- [ ] **Step 1: Write the failing contract test**

```js
import assert from "node:assert/strict";
import { freezeExecutionManifest, freezeProtocol, validateContract } from "./lib/contracts.mjs";
import fixture from "../../../evals/v2/fixtures/protocol-valid.json" with { type: "json" };
import manifest, { sameLineage } from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";

assert.equal(validateContract("protocol", fixture).valid, true);
assert.throws(() => freezeProtocol({ ...fixture, max_external_calls: 161 }), /160/);
assert.throws(() => freezeProtocol({ ...fixture, human_calibration: true }), /unknown|human/i);
assert.throws(() => freezeProtocol({ ...fixture, baseline_revision: "f".repeat(40) }), /baseline/);
assert.throws(() => freezeExecutionManifest({ ...manifest, evaluator_families: sameLineage }), /lineage/);
assert.throws(() => freezeExecutionManifest({ ...manifest, chromium_version: "latest" }), /exact version/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tools/evals/v2/test-contracts.mjs`

Expected: failure because `tools/evals/v2/lib/contracts.mjs` and the schemas do not exist.

- [ ] **Step 3: Implement closed schemas and contract helpers**

Every schema uses `additionalProperties: false`. The protocol requires the exact source revisions, six named strata, two scenarios per stratum, seeds `[101,202]`, `comparison_units: 24`, `generation_calls: 48`, `production_judgments: 96`, `anchor_judgments: 16`, `max_external_calls: 160`, `incremental_spend_cap_usd: 0`, `retry_policy: "none"`, `exclusions: []`, family quorum `2`, judge identities per family `2`, candidate preference floor `18`, scenario-majority floor `8`, absolute mean floor `4`, dimension floor `3`, and `human_calibration_claimed: false`. It also requires the admitted randomization-commitment digest and reject-only packet-validator version/digest. The execution manifest requires exact version strings and digests rather than mutable aliases.

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
    exclusions: [],
  };
  for (const [key, value] of Object.entries(expected)) {
    if (protocol[key] !== value) throw new TypeError(`${key} must equal ${value}`);
  }
  return { protocol: structuredClone(protocol), canonical_sha256: sha256(canonicalJson(protocol)) };
}
```

- [ ] **Step 4: Verify GREEN and run mutation checks**

Run: `node tools/evals/v2/test-contracts.mjs`

Expected: `effectiveness-v2 contract tests passed` after tests mutate every frozen count, threshold, revision, exclusion, commitment, validator, unknown field, and human-related field and observe rejection.

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
- Create: `evals/v2/historical-authority.json`
- Create before admission: `evals/v2/randomization-commitment.json`
- Create: `evals/v2/anchors/tie-identical-a.json`
- Create: `evals/v2/anchors/tie-identical-b.json`
- Create: `evals/v2/anchors/broken-complete-a.json`
- Create: `evals/v2/anchors/broken-complete-b.json`
- Create: `tools/evals/v2/lib/registry.mjs`
- Create: `tools/evals/v2/lib/ledger.mjs`
- Create: `tools/evals/v2/lib/historical-authority.mjs`
- Create: `tools/evals/v2/lib/randomization.mjs`
- Create: `tools/evals/v2/test-registry.mjs`

**Interfaces:**
- `loadRegistry(root)` returns the hash-sorted 12-scenario registry.
- `validateCorpusSeparation(registry)` rejects duplicate hashes and normalized semantic-near duplicates across scenarios and anchors.
- `appendEvent(path, previous, event)` returns a canonical hash-chained event and refuses deletion, reorder, or mismatched predecessor hashes.
- `verifyHistoricalAuthority(root, manifest)` verifies the tracked V1 authority bytes and rejects their use as v2 inputs.
- `commitRandomization(seed, domain)` returns a sealed commitment; `verifyOpening(commitment, opening)` accepts exactly one domain-bound opening.
- `verifyHistoricalSeparation(inputs, authority)` resolves indirection and rejects exact or normalized historical content across every v2 scenario, anchor, fixture, artifact, render, packet, judgment, and synthesis input.

- [ ] **Step 1: Write failing registry and ledger tests**

```js
const registry = loadRegistry(root);
assert.equal(registry.scenarios.length, 12);
assert.deepEqual(Object.values(groupByStratum(registry)).map((rows) => rows.length), [2,2,2,2,2,2]);
assert.throws(() => validateCorpusSeparation(duplicateFixture), /duplicate|overlap/);
const first = appendEvent(undefined, null, { type: "protocol_frozen", at: "2026-07-12T00:00:00Z" });
assert.throws(() => appendEvent(undefined, { ...first, event_sha256: "0".repeat(64) }, { type: "production_admitted" }), /predecessor/);
assert.throws(() => verifyHistoricalAuthority(mutatedRoot, authority), /historical authority/);
assert.throws(() => validateV2InputPath("evals/receipts/v1/immutable/w1-effectiveness.json"), /historical/);
for (const copied of [exactCopy, renamedCopy, wrappedCopy, normalizedNearCopy, symlinkCopy]) {
  assert.throws(() => verifyHistoricalSeparation(copied, authority), /historical|overlap/);
}
assert.throws(() => admitWithoutCommitment(fixture), /randomization commitment/);
assert.throws(() => replaceCommittedSeed(admitted), /immutable|replacement/);
assert.throws(() => verifyOpening(commitment, invalidOpening), /opening/);
assert.throws(() => verifyOpening(openedCommitment, validOpening), /already opened/);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-registry.mjs`

Expected: missing module failure.

- [ ] **Step 3: Add 12 decision-complete scenarios and four anchors**

Each scenario declares `scenario_id`, `stratum`, `brief`, `starting_fixture`, `required_skills`, `forbidden_cues`, `render_required`, `hard_regressions`, and exact time/tool policy. The four anchors implement identical/tie, reversed identical/tie, broken-vs-complete, and reversed broken-vs-complete controls without using real production outputs.

- [ ] **Step 4: Implement deterministic registry hashing, semantic quarantine, historical authority, and hash-chain ledger**

Normalization uses Unicode NFKC, lowercase, punctuation removal, whitespace collapse, wrapper extraction, and sorted token shingles. Exact hash equality or Jaccard similarity `>= 0.85` blocks corpus freeze. The historical manifest pins every tracked public V1/W1/full19/V5 authority file used by ADR 0001. Admission and synthesis walk realpaths, resolve symlinks/indirection, and compare every v2 input against both exact historical hashes and normalized fingerprints.

Before the first external call, `commit-randomization` creates a secret seed and a domain-separated commitment with exclusive creation. Only the commitment file is tracked. Its digest is bound into the frozen protocol, admission event, run ID, and initial ledger root alongside protocol, corpus, source, execution-manifest, and `exclusions: []` digests. Admission rejects late creation or replacement. Opaque IDs are derived from commitment plus stable unit coordinates, never arm order. The opening remains inaccessible until the committed synthesis reservation and can verify exactly once.

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
- `admitCall(state, request)` atomically reserves the next never-reused ordinal before execution and returns the call receipt only when attempted calls remain `<=160`, incremental spend remains `0`, protocol/source/execution-manifest hashes match, and the exact provider/model/runtime tuple is frozen.
- `classifyExecution(result)` returns `completed`, `transport_failed`, or `false_success`.
- `buildArmJob({ scenario, seed, arm, revision, protocol_sha256 })` emits identical arm policies except for the source revision and skill-pack content.
- Every attempted-call receipt closes over ordinal, cost classification (`flat-rate`, `already-provisioned`, or rejected `incremental`), and terminal status.

- [ ] **Step 1: Write failing admission and false-success tests**

```js
assert.equal(classifyExecution({ exit_code: 0, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [] }), "false_success");
assert.throws(() => admitCall({ admitted: 160, spend_usd: 0 }, request), /160/);
assert.throws(() => admitCall({ admitted: 0, spend_usd: 0.01 }, request), /incremental spend/);
assert.equal(failAttempt(reserveOrdinal(state, request)).run_status, "production_incomplete");
assert.throws(() => reserveOrdinal(stateAfterFailure, request), /terminal|retry/);
assert.deepEqual(stripArmIdentity(buildArmJob(current)), stripArmIdentity(buildArmJob(baseline)));
assert.throws(() => omitUnit(admittedPlan), /24 mandatory units/);
for (const scope of ["scenario", "unit", "arm", "viewport"]) assert.throws(() => addLateExclusion(admittedPlan, scope), /exclusion/);
assert.throws(() => classifyCost({ kind: "incremental", usd: 0.01 }), /incremental spend/);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-generation.mjs`

- [ ] **Step 3: Implement preflight and generation receipts**

The CLI supports `preflight`, `plan`, and `run`. `plan` must show exactly 48 generation calls without starting a model. `run` refuses a dirty source tree, wrong revisions, absent or drifted execution manifest, or any pay-per-call requirement. Every attempt reserves and fsyncs its call ordinal first; its closed receipt records ordinal, cost classification, and terminal status. A zero-turn/zero-token/no-artifact Dispatch result is persisted as `false_success`, consumes its ordinal, and terminates the run; transport failures behave identically. No replacement or retry exists. All 24 units and both arms come from the admitted protocol; omission or any late scenario/unit/arm/viewport exclusion terminates `production_incomplete`.

- [ ] **Step 4: Verify GREEN, including a fake executor E2E**

Run: `node tools/evals/v2/test-generation.mjs`

Expected: `effectiveness-v2 generation tests passed; 48 arm jobs; budget fail-closed`.

- [ ] **Step 5: Commit**

Commit: `feat: add sealed effectiveness generation runner`

---

### Task 4: Hash-bound render evidence capture

**Files:**
- Create: `tools/evals/v2/lib/render.mjs`
- Create: `tools/evals/v2/render.mjs`
- Create: `tools/evals/v2/test-render.mjs`
- Create: `evals/v2/fixtures/render-success.json`

**Interfaces:**
- `captureRenders({ runId, artifact, manifest, requiredViewports })` captures local evidence and returns closed render receipts without consuming an external-call ordinal.
- `verifyRenderReceipt(receipt, artifact, manifest, runId)` binds source artifact hash, screenshot/serialized-DOM/deterministic-computed-style hashes, viewport, Playwright, Chromium, font-set, renderer-adapter, render-host, and run identities.

- [ ] **Step 1: Write failing receipt and adversarial lineage tests**

```js
assert.deepEqual(captureRenders(fixture).map((r) => r.viewport_id), ["mobile", "desktop"]);
for (const mutation of [missingViewport, mismatchedArtifact, tamperedDom, tamperedStyles, tamperedScreenshot, wrongRenderer, wrongHost, staleReplay]) {
  assert.throws(() => verifyRenderReceipt(mutation.receipt, mutation.artifact, manifest, runId), /render|viewport|hash|lineage|replay/);
}
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-render.mjs`

- [ ] **Step 3: Implement deterministic local capture**

Use the exact frozen Playwright/Chromium/font/host/adapter identities and both frozen viewports. Serialize DOM and the allowlisted computed-style projection deterministically before hashing. Bind every receipt to the generated artifact, unit, arm, viewport, and run. Any missing viewport, byte mutation, identity drift, cross-artifact reuse, or cross-run replay terminates `production_incomplete`. Rendering is local and does not change the exact 160 external-call count.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node tools/evals/v2/test-render.mjs && node tools/evals/v2/test-generation.mjs`

Commit: `feat: capture hash-bound render evidence`

---

### Task 5: Blind packet builder, machine anchors, and judge validation

**Files:**
- Create: `tools/evals/v2/lib/blind.mjs`
- Create: `tools/evals/v2/lib/packet-policy.mjs`
- Create: `tools/evals/v2/lib/judges.mjs`
- Create: `tools/evals/v2/build-packets.mjs`
- Create: `tools/evals/v2/validate-judges.mjs`
- Create: `tools/evals/v2/test-judges.mjs`

**Interfaces:**
- `buildBlindPackets({ protocol, registry, generations, renders, admittedCommitment })` returns 24 opaque allowlisted packets and a sealed unmask-map commitment; the opening is unavailable until reserved synthesis.
- `validatePacketArtifact({ bytes, validatorVersion, validatorDigest })` is reject-only and returns the original bytes unchanged or rejects the unit.
- `validateEvidenceCitation(citation, packetSet)` verifies deterministic codepoint offsets and an exact contiguous span in the named hash-verified artifact and viewport.
- `validateJudgeBatch({ packetSet, anchorSet, results, families })` returns `{ valid, errors, admissible_results }`.
- `anchorExpectedVerdict(anchor)` is private operator logic and never appears in production packets.

- [ ] **Step 1: Write failing packet and adversarial judge tests**

```js
const built = buildBlindPackets(fixture);
assert.equal(built.packets.length, 24);
assert.equal(JSON.stringify(built.packets).includes("candidate"), false);
assert.equal(JSON.stringify(built.packets).includes("baseline"), false);
for (const cue of ["0859121", "0f99603", "1.1.0", "/worktree/", "generated_at", "provider", "package.json"]) rejectPacketCue(cue);
reject("one family", mutate(results, (r) => { r.evaluator_family = "family-a"; }), "family_quorum");
reject("duplicate upstream lineage", mutate(results, collapseLineage), "family_lineage");
reject("duplicate invocation context", mutate(results, duplicateInvocation), "invocation_identity");
reject("failed tie anchor", mutate(results, failTieAnchor), "anchor_batch_invalid");
reject("missing exact evidence", mutate(results, dropCitation), "evidence_binding");
reject("human field", mutate(results, (r) => { r.human_calibration = {}; }), "unknown field");
for (const bad of [inventedSpan, paraphrasedSpan, wrongArm, wrongViewport, wrongLocator, staleHash, emptySpan, hashValidNonmatchingSpan]) reject("bad evidence", bad, "evidence_binding");
for (const bad of [armOrderDependentId, absentAdmittedCommitment, transformedBytes, asymmetricAcceptance, validatorDrift, validatorCollision]) reject("mutable packet", bad, "packet_integrity");
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-judges.mjs`

- [ ] **Step 3: Implement deterministic label randomization, sealed unmasking, anchors, and validation**

Packets contain only opaque packet/scenario/unit/artifact/viewport/label IDs, common brief and rubric, exact unmodified treatment-produced bytes, verified render evidence, and content hashes. IDs derive from the admitted commitment and stable unit coordinates independently of arm order. Revisions, versions, package/source/worktree/run paths, timestamps, logs, receipts, provider data, filesystem metadata, arm-specific identifiers, and asymmetric fields are rejected.

Packet cue enforcement is reject-only under the frozen validator version and digest: both arms are checked identically, accepted bytes are byte-for-byte preserved, and any forbidden cue rejects the whole unit. No cleanup, rewriting, normalization, or selective field removal is allowed. Judge results bind exact frozen provider, verified foundation lineage, model version, identity tuple, unique context/invocation IDs, packet digest, five 1–5 scores for each opaque arm, pairwise preference, and hard-regression flags. Each evidence citation names an artifact and viewport, its hash, start and exclusive end Unicode-codepoint offsets, and the exact nonempty contiguous span. Validation recomputes the hash and substring; invented, paraphrased, wrong-arm, wrong-viewport, stale, empty, or nonmatching evidence fails.

- [ ] **Step 4: Verify GREEN and mutation coverage**

Run: `node tools/evals/v2/test-judges.mjs`

Expected: all identity-leak, family-collapse, anchor, exact-evidence, commitment, reject-only policy, unknown-field, replay, and packet/render-hash mutations fail.

- [ ] **Step 5: Commit**

Commit: `feat: add machine-only blind judge protocol`

---

### Task 6: One-time synthesis and scoped public claims

**Files:**
- Create: `tools/evals/v2/lib/synthesis.mjs`
- Create: `tools/evals/v2/lib/reservation.mjs`
- Create: `tools/evals/v2/synthesize.mjs`
- Create: `tools/evals/v2/project-claim.mjs`
- Create: `tools/evals/v2/test-synthesis.mjs`
- Create: `evals/v2/fixtures/synthesis-pass.json`
- Create: `evals/v2/fixtures/synthesis-disagreement.json`

**Interfaces:**
- `synthesize({ protocol, packets, unmask, validatedBatches, ledger })` returns the closed synthesis contract.
- `reserveSynthesis({ runRoot, runId, ledgerRoot })` exclusively creates and fsyncs a terminal reservation; `verifyCommittedReservation(path, head)` requires those exact bytes in `HEAD` and a clean tree before unmask.
- `projectPublicClaim(synthesis)` returns exact allowed copy and rejects human, universal, or skill-level promotion.
- `openUnmask({ opening, map, packetSet, commitment, reservation, ledger })` verifies the one-time opening and binds the complete map digest to run ID, admitted commitment, complete packet-set digest, current reservation digest, and immediate ledger predecessor.

- [ ] **Step 1: Write failing decision-rule tests**

```js
assert.equal(synthesize(passFixture).status, "supported");
assert.equal(synthesize({ ...passFixture, familyB: below18 }).status, "inconclusive");
assert.equal(synthesize(splitIdentityFixture).families.a.preference_score, 18);
assert.equal(synthesize(splitSeedFixture).families.a.scenario_majorities, 7);
assert.equal(synthesize(exactScenarioTie).families.a.scenario_majorities, 0);
assert.equal(synthesize({ ...passFixture, hard_regressions: ["a11y"] }).status, "blocked");
assert.equal(synthesize(contradictoryRegressionFixture).status, "blocked");
assert.equal(synthesize(missingScoreFixture).status, "production_incomplete");
assert.throws(() => synthesize(rerunFixture), /one-time|rerun/);
assert.throws(() => verifyCommittedReservation(deletedLedger), /deletion|root/);
assert.throws(() => verifyCommittedReservation(forkedLedger), /predecessor/);
assert.throws(() => verifyCommittedReservation(copiedRun), /run id|root/);
assert.equal(projectPublicClaim(passSynthesis).claim, ALLOWED_POSITIVE_CLAIM);
for (const promoted of promoteScopeAcrossUsersTasksGeneratorsFamiliesRuntimesRendersRevisionsAndSkills) assert.throws(() => projectPublicClaim(promoted), /claim scope/);
for (const forged of [swappedArm, swappedUnit, wrongRun, missingEntry, extraEntry, recomputedMapHash, invalidOpening, postReservationReplacement]) {
  assert.throws(() => openUnmask(forged), /unmask|opening|binding|packet|reservation/);
}
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-synthesis.mjs`

- [ ] **Step 3: Implement family-separated aggregation and exact decision rules**

Map each identity preference to candidate `1`, tie `0.5`, or baseline `0`; abstention/missing is incomplete. A family-unit score is the mean of exactly two identity scores. A family requires the sum of 24 unit scores `>=18`. A family-scenario score is the mean of its two seeded unit scores and counts candidate-majority only when `>0.5`; each family requires at least 8. Each identity scores both arms on five dimensions; average the two identities per family/unit/arm/dimension, then average the 24 equally weighted candidate units per dimension. Each candidate dimension mean must be `>=3` and their five-dimension mean `>=4`. Any admissible hard-regression flag blocks. `supported` requires both families; valid disagreement is `inconclusive`; hard regression or integrity invalidation is `blocked`; missing evidence is `production_incomplete`.

`reserve` uses exclusive creation and fsync, then exits without unmasking. The operator commits the current reservation. `synthesize` requires that exact current reservation in `HEAD`, a clean tree, the committed initial ledger root, an intact hash chain, and no prior reservation for the run ID. The unmask opening is verified once and its complete mapping is bound to the admitted commitment, packet set, run ID, current reservation, and immediate ledger predecessor before candidate attribution. A crash after the current reservation is terminal and cannot resume. Ledger deletion, truncation, forks, copied roots, repeated run IDs, swapped or partial maps, invalid openings, or post-reservation replacement fail closed.

- [ ] **Step 4: Verify GREEN and reconstruct from sealed fixtures**

Run: `node tools/evals/v2/test-synthesis.mjs`

- [ ] **Step 5: Commit**

Commit: `feat: synthesize scoped machine blind evidence`

---

### Task 7: External model adapters and production rehearsal

**Files:**
- Create: `tools/evals/v2/lib/providers.mjs`
- Create: `tools/evals/v2/run-judges.mjs`
- Create: `tools/evals/v2/rehearse.mjs`
- Create: `tools/evals/v2/test-rehearsal.mjs`
- Create: `docs/EFFECTIVENESS-V2.md`
- Modify: `package.json`

**Interfaces:**
- `discoverProvisionedFamilies()` returns public-safe provider capabilities without tokens or local paths.
- `freezeExecutionSelection(capabilities)` resolves aliases and writes the exact hash-bound execution manifest before the first call.
- `runIsolatedJudge({ family, judgeIdentity, packetPath, protocolSha256, invocationId })` writes one raw result and receipt for exactly one production comparison or anchor in a fresh context.
- `rehearse()` runs the entire pipeline with fake executors and proves the production call graph without consuming external calls.

- [ ] **Step 1: Write failing provider and rehearsal tests**

```js
assert.deepEqual(sanitizeCapability(secretFixture), publicFixture);
assert.throws(() => selectFamilies([singleFamily]), /two provider families/);
assert.throws(() => selectFamilies([aliasA, sameLineageAliasB]), /foundation lineage/);
assert.throws(() => selectFamilies([billableA, provisionedB]), /incremental spend/);
assert.throws(() => admitResolvedModel({ ...frozenManifest, resolved_version: "drifted" }), /version drift/);
assert.deepEqual(rehearse().counts, { generations: 48, render_receipts: 96, production_judgments: 96, anchor_judgments: 16, external_calls: 160 });
assert.equal(rehearse().all_render_viewports_bound, true);
assert.equal(rehearse().randomization_commitment_precedes_external_calls, true);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/evals/v2/test-rehearsal.mjs`

- [ ] **Step 3: Implement adapters and dry-run rehearsal**

Dispatch is queried before executor/model selection during preflight. Preflight must verify two different providers and two different foundation-model lineages, resolve exact model versions, and freeze all generator, judge-identity, runtime, adapter, prompt, renderer, font, viewport, tool, and time identities. It also verifies the precommitted randomization digest, exact empty exclusions, reject-only validator digest, historical content closure, and local render graph. No post-admission fallback or substitution exists. Provider commands receive packet paths, not unmask data. The implementation never prints tokens, credentials, full environment values, or machine paths.

- [ ] **Step 4: Verify GREEN and run full fake-executor rehearsal**

Run: `node tools/evals/v2/test-rehearsal.mjs && npm run verify:v1`

- [ ] **Step 5: Add supported commands and commit**

```json
"eval:v2:preflight": "node tools/evals/v2/generate.mjs preflight",
"eval:v2:rehearse": "node tools/evals/v2/rehearse.mjs",
"eval:v2:generate": "node tools/evals/v2/generate.mjs run",
"eval:v2:render": "node tools/evals/v2/render.mjs run",
"eval:v2:judge": "node tools/evals/v2/run-judges.mjs",
"eval:v2:synthesize": "node tools/evals/v2/synthesize.mjs",
"verify:v2": "npm run test:effectiveness-v2 && node tools/evals/v2/rehearse.mjs"
```

Commit: `feat: add effectiveness v2 execution adapters`

---

### Task 8: Production execution, evidence closeout, review, and QA

**Files:**
- Create only after admission: `evals/v2/runs/<run-id>/...`
- Modify after result only: `docs/EFFECTIVENESS-V2.md`

**Interfaces:**
- The production CLI consumes only the frozen protocol and creates immutable run-scoped evidence.
- No tracked source file changes after production admission except the append-only public-safe evidence ledger, the terminal synthesis reservation, and derived result documentation.

- [ ] **Step 1: Run non-consuming preflight**

Run: `pushing-dispatch route --mode breakout --task "TasteCheck v2 machine-only blind evaluation: select two already-provisioned independent provider families for isolated judging"`

Run: `npm run eval:v2:preflight`

Expected: exact source/corpus/protocol/execution-manifest/historical-authority/randomization-commitment/packet-validator hashes, `exclusions=[]`, two providers with different verified foundation-model lineages, exact generator/judge/runtime/render identities, `incremental_spend_cap_usd=0`, `retry_policy=none`, `planned_external_calls=160`, and no production event.

- [ ] **Step 2: Execute generation once**

Run: `npm run eval:v2:generate`

Expected: 48 completed arm receipts or a terminal `production_incomplete` ledger; every attempt has a unique pre-reserved ordinal and no retry.

- [ ] **Step 3: Capture and validate local render evidence**

Run: `npm run eval:v2:render`

Expected: both frozen viewports for every arm of every render-required unit, with hash-bound screenshot, DOM, computed-style, artifact-lineage, renderer, and host receipts; no external-call ordinal consumed. Any missing or stale receipt terminates `production_incomplete`.

- [ ] **Step 4: Build packets and execute two-family judges once**

Run: `node tools/evals/v2/build-packets.mjs && npm run eval:v2:judge`

Expected: four valid judge identities with 112 isolated calls containing 96 production and 16 anchor judgments, or terminal incomplete/invalid evidence.

- [ ] **Step 5: Reserve synthesis before unmask**

Run: `node tools/evals/v2/synthesize.mjs reserve`

Expected: exclusively created and fsynced `synthesis-reservation.json`; no unmask access and no synthesis output. Commit the reservation as `eval: reserve effectiveness v2 synthesis`, then require a clean worktree.

- [ ] **Step 6: Unmask and synthesize exactly once**

Run: `npm run eval:v2:synthesize`

Expected: `supported`, `inconclusive`, `blocked`, or `production_incomplete`; the command verifies the committed reservation and refuses every second, interrupted, forked, truncated, deleted, or copied synthesis attempt.

- [ ] **Step 7: Verify, review, and adversarially QA**

Run: `npm run verify:v1 && npm run verify:v2 && npm run release:claims && git diff --check`

Then run an independent code review requiring `APPROVE` and architectural `CLEAR`, followed by adversarial QA covering dirty trees; source drift; exact, renamed, wrapped, normalized, symlinked, or indirect historical copies; late/replaced commitments and repeated/invalid openings; arm-order-dependent IDs; alias/lineage/version/runtime drift; missing viewport, mismatched artifact, tampered screenshot/DOM/styles, wrong renderer/host, and stale render replay; late scenario/unit/arm/viewport exclusions; reject-only validator drift, asymmetric acceptance, collision, or output transformation; packet leaks through paths/versions/timestamps/metadata/asymmetry; failed anchors; split identities/seeds; exact ties; missing scores; contradictory regression flags; duplicate contexts/invocations; single-family output; invented/paraphrased/wrong-arm/wrong-viewport/wrong-locator/stale/empty/nonmatching evidence; false-success dispatch; per-attempt cost classification and zero-cost cap; partial production; swapped-arm/swapped-unit/wrong-run/missing/extra/recomputed/post-reservation unmask maps; ledger deletion/truncation/forks/copies; interrupted reservation; and repeat synthesis.

- [ ] **Step 8: Public leak audit and evidence commit**

Scan staged textual output for credentials, local paths, usernames, emails, temporary paths, private hosts, environment values, and process-only evidence. Commit only public-safe artifacts.

Commit: `eval: publish machine-only blind effectiveness result`
