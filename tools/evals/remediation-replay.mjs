#!/usr/bin/env node
/**
 * Revision-safe fresh-attempt scaffold for TasteCheck W1 remediation replay.
 *
 * This module intentionally has no dependency on the historical W1 collector,
 * attempt validator, evaluator, judge, synthesis, unmask, or receipt writers.
 * It reads only the checked-in scaffold, current skill sources, current scenario
 * sources, and the nine result paths supplied by the caller.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REVISION_ID = "w1r1-remediation-2026-07-11";
export const NAMESPACE = `evals/replays/${REVISION_ID}`;
const MANIFEST_REL = `${NAMESPACE}/manifest.json`;
const SKILLS = new Set(["component-states", "deslop-ui", "tastecheck-pass"]);
const SEEDS = new Set([101, 202, 303]);
const DEFAULT_TEMPERATURES = { "component-states": 0.7, "deslop-ui": 0.2, "tastecheck-pass": 0 };
const EVIDENCE_FIELDS = ["status", "reason", "remediation", "evidence", "provenance"];
const RESULT_FIELDS = new Set([
  "schema_version", "revision_id", "namespace", "result_path", "job_id", "attempt_id",
  "executor", "requested_seed", "observed_seed", "requested_temperature", "observed_temperature",
  "skill_source_path", "skill_source_sha256", "skill", "scenario_id", "run_type", "skill_version",
  "prompt_packet_ref", "prompt_packet_sha256", "status", "raw_output", "raw_output_hash",
  "assertions_result", "evidence_fields_present", "self_check_shape_observed", "external_source",
  "external_source_lane", "date_utc",
]);
const ASSERTION_FIELDS = new Set(["assertion_index", "assertion_text", "met", "evidence", "notes"]);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ATTEMPT_ID = /^[a-z][a-z0-9-]+-upgraded-seed\d+-fresh-\d+$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label}: invalid JSON (${error.message})`);
  }
}

function hasOnlyKeys(value, allowed, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} has unknown field "${key}"`);
  }
}

function repoPath(root, relPath) {
  if (typeof relPath !== "string" || relPath.startsWith("/") || relPath.split("/").includes("..")) return null;
  const absolute = resolve(root, relPath);
  const rootAbsolute = resolve(root);
  if (absolute !== rootAbsolute && !absolute.startsWith(`${rootAbsolute}/`)) return null;
  return absolute;
}

function isUnder(relPath, prefix) {
  return relPath === prefix || relPath.startsWith(`${prefix}/`);
}

export function loadManifest(root = ROOT) {
  return readJson(join(root, MANIFEST_REL), MANIFEST_REL);
}

function currentScenario(root, skill, errors) {
  const path = join(root, "evals/scenarios", `${skill}.json`);
  if (!existsSync(path)) {
    errors.push(`missing current scenario for ${skill}`);
    return null;
  }
  try { return readJson(path, `evals/scenarios/${skill}.json`); }
  catch (error) { errors.push(error.message); return null; }
}

function validateSourceBinding(root, binding, errors, label = "source binding") {
  if (!binding || typeof binding !== "object") {
    errors.push(`${label} must be an object`);
    return;
  }
  const path = repoPath(root, binding.path);
  if (!path || !binding.path.startsWith("skills/") || !binding.path.endsWith("/SKILL.md")) {
    errors.push(`${label} path must be a current skills/<skill>/SKILL.md path`);
    return;
  }
  if (!existsSync(path)) {
    errors.push(`${label} missing current source: ${binding.path}`);
    return;
  }
  const actual = fileSha256(path);
  if (actual !== binding.sha256) {
    errors.push(`live source digest drift for ${binding.path}: manifest=${binding.sha256}, live=${actual}`);
  }
}

function validatePacket(root, manifest, job, scenarios, errors) {
  const packetPath = repoPath(root, job.prompt_packet_ref);
  if (!packetPath || !isUnder(job.prompt_packet_ref, `${NAMESPACE}/jobs`)) {
    errors.push(`${job.job_id}: prompt packet path is outside the revision namespace`);
    return;
  }
  if (!existsSync(packetPath)) {
    errors.push(`${job.job_id}: missing prompt packet ${job.prompt_packet_ref}`);
    return;
  }
  const actualPacketSha = fileSha256(packetPath);
  if (actualPacketSha !== job.prompt_packet_sha256) {
    errors.push(`${job.job_id}: prompt packet digest mismatch`);
  }
  let packet;
  try { packet = readJson(packetPath, job.prompt_packet_ref); }
  catch (error) { errors.push(error.message); return; }

  const scenario = scenarios.get(job.skill);
  const expected = {
    revision_id: manifest.revision_id,
    namespace: manifest.namespace,
    job_id: job.job_id,
    skill: job.skill,
    scenario_id: job.scenario_id,
    run_type: "upgraded",
    requested_seed: job.requested_seed,
    requested_temperature: job.requested_temperature,
    executor: manifest.executor,
    fresh_context: true,
    skill_version: "current",
    skill_source_path: job.skill_source_path,
    result_path: job.result_path,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (packet[key] !== value) errors.push(`${job.job_id}: packet ${key} is not bound to manifest`);
  }
  if (!packet.scenario || packet.scenario.id !== scenario.id || packet.scenario.prompt !== scenario.prompt) {
    errors.push(`${job.job_id}: packet scenario is not the current scenario`);
  }
  if (JSON.stringify(packet.scenario?.assertions) !== JSON.stringify(scenario.assertions)) {
    errors.push(`${job.job_id}: packet scenario assertions drifted from current scenario`);
  }
  if (JSON.stringify(packet.assertions) !== JSON.stringify(scenario.assertions)) {
    errors.push(`${job.job_id}: packet assertions drifted from current scenario`);
  }
  if (JSON.stringify(job.assertions) !== JSON.stringify(scenario.assertions)) {
    errors.push(`${job.job_id}: manifest assertions drifted from current scenario`);
  }
  if (JSON.stringify(packet.expected_evidence_fields) !== JSON.stringify(EVIDENCE_FIELDS)) {
    errors.push(`${job.job_id}: packet expected evidence fields drifted`);
  }
}

export function validatePackage(root = ROOT) {
  const errors = [];
  let manifest;
  try { manifest = loadManifest(root); }
  catch (error) { return { manifest: null, errors: [error.message] }; }

  if (manifest.schema_version !== 1) errors.push("manifest schema_version must be 1");
  if (manifest.revision_id !== REVISION_ID) errors.push(`manifest revision_id must be ${REVISION_ID}`);
  if (manifest.namespace !== NAMESPACE) errors.push(`manifest namespace must be ${NAMESPACE}`);
  if (manifest.wave !== "W1" || manifest.kind !== "fresh-attempt-scaffold") errors.push("manifest is not a W1 fresh-attempt scaffold");
  if (manifest.run_type !== "upgraded" || manifest.status !== "pending") errors.push("manifest must remain pending upgraded replay work");
  if (manifest.executor !== "gpt-5.6-terra" || manifest.fresh_context !== true) errors.push("manifest executor/fresh_context binding is invalid");
  if (manifest.exact_job_count !== 9 || !Array.isArray(manifest.jobs) || manifest.jobs.length !== 9) errors.push("manifest must contain exactly 9 jobs");
  if (JSON.stringify(manifest.skills) !== JSON.stringify([...SKILLS])) errors.push("manifest skill set drifted");
  if (JSON.stringify(manifest.seeds) !== JSON.stringify([...SEEDS])) errors.push("manifest seed set drifted");
  if (manifest.historical_evidence_policy?.attempt_3_policy !== "never read or treat old attempt-3 files as current evidence") errors.push("attempt-3 historical evidence policy is missing");
  if (manifest.historical_evidence_policy?.current_evidence_roots?.some((path) => path.startsWith(".omx/") || path.includes("v1/w1"))) errors.push("current evidence root points at historical W1 evidence");
  if (manifest.old_failed_w1_parent_receipt?.status !== "failed" || manifest.old_failed_w1_parent_receipt?.immutable !== true) errors.push("old failed W1 parent receipt binding is missing");
  if (manifest.baseline_references?.length !== 3 || manifest.baseline_references?.some((ref) => ref.immutable !== true || !ref.attempt_id.endsWith("-attempt-1"))) errors.push("immutable baseline attempt-1 references are incomplete");

  const scenarios = new Map();
  for (const skill of SKILLS) {
    const scenario = currentScenario(root, skill, errors);
    if (scenario) scenarios.set(skill, scenario);
  }
  for (const binding of manifest.source_bindings ?? []) validateSourceBinding(root, binding, errors);
  if (manifest.source_bindings?.length !== 3) errors.push("manifest must bind all three current skill sources");

  const jobs = Array.isArray(manifest.jobs) ? manifest.jobs : [];
  const seen = new Set();
  for (const job of jobs) {
    if (!job || typeof job !== "object") { errors.push("job entry must be an object"); continue; }
    if (seen.has(job.job_id)) errors.push(`duplicate job_id ${job.job_id}`);
    seen.add(job.job_id);
    if (!SKILLS.has(job.skill) || !SEEDS.has(job.requested_seed)) errors.push(`${job.job_id}: invalid skill or seed`);
    if (job.status !== "pending") errors.push(`${job.job_id}: status must remain pending`);
    const binding = manifest.source_bindings?.find((item) => item.skill === job.skill);
    if (!binding || job.skill_source_path !== binding.path || job.skill_source_sha256 !== binding.sha256) errors.push(`${job.job_id}: source binding mismatch`);
    if (!isUnder(job.result_path, `${NAMESPACE}/results`)) errors.push(`${job.job_id}: result path is outside revision namespace`);
    validatePacket(root, manifest, job, scenarios, errors);
  }
  const keys = new Set(jobs.map((job) => `${job.skill}:${job.requested_seed}`));
  if (keys.size !== 9 || [...SKILLS].some((skill) => ![...SEEDS].every((seed) => keys.has(`${skill}:${seed}`)))) errors.push("manifest must contain the 3x3 upgraded cell matrix");
  return { manifest, errors };
}

function resultErrors(result, job, root) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["result must be an object"];
  hasOnlyKeys(result, RESULT_FIELDS, `${job.job_id} result`, errors);
  const expected = {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    result_path: job.result_path,
    job_id: job.job_id,
    executor: "gpt-5.6-terra",
    requested_seed: job.requested_seed,
    observed_seed: null,
    requested_temperature: job.requested_temperature,
    observed_temperature: null,
    skill_source_path: job.skill_source_path,
    skill_source_sha256: job.skill_source_sha256,
    skill: job.skill,
    scenario_id: job.scenario_id,
    run_type: "upgraded",
    skill_version: "current",
    prompt_packet_ref: job.prompt_packet_ref,
    prompt_packet_sha256: job.prompt_packet_sha256,
    external_source: true,
    external_source_lane: "terra",
  };
  for (const [key, value] of Object.entries(expected)) if (result[key] !== value) errors.push(`${job.job_id}: ${key} mismatch`);
  if (typeof result.attempt_id !== "string" || !ATTEMPT_ID.test(result.attempt_id)) errors.push(`${job.job_id}: invalid fresh attempt_id`);
  if (!new Set(["complete", "error", "truncated"]).has(result.status)) errors.push(`${job.job_id}: invalid status`);
  if (typeof result.raw_output !== "string" || result.raw_output.length === 0) errors.push(`${job.job_id}: raw_output must be non-empty`);
  if (typeof result.raw_output_hash !== "string" || result.raw_output_hash !== sha256(result.raw_output)) errors.push(`${job.job_id}: raw_output_hash mismatch`);
  if (!Array.isArray(result.assertions_result) || result.assertions_result.length !== job.assertions.length) {
    errors.push(`${job.job_id}: assertions_result cardinality mismatch`);
  } else {
    result.assertions_result.forEach((assertion, index) => {
      hasOnlyKeys(assertion, ASSERTION_FIELDS, `${job.job_id} assertions_result[${index}]`, errors);
      if (assertion.assertion_index !== index || assertion.assertion_text !== job.assertions[index]) errors.push(`${job.job_id}: assertions_result[${index}] is not bound to packet assertion`);
      if (typeof assertion.met !== "boolean" || typeof assertion.evidence !== "string" || assertion.evidence.length === 0) errors.push(`${job.job_id}: assertions_result[${index}] missing evidence binding`);
    });
  }
  if (!result.evidence_fields_present || typeof result.evidence_fields_present !== "object" || Array.isArray(result.evidence_fields_present)) {
    errors.push(`${job.job_id}: evidence_fields_present must be an object`);
  } else {
    const keys = Object.keys(result.evidence_fields_present);
    if (keys.length !== EVIDENCE_FIELDS.length || !EVIDENCE_FIELDS.every((field) => keys.includes(field))) errors.push(`${job.job_id}: evidence_fields_present keys mismatch`);
    for (const field of EVIDENCE_FIELDS) if (typeof result.evidence_fields_present[field] !== "boolean") errors.push(`${job.job_id}: evidence field ${field} must be boolean`);
  }
  if (typeof result.self_check_shape_observed !== "string") errors.push(`${job.job_id}: self_check_shape_observed is required`);
  if (typeof result.date_utc !== "string" || !ISO_UTC.test(result.date_utc)) errors.push(`${job.job_id}: date_utc must be ISO UTC`);
  const source = repoPath(root, result.skill_source_path);
  if (!source || !existsSync(source)) errors.push(`${job.job_id}: live source path missing`);
  else if (fileSha256(source) !== result.skill_source_sha256) errors.push(`${job.job_id}: live source digest drift`);
  return errors;
}

export function validateResultSet(root = ROOT, inputPaths = []) {
  const packageCheck = validatePackage(root);
  const errors = [...packageCheck.errors];
  if (!Array.isArray(inputPaths) || inputPaths.length !== 9) {
    errors.push(`result intake must contain exactly 9 JSON paths; got ${Array.isArray(inputPaths) ? inputPaths.length : "non-array"}`);
    return { errors, results: [] };
  }
  const manifest = packageCheck.manifest;
  if (!manifest) return { errors, results: [] };
  const byJob = new Map(manifest.jobs.map((job) => [job.job_id, job]));
  const seenJobs = new Set();
  const results = [];
  for (const input of inputPaths) {
    const inputRelative = relative(resolve(root), resolve(input));
    if (isUnder(inputRelative, ".omx/evidence/tastecheck-v1/raw") || isUnder(inputRelative, "evals/receipts/v1/w1")) {
      errors.push(`historical W1 evidence path forbidden as current input: ${inputRelative}`);
      continue;
    }
    let path;
    try { path = realpathSync(resolve(input)); }
    catch { errors.push(`result input missing: ${input}`); continue; }
    let result;
    try { result = readJson(path, path); }
    catch (error) { errors.push(error.message); continue; }
    const job = byJob.get(result?.job_id);
    if (!job) { errors.push(`unknown result job_id: ${result?.job_id ?? "missing"}`); continue; }
    if (seenJobs.has(job.job_id)) { errors.push(`duplicate result job_id: ${job.job_id}`); continue; }
    seenJobs.add(job.job_id);
    const currentErrors = resultErrors(result, job, root);
    errors.push(...currentErrors);
    if (currentErrors.length === 0) results.push(result);
  }
  if (seenJobs.size !== 9) errors.push(`result intake is missing ${9 - seenJobs.size} manifest job(s)`);
  return { errors, results };
}

export function collectResults(root = ROOT, inputPaths = []) {
  const checked = validateResultSet(root, inputPaths);
  if (checked.errors.length > 0) return { ...checked, written: [] };
  const manifest = loadManifest(root);
  const destinations = checked.results.map((result) => {
    const path = repoPath(root, result.result_path);
    return { result, path };
  });
  const destinationErrors = [];
  for (const { result, path } of destinations) {
    if (!path || !isUnder(result.result_path, `${NAMESPACE}/results`)) destinationErrors.push(`${result.job_id}: destination outside replay namespace`);
    else if (existsSync(path)) destinationErrors.push(`${result.job_id}: destination already exists; refusing overwrite`);
  }
  if (destinationErrors.length > 0) return { ...checked, errors: destinationErrors, written: [] };
  for (const { result, path } of destinations) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  }
  return { ...checked, manifest, written: destinations.map(({ result }) => result.result_path) };
}

function usage() {
  console.error("Usage: node tools/evals/remediation-replay.mjs package | validate <exactly-9-json-paths> | collect <exactly-9-json-paths>");
}

const [, , command, ...args] = process.argv;
if (command === "package") {
  const checked = validatePackage(ROOT);
  if (checked.errors.length > 0) {
    console.error(checked.errors.map((error) => `FAIL: ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`package valid: ${NAMESPACE} (9 pending jobs)`);
    for (const job of checked.manifest.jobs) console.log(`${job.job_id}\t${job.prompt_packet_ref}\t${job.result_path}`);
  }
} else if (command === "validate" || command === "collect") {
  if (args.length !== 9) {
    usage();
    process.exitCode = 1;
  } else {
    const checked = command === "validate" ? validateResultSet(ROOT, args) : collectResults(ROOT, args);
    if (checked.errors.length > 0) {
      console.error(checked.errors.map((error) => `FAIL: ${error}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.log(`${command} valid: 9 fresh Terra results bound to ${NAMESPACE}`);
      if (command === "collect") for (const path of checked.written) console.log(path);
    }
  }
} else if (import.meta.url === `file://${process.argv[1]}`) {
  usage();
  process.exitCode = 1;
}
