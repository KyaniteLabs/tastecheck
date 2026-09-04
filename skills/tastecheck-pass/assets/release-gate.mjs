#!/usr/bin/env node
/**
 * Dependency-free TasteCheck release gate.
 *
 * `gate-audit.js` is intentionally a pasteable cold-load heuristic. This file
 * is the release authority: it consumes one evidence ledger, binds every row
 * to the current artifact and closed catalog, and can emit SHIP only when all
 * required evidence and provenance checks pass.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const CATALOG_PATH = "skills/tastecheck-pass/assets/check-catalog.json";
export const SCHEMA_VERSION = 1;
export const KIND = "tastecheck-release-gate";
export const SKILL = "tastecheck-pass";
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const RUNTIME_KEYS = ["name", "version"];
const INSPECTOR_KEYS = ["name", "role", "method"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashJson(value) {
  return sha256(JSON.stringify(canonical(value)));
}

export function hashEvidence(evidence) {
  if (!isObject(evidence)) return null;
  const { sha256: ignored, ...unsigned } = evidence;
  return hashJson(unsigned);
}

export function hashProvenance(provenance) {
  if (!isObject(provenance)) return null;
  const { sha256: ignored, ...unsigned } = provenance;
  return hashJson(unsigned);
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value, allowed) {
  return isObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function normalizeRelative(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveRepoPath(root, value) {
  if (!nonempty(value) || value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)) throw new Error("path must be a non-empty repo-relative path");
  const normalized = normalizeRelative(value);
  if (normalized.split("/").includes("..")) throw new Error("path may not contain '..'");
  const absolute = resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error("path escapes repository root");
  if (!existsSync(absolute)) throw new Error(`path does not exist: ${normalized}`);
  const real = realpathSync(absolute);
  const realRoot = realpathSync(root);
  if (real !== realRoot && !real.startsWith(`${realRoot}${sep}`)) throw new Error("path resolves outside repository root");
  return { absolute, relative: normalized };
}

function hashDirectory(absolute) {
  const entries = [];
  let bytes = 0;
  const walk = (current, prefix) => {
    for (const name of readdirSync(current).sort()) {
      const child = join(current, name);
      const childPrefix = prefix ? `${prefix}/${name}` : name;
      const info = lstatSync(child);
      if (info.isSymbolicLink()) throw new Error(`directory artifact contains a symbolic link: ${childPrefix}`);
      if (info.isDirectory()) walk(child, childPrefix);
      else if (info.isFile()) {
        const data = readFileSync(child);
        entries.push({ path: childPrefix, bytes: data.length, sha256: sha256(data) });
        bytes += data.length;
      } else throw new Error(`directory artifact contains unsupported entry: ${childPrefix}`);
    }
  };
  walk(absolute, "");
  if (entries.length === 0) throw new Error("directory artifact must contain at least one file");
  return { bytes, sha256: hashJson(entries) };
}

export function inspectArtifact(artifact, { root = ROOT } = {}) {
  const errors = [];
  if (!isObject(artifact)) return { artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false }, errors: ["artifact must be an object"] };
  const type = ["file", "directory", "url"].includes(artifact.type) ? artifact.type : "file";
  if (type !== artifact.type) errors.push("artifact.type must be file, directory, or url");
  const allowedArtifactKeys = type === "url" ? ["type", "url", "sha256"] : ["type", "path", "sha256", "bytes"];
  if (!hasOnlyKeys(artifact, allowedArtifactKeys)) errors.push("artifact contains unknown fields");
  if (type === "url") {
    if (!/^https:\/\//.test(artifact.url ?? "")) errors.push("url artifact must use https");
    if (!SHA256.test(artifact.sha256 ?? "")) errors.push("url artifact requires a lowercase SHA-256");
    return {
      artifact: { type: "url", identity: artifact.url || "unresolved", sha256: artifact.sha256 || "0".repeat(64), bytes: 0, hash_verified: false },
      errors: [...errors, "url artifact content was not independently fetched or hashed; release remains HOLD"],
    };
  }
  let target;
  try { target = resolveRepoPath(root, artifact.path); }
  catch (error) { return { artifact: { type, identity: `unresolved:${artifact.path || "artifact"}`, sha256: "0".repeat(64), bytes: 0, hash_verified: false }, errors: [...errors, error.message] }; }
  let measured;
  try {
    const info = statSync(target.absolute);
    if (type === "file") {
      if (!info.isFile()) throw new Error("file artifact path is not a regular file");
      const data = readFileSync(target.absolute);
      if (data.length === 0) throw new Error("file artifact must not be empty");
      measured = { bytes: data.length, sha256: sha256(data) };
    } else {
      if (!info.isDirectory()) throw new Error("directory artifact path is not a directory");
      measured = hashDirectory(target.absolute);
    }
  } catch (error) {
    return { artifact: { type, identity: `${type}:${target.relative}`, sha256: "0".repeat(64), bytes: 0, hash_verified: false }, errors: [...errors, error.message] };
  }
  if (artifact.sha256 !== undefined && artifact.sha256 !== measured.sha256) errors.push(`declared artifact SHA-256 does not match ${target.relative}`);
  if (artifact.bytes !== undefined && artifact.bytes !== measured.bytes) errors.push(`declared artifact byte count does not match ${target.relative}`);
  return {
    artifact: { type, identity: `${type}:${target.relative}`, ...measured, hash_verified: errors.length === 0 },
    errors,
  };
}

function catalogErrors(catalog) {
  const errors = [];
  if (!isObject(catalog)) return ["check catalog must be an object"];
  if (catalog.schema_version !== SCHEMA_VERSION) errors.push("check catalog schema_version must be 1");
  if (catalog.kind !== "tastecheck-release-check-catalog") errors.push("check catalog kind is invalid");
  if (!nonempty(catalog.catalog_id)) errors.push("check catalog catalog_id is required");
  if (!Array.isArray(catalog.checks) || catalog.checks.length === 0) return [...errors, "check catalog checks must be a non-empty array"];
  const ids = new Set();
  for (const [index, check] of catalog.checks.entries()) {
    const label = `catalog check ${index + 1}`;
    if (!isObject(check)) { errors.push(`${label} must be an object`); continue; }
    for (const key of ["id", "label", "stage", "required", "applicability", "na_policy", "manual_inspector_required"]) if (!(key in check)) errors.push(`${label} missing ${key}`);
    if (!nonempty(check.id)) errors.push(`${label}.id must be non-empty`);
    if (ids.has(check.id)) errors.push(`${label}: duplicate check ID ${check.id}`);
    ids.add(check.id);
    if (!nonempty(check.label)) errors.push(`${label}.label must be non-empty`);
    if (typeof check.required !== "boolean") errors.push(`${label}.required must be boolean`);
    if (!isObject(check.applicability) || !["always", "optional_subject"].includes(check.applicability.kind)) errors.push(`${label}.applicability is invalid`);
    if (check.applicability?.kind === "optional_subject" && !nonempty(check.applicability.subject)) errors.push(`${label}.applicability.subject is required`);
    if (!["forbidden", "subject_absence"].includes(check.na_policy)) errors.push(`${label}.na_policy is invalid`);
    if (check.required && check.na_policy !== "forbidden") errors.push(`${label}: required checks must forbid n/a`);
    if (!check.required && check.na_policy !== "subject_absence") errors.push(`${label}: optional checks require subject-absence n/a policy`);
    if (typeof check.manual_inspector_required !== "boolean") errors.push(`${label}.manual_inspector_required must be boolean`);
  }
  return errors;
}

export function loadCheckCatalog({ root = ROOT } = {}) {
  const path = join(root, CATALOG_PATH);
  const raw = readFileSync(path, "utf8");
  const catalog = JSON.parse(raw);
  return { catalog, raw, sha256: sha256(raw), errors: catalogErrors(catalog) };
}

function validateRuntime(value, label, errors) {
  if (!isObject(value)) { errors.push(`${label} must be an object`); return; }
  if (!hasOnlyKeys(value, RUNTIME_KEYS)) errors.push(`${label} contains unknown fields`);
  for (const key of RUNTIME_KEYS) if (!nonempty(value[key])) errors.push(`${label}.${key} must be non-empty`);
}

function validateInspector(value, label, errors) {
  if (!isObject(value)) { errors.push(`${label} is required for manual evidence`); return; }
  if (!hasOnlyKeys(value, INSPECTOR_KEYS)) errors.push(`${label} contains unknown fields`);
  for (const key of INSPECTOR_KEYS) if (!nonempty(value[key])) errors.push(`${label}.${key} must be non-empty`);
}

function validateEvidence(evidence, check, status, errors) {
  if (!isObject(evidence)) { errors.push("evidence must be an object"); return; }
  if (!hasOnlyKeys(evidence, ["mode", "summary", "details", "subject", "subject_absent", "sha256"])) errors.push("evidence contains unknown fields");
  if (!["automated", "manual"].includes(evidence.mode)) errors.push("evidence.mode must be automated or manual");
  if (!nonempty(evidence.summary)) errors.push("evidence.summary must be non-empty");
  if (!("details" in evidence) || evidence.details === undefined || evidence.details === null) errors.push("evidence.details is required");
  if (!SHA256.test(evidence.sha256 ?? "")) errors.push("evidence.sha256 must be a lowercase SHA-256");
  else if (hashEvidence(evidence) !== evidence.sha256) errors.push("evidence.sha256 does not match canonical evidence content");
  if (check.manual_inspector_required && evidence.mode !== "manual") errors.push(`${check.id}: manual evidence is required`);
  if (status === "n/a") {
    if (check.na_policy !== "subject_absence") errors.push(`${check.id}: required row may not use n/a`);
    if (evidence.subject_absent !== true) errors.push(`${check.id}: n/a requires subject_absent=true evidence`);
    if (evidence.subject !== check.applicability.subject) errors.push(`${check.id}: n/a subject must be ${check.applicability.subject}`);
  }
}

function validateProvenance(provenance, artifact, evidence, check, errors) {
  if (!isObject(provenance)) { errors.push("provenance must be an object"); return; }
  if (!hasOnlyKeys(provenance, ["artifact_identity", "artifact_sha256", "captured_at", "tool", "browser", "inspector", "sha256"])) errors.push("provenance contains unknown fields");
  if (provenance.artifact_identity !== artifact.identity) errors.push(`${check.id}: provenance artifact identity does not match measured artifact`);
  if (provenance.artifact_sha256 !== artifact.sha256) errors.push(`${check.id}: provenance artifact SHA-256 does not match measured artifact`);
  if (!ISO_DATE.test(provenance.captured_at ?? "") || Number.isNaN(Date.parse(provenance.captured_at))) errors.push(`${check.id}: captured_at must be an ISO-8601 UTC timestamp`);
  validateRuntime(provenance.tool, `${check.id}: provenance.tool`, errors);
  validateRuntime(provenance.browser, `${check.id}: provenance.browser`, errors);
  if (evidence?.mode === "manual") validateInspector(provenance.inspector, `${check.id}: provenance.inspector`, errors);
  else if (provenance.inspector !== null) errors.push(`${check.id}: automated evidence must set provenance.inspector to null`);
  if (!SHA256.test(provenance.sha256 ?? "")) errors.push(`${check.id}: provenance.sha256 must be a lowercase SHA-256`);
  else if (hashProvenance(provenance) !== provenance.sha256) errors.push(`${check.id}: provenance.sha256 does not match canonical provenance content`);
}

function missingRow(check) {
  return {
    skill: SKILL,
    check_id: check.id,
    status: "fail",
    reason: "No ledger row was supplied for this closed check.",
    remediation: "Run this check on the real artifact and attach complete evidence and provenance.",
    evidence: null,
    provenance: null,
    validation_errors: ["missing ledger row"],
  };
}

function normalizeRow(row, check, artifact) {
  const errors = [];
  if (!isObject(row)) return missingRow(check);
  if (!hasOnlyKeys(row, ["skill", "check_id", "status", "reason", "remediation", "evidence", "provenance"])) errors.push(`${check.id}: ledger row contains unknown fields`);
  const status = ["pass", "fail", "n/a"].includes(row.status) ? row.status : "fail";
  if (row.skill !== SKILL) errors.push(`${check.id}: skill must be ${SKILL}`);
  if (!["pass", "fail", "n/a"].includes(row.status)) errors.push("status must be pass, fail, or n/a");
  for (const field of ["reason", "remediation"]) if (!nonempty(row[field])) errors.push(`${field} must be non-empty`);
  validateEvidence(row.evidence, check, status, errors);
  validateProvenance(row.provenance, artifact, row.evidence, check, errors);
  return { skill: SKILL, check_id: check.id, status, reason: row.reason || "Invalid ledger row.", remediation: row.remediation || "Repair the ledger row and rerun the release gate.", evidence: row.evidence ?? null, provenance: row.provenance ?? null, validation_errors: errors };
}

function structuralInputErrors(input) {
  const errors = [];
  if (!isObject(input)) return ["ledger input must be an object"];
  if (!hasOnlyKeys(input, ["schema_version", "catalog", "artifact", "rows"])) errors.push("ledger input contains unknown fields");
  if (input.schema_version !== SCHEMA_VERSION) errors.push("ledger schema_version must be 1");
  if (!isObject(input.artifact)) errors.push("ledger artifact is required");
  if (!Array.isArray(input.rows)) errors.push("ledger rows must be an array");
  if (input.catalog !== undefined && (!isObject(input.catalog) || !hasOnlyKeys(input.catalog, ["path", "sha256"]))) errors.push("ledger catalog must contain only path and sha256");
  return errors;
}

export function evaluateReleaseGate(input, { root = ROOT } = {}) {
  const errors = structuralInputErrors(input);
  let loaded;
  try { loaded = loadCheckCatalog({ root }); }
  catch (error) {
    return {
      schema_version: SCHEMA_VERSION, kind: KIND,
      catalog: { path: CATALOG_PATH, sha256: "0".repeat(64), check_ids: [] },
      artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false },
      rows: [], verdict: "HOLD", release_eligible: false, blockers: ["catalog"],
      validation: { input_valid: false, catalog_complete: false, artifact_hash_verified: false, evidence_hashes_verified: false, provenance_hashes_verified: false, errors: [`cannot load check catalog: ${error.message}`] },
    };
  }
  errors.push(...loaded.errors.map((error) => `catalog: ${error}`));
  if (isObject(input?.catalog)) {
    if (input.catalog.path !== CATALOG_PATH) errors.push(`catalog path must be ${CATALOG_PATH}`);
    if (input.catalog.sha256 !== loaded.sha256) errors.push("input catalog SHA-256 does not match the canonical catalog");
  }
  const inspected = inspectArtifact(input?.artifact, { root });
  errors.push(...inspected.errors.map((error) => `artifact: ${error}`));
  const checks = loaded.catalog.checks;
  const checkIds = checks.map((check) => check.id);
  const known = new Map(checks.map((check) => [check.id, check]));
  const supplied = Array.isArray(input?.rows) ? input.rows : [];
  const grouped = new Map();
  for (const row of supplied) {
    const id = row?.check_id;
    if (!known.has(id)) { errors.push(`unknown check ID: ${id ?? "<missing>"}`); continue; }
    const list = grouped.get(id) || [];
    list.push(row);
    grouped.set(id, list);
  }
  const rows = checks.map((check) => {
    const candidates = grouped.get(check.id) || [];
    if (candidates.length === 0) {
      errors.push(`${check.id}: missing ledger row`);
      return missingRow(check);
    }
    const normalized = normalizeRow(candidates[0], check, inspected.artifact);
    if (candidates.length > 1) {
      normalized.validation_errors.push(`duplicate ledger rows: ${candidates.length}`);
      errors.push(`${check.id}: duplicate ledger rows`);
    }
    if (normalized.validation_errors.length) errors.push(...normalized.validation_errors.map((error) => `${check.id}: ${error}`));
    return normalized;
  });
  const evidenceHashesVerified = rows.every((row) => row.evidence && hashEvidence(row.evidence) === row.evidence.sha256);
  const provenanceHashesVerified = rows.every((row) => row.provenance && hashProvenance(row.provenance) === row.provenance.sha256 && row.provenance.artifact_identity === inspected.artifact.identity && row.provenance.artifact_sha256 === inspected.artifact.sha256);
  const catalogComplete = loaded.errors.length === 0 && new Set(checkIds).size === checkIds.length && rows.length === checkIds.length;
  const blockers = rows.filter((row) => {
    const check = known.get(row.check_id);
    const validOptionalNa = row.status === "n/a" && check?.required === false && row.validation_errors.length === 0;
    return !validOptionalNa && (row.status !== "pass" || row.validation_errors.length > 0);
  }).map((row) => row.check_id);
  if (!inspected.artifact.hash_verified) blockers.push("artifact");
  if (errors.some((error) => error.startsWith("unknown check ID") || error.startsWith("catalog:") || error.startsWith("catalog path") || error.startsWith("input catalog"))) blockers.push("catalog");
  const uniqueBlockers = [...new Set(blockers)];
  const validation = {
    input_valid: errors.length === 0,
    catalog_complete: catalogComplete,
    artifact_hash_verified: inspected.artifact.hash_verified,
    evidence_hashes_verified: evidenceHashesVerified,
    provenance_hashes_verified: provenanceHashesVerified,
    errors: [...new Set(errors)],
  };
  const releaseEligible = validation.input_valid && catalogComplete && inspected.artifact.hash_verified && evidenceHashesVerified && provenanceHashesVerified && uniqueBlockers.length === 0;
  return {
    schema_version: SCHEMA_VERSION,
    kind: KIND,
    catalog: { path: CATALOG_PATH, sha256: loaded.sha256, check_ids: checkIds },
    artifact: inspected.artifact,
    rows,
    verdict: releaseEligible ? "SHIP" : "HOLD",
    release_eligible: releaseEligible,
    blockers: uniqueBlockers,
    validation,
  };
}

function readInput(root, inputPath) {
  const target = resolveRepoPath(root, inputPath);
  return JSON.parse(readFileSync(target.absolute, "utf8"));
}

function resolveOutputPath(root, value) {
  if (!nonempty(value) || value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)) throw new Error("output path must be a non-empty repo-relative path");
  const normalized = normalizeRelative(value);
  if (normalized.split("/").includes("..")) throw new Error("output path may not contain '..'");
  const absolute = resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error("output path escapes repository root");
  return absolute;
}

function cli() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outIndex = args.indexOf("--out");
  const positional = args.filter((arg, index) => !arg.startsWith("--") && index !== inputIndex + 1 && index !== outIndex + 1);
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : positional[0];
  const outPath = outIndex >= 0 ? args[outIndex + 1] : positional[1];
  if (!inputPath || inputPath.startsWith("--")) {
    console.error("Usage: node skills/tastecheck-pass/assets/release-gate.mjs --input <repo-relative-ledger.json> [--out <repo-relative-report.json>]");
    process.exitCode = 2;
    return;
  }
  let result;
  try { result = evaluateReleaseGate(readInput(ROOT, inputPath), { root: ROOT }); }
  catch (error) {
    result = { schema_version: SCHEMA_VERSION, kind: KIND, catalog: { path: CATALOG_PATH, sha256: "0".repeat(64), check_ids: [] }, artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false }, rows: [], verdict: "HOLD", release_eligible: false, blockers: ["input"], validation: { input_valid: false, catalog_complete: false, artifact_hash_verified: false, evidence_hashes_verified: false, provenance_hashes_verified: false, errors: [error.message] } };
  }
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath && !outPath.startsWith("--")) {
    writeFileSync(resolveOutputPath(ROOT, outPath), output);
  } else process.stdout.write(output);
  if (result.verdict !== "SHIP") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
