/**
 * tools/evals/lib/w1-attempt-validator.mjs — canonical W1 attempt validator.
 *
 * Used by both validate-w1-outputs.mjs and run-w1-pilot.mjs.
 *
 * Enforces:
 *  - additionalProperties: false (schema whitelist)
 *  - All required field types and enum values
 *  - Packet binding: job_id, skill, scenario_id, run_type, executor, requested_seed,
 *    requested_temperature, observed_seed=null, observed_temperature=null,
 *    skill_version, skill_source_path, skill_source_sha256
 *  - Live skill source re-hash: compare to both packet.skill_source_sha256 and attempt value
 *  - raw_output_hash: always required; always recomputed and compared
 *  - assertions_result cardinality and text must match packet.assertions exactly
 *  - evidence_fields_present: all 5 keys must be present
 *  - external_source and external_source_lane: required
 *  - date_utc: preserved as-is; never synthesized here
 *
 * @module w1-attempt-validator
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// All properties allowed on an attempt file. Any extra key is rejected.
const ALLOWED_FIELDS = new Set([
  "schema_version",
  "job_id",
  "attempt_id",
  "executor",
  "requested_seed",
  "observed_seed",
  "requested_temperature",
  "observed_temperature",
  "skill_source_path",
  "skill_source_sha256",
  "status",
  "skill",
  "scenario_id",
  "run_type",
  "skill_version",
  "raw_output",
  "raw_output_hash",
  "assertions_result",
  "evidence_fields_present",
  "self_check_shape_observed",
  "error_detail",
  "external_source",
  "external_source_lane",
  "date_utc",
]);

// Fields required on every attempt regardless of status.
const REQUIRED_FIELDS = [
  "schema_version",
  "job_id",
  "attempt_id",
  "executor",
  "requested_seed",
  "observed_seed",
  "requested_temperature",
  "observed_temperature",
  "skill_source_path",
  "skill_source_sha256",
  "status",
  "skill",
  "scenario_id",
  "run_type",
  "skill_version",
  "raw_output",
  "raw_output_hash",
  "assertions_result",
  "evidence_fields_present",
  "external_source",
  "external_source_lane",
];

// ISO 8601 UTC datetime — seconds precision or sub-second variants.
const DATE_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

/**
 * Load a W1 job packet from disk given the repo root and job_id.
 * Returns null if the packet file is not found.
 *
 * @param {string} root - absolute path to repo root
 * @param {string} jobId - job identifier, e.g. "component-states-baseline-seed101"
 * @param {string|null} attemptId - resolves an immutable packet revision for a
 *   historical attempt before falling back to the active job packet
 * @returns {object|null}
 */
