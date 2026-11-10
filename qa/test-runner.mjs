#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.mjs";
import {
  Blocked, PATH_STATUS, countStatuses, createRunState, exitCodeFor, pathStatusFor, runnerProvenance,
} from "./run-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = loadCatalog();
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
const head = git(["rev-parse", "--verify", "HEAD"]);
const status = git(["status", "--porcelain=v1", "--untracked-files=normal"]);
assert.equal(head.status, 0, "test checkout must have a readable Git HEAD");
assert.equal(status.status, 0, "test checkout dirty state must be readable");

const provenance = runnerProvenance(root, catalog.tested_merge_sha);
assert.equal(provenance.checkout.revision, head.stdout.trim(), "summary provenance must identify the actual checkout revision");
assert.equal(provenance.checkout.dirty, status.stdout.trim().length > 0, "summary must not label a modified checkout clean");
assert.equal(typeof provenance.checkout.kind, "string", "summary must state whether this is a linked worktree or primary checkout");
assert.equal(provenance.catalog_source_revision, catalog.tested_merge_sha, "historical catalog source revision must be recorded separately");
assert.equal(Object.hasOwn(provenance, "catalog_tested_merge_sha"), false, "catalog source history must not masquerade as the tested checkout SHA");

const ownedState = createRunState(root);
const neighbor = mkdtempSync(join(tmpdir(), "tastecheck-qa-neighbor-"));
const sentinel = join(neighbor, "preserve.txt");
writeFileSync(sentinel, "not owned by runner");
try {
  assert.ok(ownedState.root !== root && !ownedState.root.startsWith(`${root}${sep}`), "HOME/XDG state must be outside the repository checkout");
  assert.equal(ownedState.home("G1"), join(ownedState.root, "homes", "G1"));
  assert.equal(ownedState.xdg("G1"), join(ownedState.root, "isolated-state", "G1"));
  ownedState.cleanup();
  assert.equal(existsSync(ownedState.root), false, "cleanup removes the unique state directory created by this runner");
  assert.equal(existsSync(sentinel), true, "cleanup does not remove a neighboring directory it does not own");
} finally {
  rmSync(ownedState.root, { recursive: true, force: true });
  rmSync(neighbor, { recursive: true, force: true });
}

// Operator-path status machine: exhaustive over PATH_STATUS.
assert.deepEqual(Object.keys(PATH_STATUS).sort(), ["BLOCKED", "FAIL", "PASS"], "a new status needs a row in this table");
for (const [name, value] of Object.entries(PATH_STATUS)) assert.equal(name, value, "stored strings equal the state names");
assert.equal(pathStatusFor(null), PATH_STATUS.PASS);
assert.equal(pathStatusFor(undefined), PATH_STATUS.PASS);
assert.equal(pathStatusFor(new Blocked("no chrome")), PATH_STATUS.BLOCKED);
assert.equal(pathStatusFor(new Error("boom")), PATH_STATUS.FAIL);
assert.equal(pathStatusFor("thrown string"), PATH_STATUS.FAIL, "a non-Error throw still fails");
const every = Object.values(PATH_STATUS).map((status) => ({ status }));
assert.deepEqual(countStatuses(every), { passed: 1, failed: 1, blocked: 1 }, "every status is counted exactly once");
assert.deepEqual(Object.keys(countStatuses([])), ["passed", "failed", "blocked"], "summary.json key order is unchanged");
assert.throws(() => countStatuses([{ status: "pass" }]), /unknown operator-path status/);
assert.throws(() => countStatuses([{}]), /unknown operator-path status/);
assert.equal(exitCodeFor({ passed: 3, failed: 0, blocked: 0 }), 0);
assert.equal(exitCodeFor({ passed: 0, failed: 0, blocked: 1 }), 2);
assert.equal(exitCodeFor({ passed: 0, failed: 1, blocked: 1 }), 1, "FAIL outranks BLOCKED");

console.log("QA runner provenance, isolated-state and status-machine tests passed");
