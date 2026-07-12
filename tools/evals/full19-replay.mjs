#!/usr/bin/env node
/**
 * Revision-safe full 19-skill production-corpus scaffold.
 *
 * This is packaging and collection infrastructure only. It never executes a
 * model, judges output, synthesizes evidence, changes product sources, or
 * changes the pack version.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REVISION_ID = "full19-v1rc-2026-07-11";
export const NAMESPACE = `evals/replays/${REVISION_ID}`;
const BASELINE_ROOT = ".omx/evidence/tastecheck-v1/baseline/v0.1.0";
const BASELINE_MANIFEST = `${BASELINE_ROOT}/manifest.json`;
const SCENARIO_REGISTRY = "evals/generated/scenario-registry.json";
const COMMAND_CONTRACT = "contracts/v1/commands.json";
const EXPECTED_SKILLS = [
  "a11y-pass", "art-direction", "cognitive-a11y", "color-system", "component-states",
  "data-viz", "design-system-interview", "deslop-ui", "empty-states", "form-ux",
  "humanize-copy", "i18n-ready", "improve-existing-website", "micro-motion", "responsive-layout",
  "spacing-system", "tastecheck-pass", "theming", "web-typography",
];
const SEEDS = [101, 202, 303];
const EXPECTED_COMMAND_COUNT = 20;
const EVIDENCE_FIELDS = ["status", "reason", "remediation", "evidence", "provenance"];
const RESULT_STATUS = new Set(["complete", "error", "truncated"]);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const JOB_COUNT = 76;
const TEMPERATURE_BY_CLASS = { generative: 0.7, repair: 0.2, verification: 0, gate: 0 };
const SEED_INSTRUCTIONS = {
  101: "Structural variation: choose a materially different response architecture and organize the actionable work around hierarchy, sequence, or decision flow. Preserve every scenario fact and assertion.",
  202: "Aesthetic variation: choose a materially different treatment vocabulary, component emphasis, or evidence presentation while staying within the scenario facts and the skill's contract. Do not invent product facts.",
  303: "Voice variation: choose a materially different cadence, framing, and explanatory voice while preserving all scenario facts, assertions, evidence obligations, and the skill's required truth.",
};
const BASELINE_INSTRUCTION = "Frozen baseline control: apply the content-addressed v0.1.0 skill source exactly. Preserve the supplied scenario facts and assertions; do not read current skill sources or historical W1/W1R1 outputs.";

const JOB_FIELDS = new Set([
  "schema_version", "revision_id", "namespace", "job_id", "skill", "scenario_id", "run_type",
  "requested_seed", "requested_temperature", "executor", "fresh_context", "skill_version",
  "skill_source_kind", "skill_source_path", "skill_source_sha256", "current_skill_source_path",
  "current_skill_source_sha256", "scenario_registry_path", "scenario_registry_sha256",
  "scenario_registry_entry_sha256", "scenario", "assertions", "contract_projection",
  "contract_projection_path", "contract_projection_sha256", "seed_instruction", "system_prompt",
  "user_prompt", "expected_evidence_fields", "result_schema_ref", "prompt_packet_ref", "prompt_packet_sha256", "result_path", "allowed_reads",
]);
const RESULT_FIELDS = new Set([
  "schema_version", "revision_id", "namespace", "result_path", "job_id", "attempt_id", "executor",
  "fresh_context", "requested_seed", "observed_seed", "requested_temperature", "observed_temperature",
  "skill_source_kind", "skill_source_path", "skill_source_sha256", "skill", "scenario_id",
  "scenario_registry_entry_sha256", "contract_projection_sha256", "run_type", "skill_version",
  "prompt_packet_ref", "prompt_packet_sha256", "status", "raw_output", "raw_output_hash",
  "assertions_result", "evidence_fields_present", "self_check_shape_observed", "external_source",
  "external_source_lane", "token_usage", "cost", "date_utc",
]);
const ASSERTION_FIELDS = new Set(["assertion_index", "assertion_text", "met", "evidence", "notes"]);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function sha256Text(value) { return sha256(Buffer.from(value, "utf8")); }
function readJson(path, label = path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`${label}: invalid JSON (${error.message})`); }
}
function jsonHash(value) { return sha256Text(JSON.stringify(value)); }
function fileHash(path) { return sha256(readFileSync(path)); }
function rootPath(root, relPath) {
  if (typeof relPath !== "string" || relPath.startsWith("/") || relPath.split("/").includes("..")) return null;
  const absolute = resolve(root, relPath);
  const base = resolve(root);
  return absolute === base || absolute.startsWith(`${base}/`) ? absolute : null;
}
function under(relPath, prefix) { return relPath === prefix || relPath.startsWith(`${prefix}/`); }
function canonicalEntry(registry, skill) {
  return registry.scenarios?.find((scenario) => scenario.skill === skill) ?? null;
}
function contractPath(skill) { return `skills/${skill}/contract.json`; }
function currentSkillPath(skill) { return `skills/${skill}/SKILL.md`; }
function baselineSkillDigest(manifest, skill) {
  const path = `skills/${skill}/SKILL.md`;
  return manifest.entries?.find((entry) => entry.path === path)?.sha256 ?? null;
}
function baselineBlobPath(digest) { return `${BASELINE_ROOT}/sha256/${digest}`; }
function temperatureFor(scenario) { return TEMPERATURE_BY_CLASS[scenario.class] ?? 0.7; }
function jobId(skill, runType, seed) { return `${skill}-${runType}-seed${seed}`; }
function packetPath(job) { return `${NAMESPACE}/jobs/${job.job_id}.json`; }
function resultPath(job) { return `${NAMESPACE}/results/${job.job_id}.json`; }

function hasOnlyKeys(value, allowed, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label} must be an object`); return; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${label} has unknown field "${key}"`);
}

function frozenBaselineStatus(root) {
  const errors = [];
  const manifestPath = rootPath(root, BASELINE_MANIFEST);
  if (!manifestPath || !existsSync(manifestPath)) return { errors: ["frozen baseline manifest is missing"] };
  let manifest;
  try { manifest = readJson(manifestPath, BASELINE_MANIFEST); } catch (error) { return { errors: [error.message] }; }
  if (manifest.schema_version !== 1 || manifest.entry_count !== manifest.entries?.length) errors.push("frozen baseline manifest shape is invalid");
  if (!manifest.manifest_sha256 || manifest.commit !== "b32ce11517b23644fe27299b4a2e6e860d1b4325") errors.push("frozen baseline manifest identity is invalid");
  for (const entry of manifest.entries ?? []) {
    const blob = rootPath(root, baselineBlobPath(entry.sha256));
    if (!blob || !existsSync(blob)) { errors.push(`missing frozen baseline blob for ${entry.path}`); continue; }
    const body = readFileSync(blob);
    if (sha256(body) !== entry.sha256) errors.push(`frozen baseline blob digest mismatch for ${entry.path}`);
    if (body.length !== entry.size) errors.push(`frozen baseline blob size mismatch for ${entry.path}`);
  }
  for (const skill of EXPECTED_SKILLS) {
    const digest = baselineSkillDigest(manifest, skill);
    if (!digest) errors.push(`frozen baseline has no exact skill source for ${skill}`);
  }
  const receiptPath = rootPath(root, `${BASELINE_ROOT}/replay-receipt.json`);
  if (!receiptPath || !existsSync(receiptPath)) errors.push("frozen baseline replay receipt is missing");
  else {
    const receipt = readJson(receiptPath, `${BASELINE_ROOT}/replay-receipt.json`);
    if (receipt.manifest_digest !== manifest.manifest_sha256 || receipt.verify_fail !== 0 || receipt.digest_verification_passed !== true) errors.push("frozen baseline replay receipt does not prove digest verification");
    if (receipt.npm_test_exit !== 0 || receipt.smoke_dry_run_exit !== 0 || receipt.passed !== true) errors.push("frozen baseline replay receipt contains a failed command");
  }
  return { manifest, errors };
}

function currentInputs(root) {
  const errors = [];
  const registryPath = rootPath(root, SCENARIO_REGISTRY);
  const commandsPath = rootPath(root, COMMAND_CONTRACT);
  const skillsManifestPath = rootPath(root, "skills.json");
  const commandsDir = rootPath(root, "commands");
  if (!registryPath || !existsSync(registryPath)) errors.push("current scenario registry is missing");
  if (!commandsPath || !existsSync(commandsPath)) errors.push("current command contract is missing");
  if (!skillsManifestPath || !existsSync(skillsManifestPath)) errors.push("skills.json is missing");
  if (!commandsDir || !existsSync(commandsDir)) errors.push("commands directory is missing");
  let registry = null;
  let commands = null;
  let skillsManifest = null;
  if (registryPath && existsSync(registryPath)) registry = readJson(registryPath, SCENARIO_REGISTRY);
  if (commandsPath && existsSync(commandsPath)) commands = readJson(commandsPath, COMMAND_CONTRACT);
  if (skillsManifestPath && existsSync(skillsManifestPath)) skillsManifest = readJson(skillsManifestPath, "skills.json");
  const manifestSkills = skillsManifest?.skills?.map((entry) => entry.name) ?? [];
  if (manifestSkills.length !== EXPECTED_SKILLS.length || new Set(manifestSkills).size !== EXPECTED_SKILLS.length || [...manifestSkills].sort().join("\n") !== [...EXPECTED_SKILLS].sort().join("\n")) errors.push("skills.json inventory drifted from the exact 19-skill surface");
  const skillDirs = rootPath(root, "skills") && readdirSync(rootPath(root, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(rootPath(root, "skills"), entry.name, "SKILL.md"))).map((entry) => entry.name).sort();
  if (JSON.stringify(skillDirs) !== JSON.stringify([...EXPECTED_SKILLS].sort())) errors.push("skills directory inventory drifted from the exact 19-skill surface");
  if (registry && (registry.scenario_count !== 20 || registry.skills_covered?.length !== 19)) errors.push("current scenario registry must cover exactly 20 scenarios and 19 skills");
  if (commands && (commands.commands?.length !== EXPECTED_COMMAND_COUNT)) errors.push("current command contract must contain exactly 20 commands");
  const commandFiles = commandsDir && existsSync(commandsDir) ? readdirSync(commandsDir).filter((name) => name.endsWith(".md")).sort() : [];
  if (commandFiles.length !== EXPECTED_COMMAND_COUNT) errors.push("commands directory must contain exactly 20 command files");
  if (commands && commands.commands?.some((entry) => !existsSync(rootPath(root, entry.file)))) errors.push("command contract contains an unshipped command file");
  const targetSkills = new Set(commands?.commands?.map((entry) => entry.skill) ?? []);
  if (targetSkills.size !== 19 || !targetSkills.has("theming")) errors.push("current command contract must target 19 skills with theming alias coverage");
  if (commands && commands.commands?.filter((entry) => entry.type === "alias" && entry.skill === "theming").length !== 1) errors.push("theming must own exactly one darkmode alias");
  const scenarios = new Map();
  for (const skill of EXPECTED_SKILLS) {
    const scenario = registry && canonicalEntry(registry, skill);
    if (!scenario) errors.push(`current scenario registry has no entry for ${skill}`);
    else scenarios.set(skill, scenario);
  }
  const contracts = new Map();
  for (const skill of EXPECTED_SKILLS) {
    const path = rootPath(root, contractPath(skill));
    if (!path || !existsSync(path)) { errors.push(`current contract projection is missing for ${skill}`); continue; }
    const contract = readJson(path, contractPath(skill));
    if (contract.skill !== skill) errors.push(`current contract projection skill mismatch for ${skill}`);
    contracts.set(skill, contract);
  }
  return { registry, registrySha256: registryPath && existsSync(registryPath) ? fileHash(registryPath) : null, scenarios, contracts, commands, errors };
}

function seedInstruction(runType, seed) { return runType === "baseline" ? BASELINE_INSTRUCTION : SEED_INSTRUCTIONS[seed]; }

function makeJob(root, baseline, inputs, skill, runType, seed) {
  const scenario = inputs.scenarios.get(skill);
  const currentSource = currentSkillPath(skill);
  const currentSourcePath = rootPath(root, currentSource);
  const currentDigest = currentSourcePath && existsSync(currentSourcePath) ? fileHash(currentSourcePath) : null;
  const frozenDigest = baselineSkillDigest(baseline, skill);
  const contract = inputs.contracts.get(skill);
  const contractPathValue = contractPath(skill);
  const contractDigest = contract ? jsonHash(contract) : null;
  const isBaseline = runType === "baseline";
  const sourcePath = isBaseline ? baselineBlobPath(frozenDigest) : currentSource;
  const sourceDigest = isBaseline ? frozenDigest : currentDigest;
  const id = jobId(skill, runType, seed);
  const packet = {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    job_id: id,
    skill,
    scenario_id: scenario.id,
    run_type: runType,
    requested_seed: seed,
    requested_temperature: temperatureFor(scenario),
    executor: "gpt-5.6-terra",
    fresh_context: true,
    skill_version: isBaseline ? "v0.1.0-frozen" : "current",
    skill_source_kind: isBaseline ? "frozen-baseline-content-addressed" : "current-live",
    skill_source_path: sourcePath,
    skill_source_sha256: sourceDigest,
    ...(isBaseline ? {} : { current_skill_source_path: currentSource, current_skill_source_sha256: currentDigest }),
    scenario_registry_path: SCENARIO_REGISTRY,
    scenario_registry_sha256: inputs.registrySha256,
    scenario_registry_entry_sha256: jsonHash(scenario),
    scenario,
    assertions: scenario.assertions,
    contract_projection: isBaseline ? null : contract,
    contract_projection_path: isBaseline ? null : contractPathValue,
    contract_projection_sha256: isBaseline ? null : contractDigest,
    seed_instruction: seedInstruction(runType, seed),
    system_prompt: `You are the ${skill} skill from TasteCheck. This is revision ${REVISION_ID}, a fresh isolated context. Apply only the bound source and scenario in this packet. Do not read historical W1/W1R1 attempts, receipts, judge packets, synthesis, or unbound sources. Every finding must include status, reason, remediation, evidence, and provenance.`,
    user_prompt: scenario.prompt,
    expected_evidence_fields: EVIDENCE_FIELDS,
    result_schema_ref: `${NAMESPACE}/result-schema.json`,
    prompt_packet_ref: `${NAMESPACE}/jobs/${id}.json`,
    result_path: `${NAMESPACE}/results/${id}.json`,
    allowed_reads: isBaseline
      ? [BASELINE_MANIFEST, sourcePath, SCENARIO_REGISTRY, `${NAMESPACE}/jobs/${id}.json`, `${NAMESPACE}/result-schema.json`]
      : [currentSource, contractPathValue, SCENARIO_REGISTRY, `${NAMESPACE}/jobs/${id}.json`, `${NAMESPACE}/result-schema.json`],
  };
  packet.prompt_packet_sha256 = null;
  return packet;
}

function finalizePacket(packet) {
  const body = { ...packet };
  delete body.prompt_packet_sha256;
  const digest = jsonHash(body);
  return { ...packet, prompt_packet_sha256: digest };
}

function writeImmutable(root, relPath, value) {
  const path = rootPath(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  const body = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== body) throw new Error(`refusing to overwrite existing scaffold file ${relPath}`);
    return;
  }
  writeFileSync(path, body, { flag: "wx" });
}

function buildManifest(root, baseline, inputs) {
  const jobs = [];
  for (const skill of EXPECTED_SKILLS) {
    jobs.push(finalizePacket(makeJob(root, baseline, inputs, skill, "baseline", 101)));
    for (const seed of SEEDS) jobs.push(finalizePacket(makeJob(root, baseline, inputs, skill, "upgraded", seed)));
  }
  const dispatch = EXPECTED_SKILLS.map((skill, index) => {
    const cells = jobs.filter((job) => job.skill === skill);
    return {
      dispatch_group_id: `terra-${String(index + 1).padStart(2, "0")}-${skill}`,
      skill,
      executor: "gpt-5.6-terra",
      fresh_context: true,
      allowed_reads: [...new Set(cells.flatMap((job) => job.allowed_reads))].sort(),
      result_writes: cells.map((job) => job.result_path),
      cells: cells.map((job) => job.job_id),
      exact_result_write_count: 4,
      isolation: "one fresh context per cell; no cross-cell result or historical-evidence reads",
    };
  });
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    kind: "full-production-corpus-scaffold",
    wave: "W4",
    status: "pending",
    executor: "gpt-5.6-terra",
    fresh_context: true,
    exact_job_count: JOB_COUNT,
    baseline_job_count: 19,
    upgraded_job_count: 57,
    skills: EXPECTED_SKILLS,
    command_count: EXPECTED_COMMAND_COUNT,
    command_alias: { file: "commands/darkmode.md", command: "/darkmode", owner_skill: "theming", type: "alias" },
    seeds: SEEDS,
    baseline_version: "v0.1.0",
    baseline_manifest_path: BASELINE_MANIFEST,
    baseline_manifest_sha256: baseline.manifest_sha256,
    baseline_commit: baseline.commit,
    current_scenario_registry_path: SCENARIO_REGISTRY,
    current_scenario_registry_sha256: inputs.registrySha256,
    historical_evidence_policy: {
      attempt_3_policy: "never read or treat historical W1 attempt-3 or W1R1 files as current evidence",
      forbidden_current_evidence_roots: [".omx/evidence/tastecheck-v1/raw", "evals/receipts/v1/w1", "evals/replays/w1r1-remediation-2026-07-11"],
      current_evidence_root: `${NAMESPACE}/results`,
    },
    jobs,
    dispatch_matrix: dispatch,
  };
}

function resultSchema() {
  return {
    schema_version: 1,
    revision_id: REVISION_ID,
    namespace: NAMESPACE,
    description: "Result contract only; model execution is external to this scaffold.",
    required_fields: [...RESULT_FIELDS],
    token_usage: { input_tokens: "integer|null", output_tokens: "integer|null", total_tokens: "integer|null", reason: "required when any token field is null" },
    cost: { amount: "number|null", currency: "string|null", reason: "required when amount is null" },
    assertion_fields: [...ASSERTION_FIELDS],
    evidence_fields: EVIDENCE_FIELDS,
  };
}

export function validatePackage(root = ROOT) {
  const errors = [];
  const frozen = frozenBaselineStatus(root);
  errors.push(...frozen.errors);
  const inputs = currentInputs(root);
  errors.push(...inputs.errors);
  const manifestPath = rootPath(root, `${NAMESPACE}/manifest.json`);
  if (!manifestPath || !existsSync(manifestPath)) return { manifest: null, errors: [...errors, `${NAMESPACE}/manifest.json is missing`] };
  let manifest;
  try { manifest = readJson(manifestPath, `${NAMESPACE}/manifest.json`); } catch (error) { return { manifest: null, errors: [...errors, error.message] }; }
  if (manifest.revision_id !== REVISION_ID || manifest.namespace !== NAMESPACE) errors.push("manifest revision or namespace mismatch");
  if (manifest.status !== "pending" || manifest.executor !== "gpt-5.6-terra" || manifest.fresh_context !== true) errors.push("manifest status/executor/fresh_context binding is invalid");
  if (manifest.exact_job_count !== JOB_COUNT || !Array.isArray(manifest.jobs) || manifest.jobs.length !== JOB_COUNT) errors.push("manifest must contain exactly 76 jobs");
  if (JSON.stringify(manifest.skills) !== JSON.stringify(EXPECTED_SKILLS) || manifest.command_count !== EXPECTED_COMMAND_COUNT) errors.push("public inventory binding is not exactly 19 skills / 20 commands");
  if (manifest.command_alias?.owner_skill !== "theming" || manifest.command_alias?.file !== "commands/darkmode.md") errors.push("theming darkmode alias binding is invalid");
  if (manifest.baseline_manifest_sha256 !== frozen.manifest?.manifest_sha256) errors.push("baseline manifest digest binding is stale");
  if (manifest.current_scenario_registry_sha256 !== inputs.registrySha256) errors.push("current scenario registry digest drifted");
  const schemaPath = rootPath(root, `${NAMESPACE}/result-schema.json`);
  if (!schemaPath || !existsSync(schemaPath)) errors.push("result schema is missing");
  else if (readJson(schemaPath).revision_id !== REVISION_ID) errors.push("result schema revision mismatch");
  const seen = new Set();
  for (const job of manifest.jobs ?? []) {
    if (!job || typeof job !== "object") { errors.push("job entry must be an object"); continue; }
    hasOnlyKeys(job, JOB_FIELDS, `${job.job_id ?? "job"}`, errors);
    if (seen.has(job.job_id)) errors.push(`duplicate job_id ${job.job_id}`);
    seen.add(job.job_id);
    const scenario = inputs.scenarios.get(job.skill);
    const expectedScenarioHash = scenario ? jsonHash(scenario) : null;
    if (!EXPECTED_SKILLS.includes(job.skill) || !["baseline", "upgraded"].includes(job.run_type)) errors.push(`${job.job_id}: invalid skill/run_type`);
    if (job.run_type === "baseline" && job.requested_seed !== 101) errors.push(`${job.job_id}: baseline seed must be 101`);
    if (job.run_type === "upgraded" && !SEEDS.includes(job.requested_seed)) errors.push(`${job.job_id}: upgraded seed is invalid`);
    if (job.revision_id !== REVISION_ID || job.namespace !== NAMESPACE || job.executor !== "gpt-5.6-terra" || job.fresh_context !== true) errors.push(`${job.job_id}: revision/model/context binding mismatch`);
    if (!scenario || job.scenario_id !== scenario.id || job.scenario_registry_entry_sha256 !== expectedScenarioHash || JSON.stringify(job.scenario) !== JSON.stringify(scenario) || JSON.stringify(job.assertions) !== JSON.stringify(scenario.assertions)) errors.push(`${job.job_id}: scenario/brief/assertion binding mismatch`);
    if (JSON.stringify(job.expected_evidence_fields) !== JSON.stringify(EVIDENCE_FIELDS)) errors.push(`${job.job_id}: evidence fields drifted`);
    const packetRel = packetPath(job);
    const packet = rootPath(root, packetRel);
    if (!packet || !existsSync(packet)) { errors.push(`${job.job_id}: missing packet ${packetRel}`); continue; }
    const packetBody = readJson(packet, packetRel);
    const packetCopy = { ...packetBody }; delete packetCopy.prompt_packet_sha256;
    if (jsonHash(packetCopy) !== job.prompt_packet_sha256) errors.push(`${job.job_id}: packet digest mismatch`);
    if (JSON.stringify(packetBody) !== JSON.stringify(job)) errors.push(`${job.job_id}: manifest packet differs from packet file`);
    if (job.result_path !== resultPath(job) || !under(job.result_path, `${NAMESPACE}/results`)) errors.push(`${job.job_id}: result path is not isolated in namespace`);
    if (job.run_type === "baseline") {
      if (job.skill_source_kind !== "frozen-baseline-content-addressed" || !job.skill_source_path.startsWith(`${BASELINE_ROOT}/sha256/`)) errors.push(`${job.job_id}: baseline source binding is not content-addressed`);
      const blob = rootPath(root, job.skill_source_path);
      if (!blob || !existsSync(blob) || fileHash(blob) !== job.skill_source_sha256 || job.skill_source_sha256 !== baselineSkillDigest(frozen.manifest, job.skill)) errors.push(`${job.job_id}: baseline source digest/path mismatch`);
      if (job.contract_projection !== null || job.contract_projection_sha256 !== null) errors.push(`${job.job_id}: baseline must not bind current contract projection`);
    } else {
      const source = rootPath(root, job.skill_source_path);
      const contract = inputs.contracts.get(job.skill);
      if (job.skill_source_kind !== "current-live" || job.skill_source_path !== currentSkillPath(job.skill) || !source || !existsSync(source) || fileHash(source) !== job.skill_source_sha256) errors.push(`${job.job_id}: current source digest drift`);
      if (!contract || JSON.stringify(job.contract_projection) !== JSON.stringify(contract) || job.contract_projection_sha256 !== jsonHash(contract) || job.contract_projection_path !== contractPath(job.skill)) errors.push(`${job.job_id}: contract projection digest drift`);
    }
  }
  const baselineCount = manifest.jobs?.filter((job) => job.run_type === "baseline").length ?? 0;
  const upgradedCount = manifest.jobs?.filter((job) => job.run_type === "upgraded").length ?? 0;
  if (baselineCount !== 19 || upgradedCount !== 57 || seen.size !== 76) errors.push("manifest cell counts are not exactly 19 baseline plus 57 upgraded");
  if (!Array.isArray(manifest.dispatch_matrix) || manifest.dispatch_matrix.length !== 19 || manifest.dispatch_matrix.some((group) => group.exact_result_write_count !== 4 || group.cells?.length !== 4 || group.result_writes?.length !== 4)) errors.push("dispatch matrix must contain 19 groups of four cells and four result writes");
  return { manifest, errors };
}

function validateTokenUsage(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label}: token_usage must be an object`); return; }
  for (const key of ["input_tokens", "output_tokens", "total_tokens"]) if (value[key] !== null && (!Number.isInteger(value[key]) || value[key] < 0)) errors.push(`${label}: ${key} must be a non-negative integer or null`);
  if ((value.input_tokens === null || value.output_tokens === null || value.total_tokens === null) && typeof value.reason !== "string" || (value.reason !== null && value.reason !== undefined && typeof value.reason !== "string")) errors.push(`${label}: token_usage reason is required when unexposed`);
}
function validateCost(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label}: cost must be an object`); return; }
  if (value.amount !== null && (typeof value.amount !== "number" || value.amount < 0)) errors.push(`${label}: cost amount must be a non-negative number or null`);
  if (value.amount === null && typeof value.reason !== "string") errors.push(`${label}: cost reason is required when unexposed`);
  if (value.currency !== null && typeof value.currency !== "string") errors.push(`${label}: cost currency must be string or null`);
}
function resultErrors(result, job, root) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["result must be an object"];
  hasOnlyKeys(result, RESULT_FIELDS, `${job.job_id} result`, errors);
  for (const key of ["schema_version", "revision_id", "namespace", "result_path", "job_id", "executor", "fresh_context", "requested_seed", "requested_temperature", "skill_source_kind", "skill_source_path", "skill_source_sha256", "skill", "scenario_id", "run_type", "skill_version", "prompt_packet_ref", "prompt_packet_sha256", "external_source", "external_source_lane"]) {
    const expected = key === "schema_version" ? 1 : key === "revision_id" ? REVISION_ID : key === "namespace" ? NAMESPACE : key === "result_path" ? job.result_path : key === "job_id" ? job.job_id : key === "executor" ? "gpt-5.6-terra" : key === "fresh_context" ? true : key === "requested_seed" ? job.requested_seed : key === "requested_temperature" ? job.requested_temperature : key === "skill_source_kind" ? job.skill_source_kind : key === "skill_source_path" ? job.skill_source_path : key === "skill_source_sha256" ? job.skill_source_sha256 : key === "skill" ? job.skill : key === "scenario_id" ? job.scenario_id : key === "run_type" ? job.run_type : key === "skill_version" ? job.skill_version : key === "prompt_packet_ref" ? packetPath(job) : key === "prompt_packet_sha256" ? job.prompt_packet_sha256 : key === "external_source" ? true : "terra";
    if (result[key] !== expected) errors.push(`${job.job_id}: ${key} mismatch`);
  }
  if (result.scenario_registry_entry_sha256 !== job.scenario_registry_entry_sha256) errors.push(`${job.job_id}: scenario registry digest mismatch`);
  if (result.contract_projection_sha256 !== job.contract_projection_sha256) errors.push(`${job.job_id}: contract projection digest mismatch`);
  if (result.observed_seed !== null && result.observed_seed !== job.requested_seed) errors.push(`${job.job_id}: observed seed mismatch`);
  if (result.observed_temperature !== null && result.observed_temperature !== job.requested_temperature) errors.push(`${job.job_id}: observed temperature mismatch`);
  if (typeof result.attempt_id !== "string" || !result.attempt_id.startsWith(`${job.job_id}-fresh-`)) errors.push(`${job.job_id}: invalid fresh attempt_id`);
  if (!RESULT_STATUS.has(result.status)) errors.push(`${job.job_id}: invalid status`);
  if (typeof result.raw_output !== "string" || result.raw_output.length === 0) errors.push(`${job.job_id}: raw_output must be non-empty`);
  if (typeof result.raw_output_hash !== "string" || result.raw_output_hash !== sha256Text(result.raw_output)) errors.push(`${job.job_id}: raw_output_hash mismatch`);
  if (!Array.isArray(result.assertions_result) || result.assertions_result.length !== job.assertions.length) errors.push(`${job.job_id}: assertions_result cardinality mismatch`);
  else result.assertions_result.forEach((assertion, index) => {
    hasOnlyKeys(assertion, ASSERTION_FIELDS, `${job.job_id} assertions_result[${index}]`, errors);
    if (assertion.assertion_index !== index || assertion.assertion_text !== job.assertions[index]) errors.push(`${job.job_id}: assertions_result[${index}] assertion binding mismatch`);
    if (typeof assertion.met !== "boolean" || typeof assertion.evidence !== "string" || assertion.evidence.length === 0) errors.push(`${job.job_id}: assertions_result[${index}] evidence missing`);
  });
  if (!result.evidence_fields_present || typeof result.evidence_fields_present !== "object" || EVIDENCE_FIELDS.some((field) => typeof result.evidence_fields_present[field] !== "boolean")) errors.push(`${job.job_id}: evidence_fields_present mismatch`);
  if (typeof result.self_check_shape_observed !== "string" || result.self_check_shape_observed.length === 0) errors.push(`${job.job_id}: self_check_shape_observed is required`);
  validateTokenUsage(result.token_usage, job.job_id, errors);
  validateCost(result.cost, job.job_id, errors);
  if (typeof result.date_utc !== "string" || !ISO_UTC.test(result.date_utc)) errors.push(`${job.job_id}: date_utc must be ISO UTC`);
  if (job.run_type === "baseline") {
    const blob = rootPath(root, job.skill_source_path);
    if (!blob || !existsSync(blob) || fileHash(blob) !== result.skill_source_sha256) errors.push(`${job.job_id}: baseline source digest/path is not frozen`);
  } else {
    const source = rootPath(root, result.skill_source_path);
    if (!source || !existsSync(source) || fileHash(source) !== result.skill_source_sha256) errors.push(`${job.job_id}: live source digest drift`);
  }
  return errors;
}

export function validateResultSet(root = ROOT, inputPaths = []) {
  const packageCheck = validatePackage(root);
  const errors = [...packageCheck.errors];
  if (!Array.isArray(inputPaths) || inputPaths.length !== JOB_COUNT) { errors.push(`result intake must contain exactly ${JOB_COUNT} JSON paths; got ${Array.isArray(inputPaths) ? inputPaths.length : "non-array"}`); return { errors, results: [] }; }
  if (!packageCheck.manifest) return { errors, results: [] };
  const byJob = new Map(packageCheck.manifest.jobs.map((job) => [job.job_id, job]));
  const seen = new Set();
  const results = [];
  for (const input of inputPaths) {
    const rel = relative(resolve(root), resolve(input));
    if (under(rel, ".omx/evidence/tastecheck-v1/raw") || under(rel, "evals/receipts/v1/w1") || under(rel, "evals/replays/w1r1-remediation-2026-07-11")) { errors.push(`historical W1/W1R1 evidence path forbidden as current input: ${rel}`); continue; }
    let path;
    try { path = realpathSync(resolve(input)); } catch { errors.push(`result input missing: ${input}`); continue; }
    let result;
    try { result = readJson(path, path); } catch (error) { errors.push(error.message); continue; }
    const job = byJob.get(result?.job_id);
    if (!job) { errors.push(`unknown result job_id: ${result?.job_id ?? "missing"}`); continue; }
    if (seen.has(job.job_id)) { errors.push(`duplicate result job_id: ${job.job_id}`); continue; }
    seen.add(job.job_id);
    const current = resultErrors(result, job, root);
    errors.push(...current);
    if (current.length === 0) results.push(result);
  }
  if (seen.size !== JOB_COUNT) errors.push(`result intake is missing ${JOB_COUNT - seen.size} manifest jobs`);
  return { errors, results };
}

export function collectResults(root = ROOT, inputPaths = []) {
  const checked = validateResultSet(root, inputPaths);
  if (checked.errors.length > 0) return { ...checked, written: [] };
  const destinations = checked.results.map((result) => ({ result, path: rootPath(root, result.result_path) }));
  const errors = [];
  for (const { result, path } of destinations) {
    if (!path || !under(result.result_path, `${NAMESPACE}/results`)) errors.push(`${result.job_id}: destination outside namespace`);
    else if (existsSync(path)) errors.push(`${result.job_id}: destination already exists; refusing overwrite`);
  }
  if (errors.length > 0) return { ...checked, errors, written: [] };
  for (const { result, path } of destinations) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  }
  return { ...checked, written: destinations.map(({ result }) => result.result_path) };
}

export function packageScaffold(root = ROOT) {
  const frozen = frozenBaselineStatus(root);
  if (frozen.errors.length > 0) throw new Error(frozen.errors.join("; "));
  const inputs = currentInputs(root);
  if (inputs.errors.length > 0) throw new Error(inputs.errors.join("; "));
  const manifest = buildManifest(root, frozen.manifest, inputs);
  writeImmutable(root, `${NAMESPACE}/result-schema.json`, resultSchema());
  for (const job of manifest.jobs) writeImmutable(root, packetPath(job), job);
  writeImmutable(root, `${NAMESPACE}/dispatch-matrix.json`, manifest.dispatch_matrix);
  writeImmutable(root, `${NAMESPACE}/manifest.json`, manifest);
  return manifest;
}

function usage() { console.error("Usage: node tools/evals/full19-replay.mjs package | validate <76-json-paths> | collect <76-json-paths>"); }
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [, , command, ...args] = process.argv;
  if (command === "package") {
    try { const manifest = packageScaffold(ROOT); console.log(`package valid: ${NAMESPACE} (${manifest.jobs.length} pending jobs, ${manifest.dispatch_matrix.length} Terra groups)`); }
    catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
  } else if (command === "validate" || command === "collect") {
    if (args.length !== JOB_COUNT) { usage(); process.exitCode = 1; }
    else {
      const checked = command === "validate" ? validateResultSet(ROOT, args) : collectResults(ROOT, args);
      if (checked.errors.length > 0) { console.error(checked.errors.map((error) => `FAIL: ${error}`).join("\n")); process.exitCode = 1; }
      else { console.log(`${command} valid: ${JOB_COUNT} fresh Terra results bound to ${NAMESPACE}`); if (command === "collect") checked.written.forEach((path) => console.log(path)); }
    }
  } else { usage(); process.exitCode = 1; }
}
