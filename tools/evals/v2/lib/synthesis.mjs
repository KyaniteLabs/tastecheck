// Task 6: Family-separated aggregation and exact decision rules.
// Implements the frozen synthesis contract from the effectiveness-v2 design.

import { canonicalJson, canonicalPacket, freezeExecutionManifest, sha256, validateContract } from "./contracts.mjs";
import { resolve } from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { appendEvent, validateLedger } from "./ledger.mjs";
import { validateJudgeBatch } from "../validate-judges.mjs";
import { canonicalExecutorDigest, verifyResolverAttestation } from "./providers.mjs";
import { verifyAuthorityReceipt } from "./authority-signature.mjs";
import { verifyRenderReceiptBinding } from "./render.mjs";

const DIMENSIONS = ["direction", "structure", "accessibility", "verbal", "integration"];

export const STATUS_SUPPORTED = "supported";
export const STATUS_INCONCLUSIVE = "inconclusive";
export const STATUS_BLOCKED = "blocked";
export const STATUS_PRODUCTION_INCOMPLETE = "production_incomplete";

function productionIncomplete(runId, reason) {
  return {
    schema_version: 2, kind: "effectiveness-v2-synthesis", run_id: runId ?? "",
    status: STATUS_PRODUCTION_INCOMPLETE,
    families: [], hard_regressions: [], claim_allowed: false,
    _reason: reason
  };
}

/**
 * synthesize({ protocol, packets, unmask, validatedBatches, ledger })
 *
 * Returns the closed synthesis contract.
 */
function selectionDigestPayload(selection) {
  return {
    execution_manifest_sha256: selection.execution_manifest_sha256,
    generator: {
      executor_digest: selection.generator.executor_digest,
      resolver_attestation_sha256: selection.generator.resolver_attestation_sha256
    },
    judges: selection.judges.map(({ executor_digest, resolver_attestation_sha256 }) => ({
      executor_digest, resolver_attestation_sha256
    })).sort((left, right) => left.executor_digest.localeCompare(right.executor_digest))
  };
}

