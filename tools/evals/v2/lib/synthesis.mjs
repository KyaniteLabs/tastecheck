// Task 6: Family-separated aggregation and exact decision rules.
// Implements the frozen synthesis contract from the effectiveness-v2 design.

import { canonicalJson, sha256, validateContract } from "./contracts.mjs";
import { validateLedger } from "./ledger.mjs";

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
export function synthesize({ protocol, packets, unmask, validatedBatches, ledger }) {
  if (!protocol || typeof protocol !== "object") throw new Error("synthesize: protocol required");
  if (!Array.isArray(packets) || packets.length !== 24) throw new Error("synthesize: exactly 24 packets required");
  if (!unmask || !Array.isArray(unmask.mappings)) throw new Error("synthesize: unmask mappings required");
  if (!Array.isArray(validatedBatches)) throw new Error("synthesize: validatedBatches required");
  if (!Array.isArray(ledger)) throw new Error("synthesize: ledger required");

  // Extract run_id from the ledger's run_initialized event.
  const initEvent = ledger.find((e) => e.type === "run_initialized");
  const runId = initEvent?.run_id ?? "";

  // 1. Verify ledger integrity (hash chain) — integrity violation throws.
  validateLedger(ledger);

  // 2. Verify run_initialized event — integrity violation throws.
  if (!initEvent) throw new Error("ledger drift: missing run_initialized root event");

  // 3. Verify production_admitted event.
  if (!ledger.some((e) => e.type === "production_admitted")) {
    return productionIncomplete(runId, "missing production_admitted event");
  }

  // 4. One-time synthesis: reject rerun.
  if (ledger.some((e) => e.type === "synthesis_completed")) {
    throw new Error("one-time synthesis: prior synthesis_completed event detected (rerun prohibited)");
  }

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

  // 6. Build lookups.
  const packetById = new Map(packets.map((p) => [p.packet_id, p]));
  const unmaskByUnit = new Map();
  for (const m of unmask.mappings) {
    if (!unmaskByUnit.has(m.unit_id)) {
      unmaskByUnit.set(m.unit_id, { scenario_id: m.scenario_id, generation_seed: m.generation_seed });
    }
  }

  // 7. Filter to production results.
  const productionResults = validatedBatches.filter((r) => packetById.has(r.packet_id));

  // 8. Identify families and identities.
  const familyIds = [...protocol.family_quorum ? new Set(productionResults.map((r) => r.family_id)) : []];
  if (familyIds.length !== 2) {
    return productionIncomplete(runId, `expected 2 families, got ${familyIds.length}`);
  }

  // 9. For each family, compute scores.
  const familyOutputs = [];
  let hasIncomplete = false;
  const allRegressions = new Set();

  for (const familyId of familyIds) {
    const famResults = productionResults.filter((r) => r.family_id === familyId);

    // Collect identities for this family.
    const identityIds = [...new Set(famResults.map((r) => r.identity_id))];
    if (identityIds.length !== protocol.judge_identities_per_family) {
      hasIncomplete = true;
    }

    // Group results by (identity_id, unit_id).
    const byIdentityUnit = new Map();
    for (const r of famResults) {
      const packet = packetById.get(r.packet_id);
      const unitId = packet.unit_id;
      const key = `${r.identity_id}|${unitId}`;
      if (byIdentityUnit.has(key)) {
        hasIncomplete = true; // duplicate
      }
      byIdentityUnit.set(key, r);
      // Collect hard regressions.
      if (Array.isArray(r.hard_regressions)) {
        for (const reg of r.hard_regressions) allRegressions.add(reg);
      }
    }

    // Compute preference values per unit.
    const unitPreferenceValues = new Map(); // unit_id → mean of identity values
    const unitScenarioMap = new Map(); // unit_id → scenario_id
    const unitSeedMap = new Map(); // unit_id → generation_seed

    for (const packet of packets) {
      const unitId = packet.unit_id;
      const ul = unmaskByUnit.get(unitId);
      if (!ul) { hasIncomplete = true; continue; }
      unitScenarioMap.set(unitId, ul.scenario_id);
      unitSeedMap.set(unitId, ul.generation_seed);

      // Determine candidate slot from unmask.
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
      if (count !== identityIds.length || count === 0) {
        hasIncomplete = true;
      }
      unitPreferenceValues.set(unitId, count > 0 ? sum / count : 0);
    }

    // preference_score = sum of 24 unit values.
    let preferenceScore = 0;
    for (const v of unitPreferenceValues.values()) preferenceScore += v;

    // scenario_majorities: group units by scenario, count scenarios with mean > 0.5.
    const scenarioUnits = new Map(); // scenario_id → [unit values]
    for (const [unitId, val] of unitPreferenceValues) {
      const sid = unitScenarioMap.get(unitId);
      if (!scenarioUnits.has(sid)) scenarioUnits.set(sid, []);
      scenarioUnits.get(sid).push(val);
    }
    let scenarioMajorities = 0;
    for (const [sid, vals] of scenarioUnits) {
      if (vals.length !== protocol.seeds.length) { hasIncomplete = true; }
      const scenarioScore = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (scenarioScore > 0.5) scenarioMajorities++;
    }

    // Dimension means: average 2 identities per family/unit/arm/dimension,
    // then average the 24 equally weighted candidate units per dimension.
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
          if (typeof score !== "number" || score < 1 || score > 5 || !Number.isFinite(score)) {
            hasIncomplete = true; continue;
          }
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

    // Absolute mean = mean of 5 dimension means.
    const absoluteMean = DIMENSIONS.reduce((s, d) => s + dimensionMeans[d], 0) / DIMENSIONS.length;

    // Check thresholds.
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

  // 10. Determine status.
  const hardRegressions = [...allRegressions].sort();
  let status;
  if (hasIncomplete) {
    status = STATUS_PRODUCTION_INCOMPLETE;
  } else if (hardRegressions.length > 0) {
    status = STATUS_BLOCKED;
  } else if (familyOutputs.every((f) => f.passed)) {
    status = STATUS_SUPPORTED;
  } else {
    status = STATUS_INCONCLUSIVE;
  }

  const synthesis = {
    schema_version: 2,
    kind: "effectiveness-v2-synthesis",
    run_id: runId,
    status,
    families: familyOutputs,
    hard_regressions: hardRegressions,
    claim_allowed: status === STATUS_SUPPORTED
  };

  // Validate against the schema.
  const validation = validateContract("synthesis", synthesis);
  if (!validation.valid) {
    throw new Error(`synthesis schema invalid: ${validation.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`);
  }

  return synthesis;
}
