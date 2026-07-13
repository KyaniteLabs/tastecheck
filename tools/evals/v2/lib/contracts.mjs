import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const schemaNames = new Set([
  "protocol", "execution-manifest", "historical-authority", "synthesis-reservation",
  "generation-receipt", "randomization-commitment", "render-receipt", "unmask",
  "judge-result", "synthesis", "public-claim"
]);
const validators = new Map();

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * canonicalPacket(packet)
 *
 * Single source of truth for the canonical packet serialization used by both
 * the adapter (packet_set_sha256) and the judge validator (packet_sha256).
 * Placed in contracts.mjs so the adapter does not need to import judges.mjs
 * (dependency boundary). Omits arm_id (not part of the closed contract).
 *
 * Brief §3.1 line 154:
 *   packet_set_sha256 = SHA256(canonicalJson(sortBy(packets, packet_id).map(canonicalPacket)))
 */
export function canonicalPacket(packet) {
  const orderedArms = [...packet.arms].sort((a, b) => a.opaque_slot - b.opaque_slot).map((arm) => ({
    opaque_slot: arm.opaque_slot,
    artifact_id: arm.artifact_id,
    label_id: arm.label_id,
    artifact_bytes: arm.artifact_bytes,
    artifact_sha256: arm.artifact_sha256,
    brief: arm.brief,
    render_evidence: [...arm.render_evidence].sort((a, b) => a.viewport_id.localeCompare(b.viewport_id)).map((entry) => ({
      viewport_id: entry.viewport_id,
      viewport_id_token: entry.viewport_id_token,
      evidence_id: entry.evidence_id,
      artifact_sha256: entry.artifact_sha256,
      screenshot_sha256: entry.screenshot_sha256,
      dom_sha256: entry.dom_sha256,
      style_sha256: entry.style_sha256
    }))
  }));
  return canonicalJson({
    packet_id: packet.packet_id,
    unit_id: packet.unit_id,
    scenario_id_token: packet.scenario_id_token,
    arms: orderedArms,
    brief: packet.brief,
    rubric: packet.rubric,
    viewport_ids: packet.viewport_ids
  });
}

export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

export function loadSchema(name) {
  if (!schemaNames.has(name)) throw new TypeError(`unknown effectiveness-v2 contract: ${name}`);
  return JSON.parse(readFileSync(join(root, `contracts/v2/effectiveness/${name}.schema.json`), "utf8"));
}

export function validateContract(name, value) {
  let validate = validators.get(name);
  if (!validate) {
    validate = new Ajv({ allErrors: true, strict: true }).compile(loadSchema(name));
    validators.set(name, validate);
  }
  const valid = validate(value);
  return { valid: Boolean(valid), errors: validate.errors ? structuredClone(validate.errors) : [] };
}

function formatErrors(errors) {
  return errors.map((error) => {
    const detail = error.keyword === "additionalProperties"
      ? ` unknown field ${error.params.additionalProperty}`
      : "";
    return `${error.instancePath || "/"} ${error.message}${detail}`;
  }).join("; ");
}

function requireValid(name, value) {
  const result = validateContract(name, value);
  if (!result.valid) throw new TypeError(formatErrors(result.errors));
}

const frozenProtocol = {
  baseline_revision: "0f99603a603b0243345e7320a52702df67a2194e",
  candidate_revision: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2",
  strata: ["greenfield-direction", "brownfield-repair", "accessibility-safety", "verbal-copy", "orchestration-gates", "render-integration"],
  scenarios_per_stratum: 2,
  seeds: [101, 202],
  comparison_units: 24,
  generation_calls: 48,
  production_judgments: 96,
  anchor_judgments: 16,
  max_external_calls: 160,
  incremental_spend_cap_usd: 0,
  retry_policy: "none",
  exclusions: [],
  family_quorum: 2,
  judge_identities_per_family: 2,
  candidate_preference_floor: 18,
  scenario_majority_floor: 8,
  absolute_mean_floor: 4,
  dimension_floor: 3,
  human_calibration_claimed: false,
  randomization_commitment_sha256: "a".repeat(64),
  packet_validator_version: "effectiveness-v2-packet-policy-1",
  packet_validator_sha256: "b".repeat(64)
};

export function freezeProtocol(protocol) {
  requireValid("protocol", protocol);
  for (const [key, expected] of Object.entries(frozenProtocol)) {
    if (canonicalJson(protocol[key]) !== canonicalJson(expected)) {
      throw new TypeError(`${key} must equal ${canonicalJson(expected)}`);
    }
  }
  const frozen = structuredClone(protocol);
  return { protocol: frozen, canonical_sha256: sha256(frozen) };
}

const mutableAlias = /(?:^|[-_.])(latest|current|stable|default|preview|auto)(?:$|[-_.0-9])/i;
const exactVersion = /^(?=.{1,128}$)(?=.*\d)[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/;
function requireExactVersion(value, label) {
  if (mutableAlias.test(value) || !exactVersion.test(value)) throw new TypeError(`${label} must be an exact version`);
}

export function freezeExecutionManifest(manifest) {
  requireValid("execution-manifest", manifest);
  requireExactVersion(manifest.generator.model_version, "generator model");
  requireExactVersion(manifest.generator.runtime_version, "generator runtime");
  requireExactVersion(manifest.playwright_version, "Playwright");
  requireExactVersion(manifest.chromium_version, "Chromium");
  const providers = new Set();
  const lineages = new Set();
  const identities = new Set();
  for (const family of manifest.evaluator_families) {
    requireExactVersion(family.model_version, `${family.family_id} model`);
    requireExactVersion(family.runtime_version, `${family.family_id} runtime`);
    if (providers.has(family.provider)) throw new TypeError("evaluator families must have different providers");
    if (lineages.has(family.foundation_lineage)) throw new TypeError("evaluator families must have different foundation lineage");
    providers.add(family.provider);
    lineages.add(family.foundation_lineage);
    for (const identity of family.identities) {
      if (identities.has(identity)) throw new TypeError("judge identity tuples must be unique");
      identities.add(identity);
    }
  }
  const frozen = structuredClone(manifest);
  return { manifest: frozen, canonical_sha256: sha256(frozen) };
}