function verifyExecutionEvidence(execution, admitted) {
  const selection = execution?.selection;
  const frozenManifest = freezeExecutionManifest(execution?.manifest);
  if (!selection?.generator || !Array.isArray(selection.judges) || selection.judges.length !== 4) {
    throw new Error("execution evidence requires one generator and four judges");
  }
  if (frozenManifest.canonical_sha256 !== admitted.execution_manifest_sha256 ||
      selection.execution_manifest_sha256 !== admitted.execution_manifest_sha256 ||
      selection.selection_sha256 !== admitted.selection_sha256 ||
      sha256(canonicalJson(selectionDigestPayload(selection))) !== selection.selection_sha256) {
    throw new Error("execution selection is not bound to production admission");
  }
  const verifiedAttestations = (execution.attestations ?? []).map(verifyResolverAttestation);
  const bindings = [selection.generator, ...selection.judges];
  for (const binding of bindings) {
    const executor = binding?.executor;
    if (canonicalExecutorDigest(executor) !== binding.executor_digest ||
        executor.zero_cost_proof?.incremental_spend_usd !== 0 ||
        !["flat-rate", "already-provisioned"].includes(executor.zero_cost_proof?.kind)) {
      throw new Error("execution binding digest or zero-cost proof invalid");
    }
    const subjectKind = executor.call_class === "generation" ? "generator" : "judge";
    const matches = verifiedAttestations.filter((attestation) =>
      attestation.subject_kind === subjectKind && attestation.subject_canonical_id === executor.identity
    );
    if (matches.length !== 1 || matches[0].attestation_sha256 !== binding.resolver_attestation_sha256 ||
        matches[0].provider !== executor.provider || matches[0].foundation_lineage !== executor.foundation_lineage ||
        matches[0].resolved_version !== executor.model_version || matches[0].incremental_spend_usd !== 0) {
      throw new Error("executor is not bound to one verified resolver attestation");
    }
  }
  const m = frozenManifest.manifest;
  const expectedExecutors = new Map();
  expectedExecutors.set(m.generator.identity, {
    call_class: "generation", provider: m.generator.provider, foundation_lineage: m.generator.foundation_lineage,
    model_version: m.generator.model_version, runtime_version: m.generator.runtime_version,
    adapter_sha256: m.generator.adapter_sha256, system_prompt_sha256: m.generator.system_prompt_sha256,
    rubric_sha256: null, settings_sha256: m.generator.settings_sha256,
    tool_policy_sha256: m.generator.tool_policy_sha256, time_budget_seconds: m.generator.time_budget_seconds,
    family: m.generator.family_id, identity: m.generator.identity
  });
  for (const family of m.evaluator_families) {
    for (const identity of family.identities) {
      expectedExecutors.set(identity, {
        call_class: "judge", provider: family.provider, foundation_lineage: family.foundation_lineage,
        model_version: family.model_version, runtime_version: family.runtime_version,
        adapter_sha256: family.adapter_sha256, system_prompt_sha256: family.system_prompt_sha256,
        rubric_sha256: family.rubric_sha256, settings_sha256: family.settings_sha256,
        tool_policy_sha256: family.tool_policy_sha256, time_budget_seconds: family.time_budget_seconds,
        family: family.family_id, identity
      });
    }
  }
  for (const { executor } of bindings) {
    const expected = expectedExecutors.get(executor.identity);
    if (!expected) throw new Error("executor identity is not bound to the admitted canonical execution manifest");
    // zero_cost_proof is verified independently above; compare all manifest-derived fields.
    const { zero_cost_proof: _zcp, ...executorCore } = executor;
    if (canonicalJson(executorCore) !== canonicalJson(expected)) {
      throw new Error("executor manifest fields are not bound to the admitted canonical execution manifest");
    }
  }
  const grouped = new Map();
  for (const { executor } of selection.judges) {
    if (executor.call_class !== "judge") throw new Error("judge executor class mismatch");
    const current = grouped.get(executor.family) ?? {
      family_id: executor.family, provider: executor.provider,
      foundation_lineage: executor.foundation_lineage, identities: []
    };
    if (current.provider !== executor.provider || current.foundation_lineage !== executor.foundation_lineage) {
      throw new Error("judge family provider or lineage drift");
    }
    current.identities.push(executor.identity);
    grouped.set(executor.family, current);
  }
  const families = [...grouped.values()].map((family) => ({ ...family, identities: family.identities.sort() }));
  if (families.length !== 2 || families.some(({ identities }) => new Set(identities).size !== 2) ||
      new Set(families.map(({ provider }) => provider)).size !== 2 ||
      new Set(families.map(({ foundation_lineage }) => foundation_lineage)).size !== 2) {
    throw new Error("exactly two providers and distinct foundation lineages are required");
  }
  return { selection, families };
}

