// Task 5: Judge-batch validation, evidence-citation validation, and the
// private machine-anchor verdict lookup. This module never imports the
// Task 6 synthesis-open authority.

import { createHash } from "node:crypto";
import { canonicalJson, sha256, validateContract, canonicalPacket } from "./contracts.mjs";

const VIEWPORT_IDS = ["mobile", "desktop"];
const DIMENSIONS = ["direction", "structure", "accessibility", "verbal", "integration"];

/**
 * packetSha256(packet)
 * Deterministic per-packet digest used by judge results to bind to packets.
 * Only hashes opaque, judge-visible fields (no arm-identifying bytes outside
 * the packet itself).
 */
export function packetSha256(packet) {
  return sha256(canonicalPacket(packet));
}

function canonicalBytes(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Buffer.isBuffer(value)) {
    return JSON.stringify(value.toString("utf8"));
  }
  return canonicalJson(value);
}

// canonicalPacket is imported from contracts.mjs (single source of truth).
// Re-exported here for backward compatibility with consumers that import
// from judges.mjs.
export { canonicalPacket };

/**
 * validateEvidenceCitation(citation, packetSet)
 *
 * Returns { valid, errors }. The citation is valid iff:
 *   1. artifact_id + opaque_slot + viewport_id resolve to a unique arm.
 *   2. artifact_sha256 equals SHA256(arm.artifact_bytes).
 *   3. Offsets are valid Unicode-codepoint offsets into arm.artifact_bytes.
 *   4. exact_span is nonempty and equals the codepoint slice.
 */
export function validateEvidenceCitation(citation, packetSet) {
  const errors = [];
  if (!citation || typeof citation !== "object") {
    return { valid: false, errors: ["evidence|binding|invalid|citation"] };
  }
  const arm = resolveArm(citation, packetSet);
  if (!arm) {
    errors.push("evidence|binding|locator|unresolved");
    return { valid: false, errors };
  }
  const bytes = Buffer.from(arm.artifact_bytes, "utf8");
  const recomputed = createHash("sha256").update(bytes).digest("hex");
  if (recomputed !== citation.artifact_sha256) {
    errors.push(`evidence|binding|stale|hash|${citation.artifact_sha256?.slice(0, 12) ?? ""}`);
  }
  if (!VIEWPORT_IDS.includes(citation.viewport_id)) {
    errors.push(`evidence|binding|viewport|${citation.viewport_id ?? ""}`);
  } else {
    const evidence = arm.render_evidence.find((entry) => entry.viewport_id === citation.viewport_id);
    if (!evidence) errors.push(`evidence|binding|viewport|missing|${citation.viewport_id}`);
  }
  const codepoints = Array.from(arm.artifact_bytes);
  const start = Number(citation.start_codepoint);
  const end = Number(citation.end_codepoint);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 1 || start >= end || end > codepoints.length) {
    errors.push(`evidence|binding|offset|bounds|${start}|${end}|${codepoints.length}`);
  }
  if (typeof citation.exact_span !== "string" || citation.exact_span.length < 1) {
    errors.push("evidence|binding|span|empty");
  }
  if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= codepoints.length) {
    const expected = codepoints.slice(start, end).join("");
    if (expected !== citation.exact_span) {
      errors.push("evidence|binding|span|nonmatching");
    }
  }
  return { valid: errors.length === 0, errors };
}

function resolveArm(citation, packetSet) {
  if (!packetSet || !Array.isArray(packetSet)) return null;
  // Prefer (artifact_id, opaque_slot) joint resolution; allow artifact_id-only
  // when opaque_slot is absent or consistent.
  const candidates = [];
  for (const packet of packetSet) {
    for (const arm of packet.arms) {
      if (arm.artifact_id !== citation.artifact_id) continue;
      if (citation.opaque_slot !== undefined && citation.opaque_slot !== null && arm.opaque_slot !== citation.opaque_slot) continue;
      candidates.push({ packet, arm });
    }
  }
  if (candidates.length !== 1) return null;
  return candidates[0].arm;
}

/**
 * validateJudgeBatch({ packetSet, anchorSet, anchorMetadata, results, families })
 *
 * Returns { valid, errors, admissible_results }.
 */
