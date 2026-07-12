#!/usr/bin/env node
/**
 * tools/evals/ab-mapping.mjs — blinded A/B mapping for corpus evaluation.
 *
 * Randomizes baseline/upgraded run pairs to opaque A/B labels per scenario.
 * Strips version/skill-author cues before handing outputs to evaluators.
 * Preserves the randomization map only in private raw evidence (.omx/).
 *
 * Contract:
 *   - Input: skill + scenario_id
 *   - Reads ledger.jsonl to find baseline + upgraded runs for the scenario
 *   - Randomly assigns "baseline" and one upgraded run to A/B (per eval session)
 *   - Writes private mapping to .omx/evidence/tastecheck-v1/raw/<skill>/<scenario>/ab-mapping.json
 *   - Prints blinded A/B output refs for the evaluator
 *   - Evaluators never see which label is baseline vs upgraded
 *
 * Usage:
 *   node tools/evals/ab-mapping.mjs <skill> <scenario_id> [--seed <N>]
 *   node tools/evals/ab-mapping.mjs --list          # show all mapped scenarios
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RAW_BASE = join(root, ".omx/evidence/tastecheck-v1/raw");
const LEDGER_PATH = join(RAW_BASE, "ledger.jsonl");

function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return [];
  return readFileSync(LEDGER_PATH, "utf8").trim().split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// Deterministic pseudo-random from a seed string (no Date.now / Math.random)
function deterministicChoice(items, seedStr) {
  const digest = createHash("sha256").update(seedStr).digest();
  const idx = digest[0] % items.length;
  return items[idx];
}

// The only judge-visible candidate shape. Mapping identifiers remain private.
export function judgeVisibleCandidate(label, rawOutput, rawOutputHash) {
  return {
    label,
    raw_output: rawOutput,
    raw_output_hash: rawOutputHash,
  };
}

function mapScenario(skill, scenarioId, seedArg) {
  const ledger = loadLedger();
  const baseline = ledger.filter((e) => e.skill === skill && e.scenario_id === scenarioId && e.run_type === "baseline");
  const upgraded = ledger.filter((e) => e.skill === skill && e.scenario_id === scenarioId && e.run_type === "upgraded");

  if (baseline.length === 0) {
    console.error(`BLOCKED: no baseline run found for ${skill}/${scenarioId} in ledger`);
    process.exit(1);
  }
  if (upgraded.length === 0) {
    console.error(`BLOCKED: no upgraded run found for ${skill}/${scenarioId} in ledger`);
    process.exit(1);
  }

  // Use first baseline and one upgraded run (deterministic selection by seed)
  const baselineRun = baseline[0];
  const seedStr = seedArg ? String(seedArg) : `${skill}:${scenarioId}:ab`;
  const upgradedRun = deterministicChoice(upgraded, seedStr);

  // Randomly assign A/B (deterministic from seed)
  const digest = createHash("sha256").update(`${seedStr}:assign`).digest();
  const baselineIsA = digest[0] % 2 === 0;

  const mapping = {
    schema_version: 1,
    skill,
    scenario_id: scenarioId,
    mapping_seed: seedStr,
    A: baselineIsA ? "baseline" : "upgraded",
    B: baselineIsA ? "upgraded" : "baseline",
    A_attempt_id: baselineIsA ? baselineRun.attempt_id : upgradedRun.attempt_id,
    B_attempt_id: baselineIsA ? upgradedRun.attempt_id : baselineRun.attempt_id,
    A_raw_output_hash: baselineIsA ? baselineRun.raw_output_hash : upgradedRun.raw_output_hash,
    B_raw_output_hash: baselineIsA ? upgradedRun.raw_output_hash : baselineRun.raw_output_hash,
  };

  // Write private mapping (never published; shared hashes are sufficient for public receipts)
  const mapDir = join(RAW_BASE, skill, scenarioId);
  mkdirSync(mapDir, { recursive: true });
  const mapPath = join(mapDir, "ab-mapping.json");
  writeFileSync(mapPath, JSON.stringify(mapping, null, 2));

  // The private map retains lineage; evaluator output shows only labels and hashes.
  console.log(`\nBlinded A/B assignment for: ${skill} / ${scenarioId}`);
  console.log(`  Label A — hash: ${mapping.A_raw_output_hash}`);
  console.log(`  Label B — hash: ${mapping.B_raw_output_hash}`);
  console.log(`\nMapping saved (private): .omx/evidence/tastecheck-v1/raw/${skill}/${scenarioId}/ab-mapping.json`);
  console.log("Evaluators: judge Label A vs Label B using the rubric — do NOT peek at ab-mapping.json.");
}

import { readdirSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "--list") {
  // Re-implement list without require
  if (!existsSync(RAW_BASE)) { console.log("No raw evidence yet."); process.exit(0); }
  const skills = readdirSync(RAW_BASE).filter((f) => !f.endsWith(".jsonl") && f !== "sha256");
  if (skills.length === 0) { console.log("No A/B mappings found."); process.exit(0); }
  for (const skill of skills) {
    const skillDir = join(RAW_BASE, skill);
    let scenarios;
    try { scenarios = readdirSync(skillDir); } catch { continue; }
    for (const scenario of scenarios) {
      const mapPath = join(skillDir, scenario, "ab-mapping.json");
      if (existsSync(mapPath)) {
        const m = JSON.parse(readFileSync(mapPath, "utf8"));
        console.log(`${skill}/${scenario}: A=${m.A}, B=${m.B}`);
      }
    }
  }
} else {
  const [skill, scenarioId] = args;
  const seedIdx = args.indexOf("--seed");
  const seedArg = seedIdx !== -1 ? args[seedIdx + 1] : null;
  if (!skill || !scenarioId) {
    console.log("Usage: node tools/evals/ab-mapping.mjs <skill> <scenario_id> [--seed <N>]");
    console.log("       node tools/evals/ab-mapping.mjs --list");
    process.exit(1);
  }
  mapScenario(skill, scenarioId, seedArg);
}