function verifyEvidenceClosure({ ledger, results, selection }) {
  const reserved = ledger.filter((event) => event.type === "ordinal_reserved");
  const routed = ledger.filter((event) => event.type === "routing_attested");
  const closed = ledger.filter((event) => event.type === "attempt_closed");
  if (reserved.length !== 160 || routed.length !== 160 || closed.length !== 160) {
    return `receipt closure: expected 160 reserved, routed, and closed, got ${reserved.length}/${routed.length}/${closed.length}`;
  }
  const classes = { generation: 48, production_judge: 96, anchor_judge: 16 };
  const reservedByOrdinal = new Map();
  const closedByOrdinal = new Map();
  const routedByOrdinal = new Map();
  for (const event of reserved) {
    if (!Number.isInteger(event.ordinal) || event.ordinal < 1 || event.ordinal > 160 || reservedByOrdinal.has(event.ordinal)) {
      return `receipt closure: invalid or duplicate reserved ordinal ${event.ordinal}`;
    }
    reservedByOrdinal.set(event.ordinal, event);
  }
  for (const event of closed) {
    if (!Number.isInteger(event.ordinal) || event.ordinal < 1 || event.ordinal > 160 || closedByOrdinal.has(event.ordinal)) {
      return `receipt closure: invalid or duplicate closed ordinal ${event.ordinal}`;
    }
    closedByOrdinal.set(event.ordinal, event);
  }
  for (const event of routed) {
    if (!Number.isInteger(event.ordinal) || routedByOrdinal.has(event.ordinal)) {
      return `receipt closure: invalid or duplicate routed ordinal ${event.ordinal}`;
    }
    routedByOrdinal.set(event.ordinal, event);
  }
  for (const [callClass, expected] of Object.entries(classes)) {
    if (reserved.filter((event) => event.call_class === callClass).length !== expected ||
        closed.filter((event) => event.call_class === callClass).length !== expected) {
      return `receipt closure: ${callClass} count mismatch`;
    }
  }
  const resultTuples = new Map(results.map((result) => [
    [result.packet_id, result.family_id, result.identity_id, result.invocation_id, result.context_id].join("\0"), result
  ]));
  const closedJudgeTuples = new Set();
  const scheduleDigests = new Set();
  for (let ordinal = 1; ordinal <= 160; ordinal++) {
    const reservation = reservedByOrdinal.get(ordinal);
    const route = routedByOrdinal.get(ordinal);
    const close = closedByOrdinal.get(ordinal);
    if (!reservation || !route || !close || reservation.call_class !== close.call_class || route.call_class !== close.call_class) {
      return `receipt closure: missing or mismatched ordinal ${ordinal}`;
    }
    const expectedClass = ordinal <= 48 ? "generation" : ordinal <= 144 ? "production_judge" : "anchor_judge";
    if (reservation.call_class !== expectedClass) {
      return `receipt closure: ordinal ${ordinal} has unexpected call class`;
    }
    if (close.status !== "completed" || close.run_status !== "running") {
      return `receipt closure: ordinal ${ordinal} did not complete cleanly`;
    }
    const expectedBinding = close.call_class === "generation"
      ? selection.generator
      : selection.judges.find(({ executor }) =>
        executor.family === close.family && executor.identity === close.identity
      );
    if (!expectedBinding || [reservation, route, close].some((event) =>
      event.executor_digest !== expectedBinding.executor_digest ||
      event.resolver_attestation_sha256 !== expectedBinding.resolver_attestation_sha256 ||
      canonicalJson(event.executor) !== canonicalJson(expectedBinding.executor)
    ) || reservation.cost_classification !== expectedBinding.executor.zero_cost_proof.kind ||
      close.cost_classification !== reservation.cost_classification ||
      reservation.incremental_spend_usd !== 0 || close.incremental_spend_usd !== 0) {
      return `receipt closure: executor, route, or zero-cost binding mismatch at ordinal ${ordinal}`;
    }
    if (close.call_class === "generation") {
      if (!Array.isArray(close.artifacts) || close.artifacts.length === 0) {
        return `receipt closure: generation ordinal ${ordinal} missing artifacts`;
      }
      if (close.raw_artifacts_sha256 !== sha256(canonicalJson(close.artifacts))) {
        return `receipt closure: generation artifact digest mismatch at ordinal ${ordinal}`;
      }
      continue;
    }
    const tupleFields = ["packet_id", "family", "identity", "invocation_id", "context_id"];
    if (tupleFields.some((field) => reservation[field] !== close[field])) {
      return `receipt closure: judge binding mismatch at ordinal ${ordinal}`;
    }
    const tuple = tupleFields.map((field) => close[field]).join("\0");
    if (!resultTuples.has(tuple) || closedJudgeTuples.has(tuple)) {
      return `receipt closure: missing, duplicate, or unexpected judge tuple at ordinal ${ordinal}`;
    }
    if (close.validated_artifact_sha256 !== sha256(canonicalJson(resultTuples.get(tuple)))) {
      return `receipt closure: judge result digest mismatch at ordinal ${ordinal}`;
    }
    closedJudgeTuples.add(tuple);
    if (!/^[0-9a-f]{64}$/.test(close.instantiated_judgment_schedule_sha256 ?? "") ||
        reservation.instantiated_judgment_schedule_sha256 !== close.instantiated_judgment_schedule_sha256) {
      return `receipt closure: judgment schedule binding mismatch at ordinal ${ordinal}`;
    }
    scheduleDigests.add(close.instantiated_judgment_schedule_sha256);
  }
  if (closedJudgeTuples.size !== results.length || scheduleDigests.size !== 1) {
    return "receipt closure: judgment result or schedule set is incomplete";
  }
  return null;
}

