#!/usr/bin/env node
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const selectedSkills = ["a11y-pass", "responsive-layout", "component-states", "micro-motion", "spacing-system", "design-system-interview", "tastecheck-pass"];

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function writeJson(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + "\n"); }

function copyFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-remediation7-"));
  const copy = (relativePath) => {
    const source = join(root, relativePath);
    const destination = join(fixtureRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  };
  copy("evals/scenarios/remediation7-replay.json");
  for (const skill of selectedSkills) {
    copy(`evals/scenarios/${skill}.json`);
    copy(`skills/${skill}/SKILL.md`);
  }
  copy("evals/scenarios/fixtures");
  copy(".omx/evidence/tastecheck-v1/raw/remediation7-v2-2026-07-11/artifacts");
  copy(".omx/evidence/tastecheck-v1/baseline/v0.1.0/manifest.json");
  copy("evals/replays/full19-v1rc-2026-07-11/manifest.json");
  copy("evals/replays/full19-v1rc-2026-07-11/blind-judge/synthesis.json");
  const baseline = readJson(join(root, ".omx/evidence/tastecheck-v1/baseline/v0.1.0/manifest.json"));
  for (const skill of selectedSkills) {
    const entry = baseline.entries.find((item) => item.path === `skills/${skill}/SKILL.md`);
    assert(entry, `missing baseline entry for ${skill}`);
    copy(`.omx/evidence/tastecheck-v1/baseline/v0.1.0/sha256/${entry.sha256}`);
  }
  return fixtureRoot;
}

