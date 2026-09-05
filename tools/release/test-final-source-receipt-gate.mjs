#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  ENGINEERING_PRODUCERS,
  PUBLIC_STATUS_RECEIPT,
  verifyFinalSourceReceiptDigests,
} from "./final-source-receipt-gate.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
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

const chain = spawnSync(process.execPath, ["tools/release/check.mjs", "--mode=verify-chain"], { cwd: root, encoding: "utf8" });
assert.equal(chain.status, 0, `dependency-free verify-chain failed:\n${chain.stdout}\n${chain.stderr}`);
assert.match(chain.stdout, /release check passed \(verify-chain\)/);

console.log("final-source receipt digest gate tests passed without optional dependencies");
