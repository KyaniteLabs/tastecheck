import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureRenders, getLocalRenderManifest, verifyRenderEvidence, verifyRenderReceipt, verifyRenderReceipts } from "./lib/render.mjs";
import { recordQaCase } from "./lib/qa-case.mjs";

const repoBase = new URL("../../../", import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(join(repoBase, "evals/v2/fixtures/render-success.json"), "utf8"));
const evidenceDir = mkdtempSync(join(tmpdir(), "tastecheck-v2-render-"));
const manifest = await getLocalRenderManifest(fixture.requiredViewports);
const input = { ...fixture, manifest, evidenceDir };

try {
  const receipts = await captureRenders(input);
  assert.deepEqual(receipts.map(({ viewport_id }) => viewport_id), ["mobile", "desktop"]);
  assert.equal(receipts.length, 2);
  for (const receipt of receipts) {
    await assert.doesNotReject(() => verifyRenderReceipt(receipt, fixture.artifact, manifest, fixture.runId));
    assert.doesNotThrow(() => verifyRenderEvidence(receipt, evidenceDir));
    const png = readFileSync(join(evidenceDir, `${receipt.evidence_id}.png`));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "must persist an actual PNG");
    assert.equal(png.readUInt32BE(16), receipt.viewport_width, "PNG width must be the frozen viewport width");
    assert.equal(png.readUInt32BE(20), receipt.viewport_height, "PNG height must be the frozen viewport height");
    assert.equal(png.toString("base64"), receipt.screenshot_png_base64, "receipt must bind persisted screenshot bytes");
    assert.equal(readFileSync(join(evidenceDir, `${receipt.evidence_id}.dom.html`), "utf8"), receipt.serialized_dom);
    assert.deepEqual(JSON.parse(readFileSync(join(evidenceDir, `${receipt.evidence_id}.styles.json`), "utf8")), receipt.computed_styles);
  }
  await verifyRenderReceipts(receipts, fixture.artifact, manifest, fixture.runId, fixture.requiredViewports);
  assert.equal(fixture.admissionState.admitted, 0, "local rendering must consume zero external-call ordinals");

  const receipt = receipts[0];
  const h = "f".repeat(64);
  const drift = (field, value) => ({ ...receipt, [field]: value });
  const otherArtifact = { ...fixture.artifact, bytes: `${fixture.artifact.bytes}\n<!-- mutation -->` };
  for (const [name, mutated, candidateArtifact, candidateRun] of [
    ["mismatched artifact", receipt, otherArtifact, fixture.runId],
    ["tampered DOM", drift("serialized_dom", `${receipt.serialized_dom} `), fixture.artifact, fixture.runId],
    ["tampered styles", drift("computed_styles", []), fixture.artifact, fixture.runId],
    ["tampered screenshot", drift("screenshot_png_base64", "Zm9yZ2Vk"), fixture.artifact, fixture.runId],
    ["wrong renderer", drift("renderer_adapter_sha256", h), fixture.artifact, fixture.runId],
    ["wrong host", drift("render_host_sha256", h), fixture.artifact, fixture.runId],
    ["wrong Playwright", drift("playwright_version", "drifted"), fixture.artifact, fixture.runId],
    ["wrong Chromium", drift("chromium_version", "drifted"), fixture.artifact, fixture.runId],
    ["wrong fonts", drift("font_set_sha256", h), fixture.artifact, fixture.runId],
    ["stale replay", receipt, fixture.artifact, "other-run"]
  ]) await assert.rejects(
    () => verifyRenderReceipt(mutated, candidateArtifact, manifest, candidateRun),
    /render|viewport|hash|lineage|replay|artifact|dom|style|screenshot|renderer|host|run/i,
    name
  );
  await assert.rejects(
    () => verifyRenderReceipts(receipts.slice(0, 1), fixture.artifact, manifest, fixture.runId, fixture.requiredViewports),
    /viewport|render/i,
    "missing desktop viewport must be terminal"
  );
  const dynamicArtifact = {
    ...fixture.artifact,
    bytes: "<!doctype html><body><script>const values=new Uint32Array(1);crypto.getRandomValues(values);document.body.textContent=[Date.now(),Math.random(),performance.now(),performance.timeOrigin,crypto.randomUUID(),values[0]].join(':');requestAnimationFrame((timestamp)=>document.body.textContent+=':'+timestamp)</script></body>"
  };
  const firstDeterministic = await captureRenders({ ...input, runId: "run-fixture-deterministic-a", artifact: dynamicArtifact, evidenceDir: join(evidenceDir, "deterministic-a") });
  const secondDeterministic = await captureRenders({ ...input, runId: "run-fixture-deterministic-b", artifact: dynamicArtifact, evidenceDir: join(evidenceDir, "deterministic-b") });
  assert.deepEqual(
    firstDeterministic.map(({ screenshot_sha256, dom_sha256, style_sha256 }) => ({ screenshot_sha256, dom_sha256, style_sha256 })),
    secondDeterministic.map(({ screenshot_sha256, dom_sha256, style_sha256 }) => ({ screenshot_sha256, dom_sha256, style_sha256 })),
    "frozen time and entropy must produce identical local evidence"
  );
  for (const [field, filename, contents] of [
    ["screenshot", `${receipt.evidence_id}.png`, Buffer.from("forged")],
    ["DOM", `${receipt.evidence_id}.dom.html`, "forged"],
    ["styles", `${receipt.evidence_id}.styles.json`, "[]"]
  ]) {
    const path = join(evidenceDir, filename);
    const original = readFileSync(path);
    writeFileSync(path, contents);
    assert.throws(() => verifyRenderEvidence(receipt, evidenceDir), new RegExp(field, "i"), `tampered ${field} file must fail`);
    writeFileSync(path, original);
  }
  await assert.rejects(() => captureRenders({ ...input, requiredViewports: fixture.requiredViewports.slice(0, 1) }), /viewport|render/i);
  await assert.rejects(
    () => captureRenders({ ...input, evidenceDir: join(evidenceDir, "network-blocked"), artifact: { ...fixture.artifact, bytes: "<!doctype html><img src=\"https://example.invalid/tracker.png\">" } }),
    /network|local|render/i,
    "remote artifact subresources must fail instead of becoming render evidence"
  );
  await assert.rejects(() => captureRenders({ ...input, manifest: { ...manifest, renderer_adapter_sha256: h } }), /renderer|render/i);
  await assert.rejects(() => captureRenders({ ...input, manifest: { ...manifest, render_host_sha256: h } }), /host|render/i);
  assert.equal(fixture.admissionState.admitted, 0, "failures must not consume ordinals either");
  recordQaCase("execution-render-and-replay-drift");
  recordQaCase("render-viewport-artifact-and-host-tampering");
  console.log("effectiveness-v2 render tests passed; Playwright mobile+desktop PNG/DOM/styles lineage closed; zero ordinals");
} finally {
  rmSync(evidenceDir, { recursive: true, force: true });
}