export function validateJudgeBatch({ packetSet, anchorSet, anchorMetadata = [], results, families }) {
  const errors = [];
  const admissible = [];
  if (!Array.isArray(packetSet) || packetSet.length !== 24) {
    errors.push(`packet|count|expected|24|actual|${Array.isArray(packetSet) ? packetSet.length : "n/a"}`);
  }
  if (!Array.isArray(anchorSet) || anchorSet.length !== 4) {
    errors.push(`anchor|count|expected|4|actual|${Array.isArray(anchorSet) ? anchorSet.length : "n/a"}`);
  }
  if (!Array.isArray(families) || families.length !== 2) {
    errors.push(`family|quorum|expected|2|actual|${Array.isArray(families) ? families.length : "n/a"}`);
  } else {
    const providers = new Set(families.map((family) => family.provider));
    const lineages = new Set(families.map((family) => family.foundation_lineage));
    if (providers.size !== 2) errors.push("family|provider|quorum");
    if (lineages.size !== 2) errors.push("family|lineage");
    for (const family of families) {
      const distinctIdentities = new Set(family.identities || []);
      if (distinctIdentities.size !== 2) errors.push(`identity|count|${family.family_id}`);
    }
  }
  // Validate every result against the schema and family manifest before
  // counting it.
  const seenPackets = new Map();
  for (const packet of packetSet) seenPackets.set(packet.packet_id, packet);
  const seenAnchors = new Map();
  for (const anchor of anchorSet) seenAnchors.set(anchor.packet_id, anchor);

  const declaredIdentities = new Set();
  for (const family of families || []) {
    for (const identity of family.identities || []) declaredIdentities.add(`${family.family_id}|${identity}`);
  }

  const contextIds = new Set();
  const invocationIds = new Set();
  const schemaValidResults = [];
  for (const result of results || []) {
    const localErrors = [];
    const contract = validateContract("judge-result", result);
    if (!contract.valid) {
      localErrors.push(...contract.errors.map((error) => `schema|${error.instancePath || "/"}|${error.keyword || "invalid"}|${error.message || ""}`));
    }
    if (!declaredIdentities.has(`${result.family_id}|${result.identity_id}`)) {
      localErrors.push(`identity|undeclared|${result.family_id}|${result.identity_id}`);
    }
    const referencedPacket = seenPackets.get(result.packet_id) ?? seenAnchors.get(result.packet_id);
    if (!referencedPacket) {
      localErrors.push(`packet|hash|mismatch|unresolved|${result.packet_id}`);
    } else {
      const recomputed = packetSha256(referencedPacket);
      if (recomputed !== result.packet_sha256) {
        localErrors.push(`packet|hash|mismatch|${result.packet_id}`);
      }
    }
    // Citations must resolve against the production packet set.
    if (seenPackets.has(result.packet_id)) {
      if (!Array.isArray(result.evidence_citations) || result.evidence_citations.length === 0) {
        localErrors.push("evidence|binding|minItems");
      } else {
        for (const citation of result.evidence_citations) {
          const cite = validateEvidenceCitation(citation, packetSet);
          if (!cite.valid) localErrors.push(...cite.errors.map((token) => `evidence|binding|${token}`));
        }
      }
    }
    if (result.preference && !["slot-0", "slot-1", "tie", "abstain"].includes(result.preference)) {
      localErrors.push(`preference|arm|leak|${result.preference}`);
    }
    if (result.preference === "baseline" || result.preference === "candidate") {
      localErrors.push(`preference|arm|leak|${result.preference}`);
    }
    if (contextIds.has(result.context_id)) localErrors.push(`context|identity|duplicate|${result.context_id}`);
    if (invocationIds.has(result.invocation_id)) localErrors.push(`invocation|identity|duplicate|${result.invocation_id}`);
    if (localErrors.length === 0) {
      schemaValidResults.push(result);
      contextIds.add(result.context_id);
      invocationIds.add(result.invocation_id);
    } else {
      errors.push(...localErrors);
    }
  }

  // Anchor verdict validation.
  const anchorByPacket = new Map();
  for (const meta of anchorMetadata) anchorByPacket.set(meta.packet_id, meta);
  const anchorResults = schemaValidResults.filter((result) => seenAnchors.has(result.packet_id));
  // Group by anchor packet and look for a consistent majority across all four identities.
  const verdictByAnchor = new Map();
  for (const result of anchorResults) {
    if (!verdictByAnchor.has(result.packet_id)) verdictByAnchor.set(result.packet_id, []);
    verdictByAnchor.get(result.packet_id).push(result);
  }
  for (const anchorPacket of anchorSet || []) {
    const meta = anchorByPacket.get(anchorPacket.packet_id);
    const verdicts = verdictByAnchor.get(anchorPacket.packet_id) ?? [];
    const expected = meta?.expected;
    if (verdicts.length === 0) {
      errors.push(`anchor|batch|invalid|${meta?.anchor_id ?? anchorPacket.packet_id}|missing`);
      continue;
    }
    for (const verdict of verdicts) {
      if (verdict.preference !== expected) {
        errors.push(`anchor|batch|invalid|${meta?.anchor_id ?? anchorPacket.packet_id}|${verdict.preference}|expected|${expected}`);
      }
    }
  }
  // Position-bias detection: judge picking the same slot on both broken-complete
  // anchors proves the judge is position-bound. broken-complete-a expects slot-1
  // (broken in slot 0) and broken-complete-b expects slot-0 (broken in slot 1).
  // A judge picking slot-1 on both (or slot-0 on both) fails position bias.
  const byKind = new Map();
  for (const meta of anchorMetadata) byKind.set(meta.kind, meta);
  const brokenA = byKind.get("broken-complete");
  const brokenB = byKind.get("broken-complete-reversed");
  if (brokenA && brokenB) {
    const aVerdicts = verdictByAnchor.get(brokenA.packet_id) ?? [];
    const bVerdicts = verdictByAnchor.get(brokenB.packet_id) ?? [];
    if (aVerdicts.length && bVerdicts.length) {
      const aPrefs = new Set(aVerdicts.map((v) => v.preference));
      const bPrefs = new Set(bVerdicts.map((v) => v.preference));
      if (aPrefs.size === 1 && bPrefs.size === 1 && [...aPrefs][0] === [...bPrefs][0] && [...aPrefs][0] !== "tie") {
        errors.push(`anchor|batch|invalid|position|${[...aPrefs][0]}`);
      }
    }
  }

  // Result count for production + anchor must be exactly 112 once families are healthy.
  if (Array.isArray(families) && families.length === 2 && Array.isArray(packetSet) && packetSet.length === 24 && Array.isArray(anchorSet) && anchorSet.length === 4) {
    const expectedProduction = packetSet.length * families.length * 2; // 24*2*2 = 96
    const expectedAnchor = anchorSet.length * families.length * 2;    // 4*2*2 = 16
    const productionCount = schemaValidResults.filter((r) => seenPackets.has(r.packet_id)).length;
    const anchorCount = schemaValidResults.filter((r) => seenAnchors.has(r.packet_id)).length;
    if (productionCount !== expectedProduction) {
      errors.push(`result|count|production|expected|${expectedProduction}|actual|${productionCount}`);
    }
    if (anchorCount !== expectedAnchor) {
      errors.push(`result|count|anchor|expected|${expectedAnchor}|actual|${anchorCount}`);
    }
  }

  // Admissible results are those that survived schema validation and citation
  // checks. Anchor failures mark the whole batch invalid (already captured in
  // errors above) but the individual admissible results are still returned so
  // callers can audit the survivors.
  return {
    valid: errors.length === 0,
    errors,
    admissible_results: schemaValidResults
  };
}

/**
 * anchorExpectedVerdict(anchor)
 *
 * PRIVATE operator logic. Returns anchor.expected; never appears in production
 * packets or judge-visible fields. Tests reach this via anchorMetadata.
 */
export function anchorExpectedVerdict(anchor) {
  if (!anchor || typeof anchor !== "object") {
    throw new Error("anchor|expected|missing");
  }
  return anchor.expected;
}

const __internal = { resolveArm, DIMENSIONS };
