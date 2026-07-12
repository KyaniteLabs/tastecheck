#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectJudgeObservations } from "./collect-observations.mjs";
import { canonicalJson } from "./lib/evidence.mjs";
import { analyzePairedObservations, analyzeStructuralObservations, validateAnalysisResult } from "./lib/statistics.mjs";
import { readCertifiedJson } from "./validate-judges.mjs";

function usage() {
  return "Usage: node tools/taste-oracle/analyze.mjs <observations.json> [--seed <uint32>] [--iterations <200..1000000>]";
}

function parseInteger(flag, value) {
  if (value === undefined || !/^\d+$/.test(value)) throw new TypeError(`${flag} requires a base-10 integer`);
  return Number(value);
}

export function parseArguments(argv) {
  let inputPath;
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--seed") {
      options.seed = parseInteger(argument, argv[++index]);
    } else if (argument === "--iterations") {
      options.iterations = parseInteger(argument, argv[++index]);
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else if (argument.startsWith("-")) {
      throw new TypeError(`unknown option: ${argument}`);
    } else if (inputPath === undefined) {
      inputPath = argument;
    } else {
      throw new TypeError(`unexpected argument: ${argument}`);
    }
  }
  if (inputPath === undefined) throw new TypeError("an observations JSON path is required");
  return { inputPath, options, help: false };
}

export function runAnalysisFile(inputPath, options) {
  const input = readCertifiedJson(inputPath).value;
  if (input?.provenance?.kind === "synthetic_fixture") return analyzePairedObservations(input, options);
  if (input?.provenance?.kind !== "validated_judge_panel") throw new TypeError("observations must be synthetic or a collector-issued validated panel receipt");
  const regenerated = collectJudgeObservations({
    packetPath: input.provenance.packet.path,
    unmaskPath: input.provenance.unmask.path,
    manifestPath: input.provenance.manifest.path,
    resultPaths: input.provenance.results.map((entry) => entry.path),
    targetArm: input.target_arm,
    comparatorArm: input.comparator_arm,
  });
  if (canonicalJson(regenerated) !== canonicalJson(input)) throw new TypeError("collected observation receipt does not canonically match regenerated validated evidence");
  const report = analyzeStructuralObservations(regenerated, options);
  report.evidence_notice = "VALIDATED PANEL ANALYSIS — MILESTONE ONLY, NOT RELEASE EVIDENCE";
  return validateAnalysisResult(report);
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }
  console.log(JSON.stringify(runAnalysisFile(parsed.inputPath, parsed.options), null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`taste-oracle analysis failed: ${error.message}`);
    console.error(usage());
    process.exitCode = 1;
  }
}