function verifyOpening({ ledger, unmask, reservation, packets, runId, randomizationCommitment }) {
  const packetSetSha256 = sha256(canonicalJson([...packets].sort((a, b) => a.packet_id.localeCompare(b.packet_id)).map(canonicalPacket)));
  const packetClosure = ledger.filter((event) => event.type === "packet_set_closed");
  const attempted = ledger.filter((event) => event.type === "opening_attempted");
  const completed = ledger.filter((event) => event.type === "opening_completed");
  if (packetClosure.length !== 1 || attempted.length !== 1 || completed.length !== 1 || ledger.at(-1) !== completed[0]) {
    return "opening authority events are incomplete or non-terminal";
  }
  const openingBody = Object.fromEntries(Object.entries(unmask).filter(([key]) =>
    !["opening_receipt_sha256", "completion_event_sha256"].includes(key)
  ));
  const unsignedOpeningBody = Object.fromEntries(Object.entries(openingBody).filter(([key]) => key !== "authority_signature"));
  let publicKeyDigest = null;
  try { publicKeyDigest = createHash("sha256").update(Buffer.from(unmask.authority_public_key, "base64")).digest("hex"); } catch {}
  if (!reservation || reservation.ledger_root !== packetClosure[0].event_sha256 ||
      unmask.run_id !== runId || packetClosure[0].run_id !== runId || attempted[0].run_id !== runId || completed[0].run_id !== runId ||
      reservation.sha256 !== attempted[0].reservation_sha256 ||
      attempted[0].predecessor_sha256 !== reservation.ledger_root ||
      unmask.ledger_predecessor !== reservation.ledger_root ||
      unmask.opening_event_sha256 !== attempted[0].event_sha256 ||
      unmask.opening_receipt_sha256 !== sha256(canonicalJson(openingBody)) ||
      publicKeyDigest !== randomizationCommitment ||
      !verifyAuthorityReceipt(unmask.authority_public_key, canonicalJson(unsignedOpeningBody), unmask.authority_signature) ||
      completed[0].predecessor_sha256 !== attempted[0].event_sha256 ||
      completed[0].opening_receipt_sha256 !== unmask.opening_receipt_sha256 ||
      completed[0].reservation_sha256 !== reservation.sha256 ||
      packetClosure[0].packet_set_sha256 !== packetSetSha256 ||
      unmask.packet_set_sha256 !== packetSetSha256 ||
      completed[0].packet_set_sha256 !== packetSetSha256 ||
      packetClosure[0].map_commitment_sha256 !== unmask.commitment_sha256 ||
      completed[0].commitment_sha256 !== unmask.commitment_sha256) {
    return "opening receipt is not bound to committed reservation, packets, or map commitment";
  }
  return null;
}

