import {
  createCipheriv, createHash, createHmac, randomBytes
} from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { canonicalJson, canonicalPacket, hmacTuple, lenPrefix } from "./contracts.mjs";
import { validatePacketArtifact, FROZEN_VALIDATOR_VERSION, FROZEN_VALIDATOR_DIGEST } from "./packet-policy.mjs";
import { authorityPublicKey } from "./authority-signature.mjs";

const commitment = (_domain, seed) => createHash("sha256").update(authorityPublicKey(seed)).digest("hex");

const VIEWPORT_IDS = ["mobile", "desktop"];

function loadSeed(privateStateRef) {
  let stats;
  try { stats = statSync(privateStateRef.secretPath); } catch { throw new Error("randomization secret missing"); }
  if ((stats.mode & 0o777) !== 0o600) throw new Error("randomization secret permission must be 0600");
  const seed = readFileSync(privateStateRef.secretPath);
  if (seed.length !== 32 || commitment(privateStateRef.domain, seed) !== privateStateRef.commitment_sha256) {
    seed.fill(0);
    throw new Error("randomization commitment replacement detected");
  }
  return seed;
}

function canonicalPacketForDigest(packet) {
  // Delegates to the shared canonicalPacket in contracts.mjs so the adapter
  // and judges.mjs never diverge. Kept as a thin local alias for clarity at
  // the call site; the dependency boundary is respected (contracts.mjs is a
  // shared low-level module, not judges.mjs).
  return canonicalPacket(packet);
}

const COMMON_RUBRIC = Object.freeze({
  dimensions: ["direction", "structure", "accessibility", "verbal", "integration"],
  scale: "1-5 integer; 5 strongest",
  hard_regressions: ["accessibility", "safety", "contract", "evidence-integrity", "task-completion"],
  preference: "slot-0 | slot-1 | tie | abstain",
  basis: "machine-only; no human calibration"
});

function groupInputs(generations, renders) {
  // Index generations and renders by (scenario_id, generation_seed).
  const genIndex = new Map();
  for (const gen of generations) {
    const key = `${gen.scenario_id}|${gen.generation_seed}`;
    if (!genIndex.has(key)) genIndex.set(key, new Map());
    genIndex.get(key).set(gen.arm, gen);
  }
  const renderIndex = new Map();
  for (const render of renders) {
    const key = `${render.scenario_id}|${render.generation_seed}`;
    if (!renderIndex.has(key)) renderIndex.set(key, new Map());
    const armMap = renderIndex.get(key);
    if (!armMap.has(render.arm)) armMap.set(render.arm, new Map());
    armMap.get(render.arm).set(render.viewport_id, render);
  }
  return { genIndex, renderIndex };
}

function buildArmForSlot({ slot, scenarioId, seed, arms, renderMap, hmacSeed, brief }) {
  // Identify which real arm occupies this opaque_slot.
  const assignmentBit = hmacTuple(hmacSeed, "assignment", scenarioId, seed)[0] & 1;
  // opaque_slot(baseline) = assignmentBit; opaque_slot(candidate) = 1 - assignmentBit.
  // So slot contains baseline iff slot === assignmentBit.
  const realArm = slot === assignmentBit ? "baseline" : "candidate";
  const entry = arms.get(realArm);
  if (!entry) throw new Error(`generation missing for ${scenarioId}|${seed}|${realArm}`);
  const armRenders = renderMap.get(realArm);
  if (!armRenders) throw new Error(`renders missing for ${scenarioId}|${seed}|${realArm}`);
  const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes, "utf8");
  // Reject-only packet-policy validation. Throw on forbidden cue.
  validatePacketArtifact({
    bytes,
    validatorVersion: FROZEN_VALIDATOR_VERSION,
    validatorDigest: FROZEN_VALIDATOR_DIGEST
  });
  const artifactSha = createHash("sha256").update(bytes).digest("hex");
  const artifactId = hmacTuple(hmacSeed, "artifact", scenarioId, seed, slot);
  const labelId = hmacTuple(hmacSeed, "label", scenarioId, seed, slot);
  const renderEvidence = [];
  for (const viewport_id of VIEWPORT_IDS) {
    const render = armRenders.get(viewport_id);
    if (!render) throw new Error(`render missing for ${scenarioId}|${seed}|${realArm}|${viewport_id}`);
    renderEvidence.push({
      viewport_id,
      viewport_id_token: hmacTuple(hmacSeed, "viewport", scenarioId, seed, slot, viewport_id),
      evidence_id: createHash("sha256").update(`${artifactId}|${viewport_id}|evidence`).digest("hex"),
      artifact_sha256: artifactSha,
      screenshot_sha256: render.screenshot_sha256,
      dom_sha256: render.dom_sha256,
      style_sha256: render.style_sha256
    });
  }
  return {
    opaque_slot: slot,
    artifact_id: artifactId,
    label_id: labelId,
    artifact_bytes: bytes.toString("utf8"),
    artifact_sha256: artifactSha,
    brief,
    render_evidence: renderEvidence
  };
}

