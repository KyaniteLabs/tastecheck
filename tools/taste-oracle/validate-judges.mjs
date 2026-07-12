#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

import { assertPublicSafe, assertRepoRelativePath, hashCanonicalJson, validateEvidenceManifest, verifyArtifactHashes } from "./lib/evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARM_IDS = ["no-skill", "current", "frozen"];
const VIEWPORT_IDS = ["mobile", "desktop"];
const SHA256 = /^[0-9a-f]{64}$/;
const OPAQUE_LABEL = /^option-[a-z]+$/;
const OPAQUE_JUDGE_ID = /^judge-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_FAMILY_ID = /^family-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_OBSERVATION_ID = /^observation-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_PARTICIPANT_ID = /^participant-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DISCLOSURE_CONTEXTS = new Set(["arm", "variant", "candidate", "label"]);
const PACKET_KEYS = ["blinded_arms", "evidence_manifest", "kind", "notice", "packet_id", "release_evidence", "rubric", "scenario_id", "schema_version", "status", "submission_contract", "viewports"];
const UNMASK_KEYS = ["kind", "mapping", "notice", "packet_file_sha256", "packet_id", "packet_path", "scenario_id", "schema_version"];
const EVIDENCE_KEYS = ["canonical_sha256", "file_sha256", "path"];
const VIEWPORT_KEYS = ["height", "id", "width"];
const BLINDED_ARM_KEYS = ["artifacts", "opaque_label"];
const ARTIFACT_KEYS = ["dom_sha256", "screenshot_sha256", "style_sha256", "viewport_id"];
const RUBRIC_KEYS = ["dimensions", "instruction"];
const SUBMISSION_KEYS = ["allows_abstention", "allows_tie", "human_calibration_claimed", "minimum_distinct_evaluator_families", "minimum_distinct_judge_identities", "requires_all_artifacts", "requires_all_pairwise_comparisons", "requires_evidence_citations", "result_schema_path"];
const UNMASK_MAPPING_KEYS = ["arm_id", "opaque_label"];
const schema = JSON.parse(fs.readFileSync(path.join(root, "contracts/v2/taste-oracle-judge-result.schema.json"), "utf8"));
const validateResultSchema = new Ajv({ strict: true, allErrors: true }).compile(schema);

const issue = (at, code, message) => ({ path: at, code, message });
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function packetShapeValid(packet) {
  return exactKeys(packet, PACKET_KEYS)
    && exactKeys(packet.evidence_manifest, EVIDENCE_KEYS)
    && Array.isArray(packet.viewports) && packet.viewports.every((entry) => exactKeys(entry, VIEWPORT_KEYS))
    && Array.isArray(packet.blinded_arms) && packet.blinded_arms.every((arm) => (
      exactKeys(arm, BLINDED_ARM_KEYS)
      && Array.isArray(arm.artifacts)
      && arm.artifacts.every((artifact) => exactKeys(artifact, ARTIFACT_KEYS))
    ))
    && exactKeys(packet.rubric, RUBRIC_KEYS)
    && exactKeys(packet.submission_contract, SUBMISSION_KEYS);
}

function unmaskShapeValid(unmaskMap) {
  return exactKeys(unmaskMap, UNMASK_KEYS)
    && Array.isArray(unmaskMap.mapping)
    && unmaskMap.mapping.every((entry) => exactKeys(entry, UNMASK_MAPPING_KEYS));
}

function visitStrings(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) value.forEach((entry) => visitStrings(entry, visit));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => visitStrings(entry, visit));
}

