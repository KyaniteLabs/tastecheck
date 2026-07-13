import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { canonicalJson, sha256 } from "./canonical-json.mjs";
import { validateAdmittedPlan } from "./admission.mjs";
import { canonicalExecutorDigest } from "./providers.mjs";

const HEX_64 = /^[0-9a-f]{64}$/;
const ARM_ORDER = Object.freeze(["baseline", "candidate"]);

function compareAscii(left, right) {
  return Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8"));
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !HEX_64.test(value)) throw new Error(`${label}|sha256|required`);
}

function exactJson(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`${label}|exact|canonical|order|mismatch`);
}

function durableExclusiveJson(path, value) {
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
    writeFileSync(fd, `${canonicalJson(value)}\n`);
    fsyncSync(fd);
  } catch (error) {
    throw new Error(`exclusive schedule persist failed or already exists: ${error.message}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  const directory = openSync(dirname(path), "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
  return value;
}

function scenarioIds(registry) {
  if (!Array.isArray(registry?.scenarios) || registry.scenarios.length !== 12) {
    throw new Error("generation schedule requires exact 12 scenarios");
  }
  const ids = registry.scenarios.map(({ scenario_id }) => scenario_id);
  if (new Set(ids).size !== 12 || ids.some((id) => typeof id !== "string" || !id)) {
    throw new Error("generation schedule scenario IDs must be unique");
  }
  return [...ids].sort(compareAscii);
}

function generationSeeds(protocol) {
  if (!Array.isArray(protocol?.seeds) || protocol.seeds.length !== 2 ||
      protocol.seeds.some((seed) => !Number.isSafeInteger(seed)) || new Set(protocol.seeds).size !== 2) {
    throw new Error("generation schedule requires exact two distinct integer seeds");
  }
  return [...protocol.seeds].sort((left, right) => left - right);
}

export function buildGenerationSchedule({ protocol, registry }) {
  if (protocol?.exclusions?.length !== 0) throw new Error("generation schedule requires exclusions=[]");
  const entries = [];
  for (const scenario_id of scenarioIds(registry)) {
    for (const generation_seed of generationSeeds(protocol)) {
      for (const arm of ARM_ORDER) {
        entries.push(Object.freeze({
          ordinal: entries.length + 1,
          call_class: "generation",
          scenario_id,
          generation_seed,
          arm,
          revision: arm === "baseline" ? protocol.baseline_revision : protocol.candidate_revision
        }));
      }
    }
  }
  return Object.freeze(entries);
}

export function validateGenerationSchedule(schedule, input) {
  if (!Array.isArray(schedule) || schedule.length !== 48) throw new Error("generation schedule must contain exact 48 calls");
  const expected = buildGenerationSchedule(input);
  exactJson(schedule, expected, "generation schedule");
  return true;
}

function packetIds(packets, label, expectedCount) {
  if (!Array.isArray(packets) || packets.length !== expectedCount) throw new Error(`${label}|exact|count|${expectedCount}`);
  const ids = packets.map(({ packet_id }) => packet_id);
  for (const id of ids) assertDigest(id, `${label}|packet_id`);
  if (new Set(ids).size !== expectedCount) throw new Error(`${label}|duplicate|packet_id`);
  return [...ids].sort(compareAscii);
}

function judgeIdentities(selection) {
  if (!Array.isArray(selection?.judges) || selection.judges.length !== 4) {
    throw new Error("judgment schedule requires exact four judge identities");
  }
  const values = selection.judges.map((judge) => {
    const family = judge?.executor?.family;
    const identity = judge?.executor?.identity;
    if (typeof family !== "string" || !family || typeof identity !== "string" || !identity) {
      throw new Error("judgment schedule requires explicit family and identity");
    }
    assertDigest(judge.executor_digest, "judge|executor_digest");
    assertDigest(judge.resolver_attestation_sha256, "judge|resolver_attestation");
    return { family, identity, executor_digest: judge.executor_digest, resolver_attestation_sha256: judge.resolver_attestation_sha256 };
  }).sort((left, right) => compareAscii(left.family, right.family) || compareAscii(left.identity, right.identity));
  if (new Set(values.map(({ family, identity }) => `${family}\0${identity}`)).size !== 4 ||
      new Set(values.map(({ executor_digest }) => executor_digest)).size !== 4) {
    throw new Error("judgment schedule duplicate family, identity, or executor digest");
  }
  return values;
}

function judgmentEntry({ ordinal, call_class, packet_id, judge, runId }) {
  const tuple = { call_class, packet_id, family: judge.family, identity: judge.identity };
  return Object.freeze({
    ordinal,
    ...tuple,
    executor_digest: judge.executor_digest,
    resolver_attestation_sha256: judge.resolver_attestation_sha256,
    invocation_id: sha256(canonicalJson({ domain: "effectiveness-v2-invocation", run_id: runId, ...tuple })),
    context_id: sha256(canonicalJson({ domain: "effectiveness-v2-context", run_id: runId, ...tuple }))
  });
}

export function buildJudgmentSchedule({ packets, anchorPackets, selection, runId }) {
  assertDigest(runId, "run_id");
  const judges = judgeIdentities(selection);
  const entries = [];
  for (const [call_class, ids] of [
    ["production_judge", packetIds(packets, "production packets", 24)],
    ["anchor_judge", packetIds(anchorPackets, "anchor packets", 4)]
  ]) {
    for (const packet_id of ids) {
      for (const judge of judges) {
        entries.push(judgmentEntry({ ordinal: entries.length + 49, call_class, packet_id, judge, runId }));
      }
    }
  }
  return Object.freeze(entries);
}

export function validateJudgmentSchedule(schedule, input) {
  if (!Array.isArray(schedule) || schedule.length !== 112) throw new Error("judgment schedule must contain exact 112 calls");
  const expected = buildJudgmentSchedule(input);
  exactJson(schedule, expected, "judgment schedule");
  if (new Set(schedule.map(({ invocation_id }) => invocation_id)).size !== 112 ||
      new Set(schedule.map(({ context_id }) => context_id)).size !== 112) {
    throw new Error("judgment schedule requires fresh invocation and context IDs");
  }
  return true;
}

function prepacketValue({ generationSchedule, generationPlan, selection, protocol, registry, protocolSha256, scenarioRegistrySha256, runId }) {
  assertDigest(protocolSha256, "protocol");
  assertDigest(scenarioRegistrySha256, "scenario registry");
  assertDigest(runId, "run_id");
  assertDigest(selection?.execution_manifest_sha256, "execution manifest");
  const generator = selection?.generator;
  assertDigest(generator?.executor_digest, "generator executor");
  assertDigest(generator?.resolver_attestation_sha256, "generator resolver attestation");
  if (canonicalExecutorDigest(generator.executor) !== generator.executor_digest) {
    throw new Error("prepacket generator executor digest mismatch");
  }
  validateGenerationSchedule(generationSchedule, { protocol, registry });
  validateAdmittedPlan(generationPlan, { protocol, registry, protocol_sha256: protocolSha256, generatorBinding: generator });
  const judges = judgeIdentities(selection);
  const body = {
    schema_version: 2,
    kind: "effectiveness-v2-prepacket-schedule",
    run_id: runId,
    protocol_sha256: protocolSha256,
    scenario_registry_sha256: scenarioRegistrySha256,
    execution_manifest_sha256: selection.execution_manifest_sha256,
    generator_executor_digest: generator.executor_digest,
    generator_resolver_attestation_sha256: generator.resolver_attestation_sha256,
    generation_plan_sha256: sha256(canonicalJson(generationPlan)),
    generation_schedule: generationSchedule,
    judgment_shape: {
      production_packets: 24,
      anchor_packets: 4,
      identities: judges,
      production_judgments: 96,
      anchor_judgments: 16,
      total_external_calls: 160
    }
  };
  return Object.freeze({ ...body, schedule_sha256: sha256(canonicalJson(body)) });
}

export function loadAndVerifyPrepacketSchedule(input) {
  if (typeof input?.path !== "string" || !input.path) throw new Error("prepacket schedule path required");
  let stat;
  try { stat = lstatSync(input.path); } catch (error) { throw new Error(`prepacket schedule read failed: ${error.message}`); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("prepacket schedule must be a regular non-symlink file");
  let actual;
  try { actual = JSON.parse(readFileSync(input.path, "utf8")); }
  catch (error) { throw new Error(`prepacket schedule parse failed: ${error.message}`); }
  const expectedSchedule = buildGenerationSchedule({ protocol: input.protocol, registry: input.registry });
  const expected = prepacketValue({ ...input, generationSchedule: expectedSchedule });
  exactJson(actual, expected, "prepacket schedule binding");
  return Object.freeze(actual);
}

export function persistPrepacketSchedule(input) {
  const value = prepacketValue(input);
  durableExclusiveJson(input.path, value);
  const persisted = loadAndVerifyPrepacketSchedule(input);
  if (persisted.schedule_sha256 !== value.schedule_sha256) {
    throw new Error("prepacket schedule durable readback digest mismatch");
  }
  return persisted;
}

function instantiatedJudgmentValue({ judgmentSchedule, state, prepacketScheduleSha256 }) {
  assertDigest(prepacketScheduleSha256, "prepacket schedule");
  if (state?.run_status !== "running" || state?.admitted !== 48) {
    throw new Error("instantiated judgment schedule must persist after 48 generation calls and before ordinal 49");
  }
  for (const [field, label] of [
    ["run_id", "run"], ["protocol_sha256", "protocol"],
    ["scenario_registry_sha256", "scenario registry"],
    ["execution_manifest_sha256", "execution manifest"]
  ]) assertDigest(state[field], label);
  if (!state.frozen_execution_selection ||
      state.frozen_execution_selection.execution_manifest_sha256 !== state.execution_manifest_sha256) {
    throw new Error("instantiated judgment schedule execution selection binding mismatch");
  }
  if (!Array.isArray(judgmentSchedule) || judgmentSchedule.length !== 112 ||
      judgmentSchedule.some((entry, index) => entry.ordinal !== index + 49)) {
    throw new Error("instantiated judgment schedule requires exact canonical ordinals 49..160");
  }
  const tuples = judgmentSchedule.map(({ ordinal, call_class, packet_id, family, identity, executor_digest, resolver_attestation_sha256, invocation_id, context_id }) => ({ ordinal, call_class, packet_id, family, identity, executor_digest, resolver_attestation_sha256, invocation_id, context_id }));
  if (new Set(tuples.map(({ call_class, packet_id, family, identity }) => `${call_class}\0${packet_id}\0${family}\0${identity}`)).size !== 112) {
    throw new Error("instantiated judgment schedule has duplicate or missing tuple");
  }
  const body = {
    schema_version: 2,
    kind: "effectiveness-v2-instantiated-judgment-schedule",
    run_id: state.run_id,
    protocol_sha256: state.protocol_sha256,
    scenario_registry_sha256: state.scenario_registry_sha256,
    execution_manifest_sha256: state.execution_manifest_sha256,
    execution_selection_sha256: sha256(canonicalJson(state.frozen_execution_selection)),
    prepacket_schedule_sha256: prepacketScheduleSha256,
    judgment_tuples: tuples
  };
  const bound = { ...body, judgment_tuple_sha256: sha256(canonicalJson(tuples)) };
  return Object.freeze({ ...bound, artifact_sha256: sha256(canonicalJson(bound)) });
}

function readExactInstantiatedArtifact(path, expected) {
  if (typeof path !== "string" || !path) throw new Error("instantiated judgment schedule path required");
  let stat;
  try { stat = lstatSync(path); } catch (error) { throw new Error(`instantiated judgment schedule read failed: ${error.message}`); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("instantiated judgment schedule must be a regular non-symlink file");
  let actual;
  try { actual = JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`instantiated judgment schedule parse failed: ${error.message}`); }
  exactJson(actual, expected, "instantiated judgment schedule artifact binding");
  return Object.freeze(actual);
}

export function loadAndVerifyInstantiatedJudgmentSchedule(input) {
  const expected = instantiatedJudgmentValue(input);
  if (input.state.instantiated_judgment_schedule_path !== input.path ||
      input.state.instantiated_judgment_schedule_sha256 !== expected.artifact_sha256 ||
      input.state.instantiated_judgment_tuple_sha256 !== expected.judgment_tuple_sha256 ||
      input.state.prepacket_schedule_sha256 !== input.prepacketScheduleSha256) {
    throw new Error("instantiated judgment schedule state path or digest binding mismatch");
  }
  return readExactInstantiatedArtifact(input.path, expected);
}

export function persistInstantiatedJudgmentSchedule(input) {
  const value = instantiatedJudgmentValue(input);
  durableExclusiveJson(input.path, value);
  const persisted = readExactInstantiatedArtifact(input.path, value);
  const { state, prepacketScheduleSha256, path } = input;
  state.prepacket_schedule_sha256 = prepacketScheduleSha256;
  state.instantiated_judgment_tuple_sha256 = value.judgment_tuple_sha256;
  state.instantiated_judgment_schedule_sha256 = value.artifact_sha256;
  state.instantiated_judgment_schedule_path = path;
  return Object.freeze({ ...persisted, artifact_path: path });
}

export function judgmentTupleSha256(schedule) {
  if (!Array.isArray(schedule)) throw new Error("judgment schedule required");
  const tuples = schedule.map(({ ordinal, call_class, packet_id, family, identity, executor_digest, resolver_attestation_sha256, invocation_id, context_id }) => ({ ordinal, call_class, packet_id, family, identity, executor_digest, resolver_attestation_sha256, invocation_id, context_id }));
  return sha256(canonicalJson(tuples));
}
