#!/usr/bin/env node
/**
 * tools/evals/pilot-manifest.mjs — pilot job manifest and prompt packets.
 *
 * Defines the mandatory minimum evaluation corpus for pilot skills:
 *   component-states, deslop-ui, tastecheck-pass
 *
 * Each skill gets: 1 frozen baseline run + 3 upgraded fresh-context runs.
 * Prompt packets are derived from the scenario registry (never fabricated).
 *
 * Fail-closed: exits 1 if a required run cell is absent from raw evidence.
 *
 * Usage:
 *   node tools/evals/pilot-manifest.mjs               # print manifest + check evidence
 *   node tools/evals/pilot-manifest.mjs --check        # exit 1 if any cell missing
 *   node tools/evals/pilot-manifest.mjs --write        # write manifest JSON to evals/generated/
 *
 * Supports externally written raw output files from Codex desktop / Terra / Luna threads.
 * External writers write to:
 *   .omx/evidence/tastecheck-v1/raw/<skill>/<scenario_id>/<variant>-<seed>-<unique>.json
 * The collect-attempts.mjs tool then ingests and validates those files.
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

const PILOT_SKILLS = ["component-states", "deslop-ui", "tastecheck-pass"];

// Run matrix per skill class (from test spec operational-run-matrix)
const CLASS_MATRIX = {
  generative: { temperature: 0.7, seeds: [101, 202, 303] },
  repair:     { temperature: 0.2, seeds: [101, 202, 303] },
  gate:       { temperature: 0.0, seeds: [101, 202, 303] },
};

// Load scenario registry
const registryPath = join(root, "evals/generated/scenario-registry.json");
if (!existsSync(registryPath)) {
  console.error("BLOCKED: evals/generated/scenario-registry.json not found — run build-registry.mjs first");
  process.exit(1);
}
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

// Index scenarios by skill
const scenariosBySkill = {};
for (const s of registry.scenarios) {
  if (!scenariosBySkill[s.skill]) scenariosBySkill[s.skill] = [];
  scenariosBySkill[s.skill].push(s);
}

// Build manifest entries
const manifest = {
  schema_version: 1,
  description: "Pilot evaluation corpus: 3 skills × (1 baseline + 3 upgraded) = 12 cells",
  pilot_skills: PILOT_SKILLS,
  cells: [],
};

for (const skill of PILOT_SKILLS) {
  const scenarios = scenariosBySkill[skill];
  if (!scenarios || scenarios.length === 0) {
    console.error(`BLOCKED: no scenario found for pilot skill "${skill}"`);
    process.exit(1);
  }
  const scenario = scenarios[0]; // use the primary scenario for each pilot skill
  const cls = scenario.class;
  const matrix = CLASS_MATRIX[cls];
  if (!matrix) {
    console.error(`BLOCKED: unknown scenario class "${cls}" for skill "${skill}"`);
    process.exit(1);
  }

  // Baseline cell (frozen — references baseline evidence, never regenerated through upgraded files)
  manifest.cells.push({
    cell_id: `${skill}:baseline`,
    skill,
    scenario_id: scenario.id ?? scenario.scenario_id,
    scenario_class: cls,
    variant: "baseline",
    seed: null,
    temperature: matrix.temperature,
    fresh_context: false,
    prompt_packet: {
      prompt: scenario.prompt,
      assertions: scenario.assertions,
      routing: scenario.routing ?? null,
    },
    run_conditions: {
      tool_policy: "read-only",
      invalid_retry_cap: 2,
      acceptance_quorum: 3,
    },
    evidence_path: `.omx/evidence/tastecheck-v1/raw/${skill}/${scenario.id ?? scenario.scenario_id}/baseline.json`,
    notes: "Frozen baseline — use W0 manifest blob; never regenerate through upgraded skill files.",
  });

  // Upgraded cells (3 fresh-context runs with seeds 101, 202, 303)
  for (const seed of matrix.seeds) {
    manifest.cells.push({
      cell_id: `${skill}:upgraded:${seed}`,
      skill,
      scenario_id: scenario.id ?? scenario.scenario_id,
      scenario_class: cls,
      variant: "upgraded",
      seed,
      temperature: matrix.temperature,
      fresh_context: true,
      prompt_packet: {
        prompt: scenario.prompt,
        assertions: scenario.assertions,
        routing: scenario.routing ?? null,
      },
      run_conditions: {
        tool_policy: "read-only",
        invalid_retry_cap: 2,
        acceptance_quorum: 3,
      },
      // Unique suffix allows externally written files from Codex desktop/Terra/Luna threads
      evidence_path: `.omx/evidence/tastecheck-v1/raw/${skill}/${scenario.id ?? scenario.scenario_id}/upgraded-${seed}.json`,
      external_writer_glob: `.omx/evidence/tastecheck-v1/raw/${skill}/${scenario.id ?? scenario.scenario_id}/upgraded-${seed}-*.json`,
      notes: "Fresh context required. External writers (Codex/Terra/Luna) may write to external_writer_glob path; collect-attempts.mjs ingests and validates.",
    });
  }
}

// --write: persist the manifest
const doWrite = process.argv.includes("--write");
const doCheck = process.argv.includes("--check");

if (doWrite) {
  const generatedDir = join(root, "evals/generated");
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "pilot-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Wrote evals/generated/pilot-manifest.json");
}

// Evidence presence check (fail-closed)
const rawBase = join(root, ".omx/evidence/tastecheck-v1/raw");
const missing = [];
const present = [];

for (const cell of manifest.cells) {
  const primary = join(root, cell.evidence_path);
  let found = existsSync(primary);

  // Also scan external-writer glob pattern (upgraded cells only)
  if (!found && cell.external_writer_glob) {
    const dir = join(root, cell.evidence_path.replace(/\/[^/]+$/, ""));
    const seedStr = String(cell.seed);
    if (existsSync(dir)) {
      const files = readdirSync(dir);
      found = files.some((f) => f.startsWith(`upgraded-${seedStr}-`) && f.endsWith(".json"));
    }
  }

  if (found) {
    present.push(cell.cell_id);
  } else {
    missing.push(cell.cell_id);
  }
}

console.log(`\nPilot manifest: ${manifest.cells.length} cells (${PILOT_SKILLS.length} skills × 4 runs each)`);
console.log(`  Present: ${present.length}`);
if (missing.length > 0) {
  console.log(`  Missing: ${missing.length}`);
  for (const id of missing) console.log(`    - ${id}`);
}

if (!doWrite && !doCheck) {
  // Print compact manifest table
  console.log("\nCell table:");
  for (const cell of manifest.cells) {
    const status = present.includes(cell.cell_id) ? "present" : "missing";
    const seedLabel = cell.seed !== null ? `seed=${cell.seed}` : "frozen-baseline";
    console.log(`  [${status}] ${cell.cell_id}  (${seedLabel}, t=${cell.temperature})`);
  }
}

if (doCheck && missing.length > 0) {
  console.error(`\nBLOCKED: ${missing.length} required pilot cells are absent from raw evidence.`);
  console.error("Run each missing cell and ingest results with: node tools/evals/collect-attempts.mjs");
  process.exit(1);
}
