// Task 5: Blind packet builder. Orchestrates the build capability produced by
// createBuildAuthority(privateStateRef), validates the resulting packets, and
// enforces the closed allowlist of opaque packet fields. This module never
// imports the Task 6 synthesis-open authority.

import { createHash } from "node:crypto";
import { canonicalJson } from "./contracts.mjs";
import { validateCorpusSeparation } from "./registry.mjs";
import {
  validatePacketArtifact,
  FROZEN_VALIDATOR_VERSION,
  FROZEN_VALIDATOR_DIGEST
} from "./packet-policy.mjs";

const VIEWPORT_IDS = ["mobile", "desktop"];
const FORBIDDEN_PACKET_CUES = ["candidate", "baseline", "0859121", "0f99603", "1.1.0", "/worktree/", "generated_at", "provider", "package.json"];
const FORBIDDEN_RETURN_FIELDS = new Set(["seed", "key", "assignment", "assignments", "plaintext_map", "map", "privateStateRef"]);

function ensureProtocol(protocol) {
  if (!protocol || typeof protocol !== "object") throw new Error("buildBlindPackets|protocol|required");
  if (!Array.isArray(protocol.seeds) || protocol.seeds.length !== 2) throw new Error("buildBlindPackets|protocol|seeds|required");
  if (protocol.exclusions && protocol.exclusions.length) throw new Error("buildBlindPackets|protocol|exclusions|forbidden");
  if (protocol.family_quorum !== 2) throw new Error("buildBlindPackets|protocol|family_quorum|frozen");
  if (protocol.judge_identities_per_family !== 2) throw new Error("buildBlindPackets|protocol|judge_identities_per_family|frozen");
  if (protocol.production_judgments !== 96) throw new Error("buildBlindPackets|protocol|production_judgments|frozen");
  if (protocol.anchor_judgments !== 16) throw new Error("buildBlindPackets|protocol|anchor_judgments|frozen");
  if (protocol.max_external_calls !== 160) throw new Error("buildBlindPackets|protocol|max_external_calls|frozen");
  if (Number(protocol.incremental_spend_cap_usd) !== 0) throw new Error("buildBlindPackets|protocol|spend|cap|zero");
  if (protocol.retry_policy !== "none") throw new Error("buildBlindPackets|protocol|retry|none");
  if (protocol.human_calibration_claimed !== false) throw new Error("buildBlindPackets|protocol|human|calibration|forbidden");
}

function ensureRegistry(registry) {
  if (!registry || !Array.isArray(registry.scenarios) || !Array.isArray(registry.anchors)) {
    throw new Error("buildBlindPackets|registry|required");
  }
  validateCorpusSeparation(registry);
}

function ensureGenerations({ protocol, registry, generations }) {
  const seenKeys = new Set();
  const expectedArms = new Set(["baseline", "candidate"]);
  for (const scenario of registry.scenarios) {
    for (const seed of protocol.seeds) {
      seenKeys.add(`${scenario.scenario_id}|${seed}`);
    }
  }
  const presentKeys = new Map();
  for (const gen of generations) {
    const key = `${gen.scenario_id}|${gen.generation_seed}`;
    if (!seenKeys.has(key)) throw new Error(`buildBlindPackets|generations|unexpected|${key}`);
    if (!expectedArms.has(gen.arm)) throw new Error(`buildBlindPackets|generations|arm|${gen.arm}`);
    if (!presentKeys.has(key)) presentKeys.set(key, new Set());
    if (presentKeys.get(key).has(gen.arm)) throw new Error(`buildBlindPackets|generations|duplicate|${key}|${gen.arm}`);
    presentKeys.get(key).add(gen.arm);
  }
  for (const key of seenKeys) {
    const arms = presentKeys.get(key);
    if (!arms || arms.size !== 2) throw new Error(`buildBlindPackets|generations|missing|${key}`);
  }
}

function ensureRenders({ protocol, registry, renders }) {
  const expected = new Set();
  for (const scenario of registry.scenarios) {
    for (const seed of protocol.seeds) {
      for (const arm of ["baseline", "candidate"]) {
        for (const viewport of VIEWPORT_IDS) {
          expected.add(`${scenario.scenario_id}|${seed}|${arm}|${viewport}`);
        }
      }
    }
  }
  const seen = new Set();
  for (const render of renders) {
    const key = `${render.scenario_id}|${render.generation_seed}|${render.arm}|${render.viewport_id}`;
    if (!expected.has(key)) throw new Error(`buildBlindPackets|renders|unexpected|${key}`);
    if (seen.has(key)) throw new Error(`buildBlindPackets|renders|duplicate|${key}`);
    seen.add(key);
  }
  for (const key of expected) {
    if (!seen.has(key)) throw new Error(`buildBlindPackets|renders|missing|${key}`);
  }
}

const CLOSED_ARM_FIELDS = new Set(["opaque_slot", "artifact_id", "label_id", "artifact_bytes", "artifact_sha256", "brief", "render_evidence"]);

