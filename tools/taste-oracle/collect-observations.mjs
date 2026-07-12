#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertPublicSafe, assertRepoRelativePath, canonicalJson, hashCanonicalJson } from "./lib/evidence.mjs";
import { validateObservationSet } from "./lib/statistics.mjs";
import { validateJudgePanel } from "./validate-judges.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARM_IDS = new Set(["no-skill", "current", "frozen"]);

function resultIdentity(result) { return `result-${hashCanonicalJson(result).slice(0, 16)}`; }
function observationIdentity(packetId, resultId, viewportId, pair) {
  return `observation-${hashCanonicalJson({ packet_id: packetId, result_id: resultId, viewport_id: viewportId, pair }).slice(0, 16)}`;
}
function unmaskPreference(preference, mapping) { return ["tie", "abstain"].includes(preference) ? preference : mapping.get(preference); }

function convertCertifiedPanel({ certification, packetPath, unmaskPath, manifestPath, resultPaths, targetArm, comparatorArm }) {
  const { packet, unmaskMap, manifest, results, file_hashes: fileHashes } = certification;
  if (!ARM_IDS.has(targetArm) || !ARM_IDS.has(comparatorArm) || targetArm === comparatorArm) throw new TypeError("target and comparator must be distinct canonical arms");
  for (const value of [packetPath, unmaskPath, manifestPath, ...resultPaths]) assertRepoRelativePath(value);
  const armByLabel = new Map(unmaskMap.mapping.map((entry) => [entry.opaque_label, entry.arm_id]));
  const targetLabel = unmaskMap.mapping.find((entry) => entry.arm_id === targetArm).opaque_label;
  const comparatorLabel = unmaskMap.mapping.find((entry) => entry.arm_id === comparatorArm).opaque_label;
  const resultReceipts = results.map((result, index) => {
    const canonical = hashCanonicalJson(result);
    return {
      result_id: resultIdentity(result),
      path: resultPaths[index],
      judge_id: result.judge_id,
      evaluator_family: result.evaluator_family,
      file_sha256: fileHashes.results[index],
      canonical_sha256: canonical,
    };
  });
  const observations = results.flatMap((result, resultIndex) => {
    const resultId = resultReceipts[resultIndex].result_id;
    return result.pairwise_preferences
      .filter((entry) => new Set([entry.left, entry.right]).size === 2 && [entry.left, entry.right].includes(targetLabel) && [entry.left, entry.right].includes(comparatorLabel))
      .map((entry) => ({
        observation_id: observationIdentity(packet.packet_id, resultId, entry.viewport_id, [targetArm, comparatorArm].sort()),
        evaluator_family: result.evaluator_family,
        result_id: resultId,
        viewport_id: entry.viewport_id,
        preference: unmaskPreference(entry.preference, armByLabel),
        evidence_citations: [...entry.evidence_citations].sort(),
      }));
  });
  const receipt = {
    schema_version: 2,
    kind: "taste-oracle-paired-observations",
    scenario_id: packet.scenario_id,
    target_arm: targetArm,
    comparator_arm: comparatorArm,
    release_scope: "milestone_only",
    provenance: {
      kind: "validated_judge_panel",
      packet: { packet_id: packet.packet_id, path: packetPath, file_sha256: fileHashes.packet, canonical_sha256: hashCanonicalJson(packet) },
      unmask: { path: unmaskPath, file_sha256: fileHashes.unmask },
      manifest: {
        path: manifestPath,
        file_sha256: fileHashes.manifest,
        canonical_sha256: hashCanonicalJson(manifest),
      },
      results: resultReceipts,
    },
    observations,
  };
  validateObservationSet(receipt);
  assertPublicSafe(receipt);
  return receipt;
}

export function collectJudgeObservations({ packetPath, unmaskPath, manifestPath, resultPaths, targetArm, comparatorArm }) {
  const certification = validateJudgePanel({ packetPath, unmaskPath, manifestPath, resultPaths });
  if (certification.errors.length) throw new TypeError(`judge panel is not valid: ${JSON.stringify(certification.errors)}`);
  return convertCertifiedPanel({ certification, packetPath, unmaskPath, manifestPath, resultPaths, targetArm, comparatorArm });
}

function main() {
  const [packetPath, unmaskPath, manifestPath, targetArm, comparatorArm, ...resultPaths] = process.argv.slice(2);
  if (!packetPath || !unmaskPath || !manifestPath || !targetArm || !comparatorArm || resultPaths.length < 2) throw new TypeError("Usage: collect-observations.mjs <packet.json> <unmask.json> <manifest.json> <target-arm> <comparator-arm> <result.json ...>");
  const receipt = collectJudgeObservations({ packetPath, unmaskPath, manifestPath, resultPaths, targetArm, comparatorArm });
  console.log(`${canonicalJson(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`taste-oracle observation collection failed: ${error.message}`); process.exitCode = 1; }
}
