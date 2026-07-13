#!/usr/bin/env node
import { lstatSync, readFileSync } from "node:fs";

import { executeAttempt } from "./lib/admission.mjs";
import { canonicalJson, sha256 } from "./lib/canonical-json.mjs";
import { loadAndVerifyInstantiatedJudgmentSchedule, validateJudgmentSchedule } from "./lib/schedule.mjs";

const HEX_64 = /^[0-9a-f]{64}$/;

function failPacket(state, message) {
  state.run_status = "production_incomplete";
  throw new Error(message);
}

function loadBoundPacket({ state, packetPath, expectedFileSha256, entry }) {
  if (typeof packetPath !== "string" || !packetPath || !HEX_64.test(expectedFileSha256 ?? "")) {
    return failPacket(state, "packet path and exact digest are required");
  }
  let stat;
  try { stat = lstatSync(packetPath); } catch { return failPacket(state, "packet path is missing"); }
  if (!stat.isFile() || stat.isSymbolicLink()) return failPacket(state, "packet path must be a regular non-symlink file");
  const bytes = readFileSync(packetPath);
  const fileSha256 = sha256(bytes.toString("utf8"));
  if (fileSha256 !== expectedFileSha256) return failPacket(state, "packet file digest mismatch");
  let packet;
  try { packet = JSON.parse(bytes.toString("utf8")); } catch { return failPacket(state, "packet file must contain strict JSON"); }
  if (!packet || typeof packet !== "object" || Array.isArray(packet) || packet.packet_id !== entry.packet_id) {
    return failPacket(state, "packet ID does not match instantiated judgment tuple");
  }
  return { packetSha256: sha256(canonicalJson(packet)), fileSha256 };
}

function parseStrictJudgeResult(result, entry, packetSha256) {
  if (!Array.isArray(result?.artifacts) || result.artifacts.length !== 1 || typeof result.artifacts[0] !== "string") {
    throw new Error("judge must return exactly one strict JSON artifact");
  }
  const raw = result.artifacts[0];
  if (raw.startsWith("\uFEFF")) throw new Error("judge JSON BOM is prohibited");
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error("judge artifact is not strict JSON; repair is prohibited"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("judge artifact must be one JSON object");
  const expected = {
    packet_id: entry.packet_id,
    family_id: entry.family,
    identity_id: entry.identity,
    invocation_id: entry.invocation_id,
    context_id: entry.context_id,
    packet_sha256: packetSha256
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value[field] !== expectedValue) throw new Error(`judge artifact ${field} binding mismatch`);
  }
  return Object.freeze(value);
}

export function runIsolatedJudge({ entry, state, packetPath, packetFileSha256, request, route, invoke }) {
  if (!entry || !["production_judge", "anchor_judge"].includes(entry.call_class)) throw new Error("invalid judgment schedule entry");
  if (entry.ordinal !== (state.admitted ?? 0) + 1) throw new Error("judgment ordinal does not match admitted ledger boundary");
  if (request.call_class !== entry.call_class || request.executor_digest !== entry.executor_digest ||
      request.resolver_attestation_sha256 !== entry.resolver_attestation_sha256 ||
      request.executor?.family !== entry.family || request.executor?.identity !== entry.identity) {
    throw new Error("judge request does not match exact scheduled executor and attestation");
  }
  const bound = loadBoundPacket({ state, packetPath, expectedFileSha256: packetFileSha256, entry });
  return executeAttempt({
    state,
    request: {
      ...request,
      receipt_binding: {
        run_id: state.run_id,
        packet_id: entry.packet_id,
        packet_sha256: bound.packetSha256,
        packet_file_sha256: bound.fileSha256,
        family: entry.family,
        identity: entry.identity,
        invocation_id: entry.invocation_id,
        context_id: entry.context_id
      }
    },
    route,
    invoke: (context) => invoke(entry, { ...context, packetPath }),
    validateArtifact: (result) => parseStrictJudgeResult(result, entry, bound.packetSha256)
  });
}

export function runJudgments({ schedule, scheduleInput, state, instantiatedJudgmentSchedulePath, packetPathFor, packetFileSha256For, requestFor, route, invoke }) {
  if (!scheduleInput) throw new Error("exact instantiated judgment schedule inputs are required");
  validateJudgmentSchedule(schedule, scheduleInput);
  if (state.admitted !== 48 || state.run_status !== "running") throw new Error("judgments must begin once at ordinal 49 after 48 generations");
  if (!HEX_64.test(state.prepacket_schedule_sha256 ?? "")) throw new Error("persisted prepacket schedule digest missing");
  loadAndVerifyInstantiatedJudgmentSchedule({
    path: instantiatedJudgmentSchedulePath,
    judgmentSchedule: schedule,
    state,
    prepacketScheduleSha256: state.prepacket_schedule_sha256
  });
  const tuples = schedule.map(({ call_class, packet_id, family, identity }) => `${call_class}\0${packet_id}\0${family}\0${identity}`);
  if (new Set(tuples).size !== schedule.length || new Set(schedule.map(({ invocation_id }) => invocation_id)).size !== schedule.length ||
      new Set(schedule.map(({ context_id }) => context_id)).size !== schedule.length) {
    throw new Error("judgment schedule contains duplicate tuple, invocation, or context");
  }
  const receipts = [];
  const results = [];
  for (const entry of schedule) {
    const outcome = runIsolatedJudge({
      entry,
      state,
      packetPath: packetPathFor(entry),
      packetFileSha256: packetFileSha256For(entry),
      request: requestFor(entry),
      route,
      invoke
    });
    receipts.push(outcome.receipt);
    if (outcome.validated_artifact) results.push(outcome.validated_artifact);
    if (outcome.run_status !== "running") return { run_status: outcome.run_status, receipts, results };
  }
  return { run_status: state.run_status, receipts, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  throw new Error("run-judges.mjs requires a sealed injected executor and frozen run state");
}