function buildAnchorPackets({ seed, registry, anchorMetadata }) {
  // Anchors follow the same HMAC contract as production but use anchor_id in
  // place of scenario_id and never use real production outputs.
  const packets = [];
  const metas = [];
  for (const anchor of registry.anchors) {
    const anchorId = anchor.anchor_id;
    const seedStr = "anchor";
    const packetId = createHmac("sha256", seed).update(lenPrefix(Buffer.from("packet", "utf8"))).update(lenPrefix(Buffer.from(anchorId, "utf8"))).update(lenPrefix(Buffer.from(seedStr, "utf8"))).digest("hex");
    const unitId = createHmac("sha256", seed).update(lenPrefix(Buffer.from("unit", "utf8"))).update(lenPrefix(Buffer.from(anchorId, "utf8"))).update(lenPrefix(Buffer.from(seedStr, "utf8"))).digest("hex");
    const scenarioIdToken = createHmac("sha256", seed).update(lenPrefix(Buffer.from("scenario", "utf8"))).update(lenPrefix(Buffer.from(anchorId, "utf8"))).update(lenPrefix(Buffer.from(seedStr, "utf8"))).digest("hex");
    const brief = `Machine anchor ${anchorId} for ${anchor.kind} consistency qualification.`;
    const labelOrder = anchor.label_order;
    const identical = anchor.kind.startsWith("identical");
    const slots = identical ? [0, 1] : [0, 1];
    const armContents = identical
      ? [anchor.artifact_content, anchor.artifact_content]
      : [anchor.broken, anchor.complete];
    const arms = slots.map((slot) => {
      const contentIndex = labelOrder[slot];
      const content = armContents[contentIndex];
      const bytes = Buffer.from(content, "utf8");
      validatePacketArtifact({
        bytes,
        validatorVersion: FROZEN_VALIDATOR_VERSION,
        validatorDigest: FROZEN_VALIDATOR_DIGEST
      });
      const artifactSha = createHash("sha256").update(bytes).digest("hex");
      const artifactId = createHmac("sha256", seed)
        .update(lenPrefix(Buffer.from("artifact", "utf8")))
        .update(lenPrefix(Buffer.from(anchorId, "utf8")))
        .update(lenPrefix(Buffer.from(seedStr, "utf8")))
        .update(lenPrefix(Buffer.from([slot])))
        .digest("hex");
      const labelId = createHmac("sha256", seed)
        .update(lenPrefix(Buffer.from("label", "utf8")))
        .update(lenPrefix(Buffer.from(anchorId, "utf8")))
        .update(lenPrefix(Buffer.from(seedStr, "utf8")))
        .update(lenPrefix(Buffer.from([slot])))
        .digest("hex");
      const renderEvidence = VIEWPORT_IDS.map((viewport_id) => ({
        viewport_id,
        viewport_id_token: createHmac("sha256", seed)
          .update(lenPrefix(Buffer.from("viewport", "utf8")))
          .update(lenPrefix(Buffer.from(anchorId, "utf8")))
          .update(lenPrefix(Buffer.from(seedStr, "utf8")))
          .update(lenPrefix(Buffer.from([slot])))
          .update(lenPrefix(Buffer.from(viewport_id, "utf8")))
          .digest("hex"),
        evidence_id: createHash("sha256").update(`${artifactId}|${viewport_id}|evidence`).digest("hex"),
        artifact_sha256: artifactSha,
        screenshot_sha256: createHash("sha256").update(`${artifactSha}|${viewport_id}|screenshot`).digest("hex"),
        dom_sha256: createHash("sha256").update(`${artifactSha}|${viewport_id}|dom`).digest("hex"),
        style_sha256: createHash("sha256").update(`${artifactSha}|${viewport_id}|style`).digest("hex")
      }));
      return {
        opaque_slot: slot,
        artifact_id: artifactId,
        label_id: labelId,
        artifact_bytes: bytes.toString("utf8"),
        artifact_sha256: artifactSha,
        brief,
        render_evidence: renderEvidence
      };
    });
    packets.push({
      packet_id: packetId,
      unit_id: unitId,
      scenario_id_token: scenarioIdToken,
      arms,
      brief,
      rubric: COMMON_RUBRIC,
      viewport_ids: VIEWPORT_IDS
    });
    metas.push({
      packet_id: packetId,
      anchor_id: anchorId,
      kind: anchor.kind,
      expected: anchor.expected,
      label_order: labelOrder
    });
  }
  // Preserve the registry's hash-sorted anchor order so the metadata array is
  // deterministic.
  const orderById = new Map(metas.map((meta, index) => [meta.packet_id, index]));
  packets.sort((a, b) => orderById.get(a.packet_id) - orderById.get(b.packet_id));
  metas.sort((a, b) => orderById.get(a.packet_id) - orderById.get(b.packet_id));
  return { anchor_packets: packets, anchor_metadata: metas };
}

