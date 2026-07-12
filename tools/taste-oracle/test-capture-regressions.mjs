import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureEvidence,
  publishEvidence,
  resolveOutput,
} from "./capture.mjs";
import { hashBytes, hashCanonicalJson } from "./lib/evidence.mjs";
import { loadContractPair } from "./validate-contracts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowedRoot = path.join(repoRoot, ".omx/taste-oracle");
const outputRelative = ".omx/taste-oracle/capture-regression";
const outputAbsolute = path.join(repoRoot, outputRelative);

function contracts() {
  return loadContractPair(repoRoot, "evals/taste-oracle/deslop-ui-hard-001/scenario.json");
}

function stagingEntries() {
  if (!fs.existsSync(allowedRoot)) return [];
  return fs.readdirSync(allowedRoot).filter((name) => name.includes(".staging-"));
}

async function fakeCapture(_browser, arm, viewport, _tokens, _outputRelative, stagingRoot) {
  const bytes = Buffer.from(`${arm.id}:${viewport.id}`);
  const sha256 = hashBytes(bytes);
  const staged = path.join(stagingRoot, `${arm.id}-${viewport.id}.png`);
  fs.writeFileSync(staged, bytes);
  const domFacts = {
    viewport: { width: viewport.width, height: viewport.height },
    probes: {
      root: { text: "Overview Activity Make the next decision obvious." },
      heading: { text: "Make the next decision obvious." },
      "primary-action": { text: "Review decision" },
      "summary-card": { text: "Decision summary" },
      status: { text: "Ready" },
    },
  };
  const computedStyles = {};
  return {
    capture: {
      arm_id: arm.id,
      viewport_id: viewport.id,
      screenshot_path: `artifacts/${arm.id}-${viewport.id}-${sha256}.png`,
      screenshot_sha256: sha256,
      dom_facts: domFacts,
      dom_sha256: hashCanonicalJson(domFacts),
      computed_styles: computedStyles,
      style_sha256: hashCanonicalJson(computedStyles),
    },
    staged_absolute: staged,
  };
}

function makeGeneration(label, stagingRoot) {
  const { scenario } = contracts();
  const captures = [];
  const stagedArtifacts = [];
  for (const arm of scenario.arms) {
    for (const viewport of scenario.viewports) {
      const bytes = Buffer.from(`${label}:${arm.id}:${viewport.id}`);
      const sha256 = hashBytes(bytes);
      const stagedAbsolute = path.join(stagingRoot, `${label}-${arm.id}-${viewport.id}.png`);
      fs.writeFileSync(stagedAbsolute, bytes);
      const domFacts = {
        viewport: { width: viewport.width, height: viewport.height },
        probes: {
          root: { text: "Overview Activity Make the next decision obvious." },
          heading: { text: "Make the next decision obvious." },
          "primary-action": { text: "Review decision" },
          "summary-card": { text: "Decision summary" },
          status: { text: "Ready" },
        },
      };
      const computedStyles = {};
      const capture = {
        arm_id: arm.id,
        viewport_id: viewport.id,
        screenshot_path: `artifacts/${label}-${arm.id}-${viewport.id}-${sha256}.png`,
        screenshot_sha256: sha256,
        dom_facts: domFacts,
        dom_sha256: hashCanonicalJson(domFacts),
        computed_styles: computedStyles,
        style_sha256: hashCanonicalJson(computedStyles),
      };
      captures.push(capture);
      stagedArtifacts.push({ capture, staged_absolute: stagedAbsolute });
    }
  }
  return {
    manifest: {
      schema_version: 1,
      scenario_id: scenario.scenario_id,
      captured_at: "2026-07-11T20:00:00.000Z",
      runtime: { browser: "chromium", playwright: "1.61.1", platform: "darwin" },
      viewports: scenario.viewports,
      arms: scenario.arms.map((arm) => arm.id),
      captures,
    },
    stagedArtifacts,
  };
}

fs.mkdirSync(allowedRoot, { recursive: true });
fs.rmSync(outputAbsolute, { recursive: true, force: true });

