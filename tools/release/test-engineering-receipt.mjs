#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  computeSourceTreeSha256,
  computeHeadSourceTreeSha256,
  deriveReceipt,
  isExcludedReceiptPath,
  isExcludedSourcePath,
} from "./engineering-receipt.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

const temp = mkdtempSync(join(tmpdir(), "tastecheck-engineering-receipt-"));
try {
  git(temp, "init", "-q");
  git(temp, "config", "user.name", "TasteCheck Test");
  git(temp, "config", "user.email", "test@example.invalid");
  mkdirSync(join(temp, "src"));
  mkdirSync(join(temp, "evals", "receipts", "v1"), { recursive: true });
  mkdirSync(join(temp, "_retrofit-2026-09-04"));
  writeFileSync(join(temp, "src", "input.txt"), "alpha\n");
  writeFileSync(join(temp, "evals", "receipts", "v1", "mechanical.json"), "{}\n");
  writeFileSync(join(temp, "_retrofit-2026-09-04", "REPORT.md"), "first report\n");
  writeFileSync(join(temp, "README.md"), "<!-- release-status:v1:start -->\nRelease status: UNVERIFIED\n<!-- release-status:v1:end -->\n");
  writeFileSync(join(temp, "index.html"), "<!-- release-status-gate:v1:start -->Gate: UNVERIFIED<!-- release-status-gate:v1:end -->\n");
  git(temp, "add", ".");
  git(temp, "commit", "-qm", "fixture");

  const first = computeSourceTreeSha256(temp);
  assert.equal(computeHeadSourceTreeSha256(temp), first);
  writeFileSync(join(temp, "evals", "receipts", "v1", "mechanical.json"), "{\"changed\":true}\n");
  assert.equal(computeSourceTreeSha256(temp), first, "generated release receipts must not affect the source digest");
  writeFileSync(join(temp, "_retrofit-2026-09-04", "REPORT.md"), "second report\n");
  writeFileSync(join(temp, "README.md"), "<!-- release-status:v1:start -->\nRelease status: PASS\n<!-- release-status:v1:end -->\n");
  writeFileSync(join(temp, "index.html"), "<!-- release-status-gate:v1:start -->Gate: PASS ✓<!-- release-status-gate:v1:end -->\n");
  assert.equal(computeSourceTreeSha256(temp), first, "generated public surfaces and retrofit reports must not affect the source digest");

  writeFileSync(join(temp, "src", "input.txt"), "beta\n");
  assert.notEqual(computeSourceTreeSha256(temp), first, "tracked source changes must invalidate the source digest");
  assert.equal(computeHeadSourceTreeSha256(temp), first, "HEAD digest must remain bound to the archived tree");

  assert.equal(isExcludedReceiptPath("evals/receipts/v1/browser.json"), true);
  assert.equal(isExcludedReceiptPath("evals/receipts/v1/artifacts/browser/proof.png"), true);
  assert.equal(isExcludedReceiptPath("evals/receipts/v1/contracts/generated.json"), true);
  assert.equal(isExcludedReceiptPath("evals/receipts/v1/immutable/w1-effectiveness.json"), false);
  assert.equal(isExcludedSourcePath("_retrofit-2026-09-04/TPS2-REPORT.md"), true);

  const passed = deriveReceipt({
    kind: "mechanical",
    sourceTreeSha256: first,
    nonce: "0123456789abcdef",
    startedAt: "2026-07-11T00:00:00.000Z",
    finishedAt: "2026-07-11T00:00:01.000Z",
    checks: [{ id: "unit", command: "npm test", passed: true, exit_code: 0 }],
  });
  assert.equal(passed.status, "pass");
  assert.equal(passed.reproducible, true);
  assert.equal(passed.producer_id, "tastecheck.release.mechanical.v1");

  const failed = deriveReceipt({
    kind: "security",
    sourceTreeSha256: first,
    nonce: "0123456789abcdef",
    startedAt: "2026-07-11T00:00:00.000Z",
    finishedAt: "2026-07-11T00:00:01.000Z",
    checks: [{ id: "claims", command: "node checker", passed: false, exit_code: 1 }],
  });
  assert.equal(failed.status, "fail");
  assert.equal(failed.reproducible, false);
  assert.throws(() => deriveReceipt({
    kind: "clean-clone",
    sourceTreeSha256: first,
    nonce: "short",
    startedAt: "2026-07-11T00:00:00.000Z",
    finishedAt: "2026-07-11T00:00:01.000Z",
    checks: [],
  }), /nonce|checks/);

  console.log("engineering receipt tests passed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