function verifyPacketProvenance({ protocol, packets, unmask, generations, renders, rawJudgeArtifacts, results, ledger, manifest, runId }) {
  if (!Array.isArray(generations) || generations.length !== 48 || !Array.isArray(renders) || renders.length !== 96) {
    return "generation or render evidence count mismatch";
  }
  const generationByKey = new Map();
  for (const generation of generations) {
    const key = `${generation.scenario_id}\0${generation.generation_seed}\0${generation.arm}`;
    if (generationByKey.has(key)) return "duplicate generation coordinate";
    generationByKey.set(key, generation);
  }
  const renderByKey = new Map();
  for (const render of renders) {
    const contract = validateContract("render-receipt", render);
    if (!contract.valid) return "render receipt contract invalid";
    const key = `${render.unit_id}\0${render.arm}\0${render.viewport_id}`;
    if (renderByKey.has(key)) return "duplicate render coordinate";
    renderByKey.set(key, render);
  }
  const generationCloses = ledger.filter((event) => event.type === "attempt_closed" && event.call_class === "generation");
  const closedGenerationKeys = new Set();
  for (const close of generationCloses) {
    const key = `${close.scenario_id}\0${close.generation_seed}\0${close.arm}`;
    if (closedGenerationKeys.has(key)) return `duplicate generation receipt coordinate at ordinal ${close.ordinal}`;
    closedGenerationKeys.add(key);
    const generation = generationByKey.get(key);
    const artifactSha256 = generation && sha256(Buffer.isBuffer(generation.bytes) ? generation.bytes.toString("utf8") : generation.bytes);
    if (!generation) return `generation receipt coordinate is not in evidence at ordinal ${close.ordinal}`;
    const expectedRevision = close.arm === "baseline" ? protocol.baseline_revision : protocol.candidate_revision;
    if (close.revision !== expectedRevision) return `generation receipt revision mismatch at ordinal ${close.ordinal}`;
    if (close.artifacts?.length !== 1) return `generation receipt artifact cardinality mismatch at ordinal ${close.ordinal}`;
    if (close.artifacts[0]?.artifact_sha256 !== artifactSha256) return `generation receipt artifact digest mismatch at ordinal ${close.ordinal}`;
  }
  if (closedGenerationKeys.size !== generationByKey.size || [...generationByKey.keys()].some((key) => !closedGenerationKeys.has(key))) {
    return "generation receipt coordinate set is incomplete";
  }
  const judgeCloses = ledger.filter((event) => event.type === "attempt_closed" && event.call_class !== "generation");
  if (!Array.isArray(rawJudgeArtifacts) || rawJudgeArtifacts.length !== 112) return "raw judge artifact evidence count mismatch";
  const rawByDigest = new Map(rawJudgeArtifacts.map((artifacts) => [sha256(canonicalJson(artifacts)), artifacts]));
  if (rawByDigest.size !== 112 || judgeCloses.some((close) => !rawByDigest.has(close.raw_artifacts_sha256))) {
    return "raw judge artifact digest set is incomplete or duplicated";
  }
  for (const close of judgeCloses) {
    const raw = rawByDigest.get(close.raw_artifacts_sha256);
    if (raw.length !== 1 || typeof raw[0] !== "string") return `raw judge artifact shape invalid at ordinal ${close.ordinal}`;
    let parsed;
    try { parsed = JSON.parse(raw[0]); } catch { return `raw judge artifact JSON invalid at ordinal ${close.ordinal}`; }
    if (sha256(canonicalJson(parsed)) !== close.validated_artifact_sha256 ||
        !results.some((result) => canonicalJson(result) === canonicalJson(parsed))) {
      return `raw and validated judge artifacts differ at ordinal ${close.ordinal}`;
    }
  }
  const packetClosure = ledger.find((event) => event.type === "packet_set_closed");
  if (packetClosure?.generation_receipts_sha256 !== sha256(canonicalJson(generationCloses)) ||
      packetClosure?.render_receipts_sha256 !== sha256(canonicalJson(renders))) {
    return "packet closure does not bind exact generation and render receipt sets";
  }
  const packetByUnit = new Map(packets.map((packet) => [packet.unit_id, packet]));
  for (const mapping of unmask.mappings) {
    const packet = packetByUnit.get(mapping.unit_id);
    const arm = packet?.arms.find(({ opaque_slot }) => opaque_slot === mapping.opaque_slot);
    const generation = generationByKey.get(`${mapping.scenario_id}\0${mapping.generation_seed}\0${mapping.arm}`);
    if (!arm || !generation || arm.artifact_sha256 !== sha256(Buffer.isBuffer(generation.bytes) ? generation.bytes.toString("utf8") : generation.bytes)) {
      return "packet arm does not derive from its generation receipt";
    }
    for (const evidence of arm.render_evidence) {
      const render = renderByKey.get(`${mapping.unit_id}\0${mapping.arm}\0${evidence.viewport_id}`);
      if (!render || evidence.artifact_sha256 !== arm.artifact_sha256 ||
          evidence.screenshot_sha256 !== render.screenshot_sha256 || evidence.dom_sha256 !== render.dom_sha256 ||
          evidence.style_sha256 !== render.style_sha256) return "packet render evidence does not close over exact render receipt";
      try {
        const artifact = { unit_id: mapping.unit_id, arm: mapping.arm, artifact_id: arm.artifact_id, bytes: generation.bytes };
        verifyRenderReceiptBinding(render, artifact, manifest, runId);
      } catch (error) {
        return `render receipt binding: ${error.message.replace(/^production_incomplete: render /, "")}`;
      }
    }
  }
  return null;
}
export function aggregateAdmissibleResults({ protocol, packets, unmask, admissibleResults }) {
  const slotByUnit = new Map();
  for (const m of unmask.mappings) {
    if (!slotByUnit.has(m.unit_id)) slotByUnit.set(m.unit_id, {});
    slotByUnit.get(m.unit_id)[m.opaque_slot] = m.arm;
  }
  const packetById = new Map(packets.map((p) => [p.packet_id, p]));
  const unmaskByUnit = new Map();
  for (const m of unmask.mappings) {
    if (!unmaskByUnit.has(m.unit_id)) {
      unmaskByUnit.set(m.unit_id, { scenario_id: m.scenario_id, generation_seed: m.generation_seed });
    }
  }
  const productionResults = admissibleResults.filter((r) => packetById.has(r.packet_id));
  const familyIds = [...protocol.family_quorum ? new Set(productionResults.map((r) => r.family_id)) : []];
  if (familyIds.length !== 2) {
    return { status: STATUS_PRODUCTION_INCOMPLETE, families: [], hard_regressions: [] };
  }
  const familyOutputs = [];
  let hasIncomplete = false;
  const allRegressions = new Set();
  for (const familyId of familyIds) {
    const famResults = productionResults.filter((r) => r.family_id === familyId);
    const identityIds = [...new Set(famResults.map((r) => r.identity_id))];
    if (identityIds.length !== protocol.judge_identities_per_family) hasIncomplete = true;
    const byIdentityUnit = new Map();
    for (const r of famResults) {
      const packet = packetById.get(r.packet_id);
      const unitId = packet.unit_id;
      const key = `${r.identity_id}|${unitId}`;
      if (byIdentityUnit.has(key)) hasIncomplete = true;
      byIdentityUnit.set(key, r);
      if (Array.isArray(r.hard_regressions)) {
        for (const reg of r.hard_regressions) allRegressions.add(reg);
      }
    }
    const unitPreferenceValues = new Map();
    const unitScenarioMap = new Map();
    for (const packet of packets) {
      const unitId = packet.unit_id;
      const ul = unmaskByUnit.get(unitId);
      if (!ul) { hasIncomplete = true; continue; }
      unitScenarioMap.set(unitId, ul.scenario_id);
      const unitSlots = slotByUnit.get(unitId);
      const candidateSlot = unitSlots[0] === "candidate" ? 0 : 1;
      const baselineSlot = 1 - candidateSlot;
      let sum = 0;
      let count = 0;
      for (const identityId of identityIds) {
        const result = byIdentityUnit.get(`${identityId}|${unitId}`);
        if (!result) { hasIncomplete = true; continue; }
        const pref = result.preference;
        if (pref === "abstain") { hasIncomplete = true; continue; }
        const slotPref = `slot-${candidateSlot}`;
        const basePref = `slot-${baselineSlot}`;
        if (pref === slotPref) { sum += 1; count++; }
        else if (pref === basePref) { sum += 0; count++; }
        else if (pref === "tie") { sum += 0.5; count++; }
        else { hasIncomplete = true; }
      }
      if (count !== identityIds.length || count === 0) hasIncomplete = true;
      unitPreferenceValues.set(unitId, count > 0 ? sum / count : 0);
    }
    let preferenceScore = 0;
    for (const v of unitPreferenceValues.values()) preferenceScore += v;
    const scenarioUnits = new Map();
    for (const [unitId, val] of unitPreferenceValues) {
      const sid = unitScenarioMap.get(unitId);
      if (!scenarioUnits.has(sid)) scenarioUnits.set(sid, []);
      scenarioUnits.get(sid).push(val);
    }
    let scenarioMajorities = 0;
    for (const [sid, vals] of scenarioUnits) {
      if (vals.length !== protocol.seeds.length) hasIncomplete = true;
      const scenarioScore = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (scenarioScore > 0.5) scenarioMajorities++;
    }
    const dimensionMeans = {};
    for (const dim of DIMENSIONS) {
      let dimSum = 0;
      let dimCount = 0;
      for (const packet of packets) {
        const unitId = packet.unit_id;
        const unitSlots = slotByUnit.get(unitId);
        const candidateSlot = unitSlots[0] === "candidate" ? 0 : 1;
        let identitySum = 0;
        let identityCount = 0;
        for (const identityId of identityIds) {
          const result = byIdentityUnit.get(`${identityId}|${unitId}`);
          if (!result) { hasIncomplete = true; continue; }
          const armScore = result.arm_scores?.find((a) => a.opaque_slot === candidateSlot);
          if (!armScore) { hasIncomplete = true; continue; }
          const score = armScore.dimensions?.[dim];
          if (typeof score !== "number" || score < 1 || score > 5 || !Number.isFinite(score)) { hasIncomplete = true; continue; }
          identitySum += score;
          identityCount++;
        }
        if (identityCount > 0) {
          dimSum += identitySum / identityCount;
          dimCount++;
        }
      }
      dimensionMeans[dim] = dimCount > 0 ? dimSum / dimCount : 0;
    }
    const absoluteMean = DIMENSIONS.reduce((s, d) => s + dimensionMeans[d], 0) / DIMENSIONS.length;
    const passed = preferenceScore >= protocol.candidate_preference_floor
      && scenarioMajorities >= protocol.scenario_majority_floor
      && DIMENSIONS.every((d) => dimensionMeans[d] >= protocol.dimension_floor)
      && absoluteMean >= protocol.absolute_mean_floor;
    familyOutputs.push({
      family_id: familyId,
      preference_score: Math.round(preferenceScore * 100) / 100,
      scenario_majorities: scenarioMajorities,
      dimension_means: dimensionMeans,
      absolute_mean: Math.round(absoluteMean * 100) / 100,
      passed
    });
  }
  const hardRegressions = [...allRegressions].sort();
  let status;
  if (hasIncomplete) status = STATUS_PRODUCTION_INCOMPLETE;
  else if (hardRegressions.length > 0) status = STATUS_BLOCKED;
  else if (familyOutputs.every((f) => f.passed)) status = STATUS_SUPPORTED;
  else status = STATUS_INCONCLUSIVE;
  return { status, families: familyOutputs, hard_regressions: hardRegressions };
}