const scaffold = await import("./remediation7-replay.mjs");
const fixtureRoot = copyFixtureRoot();
try {
  const beforeHistorical = [
    readFileSync(join(fixtureRoot, "evals/replays/full19-v1rc-2026-07-11/manifest.json")),
    readFileSync(join(fixtureRoot, "evals/replays/full19-v1rc-2026-07-11/blind-judge/synthesis.json")),
  ].map(sha256);
  const built = scaffold.buildReplayPackage(fixtureRoot);
  assert.equal(built.paired_job_count, 42);
  assert.equal(built.diversity_job_count, 21);
  assert.equal(scaffold.validateReplayPackage(fixtureRoot).errors.length, 0);
  assert.equal(built.model_execution_started, false);
  const manifest = readJson(join(fixtureRoot, built.manifest_path));
  const artifactIndex = readJson(join(fixtureRoot, manifest.artifact_index_path));
  assert.equal(artifactIndex.entries.length, 9, "sealed fixture index must cover all required repair artifacts");
  assert(artifactIndex.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)), "fixture index must contain exact SHA-256 receipts");
  const paired = manifest.paired_lane.jobs;
  for (const seed of [101, 202, 303]) {
    for (const skill of selectedSkills) {
      const baseline = paired.find((job) => job.skill === skill && job.requested_seed === seed && job.run_type === "baseline");
      const upgraded = paired.find((job) => job.skill === skill && job.requested_seed === seed && job.run_type === "upgraded");
      assert.equal(baseline.neutral_prompt_sha256, upgraded.neutral_prompt_sha256, `${skill}/${seed} neutral prompt drift`);
      assert.equal(baseline.system_prompt, upgraded.system_prompt, `${skill}/${seed} system prompt drift`);
      assert.equal(baseline.user_prompt, upgraded.user_prompt, `${skill}/${seed} user prompt drift`);
      assert.notEqual(baseline.skill_source_sha256, upgraded.skill_source_sha256, `${skill}/${seed} source should differ`);
    }
  }
  assert(manifest.diversity_lane.jobs.every((job) => job.run_type === "upgraded" && job.skill_version === "current"));
  assert(manifest.diversity_lane.jobs.every((job) => job.lane === "diversity"));
  assert.deepEqual(beforeHistorical, [
    readFileSync(join(fixtureRoot, "evals/replays/full19-v1rc-2026-07-11/manifest.json")),
    readFileSync(join(fixtureRoot, "evals/replays/full19-v1rc-2026-07-11/blind-judge/synthesis.json")),
  ].map(sha256));

  const missingArtifact = artifactIndex.entries.find((entry) => entry.skill === "a11y-pass" && entry.id === "audit-report");
  const missingArtifactPath = join(fixtureRoot, manifest.artifact_root, missingArtifact.path);
  const intactArtifact = readFileSync(missingArtifactPath);
  rmSync(missingArtifactPath);
  assert(scaffold.validateReplayPackage(fixtureRoot).errors.some((error) => /sealed artifact.*missing|artifact.*missing/i.test(error)), "missing sealed artifact must block");
  writeFileSync(missingArtifactPath, intactArtifact);
  writeFileSync(missingArtifactPath, `${readFileSync(missingArtifactPath, "utf8")}\n tampered\n`);
  assert(scaffold.validateReplayPackage(fixtureRoot).errors.some((error) => /artifact.*digest|tamper/i.test(error)), "tampered sealed artifact must block");
  writeFileSync(missingArtifactPath, intactArtifact);

  const fixtureBinding = manifest.fixture_contracts.find((entry) => entry.skill === "responsive-layout");
  const fixturePath = join(fixtureRoot, fixtureBinding.path);
  writeFileSync(fixturePath, `${readFileSync(fixturePath, "utf8")}\n tampered\n`);
  assert(scaffold.validateReplayPackage(fixtureRoot).errors.some((error) => /fixture.*digest|tamper/i.test(error)), "tampered fixture must block");
  writeFileSync(fixturePath, readFileSync(join(root, fixtureBinding.path), "utf8"));
  rmSync(fixturePath);
  assert(scaffold.validateReplayPackage(fixtureRoot).errors.some((error) => /fixture.*missing/i.test(error)), "missing fixture contract must block");
  cpSync(join(root, fixtureBinding.path), fixturePath);

  const customArtifactRoot = ".omx/evidence/tastecheck-v1/raw/remediation7-v2-replay-a/artifacts";
  cpSync(join(fixtureRoot, manifest.artifact_root), join(fixtureRoot, customArtifactRoot), { recursive: true });
  const customArtifactIndexPath = join(fixtureRoot, customArtifactRoot, "fixture-index.json");
  const customArtifactIndex = readJson(customArtifactIndexPath);
  customArtifactIndex.revision_id = "remediation7-v2-replay-a";
  writeJson(customArtifactIndexPath, customArtifactIndex);
  const customRevision = scaffold.buildReplayPackage(fixtureRoot, {
    revisionId: "remediation7-v2-replay-a",
    namespace: "evals/replays/remediation7-v2-replay-a",
  });
  assert.equal(customRevision.manifest.revision_id, "remediation7-v2-replay-a");
  assert.equal(scaffold.validateReplayPackage(fixtureRoot, { namespace: customRevision.manifest.namespace }).errors.length, 0);
  rmSync(join(fixtureRoot, customRevision.manifest.namespace), { recursive: true, force: true });

  const responsiveArtifacts = artifactIndex.entries.filter((entry) => entry.skill === "responsive-layout");
  const artifactPath = join(fixtureRoot, manifest.artifact_root, responsiveArtifacts.find((entry) => entry.id === "rendered-target").path);
  const artifactContract = manifest.fixture_contracts.find((entry) => entry.skill === "responsive-layout");
  const job = manifest.paired_lane.jobs.find((entry) => entry.skill === "responsive-layout" && entry.run_type === "baseline" && entry.requested_seed === 101);
  const result = {
    schema_version: 1,
    revision_id: manifest.revision_id,
    namespace: manifest.namespace,
    job_id: job.job_id,
    lane: "paired",
    run_type: job.run_type,
    skill: job.skill,
    scenario_id: job.scenario_id,
    requested_seed: job.requested_seed,
    requested_temperature: job.requested_temperature,
    prompt_packet_sha256: job.prompt_packet_sha256,
    status: "complete",
    raw_output: "responsive result",
    raw_output_hash: sha256("responsive result"),
    artifact_receipts: responsiveArtifacts.map((entry) => ({
      fixture_id: artifactContract.fixture_id,
      id: entry.id,
      path: `${manifest.artifact_root}/${entry.path}`,
      sha256: sha256(readFileSync(join(fixtureRoot, manifest.artifact_root, entry.path))),
      captured_at: "2026-07-11T00:00:00Z",
    })),
  };
  assert.equal(scaffold.validateModelResult(fixtureRoot, result).errors.length, 0);
  writeJson(artifactPath, { viewport: 375, zoom: 4, overflow: 0, container: "narrow-sidebar" });
  assert(scaffold.validateModelResult(fixtureRoot, result).errors.some((error) => /artifact.*digest|tamper/i.test(error)), "tampered artifact must block");
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("remediation7 replay tests: sealed fixture package and fail-closed artifact checks passed");