for (const protectedPath of ["docs", ".omx", ".omx/taste-oracle", ".omx/taste-oracle-adjacent/run"]) {
  let loaderCalled = false;
  await assert.rejects(
    captureEvidence(protectedPath, {
      loadContracts() { loaderCalled = true; return contracts(); },
    }),
    /dedicated output root/,
  );
  assert.equal(loaderCalled, false, `${protectedPath} must fail before contract loading`);
}

assert.equal(resolveOutput(outputRelative), outputAbsolute);

const outside = path.join(repoRoot, ".scratch/oracle-symlink-target");
const symlink = path.join(allowedRoot, "linked-output");
fs.mkdirSync(outside, { recursive: true });
fs.rmSync(symlink, { recursive: true, force: true });
fs.symlinkSync(outside, symlink, "dir");
try {
  let loaderCalled = false;
  await assert.rejects(
    captureEvidence(".omx/taste-oracle/linked-output/run", {
      loadContracts() { loaderCalled = true; return contracts(); },
    }),
    /symbolic link/,
  );
  assert.equal(loaderCalled, false);
  assert.equal(fs.existsSync(path.join(outside, "run")), false);
} finally {
  fs.rmSync(symlink, { force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}

const danglingSymlink = path.join(allowedRoot, "dangling-output");
fs.rmSync(danglingSymlink, { force: true });
fs.symlinkSync(path.join(repoRoot, ".scratch/does-not-exist"), danglingSymlink, "dir");
try {
  assert.throws(() => resolveOutput(".omx/taste-oracle/dangling-output/run"), /symbolic link/);
} finally {
  fs.rmSync(danglingSymlink, { force: true });
}

const orderedEvents = [];
const ownedBrowser = { close: async () => { orderedEvents.push("close"); } };
await captureEvidence(outputRelative, {
  launchBrowser: async () => ownedBrowser,
  loadContracts: contracts,
  captureArm: async (...args) => { orderedEvents.push("capture"); return fakeCapture(...args); },
  publish: async (_output, _manifest) => {
    orderedEvents.push("publish");
    return { manifestAbsolute: path.join(outputAbsolute, "manifest.json"), manifestBytes: Buffer.from("{}\n") };
  },
});
assert.equal(orderedEvents.filter((entry) => entry === "capture").length, 6);
assert.ok(orderedEvents.indexOf("close") > orderedEvents.lastIndexOf("capture"));
assert.ok(orderedEvents.indexOf("publish") > orderedEvents.indexOf("close"));
assert.deepEqual(stagingEntries(), []);

let publishedAfterCloseFailure = false;
await assert.rejects(
  captureEvidence(".omx/taste-oracle/close-failure", {
    launchBrowser: async () => ({ close: async () => { throw new Error("injected close failure"); } }),
    loadContracts: contracts,
    captureArm: fakeCapture,
    publish: async () => { publishedAfterCloseFailure = true; },
  }),
  /injected close failure/,
);
assert.equal(publishedAfterCloseFailure, false);
assert.deepEqual(stagingEntries(), []);

let publishedMismatchedEvidence = false;
await assert.rejects(
  captureEvidence(".omx/taste-oracle/rendered-parity", {
    launchBrowser: async () => ({ close: async () => {} }),
    loadContracts: contracts,
    captureArm: async (...args) => {
      const staged = await fakeCapture(...args);
      staged.capture.dom_facts.probes = { heading: { text: args[1].id === "no-skill" ? "Hidden overview" : "Overview" } };
      staged.capture.dom_sha256 = hashCanonicalJson(staged.capture.dom_facts);
      return staged;
    },
    publish: async () => { publishedMismatchedEvidence = true; },
  }),
  /visible_content_parity/,
);
assert.equal(publishedMismatchedEvidence, false);
assert.deepEqual(stagingEntries(), []);

const publicationRoot = path.join(allowedRoot, "publication-rollback");
fs.rmSync(publicationRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(publicationRoot, "artifacts"), { recursive: true });
const oldManifest = { captures: [] };
const oldManifestBytes = Buffer.from(`${JSON.stringify(oldManifest)}\n`);
fs.writeFileSync(path.join(publicationRoot, "manifest.json"), oldManifestBytes);
const stagedRoot = fs.mkdtempSync(path.join(allowedRoot, ".publication-source-"));
const { manifest: newManifest, stagedArtifacts: newStagedArtifacts } = makeGeneration("new", stagedRoot);
try {
  await assert.rejects(
    publishEvidence(publicationRoot, newManifest, newStagedArtifacts, {
      verifyPublished() { throw new Error("injected verification failure"); },
    }),
    /injected verification failure/,
  );
  assert.deepEqual(fs.readFileSync(path.join(publicationRoot, "manifest.json")), oldManifestBytes);
  assert.deepEqual(fs.readdirSync(path.join(publicationRoot, "artifacts")), []);

  await assert.rejects(
    publishEvidence(publicationRoot, newManifest, newStagedArtifacts, {
      beforeCommitMarker() {
        assert.deepEqual(fs.readFileSync(path.join(publicationRoot, "manifest.json")), oldManifestBytes);
        throw new Error("injected pre-commit failure");
      },
    }),
    /injected pre-commit failure/,
  );
  assert.deepEqual(fs.readFileSync(path.join(publicationRoot, "manifest.json")), oldManifestBytes);
  assert.deepEqual(fs.readdirSync(path.join(publicationRoot, "artifacts")), []);
  assert.deepEqual(fs.readdirSync(publicationRoot).sort(), ["artifacts", "manifest.json"]);

  const foreignLock = path.join(publicationRoot, ".publish.lock");
  const crashLockBytes = `${JSON.stringify({ version: 1, owner_token: "crashed-publisher" })}\n`;
  fs.writeFileSync(foreignLock, crashLockBytes, { flag: "wx" });
  await assert.rejects(
    publishEvidence(publicationRoot, newManifest, newStagedArtifacts),
    /verify no publisher is active, remove it manually, and retry/,
  );
  assert.equal(fs.readFileSync(foreignLock, "utf8"), crashLockBytes, "manual-lock policy must not steal a crash lock");
  fs.rmSync(foreignLock);

  for (const [hook, message] of [["writeLock", "injected lock payload failure"], ["syncLock", "injected lock fsync failure"]]) {
    await assert.rejects(
      publishEvidence(publicationRoot, newManifest, newStagedArtifacts, {
        [hook]() { throw new Error(message); },
      }),
      new RegExp(message),
    );
    assert.equal(fs.existsSync(foreignLock), false, `${hook} failure must remove only its just-created lock`);
    assert.deepEqual(fs.readFileSync(path.join(publicationRoot, "manifest.json")), oldManifestBytes);
  }

  const invalidManifest = { captures: [] };
  await assert.rejects(publishEvidence(publicationRoot, invalidManifest, []), /evidence validation failed/);
  const leakyManifest = structuredClone(newManifest);
  leakyManifest.runtime.note = ["", "Users", "operator", "private"].join("/");
  await assert.rejects(publishEvidence(publicationRoot, leakyManifest, newStagedArtifacts), /public-safe/);

  const escapedManifest = structuredClone(newManifest);
  escapedManifest.captures[0].screenshot_path = "artifacts/../escaped.png";
  await assert.rejects(
    publishEvidence(publicationRoot, escapedManifest, newStagedArtifacts),
    /normalized repo-relative path|escapes publication root/,
  );
  assert.equal(fs.existsSync(path.join(publicationRoot, "escaped.png")), false);

  const symlinkArtifact = path.join(publicationRoot, newManifest.captures[0].screenshot_path);
  fs.symlinkSync(newStagedArtifacts[0].staged_absolute, symlinkArtifact);
  await assert.rejects(
    publishEvidence(publicationRoot, newManifest, newStagedArtifacts),
    /regular file|symbolic link/,
  );
  assert.equal(fs.lstatSync(symlinkArtifact).isSymbolicLink(), true);
  fs.rmSync(symlinkArtifact);

  fs.mkdirSync(symlinkArtifact);
  await assert.rejects(
    publishEvidence(publicationRoot, newManifest, newStagedArtifacts),
    /regular file/,
  );
  fs.rmSync(symlinkArtifact, { recursive: true });

  await publishEvidence(publicationRoot, newManifest, newStagedArtifacts);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(publicationRoot, "manifest.json"), "utf8")), newManifest);
  assert.equal(
    hashBytes(fs.readFileSync(path.join(publicationRoot, newManifest.captures[0].screenshot_path))),
    newManifest.captures[0].screenshot_sha256,
  );
  assert.deepEqual(fs.readdirSync(publicationRoot).sort(), ["artifacts", "manifest.json"]);

  const acceptedBytes = fs.readFileSync(path.join(publicationRoot, "manifest.json"));
  let reusedLoaderCalled = false;
  await assert.rejects(
    captureEvidence(".omx/taste-oracle/publication-rollback", {
      loadContracts() { reusedLoaderCalled = true; return contracts(); },
    }),
    /accepted manifest already exists.*new run directory/,
  );
  assert.equal(reusedLoaderCalled, false, "accepted output reuse must fail before contract loading or browser launch");
  const { manifest: newerManifest, stagedArtifacts: newerStagedArtifacts } = makeGeneration("newer", stagedRoot);
  await assert.rejects(
    publishEvidence(publicationRoot, newerManifest, newerStagedArtifacts),
    /accepted manifest already exists.*new run directory/,
  );
  assert.deepEqual(fs.readFileSync(path.join(publicationRoot, "manifest.json")), acceptedBytes);
  assert.equal(fs.existsSync(path.join(publicationRoot, newerManifest.captures[0].screenshot_path)), false);

  const durabilityRoot = path.join(allowedRoot, "publication-durability");
  fs.rmSync(durabilityRoot, { recursive: true, force: true });
  const { manifest: durabilityManifest, stagedArtifacts: durabilityStaged } = makeGeneration("durability", stagedRoot);
  let durabilityError;
  try {
    await publishEvidence(durabilityRoot, durabilityManifest, durabilityStaged, {
      syncPath(absolute) {
        if (absolute === durabilityRoot) throw new Error("injected directory sync failure");
      },
    });
  } catch (error) {
    durabilityError = error;
  }
  assert.equal(durabilityError?.code, "EVIDENCE_COMMITTED_DURABILITY_UNCERTAIN");
  assert.equal(durabilityError?.publication?.committed, true);
  assert.equal(durabilityError?.publication?.durability, "uncertain");
  assert.equal(durabilityError?.publication?.manifest_authoritative, true);
  assert.equal(durabilityError?.publication?.manifest_path, ".omx/taste-oracle/publication-durability/manifest.json");
  const authoritativeBytes = Buffer.from(`${JSON.stringify(durabilityManifest, null, 2)}\n`);
  assert.deepEqual(fs.readFileSync(path.join(durabilityRoot, "manifest.json")), authoritativeBytes);
  assert.equal(durabilityError?.publication?.manifest_file_sha256, hashBytes(authoritativeBytes));
  assert.equal(fs.existsSync(path.join(durabilityRoot, durabilityManifest.captures[0].screenshot_path)), true);
  assert.equal(fs.existsSync(path.join(durabilityRoot, ".publish.lock")), false);
  fs.rmSync(durabilityRoot, { recursive: true, force: true });
} finally {
  fs.rmSync(stagedRoot, { recursive: true, force: true });
  fs.rmSync(publicationRoot, { recursive: true, force: true });
  fs.rmSync(outputAbsolute, { recursive: true, force: true });
}

const noSkill = fs.readFileSync(path.join(repoRoot, "evals/taste-oracle/deslop-ui-hard-001/fixtures/no-skill.html"), "utf8");
assert.doesNotMatch(noSkill, /nav\s+a:first-child\s*\{[^}]*display:\s*none/i, "Overview must remain visible");
const visibleCopy = (html) => html
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const frozen = fs.readFileSync(path.join(repoRoot, "evals/taste-oracle/deslop-ui-hard-001/fixtures/frozen.html"), "utf8");
assert.equal(visibleCopy(noSkill), visibleCopy(frozen), "all authored visible copy must remain equivalent across arms");

console.log("taste-oracle capture safety regressions passed");