export function synthesize({ repoRoot, protocol, packets, unmask, validatedBatches, judgeEvidence, ledger }) {
  if (!protocol || typeof protocol !== "object") throw new Error("synthesize: protocol required");
  if (!Array.isArray(packets) || packets.length !== 24) throw new Error("synthesize: exactly 24 packets required");
  if (!unmask || !Array.isArray(unmask.mappings)) throw new Error("synthesize: unmask mappings required");
  if (!Array.isArray(validatedBatches)) throw new Error("synthesize: validatedBatches required");
  if (!judgeEvidence || typeof judgeEvidence !== "object") throw new Error("synthesize: judgeEvidence required");
  if (!Array.isArray(ledger)) throw new Error("synthesize: ledger required");

  // Extract run_id from the ledger's run_initialized event.
  const initEvent = ledger.find((e) => e.type === "run_initialized");
  const runId = initEvent?.run_id ?? "";

  // 1. Verify ledger integrity (hash chain) — integrity violation throws.
  validateLedger(ledger);

  // 2. Verify run_initialized event — integrity violation throws.
  if (ledger.filter((event) => event.type === "run_initialized").length !== 1) {
    throw new Error("ledger drift: exactly one run_initialized root event required");
  }

  // 3. Verify production_admitted event.
  if (ledger.filter((event) => event.type === "production_admitted").length !== 1) {
    return productionIncomplete(runId, "missing production_admitted event");
  }

  // 4. One-time synthesis: reject rerun.
  if (ledger.some((e) => e.type === "synthesis_completed")) {
    throw new Error("one-time synthesis: prior synthesis_completed event detected (rerun prohibited)");
  }

  const admitted = ledger.find((event) => event.type === "production_admitted");
  let execution;
  try { execution = verifyExecutionEvidence(judgeEvidence.execution, admitted); }
  catch (error) { return productionIncomplete(runId, error.message); }

  const batch = validateJudgeBatch({
    packetSet: packets,
    anchorSet: judgeEvidence.anchorSet,
    anchorMetadata: judgeEvidence.anchorMetadata,
    results: validatedBatches,
    families: execution.families
  });
  if (!batch.valid) return productionIncomplete(runId, `judge evidence invalid: ${batch.errors.join(";")}`);
  const closureError = verifyEvidenceClosure({ ledger, results: batch.admissible_results, selection: execution.selection });
  if (closureError) return productionIncomplete(runId, closureError);
  const openingError = verifyOpening({
    ledger, unmask, reservation: judgeEvidence.reservation, packets, runId,
    randomizationCommitment: initEvent.randomization_commitment_sha256
  });
  if (openingError) throw new Error(`opening authority integrity: ${openingError}`);

  // 5. Verify unmask coordinate completeness and bijection with packets.
  const packetUnitIds = new Set(packets.map((p) => p.unit_id));
  const unmaskUnitIds = new Set();
  const slotByUnit = new Map();
  let unmaskError = null;
  for (const m of unmask.mappings) {
    if (!packetUnitIds.has(m.unit_id)) {
      unmaskError = `unmask coordinate unit_id not in packet set (invented or forged ID)`;
      break;
    }
    if (!unmaskUnitIds.has(m.unit_id)) {
      unmaskUnitIds.add(m.unit_id);
      slotByUnit.set(m.unit_id, {});
    }
    const slots = slotByUnit.get(m.unit_id);
    if (m.opaque_slot in slots) { unmaskError = "duplicate unmask coordinate"; break; }
    slots[m.opaque_slot] = m.arm;
  }
  if (!unmaskError && unmaskUnitIds.size !== 24) unmaskError = `unmask coordinate count: expected 24 units, got ${unmaskUnitIds.size}`;
  if (!unmaskError) {
    for (const [uid, slots] of slotByUnit) {
      if (slots[0] === undefined || slots[1] === undefined) { unmaskError = `unmask unit missing slot`; break; }
      if (slots[0] === slots[1]) { unmaskError = `unmask unit same arm both slots`; break; }
      if (!["baseline", "candidate"].includes(slots[0]) || !["baseline", "candidate"].includes(slots[1])) { unmaskError = `unmap invalid arm`; break; }
    }
  }
  if (unmaskError) throw new Error(`unmask coordinate integrity: ${unmaskError}`);

  const provenanceError = verifyPacketProvenance({
    protocol, packets, unmask, generations: judgeEvidence.generations, renders: judgeEvidence.renders,
    rawJudgeArtifacts: judgeEvidence.rawJudgeArtifacts, results: batch.admissible_results, ledger,
    manifest: judgeEvidence.execution.manifest, runId
  });
  if (provenanceError) return productionIncomplete(runId, provenanceError);

  // 6-10. Pure scoring (extracted; independent of authenticity gates).
  const scoring = aggregateAdmissibleResults({
    protocol, packets, unmask, admissibleResults: batch.admissible_results
  });

  const synthesis = {
    schema_version: 2,
    kind: "effectiveness-v2-synthesis",
    run_id: runId,
    status: scoring.status,
    families: scoring.families,
    hard_regressions: scoring.hard_regressions,
    claim_allowed: scoring.status === STATUS_SUPPORTED
  };

  // Validate against the schema.
  const validation = validateContract("synthesis", synthesis);
  if (!validation.valid) {
    throw new Error(`synthesis schema invalid: ${validation.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`);
  }

  if (scoring.status !== STATUS_PRODUCTION_INCOMPLETE) {
    const bindResult = bindAndAppendTerminal({ repoRoot, runId, ledger, synthesis });
    if (bindResult) return bindResult;
  }

  return synthesis;
}

