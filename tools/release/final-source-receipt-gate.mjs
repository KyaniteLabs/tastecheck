#!/usr/bin/env node
/** Dependency-free final-source freshness gate for mutable release receipts. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { computeSourceTreeSha256 } from "./engineering-receipt.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SHA256 = /^[a-f0-9]{64}$/;

export const ENGINEERING_PRODUCERS = Object.freeze({
  "context-budget": Object.freeze({ path: "evals/receipts/v1/context-budget.json", command: "npm run eval:context-budget", assertions: Object.freeze({ overall_pass: true }) }),
  browser: Object.freeze({ path: "evals/receipts/v1/browser.json", command: "npm run release:browser-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.live-execution.v1" }) }),
  e2e: Object.freeze({ path: "evals/receipts/v1/e2e.json", command: "npm run release:e2e-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.live-execution.v1" }) }),
  mechanical: Object.freeze({ path: "evals/receipts/v1/mechanical.json", command: "npm run release:mechanical-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.mechanical.v1" }) }),
  security: Object.freeze({ path: "evals/receipts/v1/security.json", command: "npm run release:security-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.security.v1" }) }),
  "clean-clone": Object.freeze({ path: "evals/receipts/v1/clean-clone.json", command: "npm run release:clean-clone-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.clean-clone.v1" }) }),
});

export const PUBLIC_STATUS_RECEIPT = "evals/receipts/v1/public-release-status.json";

const defaultIo = Object.freeze({
  readText: (path) => readFileSync(join(root, path), "utf8"),
  hasFile: (path) => existsSync(join(root, path)),
  sourceTreeSha256: () => computeSourceTreeSha256(root),
});

/**
 * Verify every mutable release receipt against one final-source snapshot.
 * This module deliberately has no optional schema-validator dependencies so
 * the final freshness proof can run in a dependency-free structural lane.
 */
export function verifyFinalSourceReceiptDigests(manifest, ioOverrides = {}) {
  const io = { ...defaultIo, ...ioOverrides };
  const errors = [];
  const finalSource = io.sourceTreeSha256();
  if (!SHA256.test(finalSource ?? "")) errors.push("final source digest is not a lowercase SHA-256");

  const cells = manifest?.engineering_readiness?.required_cells;
  const byId = new Map(Array.isArray(cells) ? cells.map((cell) => [cell?.id, cell]) : []);
  for (const [id, producer] of Object.entries(ENGINEERING_PRODUCERS)) {
    const cell = byId.get(id);
    if (!cell) {
      errors.push(`${id}: final-source receipt gate is missing the manifest cell`);
      continue;
    }
    if (cell.path !== producer.path) {
      errors.push(`${id}: final-source receipt gate path is not ${producer.path}`);
      continue;
    }
    if (!io.hasFile(cell.path)) {
      errors.push(`${id}: final-source receipt gate cannot read ${cell.path}`);
      continue;
    }
    let receipt;
    try { receipt = JSON.parse(io.readText(cell.path)); }
    catch { receipt = null; }
    if (receipt?.source_tree_sha256 !== finalSource) {
      errors.push(`${id}: receipt source_tree_sha256 does not match final source digest`);
    }
  }

  if (!io.hasFile(PUBLIC_STATUS_RECEIPT)) {
    errors.push(`public status: final-source receipt gate cannot read ${PUBLIC_STATUS_RECEIPT}`);
  } else {
    let status;
    try { status = JSON.parse(io.readText(PUBLIC_STATUS_RECEIPT)); }
    catch { status = null; }
    if (status?.source_tree_sha256 !== finalSource) {
      errors.push("public status: source_tree_sha256 does not match final source digest");
    }
  }

  const verificationSource = io.sourceTreeSha256();
  if (verificationSource !== finalSource) errors.push("source tree changed while final-source receipt gate was running");
  return { status: errors.length ? "blocked" : "ready", sourceTreeSha256: finalSource, errors };
}
