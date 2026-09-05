#!/usr/bin/env node
/**
 * tools/evals/build-registry.mjs — aggregates scenario shards into one registry.
 *
 * Canonical sources: evals/scenarios/<skill>.json + evals/scenarios/cross-skill.json
 * Output:           evals/generated/scenario-registry.json
 *
 * Rules:
 *   - Scenario IDs must be globally unique
 *   - Each scenario must reference a skill from skills.json
 *   - Shards are sorted by skill name before merging
 *   - The registry is the only generated file; never hand-edit it
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const scenariosDir = join(root, "evals/scenarios");
const generatedDir = join(root, "evals/generated");
mkdirSync(generatedDir, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
const knownSkills = new Set(manifest.skills.map((s) => s.name));

const errors = [];
const allScenarios = [];
const seenIds = new Set();

if (!existsSync(scenariosDir)) {
  console.log("evals/scenarios/ does not exist — no scenarios to aggregate (expected at W0)");
  const registry = { schema_version: 1, scenario_count: 0, skills_covered: [], scenarios: [] };
  writeFileSync(join(generatedDir, "scenario-registry.json"), JSON.stringify(registry, null, 2));
  console.log("Wrote evals/generated/scenario-registry.json (empty)");
  process.exit(0);
}

const shardFiles = readdirSync(scenariosDir)
  .filter((f) => f.endsWith(".json"))
  // Replay manifests are control-plane inputs, not scenario shards. They are
  // validated by the replay lane and must not be treated as scenarios here.
  .filter((f) => f !== "remediation7-replay.json")
  .sort();

for (const file of shardFiles) {
  const path = join(scenariosDir, file);
  let shard;
  try {
    shard = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON — ${e.message}`);
    continue;
  }
  const scenarios = shard.scenarios ?? [shard];
  for (const scenario of scenarios) {
    const id = scenario.id ?? scenario.scenario_id;
    if (!id) { errors.push(`${file}: scenario missing id or scenario_id field`); continue; }
    if (!scenario.skill && file !== "cross-skill.json") {
      errors.push(`${file}: scenario ${id} missing skill field`);
      continue;
    }
    if (scenario.skill && !knownSkills.has(scenario.skill)) {
      errors.push(`${file}: scenario ${id} references unknown skill "${scenario.skill}"`);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`${file}: duplicate scenario id "${id}"`);
      continue;
    }
    seenIds.add(id);
    // Normalize: canonical field is always `id`; strip legacy `scenario_id` to prevent silent drift
    scenario.id = id;
    delete scenario.scenario_id;
    allScenarios.push(scenario);
  }
}

if (errors.length) {
  for (const e of errors) console.error("ERROR:", e);
  process.exit(1);
}

const skillsCovered = [...new Set(allScenarios.map((s) => s.skill).filter(Boolean))].sort();
const registry = {
  schema_version: 1,
  scenario_count: allScenarios.length,
  skills_covered: skillsCovered,
  missing_skills: [...knownSkills].filter((s) => !new Set(skillsCovered).has(s)).sort(),
  scenarios: allScenarios,
};

writeFileSync(join(generatedDir, "scenario-registry.json"), JSON.stringify(registry, null, 2));
console.log(`scenario-registry: ${allScenarios.length} scenarios, ${skillsCovered.length} skills covered`);
if (registry.missing_skills.length) {
  console.warn(`  WARN: no scenarios for: ${registry.missing_skills.join(", ")}`);
}