const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Derive the canonical ledger path from repoRoot + runId, reject symlinks and
 * path traversal, verify the disk ledger matches the supplied ledger, and
 * append the terminal synthesis_completed event atomically.
 * Returns a productionIncomplete object on failure, or null on success.
 */
export function bindAndAppendTerminal({ repoRoot, runId, ledger, synthesis }) {
  if (typeof repoRoot !== "string" || !repoRoot) {
    return productionIncomplete(runId, "repoRoot required for canonical ledger binding");
  }
  if (!RUN_ID_PATTERN.test(runId) || runId.includes("..")) {
    return productionIncomplete(runId, "runId is not a safe path component");
  }
  const runsDir = resolve(repoRoot, "evals/v2/runs");
  const runDir = resolve(runsDir, runId);
  const ledgerPath = resolve(runDir, "ledger.jsonl");
  // Containment: derived runDir must stay under runsDir.
  if (!runDir.startsWith(runsDir + "/") && runDir !== runsDir) {
    return productionIncomplete(runId, "derived ledger path escapes the runs directory");
  }
  // Reject symlinks at the leaf path components (runs dir, run dir, ledger file).
  for (const p of [runsDir, runDir, ledgerPath]) {
    try { if (lstatSync(p).isSymbolicLink()) return productionIncomplete(runId, `ledger path component is a symlink: ${p}`); }
    catch { /* nonexistent is acceptable for parent dirs */ }
  }
  // Read the disk ledger and require exact canonical equality with the supplied ledger.
  let diskText;
  try { diskText = readFileSync(ledgerPath, "utf8"); }
  catch { return productionIncomplete(runId, "canonical ledger file not found on disk"); }
  const diskEvents = diskText.trim() ? diskText.trim().split("\n").map(JSON.parse) : [];
  if (canonicalJson(diskEvents) !== canonicalJson(ledger)) {
    return productionIncomplete(runId, "disk ledger does not match supplied ledger");
  }
  appendEvent(ledgerPath, ledger.at(-1), {
    type: "synthesis_completed", run_id: runId, status: synthesis.status,
    synthesis_sha256: sha256(canonicalJson(synthesis))
  });
  return null;
}
