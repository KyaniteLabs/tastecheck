#!/usr/bin/env node
/**
 * Invocation-shape regression: the deep-lane release gate must behave the same
 * through the installed symlink layout as it does from a checkout.
 *
 * `install.sh` links each skill into agent homes as a symlink; Node resolves
 * `import.meta.url` to the real path while `process.argv[1]` keeps the
 * symlinked path. A lexical entry guard therefore never fires for the
 * installed CLI, which exits 0 with no output and no report — a silent false
 * pass indistinguishable from SHIP at the consumption layer.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { isMainEntry } from "../lib/main-entry.mjs";
import { runInstalledInvocation, GATE_RELATIVE, CATALOG_RELATIVE, BROWSER_MANIFEST_RELATIVE } from "../lib/release-gate-invocation.mjs";
import { ROOT } from "../../skills/tastecheck-pass/assets/release-gate.mjs";
import { buildValidLedger, makeArtifactRoot, disposeArtifactRoot } from "../calibrate/ledger-fixture.mjs";
import { cpSync } from "node:fs";

let passed = 0;
const repoRoot = ROOT.replace(/[\\/]$/, "");

// The entry-point helper must recognise a symlinked path and reject a foreign
// module path.
const helperDir = mkdtempSync(join(tmpdir(), "tastecheck-main-entry-"));
try {
  const gate = join(repoRoot, GATE_RELATIVE);
  const linked = join(helperDir, "release-gate.mjs");
  symlinkSync(gate, linked, "file");
  const moduleUrl = new URL(`file://${gate}`).href;
  assert.equal(isMainEntry(moduleUrl, linked), true, "symlinked entry must count as the main module");
  assert.equal(isMainEntry(moduleUrl, gate), true, "literal checkout entry must count as the main module");
  assert.equal(isMainEntry(moduleUrl, join(helperDir, "other.mjs")), false, "a different entry must not run the CLI");
  assert.equal(isMainEntry(moduleUrl, undefined), false, "no argv[1] must not run the CLI");
  passed += 1;
} finally {
  rmSync(helperDir, { recursive: true, force: true });
}

// A ledger with no rows must HOLD through every installed shape, not exit 0
// silently. This is the defect: the empty ledger is the fail-closed probe.
const empty = runInstalledInvocation({ repoRoot, ledger: {}, expectedVerdict: "HOLD" });
assert.equal(empty.ok, true, empty.failures.join("\n"));
assert.deepEqual(empty.silent_shapes, [], "no invocation shape may exit 0 with no output and no report");
for (const shape of ["checkout", "installed-skill", "installed-dir-chain", "installed-file"]) {
  assert.equal(empty.exits[shape], 1, `${shape} must exit 1 on a HOLD`);
}
assert.equal(empty.verdict, "HOLD");
passed += 1;

// The same valid ledger must SHIP through every shape with identical reports.
const artifactRoot = makeArtifactRoot();
try {
  const built = buildValidLedger({ artifactRoot });
  const ship = runInstalledInvocation({
    repoRoot,
    ledger: built.ledger,
    artifactRoot,
    expectedVerdict: "SHIP",
  });
  assert.equal(ship.ok, true, ship.failures.join("\n"));
  assert.equal(ship.verdict, "SHIP");
  for (const shape of ["checkout", "installed-skill", "installed-dir-chain", "installed-file"]) {
    assert.equal(ship.exits[shape], 0, `${shape} must exit 0 on a SHIP`);
  }
  passed += 1;
} finally {
  disposeArtifactRoot(artifactRoot);
}

// The error path must also prove the CLI ran: usage through the installed
// symlink exits non-zero with Usage on stderr instead of exiting 0 silently.
const usageDir = mkdtempSync(join(tmpdir(), "tastecheck-usage-"));
try {
  mkdirSync(join(usageDir, "skills"), { recursive: true });
  symlinkSync(join(repoRoot, "skills/tastecheck-pass"), join(usageDir, "skills/tastecheck-pass"), "dir");
  const usage = spawnSync(process.execPath, [
    join(usageDir, "skills/tastecheck-pass/assets/release-gate.mjs"),
    "--verifier-root", usageDir,
    "--browser-manifest", BROWSER_MANIFEST_RELATIVE,
  ], { encoding: "utf8", timeout: 120_000 });
  assert.equal(usage.status, 2, `usage through a symlink must exit 2, got ${usage.status}`);
  assert.match(usage.stderr, /Usage: node .*release-gate\.mjs/);
  passed += 1;
} finally {
  rmSync(usageDir, { recursive: true, force: true });
}

// The same guard class in bin/profile.mjs: through a symlink the CLI must run
// and report usage, not exit 0 silently.
const profileDir = mkdtempSync(join(tmpdir(), "tastecheck-profile-entry-"));
try {
  symlinkSync(join(repoRoot, "bin/profile.mjs"), join(profileDir, "profile.mjs"), "file");
  const profile = spawnSync(process.execPath, [join(profileDir, "profile.mjs")], { encoding: "utf8", timeout: 120_000 });
  assert.equal(profile.status, 2, `profile through a symlink must exit 2, got ${profile.status}`);
  assert.match(profile.stderr, /usage: tastecheck profile/);
  passed += 1;
} finally {
  rmSync(profileDir, { recursive: true, force: true });
}

console.log(`release-gate invocation-shape tests: ${passed} passed`);
