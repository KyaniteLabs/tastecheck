#!/usr/bin/env node
/**
 * tools/evals/evaluators/blind-corpus.mjs — blinded A/B mapping generator.
 *
 * Randomizes baseline/upgraded outputs to opaque labels A/B per scenario.
 * Evaluators see only blinded outputs; the mapping is private in raw evidence.
 * Labels are deterministic per (scenario_id, run_id) so re-running is idempotent.
 *
 * Usage:
 *   node tools/evals/evaluators/blind-corpus.mjs generate              # create/refresh blind map
 *   node tools/evals/evaluators/blind-corpus.mjs view <scenario_id>    # show blinded outputs for grading
 *   node tools/evals/evaluators/blind-corpus.mjs status                # show ledger coverage
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const rawDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const ledgerPath = join(rawDir, "ledger.jsonl");
const blindMapPath = join(rawDir, "blind-map.json");

function sha256hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

function readLedger() {
  if (!existsSync(ledgerPath)) return [];
  return readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function readBlob(ref) {
  const digest = ref.replace("sha256:", "");
  const p = join(rawDir, "sha256", digest);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

// Deterministic label assignment per (scenarioId, runId) using first nibble of sha256
function assignLabel(scenarioId, runId) {
  return parseInt(sha256hex(scenarioId + "::" + runId).slice(0, 4), 16) % 2 === 0 ? "A" : "B";
}

const [,, command, scenarioArg] = process.argv;

if (command === "generate") {
  const entries = readLedger();
  if (!entries.length) {
    console.error("No entries in ledger. Collect attempts first with collect-attempt.mjs.");
    process.exit(1);
  }

  const byScenario = {};
  for (const entry of entries) {
    if (!byScenario[entry.scenario_id]) byScenario[entry.scenario_id] = [];
    byScenario[entry.scenario_id].push(entry);
  }

  const blindMap = {
    schema_version: 1,
    note: "Private randomization map. Do not share with evaluators. Labels are deterministic per (scenario_id, run_id).",
    generated_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    assignments: {},
  };

  for (const [scenarioId, group] of Object.entries(byScenario)) {
    blindMap.assignments[scenarioId] = group.map((entry) => ({
      attempt_id: entry.attempt_id,
      run_type: entry.run_type,
      requested_seed: entry.requested_seed,
      label: assignLabel(scenarioId, entry.attempt_id),
      raw_output_hash: entry.raw_output_hash,
    }));
  }

  mkdirSync(rawDir, { recursive: true });
  writeFileSync(blindMapPath, JSON.stringify(blindMap, null, 2));
  console.log(`Blind map generated: ${Object.keys(blindMap.assignments).length} scenarios`);
  for (const [sid, assignments] of Object.entries(blindMap.assignments)) {
    const b = assignments.filter((a) => a.run_type === "baseline").length;
    const u = assignments.filter((a) => a.run_type === "upgraded").length;
    console.log(`  ${sid}: ${b} baseline, ${u} upgraded`);
  }

} else if (command === "view") {
  if (!scenarioArg) {
    console.error("Usage: blind-corpus.mjs view <scenario_id>");
    process.exit(1);
  }
  if (!existsSync(blindMapPath)) {
    console.error("Blind map not generated. Run: node tools/evals/evaluators/blind-corpus.mjs generate");
    process.exit(1);
  }
  const blindMap = JSON.parse(readFileSync(blindMapPath, "utf8"));
  const assignments = blindMap.assignments[scenarioArg];
  if (!assignments) {
    console.error(`No assignments for scenario: ${scenarioArg}`);
    console.log("Available:", Object.keys(blindMap.assignments).join(", "));
    process.exit(1);
  }

  // Sort by label so evaluators see A, then B (no variant identity)
  const sorted = [...assignments].sort((a, b) => a.label.localeCompare(b.label));
  console.log(`\n=== Blinded outputs for: ${scenarioArg} ===`);
  console.log("(run_type identity is hidden. Grade on rubric only.)\n");
  for (const a of sorted) {
    const body = readBlob(a.raw_output_hash);
    console.log(`--- Label ${a.label} ---`);
    console.log(`    hash: ${a.raw_output_hash}`);
    if (body) {
      console.log(body);
    } else {
      console.log("(body blob not found — check .omx/evidence/tastecheck-v1/raw/sha256/)");
    }
    console.log();
  }

} else if (command === "status") {
  const entries = readLedger();
  console.log(`Ledger: ${entries.length} total entries`);
  const bySkill = {};
  for (const e of entries) {
    if (!bySkill[e.skill]) bySkill[e.skill] = { baseline: 0, upgraded: 0, error: 0 };
    if (e.status === "error") bySkill[e.skill].error++;
    else bySkill[e.skill][e.run_type] = (bySkill[e.skill][e.run_type] || 0) + 1;
  }
  for (const [skill, counts] of Object.entries(bySkill)) {
    console.log(`  ${skill}: baseline=${counts.baseline} upgraded=${counts.upgraded} error=${counts.error}`);
  }
  if (!existsSync(blindMapPath)) console.log("\nBlind map: not yet generated");
  else console.log("\nBlind map: present");

} else {
  console.error("Usage: blind-corpus.mjs <generate|view <scenario_id>|status>");
  process.exit(1);
}
