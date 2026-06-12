#!/usr/bin/env node
// Smoke-prompt harness — regression-tests how MODELS interpret the skills, which no
// static check can catch (e.g. the original samples-as-menu bug). Costs real model
// calls: run manually (`npm run smoke`), never in CI.
//
//   SMOKE_AGENT=claude node tools/smoke/run-smoke.mjs [--only <id>] [--dry-run]
//   SMOKE_AGENT values: "claude" (default) | "codex"
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const scenarios = JSON.parse(readFileSync(join(root, "tools/smoke/prompts.json"), "utf8"));
const agent = process.env.SMOKE_AGENT ?? "claude";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const dryRun = process.argv.includes("--dry-run");
const TIMEOUT_MS = 180_000;

function runAgent(prompt) {
  const cmd = agent === "codex"
    ? ["codex", ["exec", "--sandbox", "read-only", prompt]]
    : ["claude", ["-p", prompt, "--max-turns", "4"]];
  const res = spawnSync(cmd[0], cmd[1], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS });
  return `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
}

let failures = 0;
for (const s of scenarios) {
  if (only && s.id !== only) continue;
  if (dryRun) {
    console.log(`[dry-run] ${s.id}: ${s.prompt.slice(0, 90)}…`);
    continue;
  }
  process.stdout.write(`▶ ${s.id} … `);
  const out = runAgent(s.prompt);
  const problems = [];
  for (const re of s.mustMatch) {
    if (!new RegExp(re, "i").test(out)) problems.push(`missing expected /${re}/i`);
  }
  for (const re of s.mustNotMatch) {
    if (new RegExp(re, "i").test(out)) problems.push(`matched forbidden /${re}/i`);
  }
  if (problems.length) {
    failures++;
    console.log("FAIL");
    for (const p of problems) console.log(`    ✗ ${p}`);
    console.log(`    — excerpt: ${out.replace(/\s+/g, " ").slice(0, 240)}`);
  } else {
    console.log("pass");
  }
}
if (!dryRun) {
  console.log(`\nsmoke: ${failures} failing scenario(s). Assertions are heuristics — read the transcript before acting on a failure.`);
  if (failures) process.exit(1);
}
