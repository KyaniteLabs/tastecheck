#!/usr/bin/env node
/**
 * Fail-closed W1 post-judgment synthesis.
 *
 * The private unmask map is deliberately read only after the blind corpus has
 * passed its exact packet/result/quorum validation. No judge packet, result,
 * or public receipt is written by this tool.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { synthesizePairedJudgments } from "./evaluators/paired-lift.mjs";
import { validateJudgeCorpus } from "./validate-judge-packets.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const DEFAULTS = {
  packetsDir: join(root, ".omx/evidence/tastecheck-v1/raw/judge-packets"),
  resultsDir: join(root, ".omx/evidence/tastecheck-v1/raw/judge-results"),
  unmaskPath: join(root, ".omx/evidence/tastecheck-v1/raw/judge-unmask.json"),
  evaluatorOutputsDir: join(root, ".omx/evidence/tastecheck-v1/raw/evaluators"),
};
const JUDGE_IDS = ["luna-1", "luna-2", "sonnet-1"];

function readJsonDirectory(directory, subject) {
  if (!existsSync(directory)) throw new Error(`W1 synthesis blocked: missing ${subject} directory`);
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => {
    try {
      return JSON.parse(readFileSync(join(directory, file), "utf8"));
    } catch (error) {
      throw new Error(`W1 synthesis blocked: cannot parse ${subject} file ${file}: ${error.message}`);
    }
  });
}

function block(errors) {
  throw new Error(`W1 synthesis blocked:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

function candidateLabels(packet) {
  return Object.keys(packet.candidates ?? {}).sort();
}

function validateUnmaskMapping(mapping, packets) {
  const errors = [];
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return ["private judge-unmask mapping must be an object"];
  if (mapping.schema_version !== 1) errors.push("private judge-unmask mapping schema_version must be 1");
  if (mapping.wave !== "W1") errors.push("private judge-unmask mapping wave must be W1");
  if (!mapping.packets || typeof mapping.packets !== "object" || Array.isArray(mapping.packets)) return [...errors, "private judge-unmask mapping packets must be an object"];
  const packetIds = packets.map((packet) => packet.packet_id).sort();
  const mappingIds = Object.keys(mapping.packets).sort();
  if (JSON.stringify(packetIds) !== JSON.stringify(mappingIds)) errors.push("private judge-unmask mapping packet ids do not exactly match the validated corpus");
  for (const packet of packets) {
    const bindings = mapping.packets[packet.packet_id];
    if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
      errors.push(`${packet.packet_id}: private mapping entry must be an object`);
      continue;
    }
    const labels = candidateLabels(packet);
    if (JSON.stringify(Object.keys(bindings).sort()) !== JSON.stringify(labels)) {
      errors.push(`${packet.packet_id}: private mapping labels do not exactly match packet candidates`);
      continue;
    }
    for (const label of labels) {
      const binding = bindings[label];
      if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
        errors.push(`${packet.packet_id}/${label}: private mapping binding must be an object`);
        continue;
      }
      if (JSON.stringify(Object.keys(binding).sort()) !== JSON.stringify(["attempt_id", "raw_output_hash", "run_type"])) {
        errors.push(`${packet.packet_id}/${label}: private mapping binding fields are invalid`);
      }
      if (!["baseline", "upgraded"].includes(binding.run_type)) errors.push(`${packet.packet_id}/${label}: private mapping run_type is invalid`);
      if (binding.raw_output_hash !== packet.candidates[label].raw_output_hash) {
        errors.push(`${packet.packet_id}/${label}: private mapping hash does not match packet candidate hash`);
      }
    }
    const runTypes = labels.map((label) => bindings[label]?.run_type);
    if (packet.evaluator_type === "paired_lift" && JSON.stringify([...runTypes].sort()) !== JSON.stringify(["baseline", "upgraded"])) {
      errors.push(`${packet.packet_id}: paired mapping must contain exactly one baseline and one upgraded candidate`);
    }
    if (packet.evaluator_type !== "paired_lift" && runTypes.some((runType) => runType !== "upgraded")) {
      errors.push(`${packet.packet_id}: diversity and anti-slop mappings must contain only upgraded candidates`);
    }
  }
  return errors;
}

function quorumArtifact(packet, judgments, field, evaluator) {
  const passVotes = judgments.filter((judgment) => judgment.verdict === "pass").length;
  const pass = passVotes >= 2;
  return {
    schema_version: 1,
    evaluator,
    packet_id: packet.packet_id,
    skill: packet.skill,
    judgment_count: judgments.length,
    evaluator_families: [...new Set(judgments.map((judgment) => judgment.evaluator_family))].sort(),
    pass_votes: passVotes,
    fail_votes: judgments.length - passVotes,
    quorum_required: 2,
    quorum_met: pass,
    [field]: pass,
    verdict: pass ? "pass" : "fail",
  };
}

function synthesizeArtifact(packet, judgments, mapping) {
  if (packet.evaluator_type === "paired_lift") {
    const upgradedLabel = candidateLabels(packet).find((label) => mapping.packets[packet.packet_id][label].run_type === "upgraded");
    return {
      packet_id: packet.packet_id,
      skill: packet.skill,
      ...synthesizePairedJudgments(packet, judgments, upgradedLabel),
    };
  }
  if (packet.evaluator_type === "diversity") return quorumArtifact(packet, judgments, "overall_pass", "diversity");
  return quorumArtifact(packet, judgments, "pass", "anti-slop");
}

function filename(packet) {
  return `${packet.skill}-${packet.evaluator_type.replaceAll("_", "-")}.json`;
}

function writeArtifacts(directory, artifacts) {
  const expectedFiles = artifacts.map(({ file }) => file).sort();
  if (existsSync(directory)) {
    const existingFiles = readdirSync(directory).filter((file) => file.endsWith(".json")).sort();
    if (existingFiles.length > 0 && JSON.stringify(existingFiles) !== JSON.stringify(expectedFiles)) {
      block([`evaluator output directory must contain exactly the expected nine artifact filenames before synthesis; found ${existingFiles.join(", ") || "none"}`]);
    }
  } else {
    mkdirSync(directory, { recursive: true });
  }
  for (const { file, artifact } of artifacts) {
    writeFileSync(join(directory, file), `${JSON.stringify(artifact, null, 2)}\n`);
  }
}

export function synthesizeW1Judgments(options = {}) {
  const paths = { ...DEFAULTS, ...options };
  const packets = readJsonDirectory(paths.packetsDir, "judge packets");
  const results = readJsonDirectory(paths.resultsDir, "judge results");
  const countErrors = [];
  if (packets.length !== 9) countErrors.push(`requires exactly 9 judge packets; found ${packets.length}`);
  if (results.length !== 27) countErrors.push(`requires exactly 27 result files; found ${results.length}`);
  if (results.filter((result) => result.status === "complete").length !== 27) countErrors.push("requires exactly 27 complete valid result files");
  if (countErrors.length > 0) block(countErrors);

  const corpus = validateJudgeCorpus(packets, results);
  if (corpus.errors.length > 0 || corpus.valid_complete_judgments !== 27 || corpus.synthesized_ready_packets !== 9) {
    block(corpus.errors.length > 0 ? corpus.errors : ["requires 27 valid complete judgments and 9 valid three-judge quorums"]);
  }

  let mapping;
  try {
    mapping = JSON.parse(readFileSync(paths.unmaskPath, "utf8"));
  } catch (error) {
    block([`cannot read private judge-unmask mapping: ${error.message}`]);
  }
  const mappingErrors = validateUnmaskMapping(mapping, packets);
  if (mappingErrors.length > 0) block(mappingErrors);

  const artifacts = packets.slice().sort((left, right) => left.packet_id.localeCompare(right.packet_id)).map((packet) => {
    const judgments = results.filter((result) => result.packet_id === packet.packet_id).sort((left, right) => JUDGE_IDS.indexOf(left.judge_id) - JUDGE_IDS.indexOf(right.judge_id));
    return { file: filename(packet), artifact: synthesizeArtifact(packet, judgments, mapping) };
  });
  if (artifacts.length !== 9 || new Set(artifacts.map(({ file }) => file)).size !== 9) block(["synthesis did not produce exactly nine unique evaluator artifacts"]);
  writeArtifacts(paths.evaluatorOutputsDir, artifacts);
  return { artifacts: artifacts.map(({ file }) => file) };
}

if (process.argv[1]?.endsWith("synthesize-w1-judgments.mjs")) {
  try {
    const { artifacts } = synthesizeW1Judgments();
    console.log(`Wrote ${artifacts.length} private W1 evaluator artifacts.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
