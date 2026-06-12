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
// Agentic scenarios load skills and run interviews — they need real turn/time budget.
// 4 turns was too tight: interview-triggering prompts died on "Reached max turns".
const TIMEOUT_MS = 360_000;

// Headless runs can't answer questions: suppress interactive feature offers
// (browser visuals, setup prompts) that otherwise stall -p transcripts mid-answer.
const HEADLESS_SUFFIX =
  " (You are running headless: answer completely in plain text in this single reply." +
  " Do not offer optional features, visual previews, or ask setup questions.)";

function runAgent(prompt) {
  const full = prompt + HEADLESS_SUFFIX;
  const cmd = agent === "codex"
    ? ["codex", ["exec", "--sandbox", "read-only", full]]
    : ["claude", ["-p", full, "--max-turns", "12"]];
  const res = spawnSync(cmd[0], cmd[1], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS });
  // Make timeouts/crashes visible — an empty transcript is undiagnosable.
  const notes = [];
  if (res.signal) notes.push(`killed by ${res.signal} — likely hit the ${TIMEOUT_MS / 1000}s timeout`);
  if (res.error) notes.push(`spawn error: ${res.error.message}`);
  if (typeof res.status === "number" && res.status !== 0) notes.push(`agent exit code ${res.status}`);
  if (!(res.stdout ?? "").trim() && !(res.stderr ?? "").trim()) notes.push("agent produced no output");
  const meta = notes.length ? `\n[runner: ${notes.join("; ")}]` : "";
  return `${res.stdout ?? ""}\n${res.stderr ?? ""}${meta}`;
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
