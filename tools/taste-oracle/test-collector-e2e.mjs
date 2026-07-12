import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hashBytes, hashCanonicalJson } from "./lib/evidence.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runRelative = `.omx/taste-oracle/e2e-${process.pid}-${Date.now()}`;
const runRoot = path.join(repoRoot, runRelative);
const artifactRoot = path.join(runRoot, "artifacts");
const labels = ["option-amber", "option-birch", "option-cobalt"];
const mapping = ["no-skill", "current", "frozen"].map((arm_id, index) => ({ opaque_label: labels[index], arm_id }));
const viewports = [{ id: "mobile", width: 390, height: 844 }, { id: "desktop", width: 1280, height: 900 }];
const writeJson = (relative, value) => { const absolute = path.join(repoRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`); };
const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: "utf8" });

fs.mkdirSync(artifactRoot, { recursive: true });
const captures = mapping.flatMap(({ arm_id }) => viewports.map(({ id, width, height }) => {
  const bytes = Buffer.from(`${arm_id}:${id}`);
  const screenshot_sha256 = hashBytes(bytes);
  const screenshot_path = `artifacts/${arm_id}-${id}-${screenshot_sha256}.png`;
  fs.writeFileSync(path.join(runRoot, screenshot_path), bytes);
  const dom_facts = { viewport: { width, height }, probes: Object.fromEntries(["root", "heading", "primary-action", "summary-card", "status"].map((name) => [name, { text: `Shared ${name}` }])) };
  const computed_styles = { color: "rgb(1, 2, 3)" };
  return { arm_id, viewport_id: id, screenshot_path, screenshot_sha256, dom_facts, dom_sha256: hashCanonicalJson(dom_facts), computed_styles, style_sha256: hashCanonicalJson(computed_styles) };
}));
const manifest = { schema_version: 1, scenario_id: "deslop-ui-hard-001", captured_at: "2026-07-11T20:00:00.000Z", runtime: { browser: "chromium", playwright: "1.61.1", platform: "darwin" }, viewports, arms: ["no-skill", "current", "frozen"], captures };
const manifestPath = `${runRelative}/manifest.json`; writeJson(manifestPath, manifest);
const packetPath = `${runRelative}/packet.json`;
const byArm = new Map(captures.map((entry) => [`${entry.arm_id}:${entry.viewport_id}`, entry]));
const packet = {
  schema_version: 2, kind: "taste-oracle-judge-packet", packet_id: "deslop-ui-hard-001-render-v1", scenario_id: manifest.scenario_id,
  status: "pending", release_evidence: false, notice: "PENDING BLINDED EVALUATION — NOT RELEASE EVIDENCE",
  evidence_manifest: { path: manifestPath, file_sha256: hashBytes(fs.readFileSync(path.join(repoRoot, manifestPath))), canonical_sha256: hashCanonicalJson(manifest) },
  viewports,
  blinded_arms: mapping.map(({ opaque_label, arm_id }) => ({ opaque_label, artifacts: viewports.map(({ id }) => { const capture = byArm.get(`${arm_id}:${id}`); return { viewport_id: id, screenshot_sha256: capture.screenshot_sha256, dom_sha256: capture.dom_sha256, style_sha256: capture.style_sha256 }; }) })),
  rubric: { instruction: "Assess every artifact and cite evidence.", dimensions: ["hierarchy"] },
  submission_contract: { result_schema_path: "contracts/v2/taste-oracle-judge-result.schema.json", minimum_distinct_evaluator_families: 2, minimum_distinct_judge_identities: 2, requires_all_artifacts: true, requires_all_pairwise_comparisons: true, requires_evidence_citations: true, allows_tie: true, allows_abstention: true, human_calibration_claimed: false },
};
writeJson(packetPath, packet);
const unmaskPath = `${runRelative}/unmask.json`;
writeJson(unmaskPath, { schema_version: 2, kind: "taste-oracle-judge-unmask-map", packet_id: packet.packet_id, scenario_id: packet.scenario_id, packet_path: packetPath, packet_file_sha256: hashBytes(fs.readFileSync(path.join(repoRoot, packetPath))), mapping, notice: "CONTROLLED UNMASK MATERIAL — DO NOT INCLUDE IN JUDGE INPUT" });
function judge(index) {
  const evaluator_family = index % 2 ? "family-luna" : "family-terra";
  const artifact_assessments = packet.blinded_arms.flatMap((arm) => arm.artifacts.map((artifact) => ({ opaque_label: arm.opaque_label, viewport_id: artifact.viewport_id, artifact_hashes: { screenshot_sha256: artifact.screenshot_sha256, dom_sha256: artifact.dom_sha256, style_sha256: artifact.style_sha256 }, assessment: "Evidence is legible and internally coherent.", evidence_citations: [artifact.screenshot_sha256] })));
  const pairwise_preferences = viewports.flatMap(({ id }) => [[labels[0], labels[1]], [labels[0], labels[2]], [labels[1], labels[2]]].map(([left, right], pairIndex) => ({ viewport_id: id, left, right, preference: pairIndex === 2 ? (index === 4 ? "abstain" : index === 3 ? "tie" : index === 2 ? left : right) : "tie", reason: "The cited pair supports this bounded synthetic-test assessment.", evidence_citations: artifact_assessments.filter((entry) => entry.viewport_id === id && [left, right].includes(entry.opaque_label)).map((entry) => entry.artifact_hashes.screenshot_sha256) })));
  return { schema_version: 2, kind: "taste-oracle-judge-result", scenario_id: packet.scenario_id, packet_id: packet.packet_id, judge_id: `judge-${index}`, evaluator_family, blinded: true, artifact_assessments, pairwise_preferences, human_calibration: { claimed: false, observation_records: [] } };
}
const resultPaths = [1, 2, 3, 4].map((index) => { const relative = `${runRelative}/result-${index}.json`; writeJson(relative, judge(index)); return relative; });

try {
  const judgeRun = run("tools/taste-oracle/validate-judges.mjs", [packetPath, unmaskPath, manifestPath, ...resultPaths]);
  assert.equal(judgeRun.status, 0, judgeRun.stderr); assert.equal(JSON.parse(judgeRun.stdout).status, "quorum_valid");
  const collectRun = run("tools/taste-oracle/collect-observations.mjs", [packetPath, unmaskPath, manifestPath, "current", "frozen", ...resultPaths]);
  assert.equal(collectRun.status, 0, collectRun.stderr);
  const observations = JSON.parse(collectRun.stdout); assert.equal(observations.observations.length, 8);
  observations.provenance.results.forEach((entry) => { assert.equal(fs.existsSync(path.join(repoRoot, entry.path)), true); assert.equal(entry.file_sha256, hashBytes(fs.readFileSync(path.join(repoRoot, entry.path)))); });
  const observationsPath = `${runRelative}/observations.json`; writeJson(observationsPath, observations);
  const analyzeRun = run("tools/taste-oracle/analyze.mjs", [observationsPath, "--seed", "7", "--iterations", "400"]);
  assert.equal(analyzeRun.status, 0, analyzeRun.stderr); const report = JSON.parse(analyzeRun.stdout); assert.equal(report.release_scope, "milestone_only");
  const tamperedObservations = structuredClone(observations);
  tamperedObservations.observations[0].preference = tamperedObservations.observations[0].preference === "tie" ? tamperedObservations.target_arm : "tie";
  writeJson(observationsPath, tamperedObservations);
  assert.notEqual(run("tools/taste-oracle/analyze.mjs", [observationsPath, "--seed", "7", "--iterations", "400"]).status, 0, "tampered collector receipt must not analyze");
  const forgedObservations = structuredClone(observations);
  forgedObservations.provenance.packet.path = `${runRelative}/missing-packet.json`;
  writeJson(observationsPath, forgedObservations);
  assert.notEqual(run("tools/taste-oracle/analyze.mjs", [observationsPath, "--seed", "7", "--iterations", "400"]).status, 0, "hand-authored collected provenance must not confer authority");
  writeJson(observationsPath, observations);

  const wrongPacketPath = `${runRelative}/packet-copy.json`; writeJson(wrongPacketPath, packet);
  assert.notEqual(run("tools/taste-oracle/validate-judges.mjs", [wrongPacketPath, unmaskPath, manifestPath, ...resultPaths]).status, 0, "unmask packet_path must bind the supplied packet path");
  const unmaskBytes = fs.readFileSync(path.join(repoRoot, unmaskPath));
  const changedUnmask = JSON.parse(unmaskBytes); changedUnmask.packet_file_sha256 = "0".repeat(64); writeJson(unmaskPath, changedUnmask);
  assert.notEqual(run("tools/taste-oracle/validate-judges.mjs", [packetPath, unmaskPath, manifestPath, ...resultPaths]).status, 0, "unmask packet hash must bind exact packet bytes");
  fs.writeFileSync(path.join(repoRoot, unmaskPath), unmaskBytes);

  const packetBytes = fs.readFileSync(path.join(repoRoot, packetPath));
  fs.rmSync(path.join(repoRoot, packetPath)); fs.symlinkSync("manifest.json", path.join(repoRoot, packetPath));
  assert.notEqual(run("tools/taste-oracle/validate-judges.mjs", [packetPath, unmaskPath, manifestPath, ...resultPaths]).status, 0, "packet symlinks must fail closed");
  fs.rmSync(path.join(repoRoot, packetPath)); fs.writeFileSync(path.join(repoRoot, packetPath), packetBytes);
  const resultBytes = fs.readFileSync(path.join(repoRoot, resultPaths[0]));
  fs.rmSync(path.join(repoRoot, resultPaths[0])); fs.mkdirSync(path.join(repoRoot, resultPaths[0]));
  assert.notEqual(run("tools/taste-oracle/validate-judges.mjs", [packetPath, unmaskPath, manifestPath, ...resultPaths]).status, 0, "non-file results must fail closed");
  fs.rmSync(path.join(repoRoot, resultPaths[0]), { recursive: true }); fs.writeFileSync(path.join(repoRoot, resultPaths[0]), resultBytes);
  const corrupt = path.join(runRoot, captures[0].screenshot_path); const original = fs.readFileSync(corrupt);
  fs.writeFileSync(corrupt, "corrupt"); assert.notEqual(run("tools/taste-oracle/validate-judges.mjs", [packetPath, unmaskPath, manifestPath, ...resultPaths]).status, 0);
  fs.writeFileSync(corrupt, original); fs.rmSync(corrupt); assert.notEqual(run("tools/taste-oracle/collect-observations.mjs", [packetPath, unmaskPath, manifestPath, "current", "frozen", ...resultPaths]).status, 0);
} finally { fs.rmSync(runRoot, { recursive: true, force: true }); }

console.log("taste-oracle file-backed CLI end-to-end test passed");