function buildFullPacketSet(privateStateRef, input) {
  const { protocol, registry, generations, renders } = input;
  if (!protocol || !registry || !Array.isArray(generations) || !Array.isArray(renders)) {
    throw new Error("buildPackets input missing required fields");
  }
  if (protocol.randomization_commitment_sha256 !== privateStateRef.commitment_sha256) {
    throw new Error("commitment|binding|protocol|randomization_commitment_sha256");
  }
  const seed = loadSeed(privateStateRef);
  let keyMaterial;
  try {
    keyMaterial = createHmac("sha256", seed).update("unmask-encryption-key-v1").digest();
    const { genIndex, renderIndex } = groupInputs(generations, renders);
    const packets = [];
    const mappings = [];
    for (const scenario of registry.scenarios) {
      for (const generationSeed of protocol.seeds) {
        const key = `${scenario.scenario_id}|${generationSeed}`;
        const arms = genIndex.get(key);
        if (!arms || arms.size !== 2) throw new Error(`generation incomplete for ${key}`);
        const renderMap = renderIndex.get(key);
        if (!renderMap) throw new Error(`renders missing for ${key}`);
        const packetId = hmacTuple(seed, "packet", scenario.scenario_id, generationSeed);
        const unitId = hmacTuple(seed, "unit", scenario.scenario_id, generationSeed);
        const scenarioToken = hmacTuple(seed, "scenario", scenario.scenario_id, generationSeed);
        const arm0 = buildArmForSlot({
          slot: 0,
          scenarioId: scenario.scenario_id,
          seed: generationSeed,
          arms,
          renderMap,
          hmacSeed: seed,
          brief: scenario.brief
        });
        const arm1 = buildArmForSlot({
          slot: 1,
          scenarioId: scenario.scenario_id,
          seed: generationSeed,
          arms,
          renderMap,
          hmacSeed: seed,
          brief: scenario.brief
        });
        const packet = {
          packet_id: packetId,
          unit_id: unitId,
          scenario_id_token: scenarioToken,
          arms: [arm0, arm1],
          brief: scenario.brief,
          rubric: COMMON_RUBRIC,
          viewport_ids: VIEWPORT_IDS
        };
        packets.push(packet);
        // Build unmask mappings: one entry per (unit, opaque_slot).
        const assignmentBit = hmacTuple(seed, "assignment", scenario.scenario_id, generationSeed)[0] & 1;
        for (const slot of [0, 1]) {
          const realArm = slot === assignmentBit ? "baseline" : "candidate";
          mappings.push({
            unit_id: unitId,
            opaque_slot: slot,
            arm: realArm,
            scenario_id: scenario.scenario_id,
            generation_seed: generationSeed
          });
        }
      }
    }
    packets.sort((a, b) => a.packet_id.localeCompare(b.packet_id));
    // Compute packet_set_sha256 per brief §3.1 line 154:
    //   SHA256(canonicalJson(sortBy(packets, packet_id).map(canonicalPacket)))
    const packetSetDigest = createHash("sha256")
      .update(canonicalJson(packets.map(canonicalPacketForDigest)))
      .digest("hex");
    const plaintextMap = { packet_set_sha256: packetSetDigest, mappings };
    const plaintext = Buffer.from(canonicalJson(plaintextMap), "utf8");
    const mapCommitment = createHash("sha256").update(plaintext).digest("hex");
    // Authenticated encryption (AES-256-GCM) with deterministic key + nonce.
    const nonce = createHmac("sha256", seed).update("unmask-encryption-nonce-v1").digest().subarray(0, 12);
    const aad = Buffer.from(packetSetDigest, "utf8");
    const cipher = createCipheriv("aes-256-gcm", keyMaterial, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = {
      algorithm: "aes-256-gcm",
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      tag: tag.toString("base64"),
      packet_set_sha256: packetSetDigest
    };
    const encrypted_map = Buffer.from(JSON.stringify(envelope), "utf8");
    const { anchor_packets, anchor_metadata } = buildAnchorPackets({ seed, registry });
    return {
      packets,
      anchor_packets,
      anchor_metadata,
      encrypted_map,
      map_commitment: mapCommitment,
      packet_set_sha256: packetSetDigest
    };
  } finally {
    seed.fill(0);
    if (keyMaterial) keyMaterial.fill(0);
  }
}

function buildDigestLegacy(privateStateRef, input) {
  let seed;
  try { seed = loadSeed(privateStateRef); } catch (error) { throw error; }
  try {
    return createHash("sha256").update(seed).update(canonicalJson(input ?? {})).digest("hex");
  } finally {
    seed.fill(0);
  }
}

export function createBuildAuthority(privateStateRef) {
  return Object.freeze({
    buildPackets(input) {
      if (input && typeof input === "object" && input.protocol && input.registry) {
        return buildFullPacketSet(privateStateRef, input);
      }
      return { packet_set_sha256: buildDigestLegacy(privateStateRef, input) };
    }
  });
}

// Exported for unit tests; not part of the public capability surface.
export const __internal = { hmacTuple, buildArmForSlot, commitment };
