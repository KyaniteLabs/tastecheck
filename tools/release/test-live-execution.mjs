#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

import { deriveReproducible, deriveStatus } from "./live-execution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runRelative = `.omx/release-live-test-${process.pid}-${Date.now()}`;
const runRoot = path.join(root, runRelative);
const schema = JSON.parse(fs.readFileSync(path.join(root, "contracts/v1/live-execution-receipt.schema.json"), "utf8"));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

assert.equal(deriveStatus([{ id: "one", passed: true, detail: "ok" }]), "pass");
assert.equal(deriveStatus([{ id: "one", passed: true, detail: "ok" }, { id: "two", passed: false, detail: "no" }]), "fail");
assert.equal(deriveStatus([]), "fail", "an empty check set cannot manufacture a pass");
assert.equal(deriveReproducible([{ id: "one", passed: true, detail: "ok" }], [{ id: "shot", path: "artifacts/x.png", sha256: "a".repeat(64), bytes: 1 }]), true);
assert.equal(deriveReproducible([{ id: "one", passed: false, detail: "no" }], [{ id: "shot", path: "artifacts/x.png", sha256: "a".repeat(64), bytes: 1 }]), false);
assert.equal(deriveReproducible([{ id: "one", passed: true, detail: "ok" }], []), false);

function run(kind) {
  const out = `${runRelative}/${kind}.json`;
  const artifacts = `${runRelative}/artifacts`;
  const result = spawnSync(process.execPath, [
    "tools/release/live-execution.mjs", kind,
    "--out", out,
    "--artifact-dir", artifacts,
    "--nonce", `test-${kind}-${process.pid}-${Date.now()}`,
  ], { cwd: root, encoding: "utf8", timeout: 180_000 });
  assert.equal(result.status, 0, `${kind} producer failed:\n${result.stderr}`);
  const receipt = JSON.parse(fs.readFileSync(path.join(root, out), "utf8"));
  assert.equal(validate(receipt), true, `${kind} schema errors: ${JSON.stringify(validate.errors)}`);
  assert.equal(receipt.kind, kind);
  assert.equal(receipt.producer_id, "tastecheck.release.live-execution.v1");
  assert.equal(receipt.executed, true);
  assert.equal(receipt.reproducible, true);
  assert.equal(receipt.status, "pass");
  assert.ok(receipt.checks.length > 0);
  assert.ok(receipt.checks.every((check) => check.passed === true));
  assert.equal(receipt.status, deriveStatus(receipt.checks));
  assert.match(receipt.source_tree_sha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.nonce, /^test-/);
  assert.ok(receipt.artifacts.length > 0);
  for (const artifact of receipt.artifacts) {
    const bytes = fs.readFileSync(path.join(root, artifact.path));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(sha256(bytes), artifact.sha256);
  }
  assert.doesNotMatch(JSON.stringify(receipt), /(?:\/Users\/|\/home\/|[A-Z]:\\|@(?:gmail|outlook)\.)/i);
  const second = spawnSync(process.execPath, [
    "tools/release/live-execution.mjs", kind,
    "--out", out,
    "--artifact-dir", artifacts,
    "--nonce", `test-repeat-${kind}-${process.pid}`,
  ], { cwd: root, encoding: "utf8", timeout: 180_000 });
  assert.notEqual(second.status, 0, "accepted receipt must be immutable");
  return receipt;
}

try {
  const browser = run("browser");
  assert.ok(browser.checks.some((check) => check.id === "landing-desktop-no-overflow"));
  assert.ok(browser.checks.some((check) => check.id === "integration-mobile-no-console-errors"));

  const e2e = run("e2e");
  assert.ok(e2e.checks.some((check) => check.id === "install-canonical-skills"));
  assert.ok(e2e.checks.some((check) => check.id === "operator-valid-form"));
  assert.ok(e2e.checks.some((check) => check.id === "operator-retry-state"));
} finally {
  fs.rmSync(runRoot, { recursive: true, force: true });
}

console.log("live browser/e2e receipt producer tests passed");
