#!/usr/bin/env node
/** Deterministic release checks. Static checks never claim model/browser execution. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
export const TERMINAL_V5_SYNTHESIS = "evals/replays/remediation7-v5-spacing-final-2026-07-11/blind-judge/synthesis.json";
export const HISTORICAL_FULL19_PREFIX = "evals/replays/full19-v1rc-2026-07-11/";
const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ?? "release";

function load(rel) { return JSON.parse(readFileSync(join(root, rel), "utf8")); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function at(value, path) { return path.split(".").reduce((current, key) => current?.[key], value); }

export function checkReceiptManifest(manifest, { readText = (path) => readFileSync(join(root, path), "utf8"), hasFile = (path) => existsSync(join(root, path)) } = {}) {
  const errors = [];
  if (manifest?.schema_version !== 1) errors.push("release receipt manifest schema_version must be 1");
  if (manifest?.target_release !== "1.0.0") errors.push("release receipt manifest target_release must be 1.0.0");
  if (!Array.isArray(manifest?.required_receipts) || manifest.required_receipts.length === 0) errors.push("required_receipts must be nonempty");
  for (const receipt of manifest?.required_receipts ?? []) {
    if (!receipt.id || !receipt.path || !receipt.sha256 || !receipt.assertions) {
      errors.push(`${receipt.id ?? "<unnamed>"}: missing path, sha256, or assertions`);
      continue;
    }
    if (!hasFile(receipt.path)) { errors.push(`${receipt.id}: missing required receipt cell ${receipt.path}`); continue; }
    const text = readText(receipt.path);
    if (sha256(text) !== receipt.sha256) errors.push(`${receipt.id}: pinned SHA-256 does not match ${receipt.path}`);
    const value = JSON.parse(text);
    for (const [path, expected] of Object.entries(receipt.assertions)) {
      if (at(value, path) !== expected) errors.push(`${receipt.id}: ${path}=${JSON.stringify(at(value, path))}; expected ${JSON.stringify(expected)}`);
    }
  }
  return errors;
}

export function checkReleaseManifest(manifest, io = {}) {
  const errors = checkReceiptManifest(manifest, io);
  const terminal = manifest?.required_receipts?.find((receipt) => receipt.id === "terminal-v5-synthesis");
  if (!terminal) {
    errors.push("terminal-v5-synthesis: required terminal V5 synthesis receipt is missing");
  } else {
    if (terminal.path !== TERMINAL_V5_SYNTHESIS) errors.push("terminal-v5-synthesis: terminal receipt path is not the canonical V5 synthesis");
    if (terminal.assertions?.release_eligible !== true) errors.push("terminal-v5-synthesis: release_eligible=true is required");
  }
  for (const receipt of manifest?.required_receipts ?? []) {
    if (receipt.path?.startsWith(HISTORICAL_FULL19_PREFIX)) errors.push(`${receipt.id}: historical full19-v1rc evidence cannot satisfy the current release gate`);
  }
  return errors;
}

function runNode(script, args = []) {
  try { execFileSync(process.execPath, [join(root, script), ...args], { cwd: root, stdio: "inherit" }); return true; }
  catch { return false; }
}

function claims() {
  const errors = [];
  const pkg = load("package.json");
  const manifest = load("skills.json");
  const dirs = readdirSync(join(root, "skills")).filter((name) => statSync(join(root, "skills", name)).isDirectory());
  const commandCount = readdirSync(join(root, "commands")).filter((name) => name.endsWith(".md")).length;
  if (pkg.version !== "1.0.0") errors.push(`package.json version is ${pkg.version}; expected 1.0.0`);
  if (manifest.version !== "1.0.0") errors.push(`skills.json version is ${manifest.version}; expected 1.0.0`);
  const manifestNames = new Set(manifest.skills.map((skill) => skill.name));
  if (new Set(dirs).size !== 19 || dirs.some((name) => !manifestNames.has(name)) || manifestNames.size !== new Set(dirs).size) errors.push(`skill inventory is not an exact 19-entry manifest parity`);
  if (commandCount !== 20) errors.push(`command inventory is ${commandCount}; expected 20`);
  const index = readFileSync(join(root, "index.html"), "utf8");
  if (/set of 15|set of 14|set of 13/.test(index)) errors.push("index.html contains a stale skill-count claim");
  if (/19 commands/i.test(readFileSync(join(root, "README.md"), "utf8"))) errors.push("README.md claims 19 commands; release truth is 20 command files");
  return errors;
}

function checkE2E() {
  const path = process.env.TASTECHECK_E2E_RECEIPT ?? "evals/receipts/v1/e2e.json";
  if (!existsSync(join(root, path))) return [`missing live e2e receipt cell ${path}`];
  const receipt = load(path);
  if (receipt.executed !== true || receipt.status !== "pass") return [`e2e receipt is not an executed pass: ${path}`];
  return [];
}

function main() {
  const errors = [];
  if (mode === "browser") {
    const ok = ["tools/verify.mjs", "tools/verify-landing.mjs", "tools/verify-integration.mjs", "tools/verify-gate-audit.mjs"].every((script) => runNode(script));
    if (!ok) errors.push("static browser-contract checks failed");
    else console.log("browser-contract checks passed; no live browser execution claimed");
  } else if (mode === "interviews") {
    const ok = runNode("tools/contracts/test-contracts.mjs") && runNode("tools/contracts/project.mjs", ["--scope=interviews"]);
    if (!ok) errors.push("interview contract/projection checks failed");
    else console.log("interview schema/projection checks passed; no model interview execution claimed");
  } else if (mode === "routing") {
    if (!runNode("tools/contracts/test-scenarios.mjs")) errors.push("scenario routing checks failed");
    else console.log("routing contract checks passed; no semantic model routing execution claimed");
  } else if (mode === "e2e") {
    errors.push(...checkE2E());
  } else if (mode === "claims") {
    errors.push(...claims());
  } else if (mode === "release") {
    errors.push(...claims(), ...checkReleaseManifest(load("contracts/v1/release-receipts.json")));
  } else errors.push(`unknown release check mode: ${mode}`);
  if (errors.length) {
    console.error(`release check blocked (${mode})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`release check passed (${mode})`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
