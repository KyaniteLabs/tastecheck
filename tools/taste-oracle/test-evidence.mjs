import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPublicSafe,
  assertRepoRelativePath,
  canonicalJson,
  findClippedProbes,
  hashBytes,
  hashCanonicalJson,
  normalizeEvidenceManifest,
  verifyArtifactHashes,
  validateEvidenceManifest,
} from "./lib/evidence.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scenarioRoot = path.join(repoRoot, "evals/taste-oracle/deslop-ui-hard-001");
const sha = "a".repeat(64);

function capture(armId, viewportId) {
  return {
    arm_id: armId,
    viewport_id: viewportId,
    screenshot_path: `artifacts/${armId}-${viewportId}.png`,
    screenshot_sha256: sha,
    dom_facts: {
      landmarks: ["banner", "navigation", "main"],
      probes: {
        root: { text: "Northstar Overview Activity Make the next decision obvious." },
        heading: { text: "Make the next decision obvious." },
        "primary-action": { text: "Review priorities" },
        "summary-card": { text: "Launch readiness Three reviews remain." },
        status: { text: "On track for Friday" },
      },
      scroll_width: viewportId === "mobile" ? 390 : 1280,
      scroll_height: viewportId === "mobile" ? 844 : 900,
    },
    dom_sha256: sha,
    computed_styles: {
      root: { backgroundColor: "rgb(250, 248, 244)", color: "rgb(40, 42, 48)" },
    },
    style_sha256: sha,
  };
}

function validManifest() {
  const captures = [];
  for (const armId of ["no-skill", "current", "frozen"]) {
    for (const viewportId of ["mobile", "desktop"]) captures.push(capture(armId, viewportId));
  }
  return {
    schema_version: 1,
    scenario_id: "deslop-ui-hard-001",
    captured_at: "2026-07-11T20:00:00.000Z",
    runtime: { browser: "chromium", playwright: "1.55.0", platform: "darwin" },
    viewports: [
      { id: "mobile", width: 390, height: 844 },
      { id: "desktop", width: 1280, height: 900 },
    ],
    arms: ["no-skill", "current", "frozen"],
    captures,
  };
}

function expectCode(manifest, code) {
  const errors = validateEvidenceManifest(manifest);
  assert.ok(errors.some((error) => error.code === code), JSON.stringify(errors, null, 2));
}

assert.equal(
  canonicalJson({ z: 1, a: { y: 2, x: [3, { b: true, a: null }] } }),
  '{"a":{"x":[3,{"a":null,"b":true}],"y":2},"z":1}',
);
assert.equal(hashCanonicalJson({ b: 2, a: 1 }), hashCanonicalJson({ a: 1, b: 2 }));
assert.throws(() => canonicalJson({ bad: Number.NaN }), /finite JSON number/);
assert.throws(() => canonicalJson({ bad: undefined }), /JSON-compatible/);

assert.equal(assertRepoRelativePath("artifacts/current-mobile.png"), "artifacts/current-mobile.png");
for (const unsafe of [
  ["", "tmp", "output.png"].join("/"),
  "../output.png",
  "./output.png",
  ["file:", "", "", "tmp", "x"].join("/"),
  "C:/temp/x",
  "a\\b",
]) {
  assert.throws(() => assertRepoRelativePath(unsafe), /repo-relative/);
}

assert.doesNotThrow(() => assertPublicSafe(validManifest()));
for (const unsafe of [
  ["", "Users", "example", "work", "output.png"].join("/"),
  ["", "home", "example", "output.png"].join("/"),
  ["file:", "", "", "private", "tmp", "output.png"].join("/"),
  "~/work/output.png",
  "C:\\Users\\operator\\work\\output.png",
  "C:\\DOCUMENTS AND SETTINGS\\OPERATOR\\work\\output.png",
  "C:/Users/operator/work/output.png",
  ["operator", "example.com"].join("@"),
  ["TOKEN", "secret"].join("="),
]) {
  assert.throws(() => assertPublicSafe({ note: unsafe }), /public-safe/);
}

const manifest = validManifest();
assert.deepEqual(validateEvidenceManifest(manifest), []);
const reordered = structuredClone(manifest);
reordered.captures.reverse();
reordered.runtime = { platform: "darwin", playwright: "1.55.0", browser: "chromium" };
assert.equal(canonicalJson(normalizeEvidenceManifest(manifest)), canonicalJson(normalizeEvidenceManifest(reordered)));

const missingCoverage = structuredClone(manifest);
missingCoverage.captures.pop();
expectCode(missingCoverage, "exact_capture_coverage");

const duplicateCoverage = structuredClone(manifest);
duplicateCoverage.captures[5] = structuredClone(duplicateCoverage.captures[0]);
expectCode(duplicateCoverage, "duplicate_capture");
expectCode(duplicateCoverage, "exact_capture_coverage");

const wrongViewport = structuredClone(manifest);
wrongViewport.viewports[0].width = 391;
expectCode(wrongViewport, "exact_viewports");

for (const field of ["screenshot_sha256", "dom_sha256", "style_sha256"]) {
  const absent = structuredClone(manifest);
  delete absent.captures[0][field];
  expectCode(absent, "required_hash");
  const malformed = structuredClone(manifest);
  malformed.captures[0][field] = "not-a-hash";
  expectCode(malformed, "sha256");
}

