#!/usr/bin/env node
/**
 * Privacy-law pin (evals/corpus/PROFILE.md): the product ships EMPTY of
 * anyone's taste. Profiles and verdict corpora are USER-LOCAL data and never
 * enter the repo — pinned here three ways:
 *   1. git tracks zero profile/corpus data files;
 *   2. when an org-side corpus is present on this machine (TASTECHECK_ORG_PROFILE_CORPUS),
 *      none of its verbatim verdicts appear in ANY tracked file;
 *   3. the calibration runner refuses to read a corpus from, or write any
 *      output into, the product repo.
 * Extends the cold-start skip pattern of tools/calibrate/test-calibration.mjs
 * (absent user-local profile -> skip, never fail): without the org-side file
 * the content scan has nothing to check and passes as "no profile present".
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProfileCalibration } from "./run-profile-calibration.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
let passed = 0;

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

// 1. Zero profile/corpus data files tracked in git.
const dataFilePattern = /(^|\/)(?:loved-corpus|calibration-corpus|org-ceo[^/]*|taste-profile[^/]*|profile-weights[^/]*|calibration-gate-receipt[^/]*)\.json$/i;
const trackedDataFiles = trackedFiles().filter((path) => dataFilePattern.test(path));
assert.deepEqual(trackedDataFiles, [], `profile data files tracked in repo: ${trackedDataFiles.join(", ")}`);
assert.equal(existsSync(join(REPO_ROOT, "evals/corpus/loved")), false, "evals/corpus/loved/ must not exist in-repo (user-local profile location)");
passed++;

// 2. Org-side verdicts never appear in tracked files (skipped when the
// org-side corpus is not present on this machine — cold-start law).
const orgCorpusPath = process.env.TASTECHECK_ORG_PROFILE_CORPUS;
if (orgCorpusPath && existsSync(orgCorpusPath)) {
  const orgCorpus = JSON.parse(readFileSync(orgCorpusPath, "utf8"));
  const tracked = trackedFiles();
  const blobs = new Map(tracked.map((path) => [path, readFileSync(join(REPO_ROOT, path), "utf8").toLowerCase()]));
  for (const verdict of orgCorpus.entries ?? []) {
    const needle = String(verdict.verdict_quote ?? "").toLowerCase().slice(0, 40).trim();
    if (needle.length < 12) continue;
    for (const [path, text] of blobs) {
      assert.ok(!text.includes(needle), `org verdict from ${verdict.id} leaked into tracked file ${path}`);
    }
  }
  passed++;
  console.log(`privacy content scan: ${orgCorpus.entries?.length ?? 0} org verdicts absent from ${tracked.length} tracked files`);
} else {
  console.log("privacy content scan: no user-local profile present — scan skipped (cold-start law)");
}

// 3. The runner refuses any in-repo corpus or output path, even when asked nicely.
const tmp = mkdtempSync(join(tmpdir(), "tastecheck-privacy-test-"));
const corpusPath = join(tmp, "corpus.json");
writeFileSync(corpusPath, JSON.stringify({
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [{
    id: "p-1", product: "synthetic", date: "2026-09-28", kind: "negative",
    verdict_quote: "synthetic privacy-fixture verdict", principle: "synthetic principle",
    source: { desk: "synthetic/desk.md:1" }, salience: { boldness: -1 },
  }],
}, null, 2));

const inRepoCorpus = join(REPO_ROOT, "evals/corpus/loved/leak.json");
assert.throws(
  () => runProfileCalibration({ corpusPath: inRepoCorpus, write: false }),
  /never enters the repo/,
  "in-repo corpus path refused",
);
assert.throws(
  () => runProfileCalibration({ corpusPath, receiptPath: join(REPO_ROOT, "evals/leak-receipt.json"), write: true }),
  /never enters the repo/,
  "in-repo receipt path refused",
);
assert.throws(
  () => runProfileCalibration({ corpusPath, receiptPath: join(tmp, "ok.json"), profileOutPath: join(REPO_ROOT, "evals/leak-weights.json"), write: true }),
  /never enters the repo/,
  "in-repo profile path refused",
);
assert.equal(existsSync(join(tmp, "ok.json")), false, "nothing written when any output path is refused");
passed++;

console.log(`profile privacy law tests: ${passed} passed (repo tracks zero profile data; runner refuses in-repo paths)`);
