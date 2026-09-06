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
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const VERIFIER_ROOT = ROOT;
export const CATALOG_PATH = "skills/tastecheck-pass/assets/check-catalog.json";
export const BROWSER_SUBJECT_MANIFEST_PATH = "skills/tastecheck-pass/assets/browser-subject-manifest.json";
export const REQUIRED_VIEWPORTS = Object.freeze([390, 768, 1280]);
export const SCHEMA_VERSION = 1;
export const KIND = "tastecheck-release-gate";
export const SKILL = "tastecheck-pass";
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const RUNTIME_KEYS = ["name", "version"];
const INSPECTOR_KEYS = ["name", "role", "method"];
const EXECUTION_KEYS = ["mode", "target_origin", "authenticated", "writes", "injection", "authorization"];
const AUTHORIZATION_KEYS = ["scope", "approved_by", "approved_at", "expires_at", "reason"];
const REVIEW_KEYS = ["check_id", "artifact_sha256", "evidence_sha256", "reviewer", "rubric", "independent", "decision", "disagreement", "adjudication", "reviewed_at", "sha256"];
const REVIEWER_KEYS = ["id", "type", "role", "method"];
const ADJUDICATION_KEYS = ["adjudicator", "rule", "decision", "resolved_at", "rationale"];
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_CAPTURE_TEXT = 4096;
const MAX_CAPTURE_DEPTH = 8;
const MAX_CAPTURE_KEYS = 64;
const MAX_CAPTURE_ITEMS = 64;

const DEFAULT_EXECUTION = Object.freeze({
  mode: "audit",
  target_origin: "repo",
  authenticated: false,
  writes: false,
  injection: false,
  authorization: null,
});

