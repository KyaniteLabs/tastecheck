#!/usr/bin/env node
/**
 * W0 baseline builder — run ONCE before any skill/command edits.
 * Creates .omx/evidence/tastecheck-v1/baseline/v0.1.0/
 *   manifest.json   — all git ls-files paths with mode/size/sha256
 *   sha256/<digest> — content-addressed file bodies
 *   environment.json — public-safe runtime info
 */
import { createHash } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const baselineDir = join(root, ".omx/evidence/tastecheck-v1/baseline/v0.1.0");
const sha256Dir = join(baselineDir, "sha256");
mkdirSync(sha256Dir, { recursive: true });

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const commitHash = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
const dirtyPatch = (() => {
  try {
    const p = execSync("git diff HEAD", { cwd: root }).toString();
    return p ? sha256(Buffer.from(p)) : null;
  } catch { return null; }
})();

const lsOutput = execFileSync("git", ["ls-files", "--format=%(objectmode) %(path)"], { cwd: root })
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean);

const entries = [];
for (const line of lsOutput) {
  const spaceIdx = line.indexOf(" ");
  const mode = line.slice(0, spaceIdx);
  const relPath = line.slice(spaceIdx + 1);
  const absPath = join(root, relPath);
  let body;
  try {
    body = readFileSync(absPath);
  } catch {
    console.warn(`WARN: cannot read ${relPath} — skipping`);
    continue;
  }
  const digest = sha256(body);
  const size = body.length;
  const blobPath = join(sha256Dir, digest);
  // Write body once (content-addressed idempotent)
  try { statSync(blobPath); } catch { writeFileSync(blobPath, body); }
  entries.push({ path: relPath, mode, size, sha256: digest });
}

const manifestBody = JSON.stringify({
  schema_version: 1,
  commit: commitHash,
  dirty_patch_sha256: dirtyPatch,
  entry_count: entries.length,
  entries,
}, null, 2);
const manifestDigest = sha256(Buffer.from(manifestBody));
const manifest = JSON.parse(manifestBody);
manifest.manifest_sha256 = manifestDigest;

writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const nodeVersion = process.version;
const npmVersion = (() => { try { return execSync("npm --version").toString().trim(); } catch { return null; } })();
const env = {
  schema_version: 1,
  baseline_version: "v0.1.0",
  date_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  commit: commitHash,
  node_version: nodeVersion,
  npm_version: npmVersion,
  os_family: process.platform,
  test_command: "npm test",
  smoke_command: "node tools/smoke/run-smoke.mjs --dry-run",
  package_test_scripts: {
    test: "node tools/verify.mjs && node tools/lint-skills.mjs && node tools/verify-landing.mjs && node tools/verify-integration.mjs && node tools/verify-gate-audit.mjs"
  },
};
writeFileSync(join(baselineDir, "environment.json"), JSON.stringify(env, null, 2));

console.log(`Baseline built: ${entries.length} files, manifest digest ${manifestDigest}`);
console.log(`  ${join(relative(root, baselineDir), "manifest.json")}`);
console.log(`  ${join(relative(root, baselineDir), "environment.json")}`);
console.log(`  ${join(relative(root, baselineDir), "sha256/")} (${entries.length} blobs)`);
