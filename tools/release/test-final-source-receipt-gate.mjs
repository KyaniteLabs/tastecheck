#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ENGINEERING_PRODUCERS,
  PUBLIC_STATUS_RECEIPT,
  verifyFinalSourceReceiptDigests,
} from "./final-source-receipt-gate.mjs";
import { sourceRebindReceipts } from "./finalize.mjs";

const SOURCE_SHA = "a".repeat(64);
const manifest = {
  engineering_readiness: {
    required_cells: Object.entries(ENGINEERING_PRODUCERS).map(([id, producer]) => ({ id, path: producer.path })),
  },
};
const texts = new Map([
  ...Object.values(ENGINEERING_PRODUCERS).map((producer) => [producer.path, JSON.stringify({ source_tree_sha256: SOURCE_SHA })]),
  [PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: SOURCE_SHA })],
]);
const io = {
  sourceTreeSha256: () => SOURCE_SHA,
  hasFile: (path) => texts.has(path),
  readText: (path) => texts.get(path),
};

// CY-TC-001: source-rebind is metadata-only and must preserve producer-owned
// provenance. The freshness gate must continue to block until producers rerun.
const rebindRoot = mkdtempSync(join(tmpdir(), "tastecheck-source-rebind-"));
try {
  const originalSource = "f".repeat(64);
  for (const producer of Object.values(ENGINEERING_PRODUCERS)) {
    const destination = join(rebindRoot, producer.path);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, JSON.stringify({ source_tree_sha256: originalSource }));
  }
  const before = Object.fromEntries(Object.values(ENGINEERING_PRODUCERS).map((producer) => [producer.path, readFileSync(join(rebindRoot, producer.path), "utf8")]));
  const stale = sourceRebindReceipts(rebindRoot, SOURCE_SHA);
  assert.equal(stale.length, Object.keys(ENGINEERING_PRODUCERS).length, "source-rebind reports every stale producer");
  assert.deepEqual(
    Object.fromEntries(Object.values(ENGINEERING_PRODUCERS).map((producer) => [producer.path, readFileSync(join(rebindRoot, producer.path), "utf8")])),
    before,
    "source-rebind must not rewrite producer receipt bytes",
  );
  const rebindTexts = new Map([
    ...Object.values(ENGINEERING_PRODUCERS).map((producer) => [producer.path, readFileSync(join(rebindRoot, producer.path), "utf8")]),
    [PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: SOURCE_SHA })],
  ]);
  const blockedAfterRebind = verifyFinalSourceReceiptDigests(manifest, {
    sourceTreeSha256: () => SOURCE_SHA,
    hasFile: (path) => rebindTexts.has(path),
    readText: (path) => rebindTexts.get(path),
  });
  assert.equal(blockedAfterRebind.status, "blocked", "restamped-as-fresh producer receipts must remain blocked");
  assert.ok(blockedAfterRebind.errors.some((error) => error.includes("browser: receipt source_tree_sha256 does not match final source digest (stale-until-rerun")));
} finally {
  rmSync(rebindRoot, { recursive: true, force: true });
}

const ready = verifyFinalSourceReceiptDigests(manifest, io);
assert.deepEqual(ready, { status: "ready", sourceTreeSha256: SOURCE_SHA, errors: [] });

texts.set(ENGINEERING_PRODUCERS.mechanical.path, JSON.stringify({ source_tree_sha256: "b".repeat(64) }));
const staleReceipt = verifyFinalSourceReceiptDigests(manifest, io);
assert.equal(staleReceipt.status, "blocked");
assert.ok(staleReceipt.errors.some((error) => error.includes("mechanical: receipt source_tree_sha256")));
texts.set(ENGINEERING_PRODUCERS.mechanical.path, JSON.stringify({ source_tree_sha256: SOURCE_SHA }));

texts.set(PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: "b".repeat(64) }));
const staleStatus = verifyFinalSourceReceiptDigests(manifest, io);
assert.equal(staleStatus.status, "blocked");
assert.ok(staleStatus.errors.includes("public status: source_tree_sha256 does not match final source digest"));
texts.set(PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: SOURCE_SHA }));

let sourceCalls = 0;
const changingSource = verifyFinalSourceReceiptDigests(manifest, {
  ...io,
  sourceTreeSha256: () => (++sourceCalls === 1 ? SOURCE_SHA : "c".repeat(64)),
});
assert.equal(changingSource.status, "blocked");
assert.ok(changingSource.errors.includes("source tree changed while final-source receipt gate was running"));

console.log("final-source receipt digest gate tests passed without optional dependencies");