export function loadPacket(root, jobId, attemptId = null) {
  if (attemptId) {
    const revisionPath = join(root, ".omx/evidence/tastecheck-v1/raw/packet-revisions", `${attemptId}.json`);
    if (existsSync(revisionPath)) {
      try { return JSON.parse(readFileSync(revisionPath, "utf8")); }
      catch { return null; }
    }
  }
  const packetPath = join(root, "evals/w1/jobs", `${jobId}.json`);
  if (!existsSync(packetPath)) return null;
  try {
    return JSON.parse(readFileSync(packetPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Validate a single attempt object against its corresponding job packet.
 *
 * @param {object} attempt - parsed attempt JSON
 * @param {object} packet  - parsed job packet from evals/w1/jobs/<job_id>.json
 * @param {string} root    - absolute repo root path (for live skill re-hash)
 * @returns {string[]}     - array of error messages; empty means valid
 */
export function validateAttempt(attempt, packet, root) {
  const errors = [];

  // 1. additionalProperties: false
  for (const key of Object.keys(attempt)) {
    if (!ALLOWED_FIELDS.has(key)) {
      errors.push(`extra property not allowed: "${key}"`);
    }
  }

  // 2. Required fields present
  for (const field of REQUIRED_FIELDS) {
    if (!(field in attempt)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  // Stop here if too many fields are missing — subsequent checks would cascade.
  if (errors.length > 0 && errors.some((e) => e.startsWith("missing"))) {
    return errors;
  }

  // 3. Fixed-value type checks
  if (attempt.schema_version !== 1) {
    errors.push(`schema_version must be 1, got: ${attempt.schema_version}`);
  }
  if (attempt.executor !== "gpt-5.6-terra") {
    errors.push(`executor must be "gpt-5.6-terra", got: "${attempt.executor}"`);
  }
  if (attempt.observed_seed !== null) {
    errors.push(`observed_seed must be null (desktop threads do not expose seed controls), got: ${JSON.stringify(attempt.observed_seed)}`);
  }
  if (attempt.observed_temperature !== null) {
    errors.push(`observed_temperature must be null (desktop threads do not expose temperature controls), got: ${JSON.stringify(attempt.observed_temperature)}`);
  }
  if (!["baseline", "upgraded"].includes(attempt.run_type)) {
    errors.push(`invalid run_type: "${attempt.run_type}" (must be "baseline" or "upgraded")`);
  }
  if (!["complete", "error", "truncated"].includes(attempt.status)) {
    errors.push(`invalid status: "${attempt.status}" (must be "complete", "error", or "truncated")`);
  }
  if (![101, 202, 303].includes(attempt.requested_seed)) {
    errors.push(`invalid requested_seed: ${attempt.requested_seed} (must be 101, 202, or 303)`);
  }
  if (!["baseline", "current"].includes(attempt.skill_version)) {
    errors.push(`invalid skill_version: "${attempt.skill_version}" (must be "baseline" or "current")`);
  }
  if (typeof attempt.skill_source_path !== "string" || attempt.skill_source_path.trim() === "") {
    errors.push(`skill_source_path must be a non-empty string`);
  }
  if (typeof attempt.skill_source_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(attempt.skill_source_sha256)) {
    errors.push(`skill_source_sha256 must be a lowercase 64-hex-char SHA-256 digest`);
  }
  if (typeof attempt.external_source !== "boolean") {
    errors.push(`external_source must be a boolean, got: ${typeof attempt.external_source}`);
  }
  if (typeof attempt.external_source_lane !== "string" || attempt.external_source_lane.trim() === "") {
    errors.push(`external_source_lane must be a non-empty string`);
  }

  // 4. date_utc: validate format when present (never synthesize — caller must not add it)
  if ("date_utc" in attempt && attempt.date_utc !== null && attempt.date_utc !== undefined) {
    if (!DATE_UTC_RE.test(attempt.date_utc)) {
      errors.push(`date_utc must be an ISO 8601 UTC datetime (e.g. 2026-07-11T04:28:53Z), got: "${attempt.date_utc}"`);
    }
  }

  // 5. Packet binding — each field must equal the job packet value
  const bindings = [
    ["job_id", packet.job_id],
    ["skill", packet.skill],
    ["scenario_id", packet.scenario_id],
    ["run_type", packet.run_type],
    ["executor", packet.executor],
    ["requested_seed", packet.requested_seed],
    ["requested_temperature", packet.requested_temperature],
    ["skill_version", packet.skill_version],
    ["skill_source_path", packet.skill_source_path],
    ["skill_source_sha256", packet.skill_source_sha256],
  ];
  for (const [field, packetVal] of bindings) {
    if (attempt[field] !== packetVal) {
      errors.push(
        `packet binding mismatch on "${field}": attempt="${JSON.stringify(attempt[field])}", packet="${JSON.stringify(packetVal)}"`
      );
    }
  }

  // 6. Live source re-hash for active revisions. Archived attempt revisions
  // bind to their preserved source digest and cannot be substituted by live work.
  if (root && typeof attempt.skill_source_path === "string") {
    const absPath = join(root, attempt.skill_source_path);
    const archived = packet.source_revision?.validation === "archived";
    if (archived) {
      if (packet.source_revision?.sha256 !== attempt.skill_source_sha256) {
        errors.push("archived packet source revision does not bind to attempt skill_source_sha256");
      }
    } else if (!existsSync(absPath)) {
      errors.push(`skill_source_path not found on disk: ${attempt.skill_source_path}`);
    } else {
      const liveHash = sha256(readFileSync(absPath, "utf8"));
      if (attempt.skill_source_sha256 !== liveHash) {
        errors.push(
          `skill_source_sha256 does not match live file "${attempt.skill_source_path}": stored=${attempt.skill_source_sha256.slice(0, 12)}…, live=${liveHash.slice(0, 12)}…`
        );
      }
      if (packet.skill_source_sha256 !== liveHash) {
        errors.push(
          `packet skill_source_sha256 does not match live file "${attempt.skill_source_path}": packet=${packet.skill_source_sha256.slice(0, 12)}…, live=${liveHash.slice(0, 12)}…`
        );
      }
    }
  }

  // 7. raw_output_hash: always required; always recomputed
  if (typeof attempt.raw_output === "string") {
    const computed = sha256(attempt.raw_output);
    if (typeof attempt.raw_output_hash !== "string" || !/^[0-9a-f]{64}$/.test(attempt.raw_output_hash)) {
      errors.push(`raw_output_hash must be a 64-char lowercase hex SHA-256 digest`);
    } else if (attempt.raw_output_hash !== computed) {
      errors.push(
        `raw_output_hash mismatch: stored=${attempt.raw_output_hash.slice(0, 12)}…, computed=${computed.slice(0, 12)}…`
      );
    }
  }

  // 8. assertions_result: cardinality + text must match packet.assertions exactly
  if (Array.isArray(packet.assertions)) {
    if (!Array.isArray(attempt.assertions_result)) {
      errors.push(`assertions_result must be an array`);
    } else if (attempt.assertions_result.length !== packet.assertions.length) {
      errors.push(
        `assertions_result cardinality mismatch: attempt has ${attempt.assertions_result.length}, packet has ${packet.assertions.length}`
      );
    } else {
      for (let i = 0; i < packet.assertions.length; i++) {
        const entry = attempt.assertions_result[i];
        if (!entry || typeof entry !== "object") {
          errors.push(`assertions_result[${i}] is missing or not an object`);
        } else if (entry.assertion_text !== packet.assertions[i]) {
          errors.push(
            `assertions_result[${i}].assertion_text mismatch: attempt="${entry.assertion_text}", packet="${packet.assertions[i]}"`
          );
        }
      }
    }
  }

  // 9. evidence_fields_present: all 5 keys must be present
  const EF_KEYS = ["status", "reason", "remediation", "evidence", "provenance"];
  if (attempt.evidence_fields_present && typeof attempt.evidence_fields_present === "object") {
    for (const key of EF_KEYS) {
      if (!(key in attempt.evidence_fields_present)) {
        errors.push(`evidence_fields_present missing required key: "${key}"`);
      }
    }
  }

  return errors;
}
