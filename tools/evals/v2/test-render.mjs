import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureRenders, verifyRenderReceipt } from "./lib/render.mjs";

const repoBase = new URL("../../../", import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(join(repoBase, "evals/v2/fixtures/render-success.json"), "utf8"));
const { runId, artifact, manifest, requiredViewports } = fixture;
const receipts = captureRenders(fixture);

assert.deepEqual(receipts.map(({ viewport_id }) => viewport_id), ["mobile", "desktop"]);
assert.equal(receipts.length, 2);
for (const receipt of receipts) assert.doesNotThrow(() => verifyRenderReceipt(receipt, artifact, manifest, runId));
assert.deepEqual(requiredViewports, manifest.viewports);
assert.equal(fixture.admissionState.admitted, 0, "local rendering must consume zero external-call ordinals");

const receipt = receipts[0];
const otherArtifact = { ...artifact, bytes: `${artifact.bytes}\n<!-- mutation -->` };
const drift = (field, value) => ({ ...receipt, [field]: value });
const h = "f".repeat(64);
for (const [name, mutated, candidateArtifact, candidateRun] of [
  ["mismatched artifact", receipt, otherArtifact, runId],
  ["tampered DOM", drift("dom_sha256", h), artifact, runId],
  ["tampered styles", drift("style_sha256", h), artifact, runId],
  ["tampered screenshot", drift("screenshot_sha256", h), artifact, runId],
  ["wrong Playwright", drift("playwright_version", "drifted"), artifact, runId],
  ["wrong Chromium", drift("chromium_version", "drifted"), artifact, runId],
  ["wrong fonts", drift("font_set_sha256", h), artifact, runId],
  ["wrong renderer", drift("renderer_adapter_sha256", h), artifact, runId],
  ["wrong host", drift("render_host_sha256", h), artifact, runId],
  ["wrong unit", drift("unit_id", "other-unit"), artifact, runId],
  ["wrong arm", drift("arm", "candidate"), artifact, runId],
  ["viewport drift", { ...receipt, viewport_width: receipt.viewport_width + 1 }, artifact, runId],
  ["stale replay", receipt, artifact, "other-run"]
]) assert.throws(
  () => verifyRenderReceipt(mutated, candidateArtifact, manifest, candidateRun),
  new RegExp(`render|viewport|hash|lineage|replay|${name.split(" ")[1]}`, "i"),
  name
);

assert.throws(() => captureRenders({ ...fixture, requiredViewports: requiredViewports.slice(0, 1) }), /viewport|render/i);
assert.throws(() => captureRenders({ ...fixture, requiredViewports: [...requiredViewports].reverse() }), /viewport|render/i);
assert.throws(() => captureRenders({ ...fixture, artifact: { ...artifact, render_evidence: { ...artifact.render_evidence, mobile: { ...artifact.render_evidence.mobile, dom: `${artifact.render_evidence.mobile.dom} ` } } } }), /deterministic|DOM|render/i);
assert.equal(fixture.admissionState.admitted, 0, "failures must not consume ordinals either");

// Explicit per-field binding checks: each identity must produce a specific, identifiable error.
// These cannot all be satisfied by a single generic "hash or lineage mismatch" message.
const desktop = manifest.viewports.find((v) => v.viewport_id === "desktop");
for (const [field, value, pattern] of [
  ["artifact_sha256", h, /artifact/i],
  ["dom_sha256", h, /dom/i],
  ["style_sha256", h, /style/i],
  ["screenshot_sha256", h, /screenshot/i],
  ["renderer_adapter_sha256", h, /renderer/i],
  ["render_host_sha256", h, /host/i],
  ["font_set_sha256", h, /font/i],
  ["playwright_version", "drifted", /playwright/i],
  ["chromium_version", "drifted", /chromium/i],
  ["unit_id", "other-unit", /unit/i],
  ["arm", "candidate", /arm/i],
  ["viewport_width", desktop.width, /viewport/i],
  ["viewport_height", desktop.height, /viewport/i]
]) {
  assert.throws(() => verifyRenderReceipt(drift(field, value), artifact, manifest, runId), pattern, `field ${field} must name itself in error`);
}
// viewport_id swap: mobile receipt relabeled as desktop must fail on viewport-bound evidence hash.
assert.throws(() => verifyRenderReceipt(drift("viewport_id", "desktop"), artifact, manifest, runId), /viewport|screenshot|dom|style|artifact/i, "viewport_id swap must fail");
// Explicit run binding: receipt from another run must be rejected by name even if everything else matches.
assert.throws(() => verifyRenderReceipt(receipt, artifact, manifest, "run-other"), /run|replay/i, "cross-run replay must name run/replay");
assert.throws(() => verifyRenderReceipt({ ...receipt, run_id: "run-other" }, artifact, manifest, runId), /run|replay/i, "receipt run_id drift must name run/replay");

console.log("effectiveness-v2 render tests passed; mobile+desktop hash lineage closed; zero ordinals");
