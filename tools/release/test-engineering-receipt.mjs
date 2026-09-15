#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import {
  computeSourceTreeSha256,
  computeHeadSourceTreeSha256,
  deriveReceipt,
  isExcludedReceiptPath,
  isExcludedSourcePath,
  sanitizedSpawnEnv,
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

  const poisoned = {
    PATH: [
      join(temp, "node_modules", ".bin"),
      join(temp, "node_modules", "@scope", "tool", "bin"),
      "/usr/bin",
      "/bin",
    ].join(delimiter),
    HOME: "/nonexistent-home",
    npm_lifecycle_event: "release:clean-clone-receipt",
    npm_command: "run-script",
    npm_config_local_prefix: temp,
    npm_config_userconfig: join(temp, "foreign-npmrc"),
    npm_config_registry: "https://registry.invalid",
    npm_package_name: "some-outer-package",
    INIT_CWD: temp,
    NODE_OPTIONS: `--require ${join(temp, "missing-require-fixture.js")}`,
    NODE_PATH: join(temp, "node_modules"),
  };
  assert.notEqual(
    spawnSync(process.execPath, ["-e", "process.exit(0)"], { env: poisoned }).status,
    0,
    "fixture sanity: poisoned NODE_OPTIONS must break a spawned node",
  );
  const clean = sanitizedSpawnEnv(temp, poisoned);
  for (const key of ["npm_lifecycle_event", "npm_command", "npm_config_local_prefix", "npm_config_userconfig", "npm_config_registry", "npm_package_name", "INIT_CWD", "NODE_OPTIONS", "NODE_PATH"]) {
    assert.equal(key in clean, false, `${key} must be stripped from the spawned check environment`);
  }
  assert.equal(clean.HOME, "/nonexistent-home", "non-lifecycle environment must pass through unchanged");
  assert.equal(clean.PATH, ["/usr/bin", "/bin"].join(delimiter), "PATH entries inside the receipt root's node_modules must be pruned");
  const unpoisoned = sanitizedSpawnEnv(temp, { PATH: "/usr/bin:/bin", HOME: "/home/fixture" });
  assert.equal(unpoisoned.PATH, "/usr/bin:/bin", "PATH without receipt-root node_modules entries must pass through unchanged");
  assert.equal(
    spawnSync(process.execPath, ["-e", "process.stdout.write(process.env.npm_lifecycle_event ?? \"clean\")"], { env: clean, encoding: "utf8" }).stdout,
    "clean",
    "a spawned check must not see the outer npm lifecycle environment",
  );

  console.log("engineering receipt tests passed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
