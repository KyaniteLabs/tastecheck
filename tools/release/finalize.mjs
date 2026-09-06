#!/usr/bin/env node
/** Refresh source-bound mutable receipts, pins, public status, and verify-chain. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildContextBudgetReport } from "../evals/context-budget.mjs";
import { computeSourceTreeSha256 } from "./engineering-receipt.mjs";
import { ENGINEERING_PRODUCERS } from "./final-source-receipt-gate.mjs";
import { projectPublicStatus } from "./project-public-status.mjs";

const DEFAULT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CONTEXT_RECEIPT = "evals/receipts/v1/context-budget.json";
const MANIFEST = "contracts/v1/release-receipts.json";
const SHA256 = /^[a-f0-9]{64}$/;

const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function writeIfChanged(root, relativePath, value) {
  const destination = join(root, relativePath);
  const next = json(value);
  if (!existsSync(destination) || readFileSync(destination, "utf8") !== next) writeFileSync(destination, next, "utf8");
}

function refreshContextBudget(root) {
  const { report, findings } = buildContextBudgetReport(root);
  if (findings.length) throw new Error(`context-budget is not releasable:\n${findings.map((finding) => `- ${finding}`).join("\n")}`);
  writeIfChanged(root, CONTEXT_RECEIPT, report);
  console.log(`finalize: context-budget refreshed (${report.skills.length} skills)`);
}

function refreshReceiptSources(root, sourceTreeSha256) {
  for (const [id, producer] of Object.entries(ENGINEERING_PRODUCERS)) {
    const receipt = readJson(root, producer.path);
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error(`${id}: receipt must be a JSON object`);
    receipt.source_tree_sha256 = sourceTreeSha256;
    writeIfChanged(root, producer.path, receipt);
  }
  console.log(`finalize: refreshed ${Object.keys(ENGINEERING_PRODUCERS).length} mutable receipt digests (${sourceTreeSha256})`);
}

function refreshManifestPins(root) {
  const manifest = readJson(root, MANIFEST);
  const cells = manifest?.engineering_readiness?.required_cells;
  if (!Array.isArray(cells)) throw new Error("release manifest has no engineering readiness cells");
  for (const cell of cells) {
    const producer = ENGINEERING_PRODUCERS[cell.id];
    if (!producer || cell.path !== producer.path) continue;
    cell.sha256 = hash(readFileSync(join(root, producer.path)));
  }
  for (const id of Object.keys(ENGINEERING_PRODUCERS)) {
    if (!cells.some((cell) => cell.id === id)) throw new Error(`${id}: release manifest cell is missing`);
  }
  writeIfChanged(root, MANIFEST, manifest);
  console.log("finalize: updated engineering receipt pins");
}

function main() {
  const rootArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const root = resolve(rootArg ?? DEFAULT_ROOT);
  mkdirSync(join(root, "evals/receipts/v1"), { recursive: true });

  refreshContextBudget(root);
  const sourceTreeSha256 = computeSourceTreeSha256(root);
  if (!SHA256.test(sourceTreeSha256)) throw new Error("final source digest is not a lowercase SHA-256");
  refreshReceiptSources(root, sourceTreeSha256);
  refreshManifestPins(root);
  const status = projectPublicStatus(root);
  console.log(`finalize: projected public status (${status.overall_status.toUpperCase()})`);

  const finalSource = computeSourceTreeSha256(root);
  if (finalSource !== sourceTreeSha256) throw new Error("source tree changed while finalizing receipts");
  execFileSync(process.execPath, [join(root, "tools/release/check.mjs"), "--mode=verify-chain"], { cwd: root, stdio: "inherit" });
  console.log(`finalize: complete (${sourceTreeSha256})`);
}

try {
  main();
} catch (error) {
  console.error(`finalize blocked: ${error.message}`);
  process.exitCode = 1;
}