export function normalizeDisclosureText(text) {
  return text.normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .replace(/[\p{Dash_Punctuation}\u2212]/gu, " ")
    .replace(/[\p{Punctuation}\p{Symbol}]+/gu, " ")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function identityLengthAt(tokens, index) {
  if (tokens[index] === "current" || tokens[index] === "frozen") return 1;
  return tokens[index] === "no" && tokens[index + 1] === "skill" ? 2 : 0;
}

function tokensDiscloseArm(tokens) {
  const exactIdentityLength = identityLengthAt(tokens, 0);
  if (exactIdentityLength > 0 && exactIdentityLength === tokens.length) return true;
  for (let index = 0; index < tokens.length; index += 1) {
    const identityLength = identityLengthAt(tokens, index);
    if (identityLength > 0 && DISCLOSURE_CONTEXTS.has(tokens[index + identityLength])) return true;
    if (DISCLOSURE_CONTEXTS.has(tokens[index]) && identityLengthAt(tokens, index + 1) > 0) return true;
  }
  return false;
}

function containsArmIdentity(value) {
  let leaked = false;
  visitStrings(value, (text) => {
    const normalized = normalizeDisclosureText(text);
    if (tokensDiscloseArm(normalized ? normalized.split(" ") : [])) leaked = true;
  });
  return leaked;
}

const unmaskByLabel = (unmaskMap) => new Map((unmaskMap?.mapping ?? []).map((entry) => [entry.opaque_label, entry.arm_id]));
const capturesByIdentity = (manifest) => new Map((manifest?.captures ?? []).map((entry) => [`${entry.arm_id}:${entry.viewport_id}`, entry]));
function artifactsByIdentity(packet) {
  const pairs = [];
  for (const arm of packet?.blinded_arms ?? []) for (const artifact of arm?.artifacts ?? []) pairs.push([`${arm.opaque_label}:${artifact.viewport_id}`, artifact]);
  return new Map(pairs);
}
function fixedViewports(value) {
  return Array.isArray(value) && value.length === 2
    && value[0]?.id === "mobile" && value[0]?.width === 390 && value[0]?.height === 844
    && value[1]?.id === "desktop" && value[1]?.width === 1280 && value[1]?.height === 900;
}
function sameViewportMatrix(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((viewport, index) => viewport?.id === right[index]?.id
      && viewport?.width === right[index]?.width && viewport?.height === right[index]?.height);
}

export function validatePendingJudgePacket({ packet, unmaskMap, manifest, artifactRoot }) {
  const errors = [];
  if (!packetShapeValid(packet)) errors.push(issue("$.packet", "packet_shape", "packet and nested values must contain only canonical fields"));
  if (artifactRoot) {
    for (const entry of validateEvidenceManifest(manifest)) errors.push(issue(`$.manifest${entry.path.slice(1)}`, `manifest_${entry.code}`, entry.message));
    for (const entry of verifyArtifactHashes(manifest, artifactRoot)) errors.push(issue(`$.manifest${entry.path.slice(1)}`, entry.code, entry.message));
  }
  if (!unmaskShapeValid(unmaskMap)) errors.push(issue("$.unmask_map", "unmask_shape", "unmask map and entries must contain only canonical fields"));
  if (packet?.schema_version !== 2 || packet?.kind !== "taste-oracle-judge-packet") errors.push(issue("$.packet", "packet_contract", "unsupported packet contract"));
  if (packet?.scenario_id !== "deslop-ui-hard-001" || manifest?.scenario_id !== packet?.scenario_id) errors.push(issue("$.scenario_id", "scenario_identity", "scenario identities must agree"));
  if (packet?.status !== "pending" || packet?.release_evidence !== false || packet?.notice !== "PENDING BLINDED EVALUATION — NOT RELEASE EVIDENCE") {
    errors.push(issue("$.packet.status", "pending_non_release", "canonical packet must remain pending and explicitly non-release"));
  }
  if (!fixedViewports(packet?.viewports) || !sameViewportMatrix(packet?.viewports, manifest?.viewports)) errors.push(issue("$.packet.viewports", "viewport_contract", "fixed packet and manifest viewports must agree"));
  if (unmaskMap?.schema_version !== 2 || unmaskMap?.kind !== "taste-oracle-judge-unmask-map" || unmaskMap?.packet_id !== packet?.packet_id || unmaskMap?.scenario_id !== packet?.scenario_id) errors.push(issue("$.unmask_map", "unmask_identity", "unmask map must identify the packet and scenario"));
  if (!SHA256.test(unmaskMap?.packet_file_sha256 ?? "")) errors.push(issue("$.unmask_map.packet_file_sha256", "sha256", "must be the lowercase SHA-256 of the exact packet file bytes"));
  try {
    assertRepoRelativePath(packet?.evidence_manifest?.path);
    assertRepoRelativePath(unmaskMap?.packet_path);
    assertPublicSafe(packet);
    assertPublicSafe(unmaskMap);
  } catch { errors.push(issue("$", "public_safe", "packet values must be public-safe and paths repo-relative")); }
  if (containsArmIdentity(packet)) errors.push(issue("$.packet", "arm_identity_leak", "packet must not reveal canonical arm identities"));
  if (packet?.evidence_manifest?.canonical_sha256 !== hashCanonicalJson(manifest)) errors.push(issue("$.packet.evidence_manifest.canonical_sha256", "manifest_hash_mismatch", "must match canonical manifest content"));
  if (!SHA256.test(packet?.evidence_manifest?.file_sha256 ?? "")) errors.push(issue("$.packet.evidence_manifest.file_sha256", "sha256", "must be a lowercase SHA-256"));

  const labels = (packet?.blinded_arms ?? []).map((entry) => entry?.opaque_label);
  const mapping = unmaskMap?.mapping;
  if (labels.length !== 3 || new Set(labels).size !== 3 || labels.some((label) => !OPAQUE_LABEL.test(label))) errors.push(issue("$.packet.blinded_arms", "opaque_label_contract", "three distinct opaque labels are required"));
  if (!Array.isArray(mapping) || mapping.length !== 3 || new Set(mapping.map((entry) => entry?.opaque_label)).size !== 3 || new Set(mapping.map((entry) => entry?.arm_id)).size !== 3
    || ARM_IDS.some((armId) => !mapping.some((entry) => entry?.arm_id === armId)) || labels.some((label) => !mapping.some((entry) => entry?.opaque_label === label))) {
    errors.push(issue("$.unmask_map.mapping", "unmask_coverage", "unmask map must biject opaque labels to all canonical arms"));
  }
  const artifacts = artifactsByIdentity(packet);
  const expected = new Set(labels.flatMap((label) => VIEWPORT_IDS.map((viewport) => `${label}:${viewport}`)));
  const exactArtifactArrays = Array.isArray(packet?.blinded_arms) && packet.blinded_arms.length === 3
    && packet.blinded_arms.every((arm) => Array.isArray(arm?.artifacts) && arm.artifacts.length === 2
      && new Set(arm.artifacts.map((artifact) => artifact?.viewport_id)).size === 2
      && VIEWPORT_IDS.every((viewportId) => arm.artifacts.some((artifact) => artifact?.viewport_id === viewportId)));
  if (!exactArtifactArrays || artifacts.size !== 6 || [...expected].some((key) => !artifacts.has(key))) errors.push(issue("$.packet.blinded_arms", "artifact_coverage", "exactly three unique blinded arms with exactly one artifact per viewport are required"));
  const unmask = unmaskByLabel(unmaskMap);
  const captures = capturesByIdentity(manifest);
  for (const [key, artifact] of artifacts) {
    const separator = key.lastIndexOf(":");
    const label = key.slice(0, separator);
    const viewport = key.slice(separator + 1);
    const capture = captures.get(`${unmask.get(label)}:${viewport}`);
    if (!capture || ["screenshot_sha256", "dom_sha256", "style_sha256"].some((field) => artifact?.[field] !== capture?.[field])) errors.push(issue(`$.packet.blinded_arms[${key}]`, "artifact_manifest_mismatch", "artifact hashes must match the unmasked manifest capture"));
  }
  const contract = packet?.submission_contract;
  if (contract?.minimum_distinct_evaluator_families !== 2 || contract?.minimum_distinct_judge_identities !== 2 || contract?.requires_all_artifacts !== true
    || contract?.requires_all_pairwise_comparisons !== true || contract?.requires_evidence_citations !== true || contract?.allows_tie !== true
    || contract?.allows_abstention !== true || contract?.human_calibration_claimed !== false
    || contract?.result_schema_path !== "contracts/v2/taste-oracle-judge-result.schema.json") errors.push(issue("$.packet.submission_contract", "submission_contract", "must declare the fail-closed non-human quorum contract and result schema"));
  return errors;
}

function expectedPairs(labels) {
  const pairs = [];
  for (let left = 0; left < labels.length; left += 1) for (let right = left + 1; right < labels.length; right += 1) pairs.push([labels[left], labels[right]].sort().join("|"));
  return pairs;
}

function validateResult(result, index, packet, artifacts) {
  const errors = [];
  const base = `$.results[${index}]`;
  if (containsArmIdentity(result)) errors.push(issue(base, "result_arm_identity_leak", "blinded result must not reveal canonical arm identities"));
  try { assertPublicSafe(result); } catch { errors.push(issue(base, "result_public_safe", "result must not contain email, local path, or secret-like data")); }
  if (!validateResultSchema(result)) errors.push(issue(base, "result_schema", validateResultSchema.errors.map((entry) => `${entry.instancePath || "/"} ${entry.message}`).join("; ")));
  if (result?.packet_id !== packet?.packet_id || result?.scenario_id !== packet?.scenario_id || result?.blinded !== true) errors.push(issue(base, "result_identity", "must identify the blinded packet and scenario"));
  if (!OPAQUE_JUDGE_ID.test(result?.judge_id ?? "") || !OPAQUE_FAMILY_ID.test(result?.evaluator_family ?? "")) errors.push(issue(base, "opaque_identifier", "judge and evaluator-family IDs must use opaque role-prefixed identifiers"));
  const labels = packet.blinded_arms.map((entry) => entry.opaque_label);
  const expectedArtifactKeys = new Set(labels.flatMap((label) => VIEWPORT_IDS.map((viewport) => `${label}:${viewport}`)));
  const seenArtifacts = new Set();
  for (const [position, assessment] of (result?.artifact_assessments ?? []).entries()) {
    const key = `${assessment?.opaque_label}:${assessment?.viewport_id}`;
    if (seenArtifacts.has(key)) errors.push(issue(`${base}.artifact_assessments[${position}]`, "duplicate_artifact_assessment", `duplicate ${key}`));
    seenArtifacts.add(key);
    if (!expectedArtifactKeys.has(key)) errors.push(issue(`${base}.artifact_assessments[${position}]`, "unknown_opaque_label", "must reference a packet label and viewport"));
    const source = artifacts.get(key);
    for (const field of ["screenshot_sha256", "dom_sha256", "style_sha256"]) if (!source || assessment?.artifact_hashes?.[field] !== source[field]) errors.push(issue(`${base}.artifact_assessments[${position}].artifact_hashes.${field}`, "unknown_evidence_hash", "must match packet evidence"));
    const allowed = new Set(source ? [source.screenshot_sha256, source.dom_sha256, source.style_sha256] : []);
    if (!Array.isArray(assessment?.evidence_citations) || assessment.evidence_citations.length === 0 || assessment.evidence_citations.some((hash) => !allowed.has(hash))) errors.push(issue(`${base}.artifact_assessments[${position}].evidence_citations`, "artifact_citations", "must cite this artifact"));
  }
  if (seenArtifacts.size !== 6 || [...expectedArtifactKeys].some((key) => !seenArtifacts.has(key))) errors.push(issue(`${base}.artifact_assessments`, "artifact_coverage", "all six artifacts are required"));

  const expectedPreferenceKeys = new Set(VIEWPORT_IDS.flatMap((viewport) => expectedPairs(labels).map((pair) => `${viewport}:${pair}`)));
  const seenPreferences = new Set();
  for (const [position, preference] of (result?.pairwise_preferences ?? []).entries()) {
    const pair = [preference?.left, preference?.right].sort().join("|");
    const key = `${preference?.viewport_id}:${pair}`;
    if (seenPreferences.has(key)) errors.push(issue(`${base}.pairwise_preferences[${position}]`, "duplicate_pairwise_preference", `duplicate ${key}`));
    seenPreferences.add(key);
    if (!expectedPreferenceKeys.has(key) || preference?.left === preference?.right) errors.push(issue(`${base}.pairwise_preferences[${position}]`, "pairwise_identity", "must reference a canonical blinded pair and viewport"));
    if (![preference?.left, preference?.right, "tie", "abstain"].includes(preference?.preference)) errors.push(issue(`${base}.pairwise_preferences[${position}].preference`, "preference_value", "must select a compared label, tie, or abstain"));
    const left = artifacts.get(`${preference?.left}:${preference?.viewport_id}`);
    const right = artifacts.get(`${preference?.right}:${preference?.viewport_id}`);
    const leftHashes = new Set(left ? [left.screenshot_sha256, left.dom_sha256, left.style_sha256] : []);
    const rightHashes = new Set(right ? [right.screenshot_sha256, right.dom_sha256, right.style_sha256] : []);
    const known = new Set([...leftHashes, ...rightHashes]);
    const citations = preference?.evidence_citations;
    if (!Array.isArray(citations) || citations.length === 0 || citations.some((hash) => !known.has(hash)) || !citations.some((hash) => leftHashes.has(hash)) || !citations.some((hash) => rightHashes.has(hash))) errors.push(issue(`${base}.pairwise_preferences[${position}].evidence_citations`, "preference_citations", "must cite known evidence for both compared artifacts"));
    if (typeof preference?.reason !== "string" || preference.reason.trim().length === 0) errors.push(issue(`${base}.pairwise_preferences[${position}].reason`, "preference_reason", "every preference, tie, or abstention requires a reason"));
  }
  if (seenPreferences.size !== 6 || [...expectedPreferenceKeys].some((key) => !seenPreferences.has(key))) errors.push(issue(`${base}.pairwise_preferences`, "pairwise_coverage", "all three pairs at both viewports are required"));
  if (result?.human_calibration?.claimed === true && (!Array.isArray(result.human_calibration.observation_records) || result.human_calibration.observation_records.length === 0)) errors.push(issue(`${base}.human_calibration`, "human_observation_required", "human calibration requires actual observation records"));
  const observations = result?.human_calibration?.observation_records ?? [];
  if (observations.some((entry) => !OPAQUE_OBSERVATION_ID.test(entry?.observation_id ?? "") || !OPAQUE_PARTICIPANT_ID.test(entry?.participant_id ?? ""))) errors.push(issue(`${base}.human_calibration.observation_records`, "opaque_identifier", "human observation and participant IDs must be opaque role-prefixed identifiers"));
  if (new Set(observations.map((entry) => entry?.observation_id)).size !== observations.length) errors.push(issue(`${base}.human_calibration.observation_records`, "duplicate_human_observation", "human observation IDs must be unique"));
  return errors;
}

// Structural-only helper for unit tests and packet authoring. It never reads
// source bytes and therefore cannot certify a panel or collected provenance.
export function validateJudgePanelStructure({ packet, unmaskMap, manifest, results, artifactRoot }) {
  const errors = validatePendingJudgePacket({ packet, unmaskMap, manifest, artifactRoot });
  if (errors.length > 0) return errors;
  if (!Array.isArray(results) || results.length < 2) return [...errors, issue("$.results", "judge_quorum", "at least two judge results are required")];
  const artifacts = artifactsByIdentity(packet);
  results.forEach((result, index) => errors.push(...validateResult(result, index, packet, artifacts)));
  const identities = results.map((result) => result?.judge_id);
  const families = results.map((result) => result?.evaluator_family);
  if (new Set(identities).size !== identities.length) errors.push(issue("$.results", "duplicate_judge_identity", "judge identities must be distinct"));
  if (new Set(families).size < 2) errors.push(issue("$.results", "evaluator_family_quorum", "at least two distinct evaluator families are required"));
  return errors;
}

export function readCertifiedJson(relativePath) {
  assertRepoRelativePath(relativePath);
  const absolute = path.join(root, relativePath);
  const resolvedRoot = fs.realpathSync(root);
  const resolvedParent = fs.realpathSync(path.dirname(absolute));
  const relativeParent = path.relative(resolvedRoot, resolvedParent);
  if (relativeParent === ".." || relativeParent.startsWith(`..${path.sep}`) || path.isAbsolute(relativeParent)) throw new TypeError(`${relativePath} resolves outside the repository`);
  const resolvedPath = fs.realpathSync(absolute);
  if (resolvedPath !== path.join(resolvedParent, path.basename(absolute))) throw new TypeError(`${relativePath} must resolve directly to its repository path`);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink()) throw new TypeError(`${relativePath} must be a regular non-symlink file`);
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile()) throw new TypeError(`${relativePath} must be a regular file`);
    const after = fs.lstatSync(absolute);
    if (!after.isFile() || after.isSymbolicLink() || opened.dev !== after.dev || opened.ino !== after.ino) throw new TypeError(`${relativePath} changed during certification`);
    if (fs.realpathSync(absolute) !== resolvedPath) throw new TypeError(`${relativePath} changed resolution during certification`);
    const bytes = fs.readFileSync(descriptor);
    const file_sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); } catch (error) { throw new TypeError(`${relativePath} is not valid JSON: ${error.message}`); }
    return { value, bytes, file_sha256 };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function validateJudgePanel({ packetPath, unmaskPath, manifestPath, resultPaths }) {
  if (![packetPath, unmaskPath, manifestPath].every((entry) => typeof entry === "string") || !Array.isArray(resultPaths) || resultPaths.length < 2) {
    throw new TypeError("authoritative panel validation requires packet, unmask, manifest, and at least two result file paths");
  }
  const packetFile = readCertifiedJson(packetPath); const unmaskFile = readCertifiedJson(unmaskPath); const manifestFile = readCertifiedJson(manifestPath); const resultFiles = resultPaths.map(readCertifiedJson);
  const packet = packetFile.value; const unmaskMap = unmaskFile.value; const manifest = manifestFile.value; const results = resultFiles.map((entry) => entry.value);
  const errors = validateJudgePanelStructure({ packet, unmaskMap, manifest, results, artifactRoot: path.dirname(path.join(root, manifestPath)) });
  if (packet?.evidence_manifest?.path !== manifestPath || packet?.evidence_manifest?.file_sha256 !== manifestFile.file_sha256) errors.push(issue("$.packet.evidence_manifest", "manifest_file_mismatch", "path and file hash must match supplied manifest bytes"));
  if (unmaskMap?.packet_path !== packetPath || unmaskMap?.packet_file_sha256 !== packetFile.file_sha256) errors.push(issue("$.unmask_map.packet_path", "packet_file_mismatch", "unmask path and file hash must match the exact supplied packet bytes"));
  return { errors, packet, unmaskMap, manifest, results, file_hashes: { packet: packetFile.file_sha256, unmask: unmaskFile.file_sha256, manifest: manifestFile.file_sha256, results: resultFiles.map((entry) => entry.file_sha256) } };
}
function main() {
  const [packetPath, unmaskPath, manifestPath, ...resultPaths] = process.argv.slice(2);
  if (!packetPath || !unmaskPath || !manifestPath) throw new TypeError("Usage: validate-judges.mjs <packet.json> <unmask.json> <manifest.json> [result.json ...]");
  let packet; let unmaskMap; let manifest; let errors;
  if (resultPaths.length) {
    const certification = validateJudgePanel({ packetPath, unmaskPath, manifestPath, resultPaths });
    ({ packet, unmaskMap, manifest, errors } = certification);
  } else {
    const packetFile = readCertifiedJson(packetPath); const unmaskFile = readCertifiedJson(unmaskPath); const manifestFile = readCertifiedJson(manifestPath);
    packet = packetFile.value; unmaskMap = unmaskFile.value; manifest = manifestFile.value;
    errors = validatePendingJudgePacket({ packet, unmaskMap, manifest, artifactRoot: path.dirname(path.join(root, manifestPath)) });
    if (packet?.evidence_manifest?.path !== manifestPath || packet?.evidence_manifest?.file_sha256 !== manifestFile.file_sha256) errors.push(issue("$.packet.evidence_manifest", "manifest_file_mismatch", "path and file hash must match supplied manifest bytes"));
    if (unmaskMap?.packet_path !== packetPath || unmaskMap?.packet_file_sha256 !== packetFile.file_sha256) errors.push(issue("$.unmask_map.packet_path", "packet_file_mismatch", "unmask path and file hash must match the exact supplied packet bytes"));
  }
  if (errors.length) { console.error(JSON.stringify({ valid: false, errors }, null, 2)); process.exitCode = 1; return; }
  console.log(JSON.stringify({ valid: true, status: resultPaths.length ? "quorum_valid" : "pending", release_evidence: false }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { main(); } catch (error) { console.error(`taste-oracle judge validation failed: ${error.message}`); process.exitCode = 1; } }