function assertClosedAllowlist(packets) {
  const serialized = JSON.stringify(packets).toLowerCase();
  for (const cue of FORBIDDEN_PACKET_CUES) {
    if (serialized.includes(cue.toLowerCase())) {
      throw new Error(`candidate|baseline|leak|forbidden|cue|${cue}`);
    }
  }
  // Rubric must be identical across all packets (frozen common rubric).
  const rubricJsons = new Set(packets.map((packet) => canonicalJson(packet.rubric)));
  if (rubricJsons.size !== 1) throw new Error("rubric|asymmetric");
  for (const packet of packets) {
    const requiredFields = ["packet_id", "unit_id", "scenario_id_token", "arms", "brief", "rubric", "viewport_ids"];
    for (const field of requiredFields) {
      if (!(field in packet)) throw new Error(`packet|field|missing|${field}`);
    }
    if (packet.arms.length !== 2) throw new Error(`packet|arms|count|${packet.arms.length}`);
    const slotKeys = new Set(packet.arms.map((arm) => arm.opaque_slot));
    if (slotKeys.size !== 2 || !slotKeys.has(0) || !slotKeys.has(1)) throw new Error("packet|arms|slots");
    // Explicit closed per-arm field allowlist: reject unknown fields even if
    // symmetric across both arms. This makes the validator self-defending
    // against adapter bugs that inject non-contract fields.
    for (const arm of packet.arms) {
      const actualFields = Object.keys(arm);
      for (const field of actualFields) {
        if (!CLOSED_ARM_FIELDS.has(field)) throw new Error(`closed|field|arm|unknown|${field}`);
      }
      if (actualFields.length !== CLOSED_ARM_FIELDS.size) throw new Error(`closed|field|arm|count|${actualFields.length}`);
    }
    const briefs = new Set(packet.arms.map((arm) => arm.brief));
    if (briefs.size !== 1) throw new Error("brief|asymmetric");
    if (packet.viewport_ids.join("|") !== VIEWPORT_IDS.join("|")) throw new Error("packet|viewport_ids");
    for (const arm of packet.arms) {
      if (createHash("sha256").update(arm.artifact_bytes).digest("hex") !== arm.artifact_sha256) {
        throw new Error(`byte|preservation|mutated|${arm.artifact_id}`);
      }
      if (!Array.isArray(arm.render_evidence) || arm.render_evidence.length !== 2) {
        throw new Error(`render|evidence|count|${arm.artifact_id}`);
      }
      const evidenceViewports = new Set(arm.render_evidence.map((entry) => entry.viewport_id));
      if (evidenceViewports.size !== 2 || !VIEWPORT_IDS.every((viewport) => evidenceViewports.has(viewport))) {
        throw new Error(`render|evidence|viewport|${arm.artifact_id}`);
      }
      // Byte-preservation: every arm's bytes must pass the same reject-only
      // validator without mutation.
      validatePacketArtifact({
        bytes: Buffer.from(arm.artifact_bytes, "utf8"),
        validatorVersion: FROZEN_VALIDATOR_VERSION,
        validatorDigest: FROZEN_VALIDATOR_DIGEST
      });
    }
  }
}

function assertReturnShape(result) {
  const allowed = new Set(["packets", "anchor_packets", "anchor_metadata", "encrypted_map", "map_commitment", "packet_set_sha256"]);
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) {
      throw new Error(`return|field|forbidden|${key}`);
    }
  }
  for (const key of FORBIDDEN_RETURN_FIELDS) {
    if (key in result) throw new Error(`return|field|forbidden|${key}`);
  }
  if (!Array.isArray(result.packets) || result.packets.length !== 24) {
    throw new Error(`24|packet|count|actual|${Array.isArray(result.packets) ? result.packets.length : "n/a"}`);
  }
  if (!Array.isArray(result.anchor_packets) || result.anchor_packets.length !== 4) {
    throw new Error(`anchor|count|actual|${Array.isArray(result.anchor_packets) ? result.anchor_packets.length : "n/a"}`);
  }
  if (!result.packet_set_sha256 || result.packet_set_sha256.length !== 64) throw new Error("packet|set|sha256");
  if (!result.map_commitment || result.map_commitment.length !== 64) throw new Error("map|commitment|sha256");
  if (!result.encrypted_map) throw new Error("encrypted|map|required");
}

/**
 * buildBlindPackets({ protocol, registry, generations, renders, buildCapability })
 *
 * Returns:
 *   { packets, anchor_packets, anchor_metadata, encrypted_map,
 *     map_commitment, packet_set_sha256 }
 */
export function buildBlindPackets({ protocol, registry, generations, renders, buildCapability } = {}) {
  if (!buildCapability || typeof buildCapability.buildPackets !== "function") {
    throw new Error("capability|build|required");
  }
  ensureProtocol(protocol);
  ensureRegistry(registry);
  ensureGenerations({ protocol, registry, generations });
  ensureRenders({ protocol, registry, renders });
  const result = buildCapability.buildPackets({ protocol, registry, generations, renders });
  assertReturnShape(result);
  assertClosedAllowlist(result.packets);
  assertClosedAllowlist(result.anchor_packets);
  return result;
}