const absoluteArtifact = structuredClone(manifest);
absoluteArtifact.captures[0].screenshot_path = ["", "tmp", "no-skill-mobile.png"].join("/");
expectCode(absoluteArtifact, "repo_relative_path");

const visibleDom = {
  viewport: { width: 1280, height: 900 },
  probes: [
    { name: "root", rect: { x: 0, y: 0, width: 1280, height: 1200 } },
    { name: "heading", rect: { x: 10, y: 10, width: 500, height: 200 } },
    { name: "summary-card", rect: { x: 10, y: 700, width: 500, height: 200 } },
  ],
};
assert.deepEqual(findClippedProbes(visibleDom), []);
const clippedDom = structuredClone(visibleDom);
clippedDom.probes[2].rect.height = 201;
assert.deepEqual(findClippedProbes(clippedDom), ["summary-card"]);
const zeroSizeDom = structuredClone(visibleDom);
zeroSizeDom.probes[1].rect.width = 0;
assert.deepEqual(findClippedProbes(zeroSizeDom), ["heading"]);
const hiddenDom = structuredClone(visibleDom);
hiddenDom.probes[1].visible = false;
assert.deepEqual(findClippedProbes(hiddenDom), ["heading"]);

const outputPrefixedArtifact = structuredClone(manifest);
outputPrefixedArtifact.captures[0].screenshot_path = ".omx/taste-oracle/run/artifacts/no-skill-mobile.png";
expectCode(outputPrefixedArtifact, "artifact_relative_path");

const renderedParity = structuredClone(manifest);
assert.deepEqual(validateEvidenceManifest(renderedParity), []);
const caseStyledParity = structuredClone(renderedParity);
caseStyledParity.captures.find((entry) => entry.arm_id === "current").dom_facts.probes.heading.text = "MAKE THE NEXT DECISION OBVIOUS.";
assert.deepEqual(validateEvidenceManifest(caseStyledParity), [], "CSS text-transform must not become a false content-parity failure");
renderedParity.captures.find((entry) => entry.arm_id === "no-skill" && entry.viewport_id === "mobile")
  .dom_facts.probes.heading.text = "Hidden overview";
expectCode(renderedParity, "visible_content_parity");

const fixtureNames = ["no-skill", "current", "frozen"];
const fixtureHtml = fixtureNames.map((name) => fs.readFileSync(path.join(scenarioRoot, `fixtures/${name}.html`), "utf8"));
const requiredProbes = ["root", "heading", "primary-action", "summary-card", "status"];
for (const [index, html] of fixtureHtml.entries()) {
  assert.match(html, /__ORACLE_TOKENS__/, `${fixtureNames[index]} must consume injected tokens`);
  assert.match(html, /<header\b/i);
  assert.match(html, /<nav\b/i);
  assert.match(html, /<main\b/i);
  for (const probe of requiredProbes) {
    assert.match(html, new RegExp(`data-oracle-probe=["']${probe}["']`), `${fixtureNames[index]} missing ${probe}`);
  }
}

function semanticSignature(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\s+class=("[^"]*"|'[^']*')/gi, "")
    .replace(/\s+data-oracle-arm=("[^"]*"|'[^']*')/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
assert.equal(semanticSignature(fixtureHtml[0]), semanticSignature(fixtureHtml[1]));
assert.equal(semanticSignature(fixtureHtml[1]), semanticSignature(fixtureHtml[2]));

const captureSource = fs.readFileSync(path.join(repoRoot, "tools/taste-oracle/capture.mjs"), "utf8");
assert.match(captureSource, /element\.innerText/, "DOM probe evidence must include visible text only");
assert.doesNotMatch(captureSource, /element\.textContent/, "script source must not contaminate DOM probe evidence");
assert.match(captureSource, /manifest_file_sha256/, "capture receipt must label the manifest file-byte hash");
assert.match(captureSource, /manifest_canonical_sha256/, "capture receipt must label the canonical-object hash");

const artifactRoot = fs.mkdtempSync(path.join(repoRoot, ".oracle-task2-test-"));
try {
  const artifactManifest = validManifest();
  for (const entry of artifactManifest.captures) {
    const screenshot = Buffer.from(`${entry.arm_id}:${entry.viewport_id}`);
    const screenshotPath = path.join(artifactRoot, entry.screenshot_path);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, screenshot);
    entry.screenshot_sha256 = hashBytes(screenshot);
    entry.dom_sha256 = hashCanonicalJson(entry.dom_facts);
    entry.style_sha256 = hashCanonicalJson(entry.computed_styles);
  }
  assert.deepEqual(verifyArtifactHashes(artifactManifest, artifactRoot), []);

  fs.appendFileSync(path.join(artifactRoot, artifactManifest.captures[0].screenshot_path), "tampered");
  assert.ok(verifyArtifactHashes(artifactManifest, artifactRoot).some((entry) => entry.code === "screenshot_hash_mismatch"));

  const tamperedDom = structuredClone(artifactManifest);
  tamperedDom.captures[1].dom_facts.scroll_width += 1;
  assert.ok(verifyArtifactHashes(tamperedDom, artifactRoot).some((entry) => entry.code === "dom_hash_mismatch"));
} finally {
  fs.rmSync(artifactRoot, { recursive: true, force: true });
}

console.log("taste-oracle evidence tests passed");