const REDACTION_PATTERNS = [
  ["ABSOLUTE_PATH", /\/(?:Users|home|root|tmp|var|etc|opt)\/[^\s"'<>]+/gi],
  ["WINDOWS_PATH", /\b[A-Za-z]:\\[^\s"'<>]+/g],
  ["HOME_DIRECTORY", /~\/[^\s"'<>]+/g],
  ["EMAIL_ADDRESS", /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g],
  ["SECRET_MATERIAL", /\b(?:token|secret|password|api[_-]?key|auth[_-]?token|bearer|sk-|pk-)\s*[=:]\s*[^\s"'<>]+/gi],
  ["DANGEROUS_URL", /\b(?:javascript|data|vbscript):[^\s"'<>]+/gi],
  ["MARKUP", /<\/?\s*(?:script|style|iframe|object|embed|form|svg|img|meta|link)\b[^>]*>/gi],
];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value) {
  let text = String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "�")
    .replace(/[\r\n\t\u2028\u2029]+/g, " ");
  for (const [code, pattern] of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, `[REDACTED:${code}]`);
  }
  // Do not let a captured string become markup or a line/control injection in
  // any downstream Markdown/HTML presentation. JSON escaping alone is not a
  // sufficient boundary for consumers that later interpolate strings.
  text = text.replace(/[<>]/g, (character) => character === "<" ? "‹" : "›");
  const truncationMarker = " [REDACTED:TRUNCATED]";
  if (text.length > MAX_CAPTURE_TEXT) text = `${text.slice(0, MAX_CAPTURE_TEXT - truncationMarker.length)}${truncationMarker}`;
  return text;
}

/**
 * Redact data captured from a DOM, spec, audit, or specialist report before it
 * is hashed or emitted. The result is JSON-shaped, bounded, and has no object
 * prototype, so hostile keys cannot pollute the verifier or alter its output.
 */
export function redactUntrusted(value, depth = 0) {
  if (typeof value === "string") return safeString(value);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : "[REDACTED:NON_FINITE_NUMBER]";
  if (depth >= MAX_CAPTURE_DEPTH) return "[REDACTED:DEPTH_LIMIT]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_CAPTURE_ITEMS).map((item) => redactUntrusted(item, depth + 1));
    if (value.length > MAX_CAPTURE_ITEMS) items.push("[REDACTED:ITEM_LIMIT]");
    return items;
  }
  if (isObject(value)) {
    const out = Object.create(null);
    const entries = Object.entries(value).slice(0, MAX_CAPTURE_KEYS);
    for (const [key, item] of entries) {
      const safeKey = DANGEROUS_KEYS.has(key) ? "[REDACTED:DANGEROUS_KEY]" : safeString(key);
      out[safeKey] = redactUntrusted(item, depth + 1);
    }
    if (Object.keys(value).length > MAX_CAPTURE_KEYS) out["[REDACTED:KEY_LIMIT]"] = true;
    return out;
  }
  return "[REDACTED:UNSUPPORTED_VALUE]";
}

export const redactCapturedText = safeString;

function normalizedExecution(execution) {
  if (execution === undefined) return { ...DEFAULT_EXECUTION };
  return redactUntrusted(execution);
}

function validateAuthorization(authorization, mode, errors, now) {
  if (!isObject(authorization)) {
    errors.push("authenticated or mutating target-origin execution requires explicit authorization");
    return;
  }
  if (!hasOnlyKeys(authorization, AUTHORIZATION_KEYS)) errors.push("execution authorization contains unknown fields");
  const expectedScope = mode === "audit" ? "target-origin-audit" : "target-origin-fix";
  if (authorization.scope !== expectedScope) errors.push(`execution authorization scope must be ${expectedScope}`);
  for (const key of ["approved_by", "reason"]) if (!nonempty(authorization[key])) errors.push(`execution authorization.${key} must be non-empty`);
  for (const key of ["approved_at", "expires_at"]) {
    if (!ISO_DATE.test(authorization[key] ?? "") || Number.isNaN(Date.parse(authorization[key]))) errors.push(`execution authorization.${key} must be an ISO-8601 UTC timestamp`);
  }
  if (ISO_DATE.test(authorization.expires_at ?? "") && Date.parse(authorization.expires_at) <= now) errors.push("execution authorization is expired");
}

/**
 * Validate the boundary before any target-origin audit is attempted. Audit is
 * always read-only and never injects a fixer. Authenticated or mutating
 * non-repository execution needs a separately scoped, time-bounded approval.
 */
export function assessExecutionPolicy(execution, { now = Date.now() } = {}) {
  const policy = normalizedExecution(execution);
  const errors = [];
  if (!isObject(policy)) return { policy: { ...DEFAULT_EXECUTION }, allowed: false, read_only: false, errors: ["execution policy must be an object"] };
  if (!hasOnlyKeys(policy, EXECUTION_KEYS)) errors.push("execution policy contains unknown fields");
  if (!["audit", "fix"].includes(policy.mode)) errors.push("execution.mode must be audit or fix");
  if (!["repo", "staging", "production"].includes(policy.target_origin)) errors.push("execution.target_origin must be repo, staging, or production");
  for (const key of ["authenticated", "writes", "injection"]) if (typeof policy[key] !== "boolean") errors.push(`execution.${key} must be boolean`);
  if (policy.mode === "audit" && policy.writes === true) errors.push("audit mode is read-only and may not write");
  if (policy.mode === "audit" && policy.injection === true) errors.push("audit mode may not inject scripts or fixes");
  if (policy.mode === "fix" && policy.writes !== true) errors.push("fix mode must explicitly declare writes=true");
  if (policy.target_origin === "repo" && policy.authenticated === true) errors.push("repository execution may not be marked authenticated");

  const protectedExecution = policy.target_origin !== "repo" && (policy.authenticated === true || policy.writes === true || policy.injection === true);
  if (protectedExecution) validateAuthorization(policy.authorization, policy.mode, errors, now);
  else if (policy.authorization !== null && policy.authorization !== undefined) errors.push("authorization is only valid for authenticated or mutating target-origin execution");

  const expectedScope = policy.mode === "audit" ? "target-origin-audit" : "target-origin-fix";
  if (policy.target_origin === "production" && policy.injection === true && policy.authorization?.scope !== expectedScope) errors.push("authenticated-production injection is denied without target-origin authorization");
  return {
    policy,
    allowed: errors.length === 0,
    read_only: policy.mode === "audit" && policy.writes === false && policy.injection === false,
    errors: [...new Set(errors)],
  };
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

function hashUnsigned(value) {
  if (!isObject(value)) return null;
  const { sha256: ignored, ...unsigned } = value;
  return hashJson(unsigned);
}

export function hashEvidence(evidence) {
  return hashUnsigned(evidence);
}

export function hashProvenance(provenance) {
  return hashUnsigned(provenance);
}

export function hashReview(review) {
  return hashUnsigned(review);
}

export function hashSubjectInventory(inventory) {
  return hashUnsigned(inventory);
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
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error("path escapes artifact root");
  if (!existsSync(absolute)) throw new Error(`path does not exist: ${normalized}`);
  const real = realpathSync(absolute);
  const realRoot = realpathSync(root);
  if (real !== realRoot && !real.startsWith(`${realRoot}${sep}`)) throw new Error("path resolves outside artifact root");
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

function stripUrlSuffix(value) {
  return value.split(/[?#]/, 1)[0];
}

function localDependencyReference(value) {
  const ref = stripUrlSuffix(String(value ?? "")).trim();
  if (!ref || ref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) return null;
  return ref.replace(/^\.\//, "");
}

function linkedReferences(text, extension) {
  const refs = [];
  if (extension === ".html" || extension === ".htm") {
    const tagPattern = /<(?:link|script)\b[^>]*(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    for (const match of text.matchAll(tagPattern)) {
      const ref = localDependencyReference(match[1]);
      if (ref) refs.push(ref);
    }
  }
  if (extension === ".css") {
    const cssPattern = /(?:url|@import)\s*\(?(?:\s*["']?)([^"')\s]+)["']?\s*\)?/gi;
    for (const match of text.matchAll(cssPattern)) {
      const ref = localDependencyReference(match[1]);
      if (ref) refs.push(ref);
    }
  }
  if (extension === ".js" || extension === ".mjs" || extension === ".ts") {
    const importPattern = /(?:from\s*|import\s*\(|import\s*)["']([^"']+)["']/g;
    for (const match of text.matchAll(importPattern)) {
      const ref = localDependencyReference(match[1]);
      if (ref) refs.push(ref);
    }
  }
  return refs;
}

function dependencyManifestWithoutHash(manifest) {
  if (!isObject(manifest)) return null;
  const { sha256: ignored, ...unsigned } = manifest;
  return unsigned;
}

export function hashDependencyManifest(manifest) {
  return hashJson(dependencyManifestWithoutHash(manifest));
}

function measureDependencyManifest(root, target, artifact) {
  const artifactRoot = realpathSync(root);
  const targetRealPath = realpathSync(target.absolute);
  const entry = artifact.type === "directory"
    ? artifact.dependency_manifest?.entry
    : relative(artifactRoot, targetRealPath).replaceAll("\\", "/");
  const errors = [];
  if (!nonempty(entry) || entry.startsWith("../") || entry === ".." || entry.startsWith("/")) {
    return { manifest: null, errors: ["dependency manifest requires an entry path within the artifact root"] };
  }
  let current;
  try { current = resolveRepoPath(artifactRoot, entry); }
  catch (error) { return { manifest: null, errors: [error.message] }; }
  const discovered = new Map();
  const visit = (relativePath) => {
    if (discovered.has(relativePath)) return;
    let resolvedPath;
    try { resolvedPath = resolveRepoPath(artifactRoot, relativePath); }
    catch (error) { errors.push(`dependency ${relativePath}: ${error.message}`); return; }
    const info = statSync(resolvedPath.absolute);
    if (!info.isFile()) { errors.push(`dependency ${relativePath} is not a regular file`); return; }
    const data = readFileSync(resolvedPath.absolute);
    const record = { path: normalizeRelative(relativePath), bytes: data.length, sha256: sha256(data) };
    discovered.set(record.path, record);
    const ext = extname(record.path).toLowerCase();
    for (const ref of linkedReferences(data.toString("utf8"), ext)) {
      const child = normalizeRelative(join(dirname(record.path), ref));
      visit(child);
    }
  };
  visit(current.relative);
  const assets = [...discovered.values()].sort((a, b) => a.path.localeCompare(b.path));
  const unsigned = { entry: current.relative, assets };
  return { manifest: { ...unsigned, sha256: hashDependencyManifest(unsigned) }, errors };
}

function rootIdentity(root) {
  try {
    const real = realpathSync(root);
    return { path: redactCapturedText(real), sha256: sha256(real) };
  } catch (error) {
    return { path: "unresolved", sha256: "0".repeat(64), error: error.message };
  }
}

function validateDependencyManifest(manifest, measured, errors) {
  if (!isObject(manifest)) { errors.push("artifact requires a dependency_manifest bound to the rendered entry"); return false; }
  if (!hasOnlyKeys(manifest, ["entry", "assets", "sha256"])) errors.push("artifact dependency_manifest contains unknown fields");
  if (!nonempty(manifest.entry)) errors.push("artifact dependency_manifest.entry must be non-empty");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) errors.push("artifact dependency_manifest.assets must be non-empty");
  if (!SHA256.test(manifest.sha256 ?? "")) errors.push("artifact dependency_manifest.sha256 must be a lowercase SHA-256");
  else if (hashDependencyManifest(manifest) !== manifest.sha256) errors.push("artifact dependency_manifest.sha256 does not match canonical manifest content");
  if (measured && JSON.stringify(canonical(manifest)) !== JSON.stringify(canonical(measured))) errors.push("artifact dependency manifest does not match the current entry and linked CSS/JS/font closure");
  return errors.length === 0;
}

export function inspectArtifact(artifact, { root = ROOT, artifactRoot = root } = {}) {
  const errors = [];
  if (!isObject(artifact)) return { artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false }, errors: ["artifact must be an object"] };
  const type = ["file", "directory", "url"].includes(artifact.type) ? artifact.type : "file";
  if (type !== artifact.type) errors.push("artifact.type must be file, directory, or url");
  const allowedArtifactKeys = type === "url" ? ["type", "url", "sha256"] : ["type", "path", "sha256", "bytes", "dependency_manifest"];
  if (!hasOnlyKeys(artifact, allowedArtifactKeys)) errors.push("artifact contains unknown fields");
  if (type === "url") {
    if (!/^https:\/\//.test(artifact.url ?? "")) errors.push("url artifact must use https");
    if (!SHA256.test(artifact.sha256 ?? "")) errors.push("url artifact requires a lowercase SHA-256");
    return {
      artifact: { type: "url", identity: artifact.url || "unresolved", sha256: artifact.sha256 || "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false },
      errors: [...errors, "url artifact content was not independently fetched or hashed; release remains HOLD"],
    };
  }
  let target;
  try { target = resolveRepoPath(artifactRoot, artifact.path); }
  catch (error) { return { artifact: { type, identity: `unresolved:${artifact.path || "artifact"}`, sha256: "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false }, errors: [...errors, error.message] }; }
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
    return { artifact: { type, identity: `${type}:${target.relative}`, sha256: "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false }, errors: [...errors, error.message] };
  }
  if (artifact.sha256 !== undefined && artifact.sha256 !== measured.sha256) errors.push(`declared artifact SHA-256 does not match ${target.relative}`);
  if (artifact.bytes !== undefined && artifact.bytes !== measured.bytes) errors.push(`declared artifact byte count does not match ${target.relative}`);
  const measuredManifest = measureDependencyManifest(artifactRoot, target, artifact);
  errors.push(...measuredManifest.errors);
  const dependencyManifestHashVerified = validateDependencyManifest(artifact.dependency_manifest, measuredManifest.manifest, errors);
  const manifest = measuredManifest.manifest && redactUntrusted(measuredManifest.manifest);
  return {
    artifact: {
      type,
      identity: `${type}:${target.relative}`,
      root_identity: rootIdentity(artifactRoot),
      ...measured,
      hash_verified: !errors.some((error) => error.includes("artifact SHA-256") || error.includes("byte count") || error.includes("regular file") || error.includes("directory artifact")),
      dependency_manifest: manifest,
      dependency_manifest_sha256: measuredManifest.manifest?.sha256 || "0".repeat(64),
      dependency_manifest_hash_verified: dependencyManifestHashVerified,
    },
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
    for (const key of ["id", "label", "stage", "required", "applicability", "na_policy", "manual_inspector_required", "judgment"]) if (!(key in check)) errors.push(`${label} missing ${key}`);
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
    if (!["deterministic", "subjective"].includes(check.judgment)) errors.push(`${label}.judgment must be deterministic or subjective`);
    if (!isObject(check.observation)) errors.push(`${label}.observation is required`);
    else {
      if (!["single", "browser", "control-state"].includes(check.observation.coverage)) errors.push(`${label}.observation.coverage is invalid`);
      if (!["boolean_bundle", "contrast"].includes(check.observation.type)) errors.push(`${label}.observation.type is invalid`);
      if (!Array.isArray(check.observation.fields) || check.observation.fields.length === 0 || check.observation.fields.some((field) => !nonempty(field))) errors.push(`${label}.observation.fields must be a non-empty list of names`);
      if (check.observation.type === "contrast" && JSON.stringify(check.observation.fields) !== JSON.stringify(["pairs"])) errors.push(`${label}.contrast observations must use the pairs field`);
    }
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

const INVENTORY_KEYS = ["frozen_at", "subjects", "coverage", "sha256"];
const INVENTORY_MEMBER_KEYS = ["id", "route", "state", "viewport", "control"];
const BROWSER_SUBJECTS_KEYS = ["manifest_path", "manifest_sha256", "required_viewports"];
const BROWSER_MANIFEST_KEYS = ["schema_version", "kind", "routes", "states"];

function validateViewportPolicy(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0 || value.some((viewport) => !Number.isInteger(viewport) || viewport < 1)) {
    errors.push(`${label} must be a non-empty list of positive integer viewports`);
    return false;
  }
  if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicate viewports`);
  if (JSON.stringify([...value].sort((a, b) => a - b)) !== JSON.stringify(value)) errors.push(`${label} must be sorted in ascending order`);
  return true;
}

function validateBrowserManifest(manifest, errors) {
  if (!isObject(manifest)) {
    errors.push("browser subject manifest must be an object");
    return false;
  }
  if (!hasOnlyKeys(manifest, BROWSER_MANIFEST_KEYS)) errors.push("browser subject manifest contains unknown fields");
  if (manifest.schema_version !== 1) errors.push("browser subject manifest schema_version must be 1");
  if (manifest.kind !== "tastecheck-browser-subject-manifest") errors.push("browser subject manifest kind is invalid");
  for (const key of ["routes", "states"]) {
    if (!Array.isArray(manifest[key]) || manifest[key].length === 0 || manifest[key].some((value) => !nonempty(value))) errors.push(`browser subject manifest.${key} must be a non-empty list of names`);
    else if (new Set(manifest[key]).size !== manifest[key].length) errors.push(`browser subject manifest.${key} must not contain duplicates`);
  }
  return errors.length === 0;
}

function browserSubjectId(route, state, viewport) {
  return `route:${route}|state:${state}|viewport:${viewport}`;
}

export function deriveBrowserSubjectUniverse(manifest, requiredViewports) {
  return manifest.routes.flatMap((route) => manifest.states.flatMap((state) => requiredViewports.map((viewport) => ({
    id: browserSubjectId(route, state, viewport), route, state, viewport,
  }))));
}

export function loadBrowserSubjectAuthority({ root = ROOT, manifestPath = BROWSER_SUBJECT_MANIFEST_PATH, requiredViewports = REQUIRED_VIEWPORTS } = {}) {
  const errors = [];
  const policyValid = validateViewportPolicy(requiredViewports, "required viewport policy", errors);
  let target;
  try { target = resolveRepoPath(resolve(root), manifestPath); }
  catch (error) {
    errors.push(`browser subject manifest: ${error.message}`);
    return { valid: false, manifest_path: manifestPath || "unresolved", manifest_sha256: "0".repeat(64), required_viewports: [...(Array.isArray(requiredViewports) ? requiredViewports : [])], routes: [], states: [], members: [], errors };
  }
  if (lstatSync(target.absolute).isSymbolicLink()) errors.push("browser subject manifest may not be a symbolic link");
  let raw;
  let manifest;
  try {
    raw = readFileSync(target.absolute, "utf8");
    manifest = JSON.parse(raw);
  } catch (error) {
    errors.push(`browser subject manifest could not be read: ${error.message}`);
  }
  const manifestValid = validateBrowserManifest(manifest, errors);
  const members = policyValid && manifestValid ? deriveBrowserSubjectUniverse(manifest, requiredViewports) : [];
  return {
    valid: errors.length === 0,
    manifest_path: target.relative,
    manifest_sha256: raw === undefined ? "0".repeat(64) : sha256(raw),
    required_viewports: Array.isArray(requiredViewports) ? [...requiredViewports] : [],
    routes: manifestValid ? [...manifest.routes] : [],
    states: manifestValid ? [...manifest.states] : [],
    members,
    errors,
  };
}

function validateBrowserSubjects(scope, authority, errors) {
  const before = errors.length;
  if (!isObject(scope)) {
    errors.push("browser_subjects is required and must be an object");
    return false;
  }
  if (!hasOnlyKeys(scope, BROWSER_SUBJECTS_KEYS)) errors.push("browser_subjects contains unknown fields");
  if (scope.manifest_path !== authority.manifest_path) errors.push("browser_subjects.manifest_path does not match the authoritative verifier manifest");
  if (!SHA256.test(scope.manifest_sha256 ?? "")) errors.push("browser_subjects.manifest_sha256 must be a lowercase SHA-256");
  else if (scope.manifest_sha256 !== authority.manifest_sha256) errors.push("browser_subjects.manifest_sha256 does not match the independently hashed manifest");
  validateViewportPolicy(scope.required_viewports, "browser_subjects.required_viewports", errors);
  if (JSON.stringify(scope.required_viewports) !== JSON.stringify(authority.required_viewports)) errors.push("browser_subjects.required_viewports does not match the authoritative viewport policy");
  return errors.length === before;
}

function validateSubjectInventory(inventory, checks, errors, browserAuthority) {
  if (!isObject(inventory)) {
    errors.push("subject_inventory is required and must be an object");
    return { valid: false, subjects: new Set(), coverage: new Map(), sha256: null };
  }
  if (!hasOnlyKeys(inventory, INVENTORY_KEYS)) errors.push("subject_inventory contains unknown fields");
  if (!ISO_DATE.test(inventory.frozen_at ?? "") || Number.isNaN(Date.parse(inventory.frozen_at))) errors.push("subject_inventory.frozen_at must be an ISO-8601 UTC timestamp");
  if (!Array.isArray(inventory.subjects) || inventory.subjects.some((subject) => !nonempty(subject))) errors.push("subject_inventory.subjects must be a list of non-empty subject names");
  if (!isObject(inventory.coverage)) errors.push("subject_inventory.coverage must be an object keyed by check ID");
  if (!SHA256.test(inventory.sha256 ?? "")) errors.push("subject_inventory.sha256 must be a lowercase SHA-256");
  else if (hashSubjectInventory(inventory) !== inventory.sha256) errors.push("subject_inventory.sha256 does not match canonical inventory content");
  const subjects = new Set(Array.isArray(inventory.subjects) ? inventory.subjects : []);
  const coverage = new Map();
  const known = new Map(checks.map((check) => [check.id, check]));
  if (isObject(inventory.coverage)) {
    for (const [id, members] of Object.entries(inventory.coverage)) {
      const check = known.get(id);
      if (!check) { errors.push(`subject_inventory contains unknown check ID ${redactCapturedText(id)}`); continue; }
      if (!Array.isArray(members)) { errors.push(`${id}: subject inventory coverage must be an array`); continue; }
      const seen = new Set();
      const normalized = [];
      for (const member of members) {
        if (!isObject(member) || !nonempty(member.id)) { errors.push(`${id}: every inventory member needs a non-empty id`); continue; }
        if (!hasOnlyKeys(member, INVENTORY_MEMBER_KEYS)) errors.push(`${id}: subject inventory member contains unknown fields`);
        if (seen.has(member.id)) errors.push(`${id}: duplicate subject inventory member ${redactCapturedText(member.id)}`);
        seen.add(member.id);
        if (check.observation.coverage === "browser") {
          if (!nonempty(member.route) || !nonempty(member.state) || !Number.isInteger(member.viewport) || member.viewport < 1) errors.push(`${id}: browser inventory members require route, state, and positive integer viewport`);
        }
        if (check.observation.coverage === "control-state" && (!nonempty(member.control) || !nonempty(member.state))) errors.push(`${id}: control-state inventory members require control and state`);
        normalized.push({ ...member });
      }
      coverage.set(id, normalized);
    }
  }
  for (const check of checks) {
    const members = coverage.get(check.id) || [];
    const subjectPresent = check.applicability.kind !== "optional_subject" || subjects.has(check.applicability.subject);
    if (check.applicability.kind === "optional_subject") {
      if (subjectPresent && members.length === 0) errors.push(`${check.id}: applicable subject ${check.applicability.subject} needs inventory members`);
      if (!subjectPresent && members.length > 0) errors.push(`${check.id}: absent subject ${check.applicability.subject} may not have inventory members`);
    } else if (members.length === 0) errors.push(`${check.id}: required subject inventory is empty`);

    if (check.observation.coverage === "browser") {
      const expected = check.applicability.kind === "optional_subject" && !subjectPresent ? [] : (browserAuthority?.members || []);
      const expectedByKey = new Map(expected.map((member) => [JSON.stringify(canonical(member)), member]));
      const actualByKey = new Map(members.map((member) => [JSON.stringify(canonical({ id: member.id, route: member.route, state: member.state, viewport: member.viewport })), member]));
      const missing = expected.filter((member) => !actualByKey.has(JSON.stringify(canonical(member))));
      const extra = members.filter((member) => !expectedByKey.has(JSON.stringify(canonical({ id: member.id, route: member.route, state: member.state, viewport: member.viewport }))));
      if (!browserAuthority?.valid) errors.push(`${check.id}: authoritative browser subject universe could not be derived`);
      else if (missing.length || extra.length || actualByKey.size !== expectedByKey.size) errors.push(`${check.id}: browser subject inventory must exactly match the authoritative route x state x viewport universe (missing ${missing.length}, extra ${extra.length})`);
    }
  }
  return { valid: errors.length === 0, subjects, coverage, sha256: inventory.sha256 };
}

function inventoryOutput(inventory, inventoryState) {
  if (!inventoryState || !isObject(inventory)) return null;
  return {
    frozen_at: inventory.frozen_at,
    subjects: [...inventoryState.subjects].sort(),
    coverage: Object.fromEntries([...inventoryState.coverage.entries()].map(([id, members]) => [id, members.map((member) => redactUntrusted(member))])),
    sha256: inventory.sha256 || "0".repeat(64),
  };
}

function validateReviewer(value, label, errors) {
  if (!isObject(value)) { errors.push(`${label} is required`); return; }
  if (!hasOnlyKeys(value, REVIEWER_KEYS)) errors.push(`${label} contains unknown fields`);
  if (!nonempty(value.id)) errors.push(`${label}.id must be non-empty`);
  if (value.type !== "human") errors.push(`${label}.type must be human`);
  if (!nonempty(value.role)) errors.push(`${label}.role must be non-empty`);
  if (!nonempty(value.method)) errors.push(`${label}.method must be non-empty`);
}

function validateAdjudication(value, status, reviewer, errors) {
  if (!isObject(value)) { errors.push("subjective disagreement requires adjudication"); return; }
  if (!hasOnlyKeys(value, ADJUDICATION_KEYS)) errors.push("adjudication contains unknown fields");
  validateReviewer(value.adjudicator, "adjudication.adjudicator", errors);
  if (value.adjudicator?.id === reviewer?.id) errors.push("adjudicator must be independent from the primary reviewer");
  if (!nonempty(value.rule)) errors.push("adjudication.rule must be non-empty");
  if (value.decision !== status) errors.push("adjudication.decision must match the row status");
  if (!ISO_DATE.test(value.resolved_at ?? "") || Number.isNaN(Date.parse(value.resolved_at))) errors.push("adjudication.resolved_at must be an ISO-8601 UTC timestamp");
  if (!nonempty(value.rationale)) errors.push("adjudication.rationale must be non-empty");
}

function validateReview(review, check, status, provenance, artifact, evidence, errors) {
  if (check.judgment !== "subjective") {
    if (review !== undefined && review !== null) errors.push(`${check.id}: deterministic rows may not carry reviewer judgment`);
    return;
  }
  if (!isObject(review)) { errors.push(`${check.id}: subjective rows require reviewer provenance`); return; }
  if (!hasOnlyKeys(review, REVIEW_KEYS)) errors.push(`${check.id}: review contains unknown fields`);
  if (review.check_id !== check.id) errors.push(`${check.id}: review.check_id must bind the review to this check`);
  if (review.artifact_sha256 !== artifact.sha256) errors.push(`${check.id}: review.artifact_sha256 must bind the measured artifact`);
  if (review.evidence_sha256 !== evidence?.sha256) errors.push(`${check.id}: review.evidence_sha256 must bind the complete evidence capture`);
  validateReviewer(review.reviewer, `${check.id}: review.reviewer`, errors);
  if (!isObject(review.rubric)) errors.push(`${check.id}: review.rubric is required`);
  else {
    if (!hasOnlyKeys(review.rubric, ["id", "version", "criteria"])) errors.push(`${check.id}: review.rubric contains unknown fields`);
    if (!nonempty(review.rubric.id)) errors.push(`${check.id}: review.rubric.id must be non-empty`);
    if (!nonempty(review.rubric.version)) errors.push(`${check.id}: review.rubric.version must be non-empty`);
    if (!("criteria" in review.rubric)) errors.push(`${check.id}: review.rubric.criteria is required`);
  }
  if (review.independent !== true) errors.push(`${check.id}: subjective review must be marked independent=true`);
  if (review.decision !== status) errors.push(`${check.id}: review.decision must match the row status`);
  if (typeof review.disagreement !== "boolean") errors.push(`${check.id}: review.disagreement must be boolean`);
  if (!ISO_DATE.test(review.reviewed_at ?? "") || Number.isNaN(Date.parse(review.reviewed_at))) errors.push(`${check.id}: review.reviewed_at must be an ISO-8601 UTC timestamp`);
  if (review.disagreement === true) validateAdjudication(review.adjudication, status, review.reviewer, errors);
  else if (review.adjudication !== null) errors.push(`${check.id}: adjudication must be null when reviewers do not disagree`);
  if (review.reviewer?.id && provenance?.tool?.name && review.reviewer.id.toLowerCase() === provenance.tool.name.toLowerCase()) errors.push(`${check.id}: reviewer must not self-certify as the execution tool`);
  if (!SHA256.test(review.sha256 ?? "")) errors.push(`${check.id}: review.sha256 must be a lowercase SHA-256`);
  else if (hashReview(review) !== review.sha256) errors.push(`${check.id}: review.sha256 does not match canonical review content`);
}

function observationItemStatus(item, check, label, errors) {
  if (!isObject(item)) { errors.push(`${label} must be an object`); return false; }
  const contract = check.observation;
  for (const field of contract.fields) if (!(field in item)) errors.push(`${label}.${field} is required measured observation`);
  if (contract.type === "contrast") {
    const pairs = item.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) { errors.push(`${label}.pairs must contain measured contrast pairs`); return false; }
    let passed = true;
    for (const [index, pair] of pairs.entries()) {
      const pairLabel = `${label}.pairs[${index}]`;
      if (!isObject(pair)) { errors.push(`${pairLabel} must be an object`); passed = false; continue; }
      if (!nonempty(pair.kind) || !["body", "ui", "large"].includes(pair.kind)) errors.push(`${pairLabel}.kind must be body, ui, or large`);
      if (!Number.isFinite(pair.ratio) || pair.ratio < 0) { errors.push(`${pairLabel}.ratio must be a non-negative measured number`); passed = false; continue; }
      const minimum = pair.kind === "body" ? 4.5 : 3;
      if (pair.ratio < minimum) passed = false;
    }
    return passed;
  }
  let passed = true;
  for (const field of contract.fields) {
    if (typeof item[field] !== "boolean") { errors.push(`${label}.${field} must be a boolean measured observation`); passed = false; }
    else if (item[field] !== true) passed = false;
  }
  return passed;
}

function deriveObservationStatus(evidence, check, inventoryState, errors) {
  if (!isObject(evidence) || !isObject(evidence.details)) { errors.push(`${check.id}: evidence.details must contain observations`); return null; }
  const observations = evidence.details.observations;
  if (!Array.isArray(observations)) { errors.push(`${check.id}: evidence.details.observations must be an array of check-specific measured observations`); return null; }
  const expected = inventoryState?.coverage.get(check.id) || [];
  if (evidence.subject_absent === true) {
    if (expected.length > 0) errors.push(`${check.id}: subject_absent is contradictory because the frozen inventory contains applicable members`);
    if (observations.length > 0) errors.push(`${check.id}: absent subjects may not carry passing observations`);
    return expected.length === 0 ? "n/a" : null;
  }
  if (expected.length === 0) { errors.push(`${check.id}: no applicable inventory member was frozen for this non-n/a row`); return null; }
  const expectedIds = new Set(expected.map((member) => member.id));
  const seen = new Set();
  let allPassed = true;
  for (const [index, observation] of observations.entries()) {
    const label = `${check.id}: observation ${index + 1}`;
    if (!isObject(observation) || !nonempty(observation.subject_id)) { errors.push(`${label} requires subject_id`); allPassed = false; continue; }
    if (!expectedIds.has(observation.subject_id)) { errors.push(`${check.id}: observation targets unknown subject ${redactCapturedText(observation.subject_id)}`); allPassed = false; continue; }
    if (seen.has(observation.subject_id)) { errors.push(`${check.id}: duplicate observation for subject ${redactCapturedText(observation.subject_id)}`); allPassed = false; continue; }
    seen.add(observation.subject_id);
    if (!observationItemStatus(observation, check, label, errors)) allPassed = false;
  }
  for (const member of expected) if (!seen.has(member.id)) { errors.push(`${check.id}: missing observation for inventory member ${redactCapturedText(member.id)}`); allPassed = false; }
  if (seen.size !== expected.length) allPassed = false;
  return allPassed ? "pass" : "fail";
}

function hasLossyCapture(value, depth = 0) {
  if (typeof value === "string") return value.length > MAX_CAPTURE_TEXT || /\[REDACTED:(?:TRUNCATED|ITEM_LIMIT|KEY_LIMIT|DEPTH_LIMIT|UNSUPPORTED_VALUE)\]/.test(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") return false;
  if (depth >= MAX_CAPTURE_DEPTH) return true;
  if (Array.isArray(value)) return value.length > MAX_CAPTURE_ITEMS || value.some((item) => hasLossyCapture(item, depth + 1));
  if (isObject(value)) return Object.keys(value).length > MAX_CAPTURE_KEYS || Object.values(value).some((item) => hasLossyCapture(item, depth + 1));
  return true;
}

function validateEvidence(evidence, check, status, inventoryState, errors) {
  if (!isObject(evidence)) { errors.push("evidence must be an object"); return { derivedStatus: null, hashVerified: false }; }
  if (!hasOnlyKeys(evidence, ["mode", "summary", "details", "subject", "subject_absent", "sha256"])) errors.push("evidence contains unknown fields");
  if (!["automated", "manual"].includes(evidence.mode)) errors.push("evidence.mode must be automated or manual");
  if (!nonempty(evidence.summary)) errors.push("evidence.summary must be non-empty");
  if (!("details" in evidence) || evidence.details === undefined || evidence.details === null) errors.push("evidence.details is required");
  const lossyCapture = hasLossyCapture(evidence);
  if (lossyCapture) errors.push(`${check.id}: evidence contains a truncation marker or exceeds complete-capture limits; rerun with the complete capture`);
  if (!SHA256.test(evidence.sha256 ?? "")) errors.push("evidence.sha256 must be a lowercase SHA-256");
  const hashVerified = SHA256.test(evidence.sha256 ?? "") && hashEvidence(evidence) === evidence.sha256;
  if (SHA256.test(evidence.sha256 ?? "") && !hashVerified) errors.push("evidence.sha256 does not match canonical complete evidence content");
  if (check.manual_inspector_required && evidence.mode !== "manual") errors.push(`${check.id}: manual evidence is required`);
  if (status === "n/a") {
    if (check.na_policy !== "subject_absence") errors.push(`${check.id}: required row may not use n/a`);
    if (evidence.subject_absent !== true) errors.push(`${check.id}: n/a requires subject_absent=true evidence`);
    if (evidence.subject !== check.applicability.subject) errors.push(`${check.id}: n/a subject must be ${check.applicability.subject}`);
  }
  const derivedStatus = deriveObservationStatus(evidence, check, inventoryState, errors);
  if (derivedStatus && derivedStatus !== status) errors.push(`${check.id}: declared status ${status} contradicts measured observations deriving ${derivedStatus}`);
  return { derivedStatus, hashVerified: hashVerified && !lossyCapture };
}

function validateProvenance(provenance, artifact, evidence, inventory, check, errors) {
  if (!isObject(provenance)) { errors.push("provenance must be an object"); return; }
  if (!hasOnlyKeys(provenance, ["artifact_identity", "artifact_sha256", "dependency_manifest_sha256", "subject_inventory_sha256", "captured_at", "tool", "browser", "inspector", "sha256"])) errors.push("provenance contains unknown fields");
  if (provenance.artifact_identity !== artifact.identity) errors.push(`${check.id}: provenance artifact identity does not match measured artifact`);
  if (provenance.artifact_sha256 !== artifact.sha256) errors.push(`${check.id}: provenance artifact SHA-256 does not match measured artifact`);
  if (provenance.dependency_manifest_sha256 !== artifact.dependency_manifest_sha256) errors.push(`${check.id}: provenance dependency manifest SHA-256 does not match measured closure`);
  if (provenance.subject_inventory_sha256 !== inventory?.sha256) errors.push(`${check.id}: provenance subject inventory SHA-256 does not match the frozen ledger inventory`);
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
    review: null,
    validation_errors: ["missing ledger row"],
  };
}

function normalizeRow(row, check, artifact, inventoryState) {
  const errors = [];
  if (!isObject(row)) return missingRow(check);
  if (!hasOnlyKeys(row, ["skill", "check_id", "status", "reason", "remediation", "evidence", "provenance", "review"])) errors.push(`${check.id}: ledger row contains unknown fields`);
  const status = ["pass", "fail", "n/a"].includes(row.status) ? row.status : "fail";
  const rawEvidence = row.evidence;
  const safeEvidence = row.evidence === null || row.evidence === undefined ? row.evidence : redactUntrusted(row.evidence);
  const safeProvenance = row.provenance === null || row.provenance === undefined ? row.provenance : redactUntrusted(row.provenance);
  const safeReview = row.review === null || row.review === undefined ? row.review : redactUntrusted(row.review);
  if (row.skill !== SKILL) errors.push(`${check.id}: skill must be ${SKILL}`);
  if (!["pass", "fail", "n/a"].includes(row.status)) errors.push("status must be pass, fail, or n/a");
  for (const field of ["reason", "remediation"]) if (!nonempty(row[field])) errors.push(`${field} must be non-empty`);
  const evidenceValidation = validateEvidence(rawEvidence, check, status, inventoryState, errors);
  validateProvenance(safeProvenance, artifact, safeEvidence, inventoryState, check, errors);
  validateReview(safeReview, check, status, safeProvenance, artifact, safeEvidence, errors);
  const output = { skill: SKILL, check_id: check.id, status, reason: redactCapturedText(row.reason || "Invalid ledger row."), remediation: redactCapturedText(row.remediation || "Repair the ledger row and rerun the release gate."), evidence: safeEvidence ?? null, provenance: safeProvenance ?? null, review: safeReview ?? null, validation_errors: errors };
  Object.defineProperty(output, "_evidence_hash_verified", { value: evidenceValidation.hashVerified, enumerable: false });
  return output;
}

function structuralInputErrors(input) {
  const errors = [];
  if (!isObject(input)) return ["ledger input must be an object"];
  if (!hasOnlyKeys(input, ["schema_version", "catalog", "artifact", "execution", "browser_subjects", "subject_inventory", "rows"])) errors.push("ledger input contains unknown fields");
  if (input.schema_version !== SCHEMA_VERSION) errors.push("ledger schema_version must be 1");
  if (!isObject(input.artifact)) errors.push("ledger artifact is required");
  if (!isObject(input.browser_subjects)) errors.push("ledger browser_subjects is required");
  if (!isObject(input.subject_inventory)) errors.push("ledger subject_inventory is required");
  if (!Array.isArray(input.rows)) errors.push("ledger rows must be an array");
  if (input.catalog !== undefined && (!isObject(input.catalog) || !hasOnlyKeys(input.catalog, ["path", "sha256"]))) errors.push("ledger catalog must contain only path and sha256");
  return errors;
}

export function evaluateReleaseGate(input, options = {}) {
  const legacyRoot = options.root;
  const verifierRoot = resolve(options.verifierRoot ?? legacyRoot ?? ROOT);
  const artifactRoot = resolve(options.artifactRoot ?? legacyRoot ?? verifierRoot);
  const errors = structuralInputErrors(input);
  const execution = assessExecutionPolicy(input?.execution);
  errors.push(...execution.errors.map((error) => `execution: ${error}`));
  const browserAuthority = loadBrowserSubjectAuthority({
    root: verifierRoot,
    manifestPath: options.browserManifestPath ?? BROWSER_SUBJECT_MANIFEST_PATH,
    requiredViewports: options.requiredViewports ?? REQUIRED_VIEWPORTS,
  });
  errors.push(...browserAuthority.errors);
  let loaded;
  try { loaded = loadCheckCatalog({ root: verifierRoot }); }
  catch (error) {
    return {
      schema_version: SCHEMA_VERSION, kind: KIND,
      catalog: { path: CATALOG_PATH, sha256: "0".repeat(64), check_ids: [] },
      roots: { verifier: rootIdentity(verifierRoot), artifact: rootIdentity(artifactRoot) },
      browser_subjects: null,
      subject_inventory: null,
      artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false },
      execution: execution.policy,
      rows: [], verdict: "HOLD", release_eligible: false, blockers: ["catalog", ...(execution.allowed ? [] : ["execution"])],
      validation: { input_valid: false, execution_policy_valid: execution.allowed, browser_subjects_valid: false, catalog_complete: false, subject_inventory_valid: false, subject_coverage_complete: false, artifact_hash_verified: false, artifact_dependency_manifest_verified: false, evidence_hashes_verified: false, provenance_hashes_verified: false, errors: [`cannot load check catalog: ${error.message}`, ...browserAuthority.errors, ...execution.errors.map((item) => `execution: ${item}`)] },
    };
  }
  errors.push(...loaded.errors.map((error) => `catalog: ${error}`));
  if (isObject(input?.catalog)) {
    if (input.catalog.path !== CATALOG_PATH) errors.push(`catalog path must be ${CATALOG_PATH}`);
    if (input.catalog.sha256 !== loaded.sha256) errors.push("input catalog SHA-256 does not match the canonical catalog");
  }
  const checks = loaded.catalog.checks;
  const browserSubjectsValid = validateBrowserSubjects(input?.browser_subjects, browserAuthority, errors);
  const inventoryState = validateSubjectInventory(input?.subject_inventory, checks, errors, browserAuthority);
  const inspected = inspectArtifact(input?.artifact, { artifactRoot });
  errors.push(...inspected.errors.map((error) => `artifact: ${error}`));
  const checkIds = checks.map((check) => check.id);
  const known = new Map(checks.map((check) => [check.id, check]));
  const supplied = Array.isArray(input?.rows) ? input.rows : [];
  const grouped = new Map();
  for (const row of supplied) {
    const id = row?.check_id;
    if (!known.has(id)) { errors.push(`unknown check ID: ${redactCapturedText(id ?? "<missing>")}`); continue; }
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
    const normalized = normalizeRow(candidates[0], check, inspected.artifact, inventoryState);
    if (candidates.length > 1) {
      normalized.validation_errors.push(`duplicate ledger rows: ${candidates.length}`);
      errors.push(`${check.id}: duplicate ledger rows`);
    }
    if (normalized.validation_errors.length) errors.push(...normalized.validation_errors.map((error) => `${check.id}: ${error}`));
    return normalized;
  });
  const evidenceHashesVerified = rows.every((row) => row._evidence_hash_verified === true);
  const provenanceHashesVerified = rows.every((row) => row.provenance && hashProvenance(row.provenance) === row.provenance.sha256 && row.provenance.artifact_identity === inspected.artifact.identity && row.provenance.artifact_sha256 === inspected.artifact.sha256 && row.provenance.dependency_manifest_sha256 === inspected.artifact.dependency_manifest_sha256 && row.provenance.subject_inventory_sha256 === inventoryState.sha256);
  const catalogComplete = loaded.errors.length === 0 && new Set(checkIds).size === checkIds.length && rows.length === checkIds.length;
  const subjectCoverageComplete = inventoryState.valid && rows.every((row) => !row.validation_errors.some((error) => /subject inventory|inventory member|observations|subject_id|applicable subject/i.test(error)));
  const blockers = rows.filter((row) => {
    const check = known.get(row.check_id);
    const validOptionalNa = row.status === "n/a" && check?.required === false && row.validation_errors.length === 0;
    return !validOptionalNa && (row.status !== "pass" || row.validation_errors.length > 0);
  }).map((row) => row.check_id);
  if (!inspected.artifact.hash_verified) blockers.push("artifact");
  if (!inspected.artifact.dependency_manifest_hash_verified) blockers.push("artifact-dependencies");
  if (!inventoryState.valid || !subjectCoverageComplete) blockers.push("subject-inventory");
  if (errors.some((error) => error.startsWith("unknown check ID") || error.startsWith("catalog:") || error.startsWith("catalog path") || error.startsWith("input catalog"))) blockers.push("catalog");
  if (!execution.allowed) blockers.push("execution");
  if (!browserSubjectsValid || !browserAuthority.valid) blockers.push("browser-subjects");
  const uniqueBlockers = [...new Set(blockers)];
  const validation = {
    input_valid: errors.length === 0,
    execution_policy_valid: execution.allowed,
    browser_subjects_valid: browserSubjectsValid && browserAuthority.valid,
    catalog_complete: catalogComplete,
    subject_inventory_valid: inventoryState.valid,
    subject_coverage_complete: subjectCoverageComplete,
    artifact_hash_verified: inspected.artifact.hash_verified,
    artifact_dependency_manifest_verified: inspected.artifact.dependency_manifest_hash_verified,
    evidence_hashes_verified: evidenceHashesVerified,
    provenance_hashes_verified: provenanceHashesVerified,
    errors: [...new Set(errors)],
  };
  const artifactDependencyManifestVerified = inspected.artifact.dependency_manifest_hash_verified === true;
  const releaseEligible = validation.input_valid && execution.allowed && validation.browser_subjects_valid && catalogComplete && inventoryState.valid && subjectCoverageComplete && inspected.artifact.hash_verified && artifactDependencyManifestVerified && evidenceHashesVerified && provenanceHashesVerified && uniqueBlockers.length === 0;
  return {
    schema_version: SCHEMA_VERSION,
    kind: KIND,
    roots: { verifier: rootIdentity(verifierRoot), artifact: rootIdentity(artifactRoot) },
    execution: execution.policy,
    browser_subjects: browserAuthority.valid ? {
      manifest_path: browserAuthority.manifest_path,
      manifest_sha256: browserAuthority.manifest_sha256,
      required_viewports: browserAuthority.required_viewports,
      routes: browserAuthority.routes,
      states: browserAuthority.states,
      members: browserAuthority.members.map((member) => redactUntrusted(member)),
    } : null,
    catalog: { path: CATALOG_PATH, sha256: loaded.sha256, check_ids: checkIds },
    subject_inventory: inventoryOutput(input?.subject_inventory, inventoryState),
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
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error("output path escapes verifier root");
  return absolute;
}

function cli() {
  const args = process.argv.slice(2);
  const valueFor = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const optionValueIndexes = new Set(["--input", "--out", "--verifier-root", "--artifact-root", "--browser-manifest", "--required-viewports"].flatMap((flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? [index + 1] : [];
  }));
  const positional = args.filter((arg, index) => !arg.startsWith("--") && !optionValueIndexes.has(index));
  const inputPath = valueFor("--input") || positional[0];
  const outPath = valueFor("--out") || positional[1];
  const verifierRoot = resolve(valueFor("--verifier-root") || ROOT);
  const artifactRoot = resolve(valueFor("--artifact-root") || verifierRoot);
  const browserManifestPath = valueFor("--browser-manifest") || BROWSER_SUBJECT_MANIFEST_PATH;
  const viewportArgument = valueFor("--required-viewports");
  const requiredViewports = viewportArgument === undefined ? REQUIRED_VIEWPORTS : viewportArgument.split(",").map((value) => Number(value.trim()));
  if (!inputPath || inputPath.startsWith("--")) {
    console.error("Usage: node skills/tastecheck-pass/assets/release-gate.mjs --input <verifier-relative-ledger.json> [--out <verifier-relative-report.json>] [--verifier-root <tastecheck-root>] [--artifact-root <consumer-root>] [--browser-manifest <verifier-relative-manifest.json>] [--required-viewports <width,...>]");
    process.exitCode = 2;
    return;
  }
  let result;
  try { result = evaluateReleaseGate(readInput(verifierRoot, inputPath), { verifierRoot, artifactRoot, browserManifestPath, requiredViewports }); }
  catch (error) {
    result = { schema_version: SCHEMA_VERSION, kind: KIND, roots: { verifier: rootIdentity(verifierRoot), artifact: rootIdentity(artifactRoot) }, browser_subjects: null, subject_inventory: null, catalog: { path: CATALOG_PATH, sha256: "0".repeat(64), check_ids: [] }, artifact: { type: "file", identity: "unresolved", sha256: "0".repeat(64), bytes: 0, hash_verified: false, dependency_manifest: null, dependency_manifest_sha256: "0".repeat(64), dependency_manifest_hash_verified: false }, execution: { ...DEFAULT_EXECUTION }, rows: [], verdict: "HOLD", release_eligible: false, blockers: ["input"], validation: { input_valid: false, execution_policy_valid: true, browser_subjects_valid: false, catalog_complete: false, subject_inventory_valid: false, subject_coverage_complete: false, artifact_hash_verified: false, artifact_dependency_manifest_verified: false, evidence_hashes_verified: false, provenance_hashes_verified: false, errors: [error.message] } };
  }
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath && !outPath.startsWith("--")) {
    writeFileSync(resolveOutputPath(verifierRoot, outPath), output);
  } else process.stdout.write(output);
  if (result.verdict !== "SHIP") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
