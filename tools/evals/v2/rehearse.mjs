#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import manifest from "../../../evals/v2/fixtures/execution-manifest-valid.mjs";
import { appendEvent, validateLedger } from "./lib/ledger.mjs";
import { buildBlindPackets } from "./lib/blind.mjs";
import { canonicalJson, computeValidatorClosure, sha256 } from "./lib/canonical-json.mjs";
import { buildGenerationPlan, verifyProductionAdmission } from "./lib/admission.mjs";
import { runGenerations } from "./lib/generate.mjs";
import { createBuildAuthority } from "./lib/packet-build-authority.mjs";
import {
  PRODUCTION_ADMITTED, PRODUCTION_NOT_STARTED, REHEARSAL_PASSED, RESOLVER_ATTESTATION_ISSUER_ALLOWLIST,
  freezeExecutionSelection, verifyAdmissionBindings
} from "./lib/providers.mjs";
import { createRandomization } from "./lib/randomization.mjs";
import { loadRegistry, validateCorpusSeparation } from "./lib/registry.mjs";
import { computeScenarioRegistrySha256, deriveRunId, loadRegistryManifest } from "./lib/reservation.mjs";
import {
  buildGenerationSchedule, buildJudgmentSchedule,
  persistInstantiatedJudgmentSchedule, persistPrepacketSchedule
} from "./lib/schedule.mjs";
import { runJudgments } from "./run-judges.mjs";
import { packetSha256, validateJudgeBatch } from "./validate-judges.mjs";

const BASELINE_REVISION = "0f99603a603b0243345e7320a52702df67a2194e";
const CANDIDATE_REVISION = "08591213f562073f9ddb0ff9012ec0e3f8ed09c2";
const VIEWPORTS = ["mobile", "desktop"];
const repoRoot = new URL("../../../", import.meta.url).pathname;

function durableJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, `${canonicalJson(value)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(dirname(path), "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

function attestation({ subject_kind, subject_canonical_id, provider, foundation_lineage, resolved_version, cost_kind = "flat-rate" }) {
  return {
    schema_version: 2, kind: "effectiveness-v2-resolver-attestation",
    issuer: RESOLVER_ATTESTATION_ISSUER_ALLOWLIST[0], subject_kind, subject_canonical_id,
    provider, resolved_version, foundation_lineage,
    evidence_sha256: sha256(`rehearsal-resolver|${subject_kind}|${subject_canonical_id}`),
    introspection_only: true, cost_kind, incremental_spend_usd: 0
  };
}

function rehearsalAttestations() {
  const values = [attestation({
    subject_kind: "generator", subject_canonical_id: manifest.generator.identity,
    provider: manifest.generator.provider, foundation_lineage: manifest.generator.foundation_lineage,
    resolved_version: manifest.generator.model_version, cost_kind: "already-provisioned"
  })];
  for (const family of manifest.evaluator_families) for (const identity of family.identities) {
    values.push(attestation({
      subject_kind: "judge", subject_canonical_id: identity, provider: family.provider,
      foundation_lineage: family.foundation_lineage, resolved_version: family.model_version
    }));
  }
  return values;
}

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function addExactWorktree(sourceRoot, path, revision) {
  git(["-C", sourceRoot, "worktree", "add", "--detach", "--force", path, revision]);
  if (git(["-C", path, "rev-parse", "HEAD"]) !== revision) throw new Error("exact revision reconstruction failed");
  if (git(["-C", path, "status", "--porcelain"]) !== "") throw new Error("reconstructed revision is dirty");
}

function removeWorktree(sourceRoot, path) {
  try { git(["-C", sourceRoot, "worktree", "remove", "--force", path]); } catch { /* cleanup only */ }
}

function commitControlRoot(controlRoot) {
  git(["-C", controlRoot, "init", "-q"]);
  git(["-C", controlRoot, "add", "."]);
  git([
    "-C", controlRoot, "-c", "user.name=TasteCheck Rehearsal",
    "-c", "user.email=tastecheck-rehearsal@users.noreply.github.com",
    "commit", "-q", "-m", "rehearsal admission control"
  ], { env: { ...process.env, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z" } });
  if (git(["-C", controlRoot, "status", "--porcelain"]) !== "") throw new Error("control commit is dirty");
  return git(["-C", controlRoot, "rev-parse", "HEAD"]);
}

function readLedger(path) {
  const text = readFileSync(path, "utf8").trim();
  const events = text ? text.split("\n").map(JSON.parse) : [];
  validateLedger(events);
  return events;
}

function summarizeFailure(state, failureOrdinal, phases) {
  const events = readLedger(state.ledger_path);
  const ledgerOrdinals = events.filter(({ type }) => type === "ordinal_reserved").map(({ ordinal }) => ordinal);
  const closeIndex = events.findLastIndex((event) => event.type === "attempt_closed" && event.ordinal === failureOrdinal);
  const close = events[closeIndex];
  return {
    status: "production_incomplete", failing_ordinal: failureOrdinal,
    failure_status: close?.status,
    simulated_external_calls: state.admitted, real_external_calls_started: state.real_external_calls_started,
    ledger_ordinals: ledgerOrdinals, retry_count: 0,
    events_after_failure: closeIndex < 0 ? -1 : events.length - closeIndex - 1,
    unmask_opened: false, production_artifacts_written: false,
    human_calibration_claimed: false, pre_admission_order: phases
  };
}

function syntheticBytes(job, sourceBinding) {
  const variant = job.arm === "baseline" ? "First" : "Second";
  return `<main><h1>${variant} rendition</h1><p>${job.scenario.scenario_id} ${job.seed} ${sourceBinding.skill_pack_sha256}</p></main>`;
}

function committedSkillPackSha256(path) {
  const files = git(["-C", path, "ls-tree", "-r", "--name-only", "HEAD", "--", "skills", "commands", "contracts"])
    .split("\n").filter(Boolean).sort();
  if (files.length === 0) throw new Error("source skill-pack content is missing");
  const digest = createHash("sha256");
  for (const file of files) {
    const bytes = execFileSync("git", ["-C", path, "show", `HEAD:${file}`], { stdio: ["ignore", "pipe", "pipe"] });
    digest.update(file); digest.update("\0"); digest.update(bytes); digest.update("\n");
  }
  return digest.digest("hex");
}

function sourceBinding(path, expectedRevision) {
  const revision = git(["-C", path, "rev-parse", "HEAD"]);
  if (revision !== expectedRevision || git(["-C", path, "status", "--porcelain"]) !== "") {
    throw new Error("source revision binding mismatch");
  }
  return Object.freeze({
    root: path, revision, tree_oid: git(["-C", path, "rev-parse", "HEAD^{tree}"]),
    skill_pack_sha256: committedSkillPackSha256(path)
  });
}

function validJudgeArtifact(entry, packet, anchorMetadata) {
  const anchor = anchorMetadata.find(({ packet_id }) => packet.packet_id === packet_id);
  const preference = anchor?.expected ?? "tie";
  const citedSlot = preference === "slot-1" ? 1 : 0;
  const arm = packet.arms.find(({ opaque_slot }) => opaque_slot === citedSlot);
  const codepoints = Array.from(arm.artifact_bytes);
  const end = Math.min(12, codepoints.length);
  const dimensions = { direction: 4, structure: 4, accessibility: 4, verbal: 4, integration: 4 };
  return {
    schema_version: 2, kind: "effectiveness-v2-judge-result",
    packet_id: entry.packet_id, family_id: entry.family, identity_id: entry.identity,
    invocation_id: entry.invocation_id, context_id: entry.context_id,
    packet_sha256: packetSha256(packet), preference,
    arm_scores: [
      { opaque_slot: 0, dimensions: { ...dimensions } },
      { opaque_slot: 1, dimensions: { ...dimensions } }
    ],
    hard_regressions: [],
    evidence_citations: [{
      artifact_id: arm.artifact_id, opaque_slot: citedSlot, viewport_id: "mobile",
      artifact_sha256: arm.artifact_sha256, start_codepoint: 0, end_codepoint: end,
      exact_span: codepoints.slice(0, end).join("")
    }]
  };
}

export function rehearse({
  failureOrdinal = null, failPreAdmission = false, invalidJudgeOrdinal = null,
  swapSourceRoots = false, admissionMutation = null
} = {}) {
  if (failureOrdinal !== null && ![1, 49, 80, 160].includes(failureOrdinal)) {
    throw new Error("rehearsal failure ordinal must be one of 1, 49, 80, or 160");
  }
  const tempRoot = mkdtempSync(join(tmpdir(), "tastecheck-v2-rehearsal-"));
  const baselineRoot = join(tempRoot, "source-a");
  const candidateRoot = join(tempRoot, "source-b");
  const controlRoot = join(tempRoot, "control");
  const secretRoot = join(tempRoot, "sealed");
  const phases = [];
  let worktreesAdded = false;
  const originalFetch = globalThis.fetch;
  try {
    addExactWorktree(repoRoot, baselineRoot, BASELINE_REVISION);
    addExactWorktree(repoRoot, candidateRoot, CANDIDATE_REVISION);
    worktreesAdded = true;
    const sourceRoots = swapSourceRoots
      ? { baseline: candidateRoot, candidate: baselineRoot }
      : { baseline: baselineRoot, candidate: candidateRoot };
    const sourceBindings = {
      baseline: sourceBinding(sourceRoots.baseline, BASELINE_REVISION),
      candidate: sourceBinding(sourceRoots.candidate, CANDIDATE_REVISION)
    };
    const registry = loadRegistry(repoRoot);
    validateCorpusSeparation(registry);
    const registryManifest = loadRegistryManifest(repoRoot);
    const scenarioRegistrySha256 = computeScenarioRegistrySha256(registryManifest);
    phases.push("registry_and_revisions_verified");

    const closure = computeValidatorClosure(repoRoot);
    const trackedProtocol = JSON.parse(readFileSync(join(repoRoot, "evals/v2/protocol.json"), "utf8"));
    if (closure.sha256 !== trackedProtocol.packet_validator_sha256 || closure.version !== trackedProtocol.packet_validator_version) {
      throw new Error("validator closure drift");
    }
    phases.push("validator_closure_verified");
    if (failPreAdmission) return {
      status: PRODUCTION_NOT_STARTED, simulated_external_calls: 0, real_external_calls_started: 0,
      ledger_ordinals: [], unmask_opened: false, production_artifacts_written: false,
      human_calibration_claimed: false, pre_admission_order: phases
    };

    const created = createRandomization({ domain: "effectiveness-v2-rehearsal", secretRoot });
    const protocol = { ...trackedProtocol, randomization_commitment_sha256: created.commitment.commitment_sha256 };
    phases.push("randomization_committed");
    const attestations = rehearsalAttestations();
    const selection = freezeExecutionSelection({ manifest, attestations });
    const admission = verifyAdmissionBindings({
      protocol, manifest, selection, attestations,
      commitmentSha256: created.commitment.commitment_sha256
    });
    const runId = deriveRunId({
      protocolSha256: admission.protocol_sha256, scenarioRegistrySha256,
      baselineRevision: BASELINE_REVISION, candidateRevision: CANDIDATE_REVISION,
      executionManifestSha256: admission.execution_manifest_sha256,
      randomizationCommitmentSha256: created.commitment.commitment_sha256
    });
    const sourceSha256 = sha256(canonicalJson({ baseline: BASELINE_REVISION, candidate: CANDIDATE_REVISION }));
    const generationPlan = buildGenerationPlan({
      protocol, registry, protocol_sha256: admission.protocol_sha256,
      generatorBinding: selection.generator
    });
    const generationSchedule = buildGenerationSchedule({ protocol, registry });
    mkdirSync(controlRoot, { recursive: true });
    git(["-C", controlRoot, "init", "-q"]);
    const prepacketPath = join(controlRoot, "prepacket-schedule.json");
    const prepacket = persistPrepacketSchedule({
      path: prepacketPath, generationSchedule, generationPlan, selection, protocol, registry,
      protocolSha256: admission.protocol_sha256, scenarioRegistrySha256, runId
    });
    durableJson(join(controlRoot, "protocol.json"), protocol);
    durableJson(join(controlRoot, "execution-manifest.json"), manifest);
    durableJson(join(controlRoot, "execution-selection.json"), selection);
    durableJson(join(controlRoot, "randomization-commitment.json"), created.commitment);
    durableJson(join(controlRoot, "run-id.json"), { run_id: runId });
    const ledgerPath = join(controlRoot, "ledger.jsonl");
    appendEvent(ledgerPath, null, {
      type: "run_initialized", run_id: runId, protocol_sha256: admission.protocol_sha256,
      scenario_registry_sha256: scenarioRegistrySha256, source_sha256: sourceSha256,
      execution_manifest_sha256: admission.execution_manifest_sha256,
      randomization_commitment_sha256: created.commitment.commitment_sha256,
      exclusions: []
    });
    if (admissionMutation !== "missing") {
      const admittedEvent = {
        type: PRODUCTION_ADMITTED, run_id: runId,
        protocol_sha256: admission.protocol_sha256,
        source_sha256: sourceSha256,
        execution_manifest_sha256: admission.execution_manifest_sha256,
        scenario_registry_sha256: admissionMutation === "scenario_registry_sha256" ? "0".repeat(64) : scenarioRegistrySha256,
        randomization_commitment_sha256: created.commitment.commitment_sha256,
        selection_sha256: admission.selection_sha256,
        prepacket_schedule_sha256: prepacket.schedule_sha256,
        exclusions: [], max_external_calls: 160, incremental_spend_cap_usd: 0, retry_policy: "none"
      };
      appendEvent(ledgerPath, readLedger(ledgerPath).at(-1), admittedEvent);
      if (admissionMutation === "duplicate") appendEvent(ledgerPath, readLedger(ledgerPath).at(-1), admittedEvent);
    }
    phases.push("control_artifacts_persisted");
    phases.push("production_admitted");
    git(["-C", controlRoot, "add", "."]);
    git([
      "-C", controlRoot, "-c", "user.name=TasteCheck Rehearsal",
      "-c", "user.email=tastecheck-rehearsal@users.noreply.github.com",
      "commit", "-q", "-m", "rehearsal admission control"
    ], { env: { ...process.env, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z" } });
    phases.push("control_commit_created");
    if (git(["-C", controlRoot, "status", "--porcelain"]) !== "" ||
        git(["-C", baselineRoot, "rev-parse", "HEAD"]) !== BASELINE_REVISION ||
        git(["-C", candidateRoot, "rev-parse", "HEAD"]) !== CANDIDATE_REVISION ||
        git(["-C", baselineRoot, "status", "--porcelain"]) !== "" ||
        git(["-C", candidateRoot, "status", "--porcelain"]) !== "") {
      throw new Error("clean HEAD revalidation failed");
    }
    phases.push("clean_head_revalidated");

    let networkAttempts = 0;
    globalThis.fetch = () => { networkAttempts += 1; throw new Error("rehearsal network tripwire"); };
    const state = {
      admitted: 0, spend_usd: 0, run_status: "running", ledger_path: ledgerPath,
      max_external_calls: 160, protocol_sha256: admission.protocol_sha256,
      source_sha256: sourceSha256, execution_manifest_sha256: admission.execution_manifest_sha256,
      scenario_registry_sha256: scenarioRegistrySha256, run_id: runId,
      prepacket_schedule_sha256: prepacket.schedule_sha256,
      frozen_execution_selection: selection,
      require_production_admission: true,
      randomization_commitment_sha256: created.commitment.commitment_sha256,
      selection_sha256: admission.selection_sha256,
      real_external_calls_started: 0
    };
    verifyProductionAdmission(state);
    const generatorRequest = {
      call_class: "generation", executor: selection.generator.executor,
      executor_digest: selection.generator.executor_digest,
      resolver_attestation_sha256: selection.generator.resolver_attestation_sha256,
      cost: { kind: selection.generator.executor.zero_cost_proof.kind, usd: 0 },
      protocol_sha256: state.protocol_sha256, source_sha256: state.source_sha256,
      execution_manifest_sha256: state.execution_manifest_sha256
    };
    const generations = [];
    let consumedSourceBindings = 0;
    const generationOutcome = runGenerations({
      plan: generationPlan, protocol, registry, prepacketSchedulePath: prepacketPath, state,
      requestFor: () => generatorRequest,
      route: ({ request }) => ({
        executor: request.executor, executor_digest: request.executor_digest,
        resolver_attestation_sha256: request.resolver_attestation_sha256
      }),
      invoke: (job, context) => {
        if (context.ordinal === 1) phases.push("ordinal_1_reserved");
        if (failureOrdinal === context.ordinal) return { exit_code: 0, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [] };
        const binding = sourceBindings[job.arm];
        if (!binding || binding.revision !== job.revision) throw new Error("generation source binding mismatch");
        consumedSourceBindings += 1;
        const bytes = syntheticBytes(job, binding);
        generations.push({ scenario_id: job.scenario.scenario_id, generation_seed: job.seed, arm: job.arm, bytes });
        return { exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1, artifacts: [{ artifact_sha256: sha256(bytes) }] };
      }
    });
    if (generationOutcome.run_status !== "running") return summarizeFailure(state, failureOrdinal, phases);

    const renders = generations.flatMap((generation) => VIEWPORTS.map((viewport_id) => ({
      scenario_id: generation.scenario_id, generation_seed: generation.generation_seed,
      arm: generation.arm, viewport_id,
      screenshot_sha256: sha256(`${generation.bytes}|${viewport_id}|screenshot`),
      dom_sha256: sha256(`${generation.bytes}|${viewport_id}|dom`),
      style_sha256: sha256(`${generation.bytes}|${viewport_id}|style`)
    })));
    const built = buildBlindPackets({
      protocol, registry, generations, renders,
      buildCapability: createBuildAuthority(created.privateStateRef)
    });
    const packetRoot = join(controlRoot, "packets");
    mkdirSync(packetRoot, { recursive: true });
    const packetFiles = new Map();
    for (const packet of [...built.packets, ...built.anchor_packets]) {
      const path = join(packetRoot, `${packet.packet_id}.json`);
      const bytes = `${canonicalJson(packet)}\n`;
      writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
      packetFiles.set(packet.packet_id, { path, file_sha256: sha256(bytes), packet });
    }
    const scheduleInput = { packets: built.packets, anchorPackets: built.anchor_packets, selection, runId };
    const judgmentSchedule = buildJudgmentSchedule(scheduleInput);
    const judgmentSchedulePath = join(controlRoot, "instantiated-judgment-schedule.json");
    persistInstantiatedJudgmentSchedule({
      path: judgmentSchedulePath, judgmentSchedule, state,
      prepacketScheduleSha256: prepacket.schedule_sha256
    });
    const judgeByDigest = new Map(selection.judges.map((judge) => [judge.executor_digest, judge]));
    const judgmentOutcome = runJudgments({
      schedule: judgmentSchedule, scheduleInput, state,
      instantiatedJudgmentSchedulePath: judgmentSchedulePath,
      packetPathFor: (entry) => packetFiles.get(entry.packet_id).path,
      packetFileSha256For: (entry) => packetFiles.get(entry.packet_id).file_sha256,
      requestFor: (entry) => {
        const judge = judgeByDigest.get(entry.executor_digest);
        return {
          call_class: entry.call_class, executor: judge.executor,
          executor_digest: judge.executor_digest,
          resolver_attestation_sha256: judge.resolver_attestation_sha256,
          cost: { kind: judge.executor.zero_cost_proof.kind, usd: 0 },
          protocol_sha256: state.protocol_sha256, source_sha256: state.source_sha256,
          execution_manifest_sha256: state.execution_manifest_sha256
        };
      },
      route: ({ request }) => ({
        executor: request.executor, executor_digest: request.executor_digest,
        resolver_attestation_sha256: request.resolver_attestation_sha256
      }),
      invoke: (entry, context) => {
        if (failureOrdinal === context.ordinal) return { exit_code: 0, turns: 0, tokens_in: 0, tokens_out: 0, artifacts: [] };
        const packet = packetFiles.get(entry.packet_id);
        if (invalidJudgeOrdinal === context.ordinal) return {
          exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1,
          artifacts: [JSON.stringify({ ...validJudgeArtifact(entry, packet.packet, built.anchor_metadata), arm_scores: [], evidence_citations: [] })]
        };
        return {
          exit_code: 0, turns: 1, tokens_in: 1, tokens_out: 1,
          artifacts: [JSON.stringify(validJudgeArtifact(entry, packet.packet, built.anchor_metadata))]
        };
      }
    });
    if (judgmentOutcome.run_status !== "running") return summarizeFailure(state, failureOrdinal ?? invalidJudgeOrdinal, phases);
    const batch = validateJudgeBatch({
      packetSet: built.packets, anchorSet: built.anchor_packets, anchorMetadata: built.anchor_metadata,
      results: judgmentOutcome.results, families: manifest.evaluator_families
    });
    if (!batch.valid) throw new Error(`rehearsal judge batch invalid: ${batch.errors.join("; ")}`);
    if (networkAttempts !== 0) throw new Error("rehearsal network tripwire was reached");
    const events = readLedger(ledgerPath);
    const ledgerOrdinals = events.filter(({ type }) => type === "ordinal_reserved").map(({ ordinal }) => ordinal);
    const report = {
      generations: generations.length, render_receipts: renders.length,
      packets: built.packets.length, anchors: built.anchor_packets.length,
      production_judgments: judgmentSchedule.filter(({ call_class }) => call_class === "production_judge").length,
      anchor_judgments: judgmentSchedule.filter(({ call_class }) => call_class === "anchor_judge").length,
      simulated_external_calls: state.admitted, real_external_calls_started: state.real_external_calls_started
    };
    return {
      status: REHEARSAL_PASSED, report, ledger_ordinals: ledgerOrdinals,
      pre_admission_order: phases, human_calibration_claimed: protocol.human_calibration_claimed,
      unmask_opened: false, production_artifacts_written: false,
      production_admission: {
        count: events.filter(({ type }) => type === PRODUCTION_ADMITTED).length,
        before_ordinal_1: events.findIndex(({ type }) => type === PRODUCTION_ADMITTED) < events.findIndex(({ type }) => type === "ordinal_reserved"),
        exclusions: [], max_external_calls: 160, incremental_spend_cap_usd: 0, retry_policy: "none"
      },
      source_bindings: {
        consumed_jobs: consumedSourceBindings,
        revisions: { baseline: sourceBindings.baseline.revision, candidate: sourceBindings.candidate.revision },
        content_sha256: {
          baseline: sourceBindings.baseline.skill_pack_sha256,
          candidate: sourceBindings.candidate.skill_pack_sha256
        }
      },
      judgment_schedule_bindings: judgmentOutcome.receipts.filter((receipt) =>
        receipt.instantiated_judgment_schedule_sha256 === state.instantiated_judgment_schedule_sha256 &&
        receipt.instantiated_judgment_tuple_sha256 === state.instantiated_judgment_tuple_sha256
      ).length,
      external_call_capability: { mode: "fake-only", real_calls_started: state.real_external_calls_started }
    };
  } finally {
    globalThis.fetch = originalFetch;
    if (worktreesAdded) {
      removeWorktree(repoRoot, baselineRoot);
      removeWorktree(repoRoot, candidateRoot);
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(rehearse())}\n`);
}
