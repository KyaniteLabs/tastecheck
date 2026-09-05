#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projector = join(root, "tools/release/project-public-status.mjs");
const projectedOutputs = [
  "evals/receipts/v1/public-release-status.json",
  "README.md",
  "index.html",
];
const receiptFixtures = [
  "evals/receipts/v1/context-budget.json",
  "evals/receipts/v1/browser.json",
  "evals/receipts/v1/e2e.json",
  "evals/receipts/v1/mechanical.json",
  "evals/receipts/v1/security.json",
  "evals/receipts/v1/clean-clone.json",
  "evals/receipts/v1/immutable/w1-effectiveness.json",
  "evals/receipts/v1/immutable/terminal-v5-effectiveness.json",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function copyFixtureFile(fixtureRoot, relativePath) {
  const destination = join(fixtureRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, relativePath), destination);
}

function buildFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-public-status-"));
  try {
    copyFixtureFile(fixtureRoot, "contracts/v1/release-receipts.json");
    for (const relativePath of receiptFixtures) copyFixtureFile(fixtureRoot, relativePath);

    writeFileSync(join(fixtureRoot, "README.md"), [
      "<!-- release-status:v1:start -->",
      "stale release status",
      "<!-- release-status:v1:end -->",
    ].join("\n"));
    writeFileSync(join(fixtureRoot, "index.html"), [
      "<!doctype html>",
      "<!-- release-status:v1:start -->",
      "stale landing status",
      "<!-- release-status:v1:end -->",
      "<!-- release-status-gate:v1:start -->stale gate<!-- release-status-gate:v1:end -->",
      "",
    ].join("\n"));

    return fixtureRoot;
  } catch (error) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
}

function snapshotFixture(fixtureRoot) {
  const files = new Map();
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else {
        assert.equal(entry.isFile(), true, `${relativePath} must be a regular fixture file`);
        files.set(relativePath, readFileSync(absolutePath));
      }
    }
  }
  visit(fixtureRoot);
  return files;
}

function changedPaths(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => {
      const beforeBytes = before.get(path);
      const afterBytes = after.get(path);
      return !beforeBytes || !afterBytes || !beforeBytes.equals(afterBytes);
    })
    .sort();
}

function projectedOutputHashes(fixtureRoot) {
  const hashes = {};
  for (const relativePath of projectedOutputs) {
    const absolutePath = join(fixtureRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `projector must create ${relativePath}`);
    hashes[relativePath] = sha256(readFileSync(absolutePath));
  }
  return hashes;
}

function projectedOutputBytes(fixtureRoot) {
  return projectedOutputs.map((relativePath) => readFileSync(join(fixtureRoot, relativePath)));
}

function runProjector(fixtureRoot) {
  execFileSync(process.execPath, [projector, "--write", fixtureRoot], { stdio: "ignore" });
}

function testPublicStatusByteStability() {
  const fixtureRoot = buildFixture();
  try {
    const before = snapshotFixture(fixtureRoot);
    runProjector(fixtureRoot);
    const afterFirstRun = snapshotFixture(fixtureRoot);
    assert.deepEqual(changedPaths(before, afterFirstRun), [...projectedOutputs].sort(), "first projector run may change only the status JSON and generated surfaces");

    const firstHashes = projectedOutputHashes(fixtureRoot);
    const firstBytes = projectedOutputBytes(fixtureRoot);
    runProjector(fixtureRoot);
    const afterSecondRun = snapshotFixture(fixtureRoot);
    const secondHashes = projectedOutputHashes(fixtureRoot);
    const secondBytes = projectedOutputBytes(fixtureRoot);

    assert.deepEqual(secondHashes, firstHashes, "two public-status projector runs must hash identically across every output");
    assert.deepEqual(secondBytes, firstBytes, "two public-status projector runs must produce identical output bytes");
    assert.deepEqual(changedPaths(afterFirstRun, afterSecondRun), [], "second projector run must change no fixture file outside the projected outputs");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

testPublicStatusByteStability();
console.log(`public-status two-run byte-stability test passed (${projectedOutputs.map((path) => relative(root, path)).join(", ")})`);
