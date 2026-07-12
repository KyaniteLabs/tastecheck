#!/usr/bin/env node
/**
 * Rebuild the W1 blind corpus from baseline attempt-1 and upgraded attempt-3 evidence.
 *
 * Judge-visible candidate objects are intentionally limited to opaque label,
 * raw_output, and raw_output_hash. The private unmask map is kept separately
 * under raw evidence for post-judgment synthesis only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const rawDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const packetsDir = join(rawDir, "judge-packets");
const resultsDir = join(rawDir, "judge-results");
const indexPath = join(root, "evals/w1/judge-packets/index.json");
const unmaskPath = join(rawDir, "judge-unmask.json");
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const pilotSkills = ["component-states", "deslop-ui", "tastecheck-pass"];

function clearJson(directory) {
  mkdirSync(directory, { recursive: true });
  for (const file of readdirSync(directory)) if (file.endsWith(".json")) rmSync(join(directory, file));
}

function attemptFor(jobId, attemptIndex) {
  const path = join(rawDir, `${jobId}-attempt-${attemptIndex}.json`);
  if (!existsSync(path)) throw new Error(`missing attempt-${attemptIndex}: ${jobId}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function candidate(label, attempt) {
  return { label, raw_output: attempt.raw_output, raw_output_hash: attempt.raw_output_hash };
}

function packet(skill, evaluatorType, candidates, promptHash) {
  return {
    schema_version: 1,
    packet_id: `${skill}-${evaluatorType.replace("_", "-")}-001`,
    evaluator_type: evaluatorType,
    skill,
    scenario_id: candidates[0].attempt.scenario_id,
    prompt_hash: promptHash,
    calibration_ref: "evals/w1/rubric/calibration.json",
    candidates: Object.fromEntries(candidates.map(({ label, attempt }) => [label, candidate(label, attempt)])),
  };
}

clearJson(packetsDir);
clearJson(resultsDir);
const indexEntries = [];
const unmask = { schema_version: 1, wave: "W1", purpose: "private post-judgment unmasking only", packets: {} };

for (const skill of pilotSkills) {
  const baseline = attemptFor(`${skill}-baseline-seed101`, 1);
  const upgrades = [101, 202, 303].map((seed) => attemptFor(`${skill}-upgraded-seed${seed}`, 3));
  const job = JSON.parse(readFileSync(join(root, "evals/w1/jobs", `${skill}-upgraded-seed101.json`), "utf8"));
  const promptHash = hash(`${job.system_prompt}\n${job.user_prompt}`);
  const pairedSwap = parseInt(hash(`${skill}:${baseline.raw_output_hash}`)[0], 16) % 2 === 0;
  const pairedCandidates = pairedSwap
    ? [{ label: "A", attempt: baseline }, { label: "B", attempt: upgrades[0] }]
    : [{ label: "A", attempt: upgrades[0] }, { label: "B", attempt: baseline }];
  const specs = [
    packet(skill, "paired_lift", pairedCandidates, promptHash),
    packet(skill, "diversity", upgrades.map((attempt, index) => ({ label: `C${index + 1}`, attempt })), promptHash),
    packet(skill, "anti_slop", upgrades.map((attempt, index) => ({ label: `C${index + 1}`, attempt })), promptHash),
  ];
  for (const value of specs) {
    const packetPath = join(packetsDir, `${value.packet_id}.json`);
    writeFileSync(packetPath, JSON.stringify(value, null, 2) + "\n");
    const labels = Object.keys(value.candidates);
    unmask.packets[value.packet_id] = Object.fromEntries(labels.map((label) => {
      const attempt = [...pairedCandidates, ...upgrades.map((entry, index) => ({ label: `C${index + 1}`, attempt: entry }))]
        .find((entry) => entry.label === label)?.attempt;
      return [label, { attempt_id: attempt.attempt_id, run_type: attempt.run_type, raw_output_hash: attempt.raw_output_hash }];
    }));
    indexEntries.push({
      packet_id: value.packet_id,
      skill: value.skill,
      evaluator_type: value.evaluator_type,
      scenario_id: value.scenario_id,
      status: "pending",
      result_count: 0,
      packet_hash: hash(JSON.stringify(value)),
    });
    for (const judgeId of ["luna-1", "luna-2", "sonnet-1"]) {
      const slot = { schema_version: 1, result_id: `${value.packet_id}-${judgeId}`, packet_id: value.packet_id, evaluator_type: value.evaluator_type, judge_id: judgeId, evaluator_family: judgeId.startsWith("sonnet") ? "sonnet" : "luna", status: "pending" };
      writeFileSync(join(resultsDir, `${slot.result_id}.json`), JSON.stringify(slot, null, 2) + "\n");
    }
  }
}

writeFileSync(unmaskPath, JSON.stringify(unmask, null, 2) + "\n");
writeFileSync(indexPath, JSON.stringify({
  schema_version: 1,
  wave: "W1",
  note: "Public index only. Contains packet hashes and status. Raw outputs and result files are private evidence.",
  total: indexEntries.length,
  packets: indexEntries.sort((a, b) => a.packet_id.localeCompare(b.packet_id)),
}, null, 2) + "\n");
console.log(`rebuilt ${indexEntries.length} blind packets and ${indexEntries.length * 3} pending result slots`);
