#!/usr/bin/env node
/**
 * Revision-capable, model-execution-free replay package for the smallest honest
 * seven-skill remediation subset.
 *
 * The paired lane uses one byte-identical neutral prompt treatment for frozen
 * baseline and current sources. The diversity lane is current-only and carries
 * a separate semantic-evidence contract. This tool never reads or writes the
 * historical full19 result/judge artifacts except to verify their blocked
 * status and immutable parent relationship.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_REVISION_ID = "remediation7-v2-2026-07-11";
export const DEFAULT_NAMESPACE = `evals/replays/${DEFAULT_REVISION_ID}`;
export const SKILLS = ["a11y-pass", "responsive-layout", "component-states", "micro-motion", "spacing-system", "design-system-interview", "tastecheck-pass"];
export const SEEDS = [101, 202, 303];
const BASELINE_ROOT = ".omx/evidence/tastecheck-v1/baseline/v0.1.0";
const BASELINE_MANIFEST = `${BASELINE_ROOT}/manifest.json`;
const HISTORICAL_NAMESPACE = "evals/replays/full19-v1rc-2026-07-11";
const SCENARIO_DEFINITION = "evals/scenarios/remediation7-replay.json";
const REPAIR_FIXTURE_SKILLS = new Set(["a11y-pass", "responsive-layout", "component-states"]);
const REQUIRED_EVIDENCE_FIELDS = ["status", "reason", "remediation", "evidence", "provenance"];
const TEMPERATURE_BY_CLASS = { generative: 0.7, repair: 0.2, gate: 0 };
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const REVISION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function fileSha256(path) { return sha256(readFileSync(path)); }
function readJson(path, label = path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`${label}: invalid JSON (${error.message})`); }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
function safeRepoPath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.startsWith("/") || relativePath.split("/").includes("..")) return null;
  const absolute = resolve(root, relativePath);
  const rootAbsolute = resolve(root);
  if (absolute !== rootAbsolute && !absolute.startsWith(`${rootAbsolute}/`)) return null;
  return absolute;
}
function under(path, prefix) { return path === prefix || path.startsWith(`${prefix}/`); }
function revisionNamespace(revisionId, namespace) {
  if (namespace) return namespace;
  return `evals/replays/${revisionId}`;
}

export function loadReplayDefinition(root = ROOT) {
  return readJson(join(root, SCENARIO_DEFINITION), SCENARIO_DEFINITION);
}

function historicalEvidence(root) {
  const errors = [];
  const manifestPath = join(root, `${HISTORICAL_NAMESPACE}/manifest.json`);
  const synthesisPath = join(root, `${HISTORICAL_NAMESPACE}/blind-judge/synthesis.json`);
  if (!existsSync(manifestPath)) errors.push(`historical full19 manifest missing: ${HISTORICAL_NAMESPACE}/manifest.json`);
  if (!existsSync(synthesisPath)) errors.push(`historical full19 synthesis missing: ${HISTORICAL_NAMESPACE}/blind-judge/synthesis.json`);
  let manifest = null;
  let synthesis = null;
  if (existsSync(manifestPath)) manifest = readJson(manifestPath);
  if (existsSync(synthesisPath)) synthesis = readJson(synthesisPath);
  if (manifest && (manifest.revision_id !== "full19-v1rc-2026-07-11" || manifest.namespace !== HISTORICAL_NAMESPACE)) errors.push("historical full19 manifest identity drifted");
  if (synthesis && (synthesis.revision_id !== "full19-v1rc-2026-07-11" || synthesis.verdict !== "blocked" || synthesis.release_eligible !== false)) errors.push("historical full19 evidence is not preserved as blocked");
  return { errors, manifest, synthesis, manifestPath, synthesisPath };
}

function validateFixtureContract(contract, label) {
  const errors = [];
  if (!contract || typeof contract !== "object") return [`${label}: contract must be an object`];
  if (contract.kind !== "sealed-artifact-contract" || contract.sealed !== true || contract.fail_closed_if_missing !== true) errors.push(`${label}: fixture must be sealed and fail closed`);
  if (typeof contract.fixture_id !== "string" || typeof contract.skill !== "string") errors.push(`${label}: fixture_id and skill are required`);
  const artifacts = contract.required_artifacts;
  if (!Array.isArray(artifacts) || artifacts.length === 0) errors.push(`${label}: required_artifacts must be non-empty`);
  const ids = new Set();
  for (const artifact of artifacts ?? []) {
    if (!artifact || typeof artifact.id !== "string" || ids.has(artifact.id)) errors.push(`${label}: artifact IDs must be unique strings`);
    ids.add(artifact?.id);
    if (!Array.isArray(artifact?.required_fields) || !artifact.required_fields.includes("path") || !artifact.required_fields.includes("sha256")) errors.push(`${label}/${artifact?.id ?? "unknown"}: path and sha256 are required fields`);
  }
  return errors;
}

function expectedArtifactEntries(scenarioEntries) {
  return scenarioEntries
    .filter((entry) => REPAIR_FIXTURE_SKILLS.has(entry.skill) && entry.fixture)
    .flatMap((entry) => entry.fixture.required_artifacts.map((artifact) => ({
      skill: entry.skill,
      fixture_id: entry.fixture.fixture_id,
      id: artifact.id,
      path: `${entry.skill}/${artifact.id}.json`,
    })));
}

function validateArtifactIndex(root, manifest, scenarioEntries) {
  const errors = [];
  const indexPath = manifest.artifact_index_path ?? `${manifest.artifact_root}/fixture-index.json`;
  const absoluteIndex = safeRepoPath(root, indexPath);
  if (!absoluteIndex || !existsSync(absoluteIndex)) return { errors: [`sealed artifact index missing: ${indexPath}`], index: null };
  if (manifest.artifact_index_sha256 && fileSha256(absoluteIndex) !== manifest.artifact_index_sha256) errors.push(`sealed artifact index digest mismatch: ${indexPath}`);
  let index;
  try { index = readJson(absoluteIndex, indexPath); } catch (error) { return { errors: [...errors, error.message], index: null }; }
  if (index.schema_version !== 1 || index.kind !== "deterministic-sealed-fixture-index" || index.revision_id !== manifest.revision_id || index.synthetic !== true) errors.push(`sealed artifact index identity invalid: ${indexPath}`);
  if (!ISO_UTC.test(index.captured_at ?? "")) errors.push(`sealed artifact index timestamp invalid: ${indexPath}`);
  if (!Array.isArray(index.entries)) errors.push(`sealed artifact index entries missing: ${indexPath}`);
  const expected = expectedArtifactEntries(scenarioEntries);
  const expectedByKey = new Map(expected.map((entry) => [`${entry.skill}:${entry.id}`, entry]));
  const seen = new Set();
  for (const entry of index.entries ?? []) {
    const key = `${entry?.skill}:${entry?.id}`;
    if (seen.has(key)) errors.push(`sealed artifact index duplicate entry: ${key}`);
    seen.add(key);
    const expectedEntry = expectedByKey.get(key);
    if (!expectedEntry) { errors.push(`sealed artifact index unexpected entry: ${key}`); continue; }
    if (entry.fixture_id !== expectedEntry.fixture_id || entry.path !== expectedEntry.path) errors.push(`sealed artifact index binding drifted: ${key}`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) errors.push(`sealed artifact index SHA-256 invalid: ${key}`);
    if (!ISO_UTC.test(entry.captured_at ?? "")) errors.push(`sealed artifact index timestamp invalid: ${key}`);
    if (typeof entry.path !== "string" || entry.path.startsWith("/") || entry.path.split("/").includes("..")) { errors.push(`sealed artifact path invalid: ${key}`); continue; }
    const artifactPath = safeRepoPath(root, `${manifest.artifact_root}/${entry.path}`);
    if (!artifactPath || !existsSync(artifactPath)) errors.push(`sealed artifact missing: ${manifest.artifact_root}/${entry.path}`);
    else if (fileSha256(artifactPath) !== entry.sha256) errors.push(`sealed artifact digest mismatch: ${manifest.artifact_root}/${entry.path}`);
  }
  for (const entry of expected) if (!seen.has(`${entry.skill}:${entry.id}`)) errors.push(`sealed artifact index missing entry: ${entry.skill}:${entry.id}`);
  if (seen.size !== expected.length) errors.push(`sealed artifact index must contain exactly ${expected.length} required entries`);
  return { errors, index };
}

function loadScenarioEntries(root, definition) {
  const errors = [];
  const entries = [];
  if (definition.schema_version !== 1 || definition.revision_id !== DEFAULT_REVISION_ID) errors.push("remediation7 scenario definition identity drifted");
  if (JSON.stringify(definition.seeds) !== JSON.stringify(SEEDS)) errors.push("remediation7 seed set drifted");
  if (JSON.stringify(definition.skills?.map((entry) => entry.skill)) !== JSON.stringify(SKILLS)) errors.push("remediation7 skill order/set drifted");
  for (const entry of definition.skills ?? []) {
    const scenarioPath = safeRepoPath(root, entry.scenario_path);
    if (!scenarioPath || !existsSync(scenarioPath)) { errors.push(`${entry.skill}: scenario missing`); continue; }
    let scenario;
    try { scenario = readJson(scenarioPath, entry.scenario_path); } catch (error) { errors.push(error.message); continue; }
    if (scenario.skill !== entry.skill || typeof scenario.id !== "string" || typeof scenario.prompt !== "string") errors.push(`${entry.skill}: scenario binding is invalid`);
    const fixturePath = entry.fixture_contract_path ?? null;
    let fixture = null;
    if (fixturePath) {
      const absoluteFixture = safeRepoPath(root, fixturePath);
      if (!absoluteFixture || !existsSync(absoluteFixture)) errors.push(`${entry.skill}: fixture contract missing`);
      else {
        try { fixture = readJson(absoluteFixture, fixturePath); errors.push(...validateFixtureContract(fixture, fixturePath)); }
        catch (error) { errors.push(error.message); }
      }
      if (fixture && fixture.skill !== entry.skill) errors.push(`${entry.skill}: fixture skill binding drifted`);
    }
    entries.push({ ...entry, scenario, scenario_path: entry.scenario_path, fixture, fixture_path: fixturePath });
  }
  return { errors, entries };
}

function currentSource(root, skill) {
  const path = `skills/${skill}/SKILL.md`;
  const absolute = safeRepoPath(root, path);
  if (!absolute || !existsSync(absolute)) throw new Error(`${skill}: current source missing`);
  return { path, sha256: fileSha256(absolute), kind: "current-live", version: "current" };
}

function baselineSource(root, skill) {
  const manifestPath = join(root, BASELINE_MANIFEST);
  if (!existsSync(manifestPath)) throw new Error(`baseline manifest missing: ${BASELINE_MANIFEST}`);
  const manifest = readJson(manifestPath, BASELINE_MANIFEST);
  const entry = manifest.entries?.find((item) => item.path === `skills/${skill}/SKILL.md`);
  if (!entry) throw new Error(`${skill}: frozen baseline source entry missing`);
  const path = `${BASELINE_ROOT}/sha256/${entry.sha256}`;
  const absolute = safeRepoPath(root, path);
  if (!absolute || !existsSync(absolute)) throw new Error(`${skill}: frozen baseline blob missing`);
  if (fileSha256(absolute) !== entry.sha256) throw new Error(`${skill}: frozen baseline blob digest mismatch`);
  return { path, sha256: entry.sha256, kind: "frozen-baseline-content-addressed", version: "v0.1.0-frozen" };
}

function temperatureFor(scenario) { return TEMPERATURE_BY_CLASS[scenario.class] ?? null; }
function neutralPrompt(definition, scenario) {
  return {
    system_prompt: definition.neutral_pairing.instruction,
    user_prompt: scenario.prompt,
    requested_temperature: temperatureFor(scenario),
  };
}

function fixtureBinding(root, entry) {
  if (!entry.fixture) return null;
  return {
    skill: entry.skill,
    fixture_id: entry.fixture.fixture_id,
    path: entry.fixture_path,
    sha256: fileSha256(join(root, entry.fixture_path)),
    required_artifacts: entry.fixture.required_artifacts,
  };
}

function makeJob({ root, namespace, revisionId, lane, runType, seed, entry, source, definition }) {
  const skill = entry.skill;
  const scenario = entry.scenario;
  const id = `${skill}-${lane === "paired" ? `${runType}-` : "diversity-"}seed${seed}`;
  const packetPath = `${namespace}/${lane}/jobs/${id}.json`;
  const resultPath = `${namespace}/${lane}/results/${id}.json`;
  const prompt = lane === "paired" ? neutralPrompt(definition, scenario) : {
    system_prompt: `${definition.diversity_lane.instruction} Required axes: ${entry.semantic_diversity.required_axes.join(", ")}. Required invariants: ${entry.semantic_diversity.required_invariants.join(", ")}.`,
    user_prompt: scenario.prompt,
    requested_temperature: temperatureFor(scenario),
  };
  const packet = {
    schema_version: 1,
    revision_id: revisionId,
    namespace,
    lane,
    job_id: id,
    skill,
    scenario_id: scenario.id,
    run_type: runType,
    requested_seed: seed,
    requested_temperature: prompt.requested_temperature,
    executor: definition.executor,
    evaluator_executor: definition.evaluator_executor,
    fresh_context: true,
    skill_version: source.version,
    skill_source_kind: source.kind,
    skill_source_path: source.path,
    skill_source_sha256: source.sha256,
    prompt_packet_ref: packetPath,
    result_path: resultPath,
    system_prompt: prompt.system_prompt,
    user_prompt: prompt.user_prompt,
    neutral_prompt_sha256: lane === "paired" ? sha256(JSON.stringify(prompt)) : null,
    scenario,
    assertions: scenario.assertions,
    expected_evidence_fields: REQUIRED_EVIDENCE_FIELDS,
    semantic_diversity: entry.semantic_diversity,
    deterministic_gate: entry.deterministic_gate ?? null,
    fixture_contract_id: entry.fixture?.fixture_id ?? null,
  };
  const absolutePacket = safeRepoPath(root, packetPath);
  writeJson(absolutePacket, packet);
  return {
    schema_version: 1,
    revision_id: revisionId,
    namespace,
    lane,
    job_id: id,
    skill,
    scenario_id: scenario.id,
    run_type: runType,
    requested_seed: seed,
    requested_temperature: prompt.requested_temperature,
    executor: definition.executor,
    fresh_context: true,
    skill_version: source.version,
    skill_source_kind: source.kind,
    skill_source_path: source.path,
    skill_source_sha256: source.sha256,
    prompt_packet_ref: packetPath,
    prompt_packet_sha256: fileSha256(absolutePacket),
    result_path: resultPath,
    fixture_contract_id: entry.fixture?.fixture_id ?? null,
    semantic_diversity: entry.semantic_diversity,
    deterministic_gate: entry.deterministic_gate ?? null,
  };
}

function resultSchema() {
  return {
    schema_version: 1,
    description: "Model results for remediation7 are accepted only when bound to a packaged job and, for repair skills, sealed artifact receipts.",
    required: ["schema_version", "revision_id", "namespace", "job_id", "lane", "run_type", "skill", "scenario_id", "requested_seed", "requested_temperature", "prompt_packet_sha256", "status", "raw_output", "raw_output_hash", "artifact_receipts"],
    artifact_receipt_required: ["fixture_id", "id", "path", "sha256", "captured_at"],
    no_model_execution_in_package: true,
  };
}

export function buildReplayPackage(root = ROOT, { revisionId = DEFAULT_REVISION_ID, namespace = revisionNamespace(revisionId) } = {}) {
  if (!REVISION_ID.test(revisionId) || revisionId === "full19-v1rc-2026-07-11" || namespace === HISTORICAL_NAMESPACE || namespace.startsWith(`${HISTORICAL_NAMESPACE}/`)) throw new Error("invalid or historical full19 namespace is immutable and cannot be a package target");
  const definition = loadReplayDefinition(root);
  const historical = historicalEvidence(root);
  if (historical.errors.length > 0) throw new Error(historical.errors.join("\n"));
  const scenarios = loadScenarioEntries(root, definition);
  if (scenarios.errors.length > 0) throw new Error(scenarios.errors.join("\n"));
  const artifactRoot = `.omx/evidence/tastecheck-v1/raw/${revisionId}/artifacts`;
  const artifactIndexPath = `${artifactRoot}/fixture-index.json`;
  const artifactCheck = validateArtifactIndex(root, { revision_id: revisionId, artifact_root: artifactRoot, artifact_index_path: artifactIndexPath }, scenarios.entries);
  if (artifactCheck.errors.length > 0) throw new Error(artifactCheck.errors.join("\n"));
  const target = safeRepoPath(root, namespace);
  if (!target) throw new Error("package namespace is outside repository root");
  if (existsSync(target)) throw new Error(`refusing to overwrite existing replay namespace: ${namespace}`);
  mkdirSync(target, { recursive: true });

  const pairedJobs = [];
  const diversityJobs = [];
  for (const entry of scenarios.entries) {
    const baseline = baselineSource(root, entry.skill);
    const current = currentSource(root, entry.skill);
    for (const seed of SEEDS) {
      pairedJobs.push(makeJob({ root, namespace, revisionId, lane: "paired", runType: "baseline", seed, entry, source: baseline, definition }));
      pairedJobs.push(makeJob({ root, namespace, revisionId, lane: "paired", runType: "upgraded", seed, entry, source: current, definition }));
      diversityJobs.push(makeJob({ root, namespace, revisionId, lane: "diversity", runType: "upgraded", seed, entry, source: current, definition }));
    }
  }
  const fixtureContracts = scenarios.entries.filter((entry) => entry.fixture).map((entry) => fixtureBinding(root, entry));
  const manifest = {
    schema_version: 2,
    revision_id: revisionId,
    namespace,
    kind: "revision-capable-remediation-replay",
    status: "pending",
    model_execution_started: false,
    executor: definition.executor,
    evaluator_executor: definition.evaluator_executor,
    skills: SKILLS,
    seeds: SEEDS,
    source_definition: SCENARIO_DEFINITION,
    source_definition_revision: definition.revision_id,
    artifact_root: artifactRoot,
    artifact_index_path: artifactIndexPath,
    artifact_index_sha256: fileSha256(safeRepoPath(root, artifactIndexPath)),
    artifact_fixture_count: artifactCheck.index.entries.length,
    historical_parent: {
      revision_id: "full19-v1rc-2026-07-11",
      namespace: HISTORICAL_NAMESPACE,
      immutable: true,
      expected_verdict: "blocked",
      expected_release_eligible: false,
      manifest_sha256: fileSha256(historical.manifestPath),
      synthesis_sha256: fileSha256(historical.synthesisPath),
    },
    paired_lane: { prompt_contract: "neutral-v1", current_only: false, job_count: pairedJobs.length, jobs: pairedJobs },
    diversity_lane: { prompt_contract: "semantic-current-only-v1", current_only: true, job_count: diversityJobs.length, jobs: diversityJobs },
    fixture_contracts: fixtureContracts,
    result_schema_path: `${namespace}/result-schema.json`,
  };
  writeJson(join(target, "manifest.json"), manifest);
  writeJson(join(target, "result-schema.json"), resultSchema());
  const checked = validateReplayPackage(root, { namespace });
  if (checked.errors.length > 0) throw new Error(`new replay package failed self-validation:\n${checked.errors.join("\n")}`);
  return { manifest_path: `${namespace}/manifest.json`, paired_job_count: pairedJobs.length, diversity_job_count: diversityJobs.length, model_execution_started: false, manifest };
}

export function validateReplayPackage(root = ROOT, { namespace = DEFAULT_NAMESPACE } = {}) {
  const errors = [];
  const manifestPath = safeRepoPath(root, `${namespace}/manifest.json`);
  if (!manifestPath || !existsSync(manifestPath)) return { errors: [`replay manifest missing: ${namespace}/manifest.json`], manifest: null };
  let manifest;
  try { manifest = readJson(manifestPath, `${namespace}/manifest.json`); } catch (error) { return { errors: [error.message], manifest: null }; }
  if (manifest.revision_id === "full19-v1rc-2026-07-11" || manifest.namespace === HISTORICAL_NAMESPACE) errors.push("new replay cannot claim the historical full19 identity");
  if (!REVISION_ID.test(manifest.revision_id ?? "")) errors.push("replay revision_id is invalid");
  if (manifest.namespace !== namespace) errors.push("replay namespace binding drifted");
  if (manifest.status !== "pending" || manifest.model_execution_started !== false) errors.push("new replay package must remain pending and model-execution-free");
  const historical = historicalEvidence(root);
  errors.push(...historical.errors);
  if (manifest.historical_parent?.immutable !== true || manifest.historical_parent?.expected_verdict !== "blocked" || manifest.historical_parent?.expected_release_eligible !== false) errors.push("historical parent policy is not immutable/blocked");
  if (historical.manifestPath && existsSync(historical.manifestPath) && manifest.historical_parent?.manifest_sha256 !== fileSha256(historical.manifestPath)) errors.push("historical manifest digest drifted after packaging");
  if (historical.synthesisPath && existsSync(historical.synthesisPath) && manifest.historical_parent?.synthesis_sha256 !== fileSha256(historical.synthesisPath)) errors.push("historical synthesis digest drifted after packaging");
  if (JSON.stringify(manifest.skills) !== JSON.stringify(SKILLS)) errors.push("manifest skill set drifted");
  if (JSON.stringify(manifest.seeds) !== JSON.stringify(SEEDS)) errors.push("manifest seed set drifted");
  const definition = existsSync(join(root, SCENARIO_DEFINITION)) ? readJson(join(root, SCENARIO_DEFINITION), SCENARIO_DEFINITION) : null;
  const scenarios = definition ? loadScenarioEntries(root, definition) : { errors: ["scenario definition missing"], entries: [] };
  errors.push(...scenarios.errors);
  if (definition && manifest.source_definition_revision !== definition.revision_id) errors.push("source definition revision binding drifted");
  const artifactCheck = validateArtifactIndex(root, manifest, scenarios.entries);
  errors.push(...artifactCheck.errors);
  const scenarioBySkill = new Map(scenarios.entries.map((entry) => [entry.skill, entry]));
  for (const binding of manifest.fixture_contracts ?? []) {
    const path = safeRepoPath(root, binding.path);
    if (!path || !existsSync(path)) { errors.push(`${binding.skill}: fixture contract missing`); continue; }
    if (fileSha256(path) !== binding.sha256) errors.push(`${binding.skill}: fixture contract digest mismatch`);
    try { errors.push(...validateFixtureContract(readJson(path, binding.path), binding.path)); } catch (error) { errors.push(error.message); }
  }
  const allJobs = [...(manifest.paired_lane?.jobs ?? []), ...(manifest.diversity_lane?.jobs ?? [])];
  if (manifest.paired_lane?.job_count !== 42 || manifest.paired_lane?.jobs?.length !== 42) errors.push("paired lane must contain exactly 42 jobs");
  if (manifest.diversity_lane?.job_count !== 21 || manifest.diversity_lane?.jobs?.length !== 21) errors.push("diversity lane must contain exactly 21 jobs");
  const seen = new Set();
  for (const job of allJobs) {
    if (seen.has(job.job_id)) errors.push(`duplicate job ${job.job_id}`);
    seen.add(job.job_id);
    if (!SKILLS.includes(job.skill) || !SEEDS.includes(job.requested_seed)) errors.push(`${job.job_id}: invalid skill or seed`);
    if (job.lane === "diversity" && (job.run_type !== "upgraded" || job.skill_version !== "current")) errors.push(`${job.job_id}: diversity lane must be current-only`);
    if (job.lane === "paired" && !["baseline", "upgraded"].includes(job.run_type)) errors.push(`${job.job_id}: paired lane run type invalid`);
    const entry = scenarioBySkill.get(job.skill);
    if (!entry || job.scenario_id !== entry.scenario.id || job.fixture_contract_id !== (entry.fixture?.fixture_id ?? null)) errors.push(`${job.job_id}: scenario/fixture binding drifted`);
    const source = safeRepoPath(root, job.skill_source_path);
    if (!source || !existsSync(source) || fileSha256(source) !== job.skill_source_sha256) errors.push(`${job.job_id}: source missing or digest drifted`);
    const packet = safeRepoPath(root, job.prompt_packet_ref);
    if (!packet || !existsSync(packet)) { errors.push(`${job.job_id}: packet missing`); continue; }
    if (fileSha256(packet) !== job.prompt_packet_sha256) errors.push(`${job.job_id}: packet digest mismatch`);
    let packetJson;
    try { packetJson = readJson(packet, job.prompt_packet_ref); } catch (error) { errors.push(error.message); continue; }
    for (const key of ["revision_id", "namespace", "job_id", "lane", "run_type", "skill", "scenario_id", "requested_seed", "skill_source_path", "skill_source_sha256", "result_path"]) if (packetJson[key] !== job[key]) errors.push(`${job.job_id}: packet ${key} mismatch`);
    if (job.lane === "paired" && packetJson.neutral_prompt_sha256 === null) errors.push(`${job.job_id}: paired packet lacks neutral prompt binding`);
  }
  for (const skill of SKILLS) for (const seed of SEEDS) {
    const baseline = manifest.paired_lane?.jobs?.find((job) => job.skill === skill && job.requested_seed === seed && job.run_type === "baseline");
    const upgraded = manifest.paired_lane?.jobs?.find((job) => job.skill === skill && job.requested_seed === seed && job.run_type === "upgraded");
    if (!baseline || !upgraded) { errors.push(`${skill}/seed${seed}: paired baseline/upgraded pair missing`); continue; }
    const baselinePacket = readJson(safeRepoPath(root, baseline.prompt_packet_ref));
    const upgradedPacket = readJson(safeRepoPath(root, upgraded.prompt_packet_ref));
    for (const key of ["system_prompt", "user_prompt", "requested_temperature", "neutral_prompt_sha256"]) if (baselinePacket[key] !== upgradedPacket[key]) errors.push(`${skill}/seed${seed}: neutral paired prompt treatment drifted`);
  }
  return { errors, manifest, artifactIndex: artifactCheck.index };
}

export function validateModelResult(root = ROOT, result) {
  const errors = [];
  if (!result || typeof result !== "object") return { errors: ["result must be an object"] };
  const packageCheck = validateReplayPackage(root, { namespace: result.namespace });
  errors.push(...packageCheck.errors);
  const manifest = packageCheck.manifest;
  if (!manifest) return { errors };
  const jobs = [...manifest.paired_lane.jobs, ...manifest.diversity_lane.jobs];
  const job = jobs.find((entry) => entry.job_id === result.job_id);
  if (!job) return { errors: [...errors, `unknown result job ${result.job_id}`] };
  for (const key of ["revision_id", "namespace", "job_id", "lane", "run_type", "skill", "scenario_id", "requested_seed", "requested_temperature", "prompt_packet_sha256"]) if (result[key] !== job[key]) errors.push(`${job.job_id}: result ${key} mismatch`);
  if (result.status !== "complete") errors.push(`${job.job_id}: result must be complete`);
  if (typeof result.raw_output !== "string" || !result.raw_output) errors.push(`${job.job_id}: raw_output is required`);
  if (result.raw_output_hash !== sha256(result.raw_output ?? "")) errors.push(`${job.job_id}: raw_output hash mismatch`);
  if (!Array.isArray(result.artifact_receipts)) errors.push(`${job.job_id}: artifact_receipts must be an array`);
  let entry = null;
  let required = [];
  try {
    entry = loadReplayDefinition(root).skills.find((item) => item.skill === job.skill);
    if (entry?.fixture_contract_path) {
      const fixturePath = safeRepoPath(root, entry.fixture_contract_path);
      if (fixturePath && existsSync(fixturePath)) required = readJson(fixturePath).required_artifacts ?? [];
      else errors.push(`${job.job_id}: fixture contract missing`);
    }
  } catch (error) {
    errors.push(`${job.job_id}: fixture contract invalid (${error.message})`);
  }
  const receipts = result.artifact_receipts ?? [];
  if (REPAIR_FIXTURE_SKILLS.has(job.skill)) {
    const expectedIds = required.map((artifact) => artifact.id).sort();
    const actualIds = receipts.map((receipt) => receipt.id).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) errors.push(`${job.job_id}: sealed artifact receipt set is incomplete or contains extras`);
    for (const receipt of receipts) {
      if (!receipt.fixture_id || receipt.fixture_id !== job.fixture_contract_id || !receipt.path || !/^[a-f0-9]{64}$/.test(receipt.sha256 ?? "") || !ISO_UTC.test(receipt.captured_at ?? "")) errors.push(`${job.job_id}/${receipt.id}: malformed artifact receipt`);
      if (typeof receipt.path !== "string" || receipt.path.startsWith("/") || receipt.path.split("/").includes("..") || !under(receipt.path, manifest.artifact_root)) { errors.push(`${job.job_id}/${receipt.id}: artifact path outside sealed artifact root`); continue; }
      const artifact = safeRepoPath(root, receipt.path);
      if (!artifact || !existsSync(artifact)) errors.push(`${job.job_id}/${receipt.id}: artifact missing`);
      else if (fileSha256(artifact) !== receipt.sha256) errors.push(`${job.job_id}/${receipt.id}: artifact digest mismatch`);
      const sealedEntry = packageCheck.artifactIndex?.entries?.find((entry) => entry.skill === job.skill && entry.id === receipt.id);
      if (!sealedEntry) errors.push(`${job.job_id}/${receipt.id}: artifact is not in sealed fixture index`);
      else {
        if (receipt.path !== `${manifest.artifact_root}/${sealedEntry.path}`) errors.push(`${job.job_id}/${receipt.id}: artifact path does not match sealed fixture index`);
        if (receipt.sha256 !== sealedEntry.sha256) errors.push(`${job.job_id}/${receipt.id}: receipt SHA-256 does not match sealed fixture index`);
        if (receipt.captured_at !== sealedEntry.captured_at) errors.push(`${job.job_id}/${receipt.id}: receipt timestamp does not match sealed fixture index`);
      }
    }
  } else if (receipts.length > 0) errors.push(`${job.job_id}: non-repair result cannot add artifact receipts`);
  if (job.lane === "diversity" && !result.semantic_variation_evidence) errors.push(`${job.job_id}: diversity result lacks semantic_variation_evidence`);
  return { errors, manifest, job };
}

function usage() { console.error("Usage: node tools/evals/remediation7-replay.mjs package [--revision ID] [--namespace PATH] | validate [--namespace PATH]"); }
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2];
  const revisionIndex = process.argv.indexOf("--revision");
  const namespaceIndex = process.argv.indexOf("--namespace");
  const revisionId = revisionIndex >= 0 ? process.argv[revisionIndex + 1] : DEFAULT_REVISION_ID;
  const namespace = namespaceIndex >= 0 ? process.argv[namespaceIndex + 1] : revisionNamespace(revisionId);
  try {
    if (command === "package") {
      const result = buildReplayPackage(ROOT, { revisionId, namespace });
      console.log(JSON.stringify({ manifest_path: result.manifest_path, paired_job_count: result.paired_job_count, diversity_job_count: result.diversity_job_count, model_execution_started: result.model_execution_started }, null, 2));
    } else if (command === "validate") {
      const result = validateReplayPackage(ROOT, { namespace });
      if (result.errors.length > 0) { console.error(result.errors.join("\n")); process.exitCode = 1; }
      else console.log(`valid: ${namespace} (42 paired jobs, 21 current-only diversity jobs)`);
    } else usage();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
