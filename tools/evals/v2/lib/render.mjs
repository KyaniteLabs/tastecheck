import { createHash } from "node:crypto";

const VIEWPORT_IDS = ["mobile", "desktop"];
const SHA256 = /^[0-9a-f]{64}$/;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(message) {
  throw new Error(`production_incomplete: render ${message}`);
}

function assertString(value, name) {
  if (typeof value !== "string" || value.length === 0) fail(`${name} lineage is missing`);
}

function exactViewports(requiredViewports, manifest) {
  if (!Array.isArray(requiredViewports) || requiredViewports.length !== 2) fail("viewport set must contain exactly mobile and desktop");
  if (requiredViewports.some((item, index) => item?.viewport_id !== VIEWPORT_IDS[index])) fail("viewport order must be mobile then desktop");
  if (JSON.stringify(requiredViewports) !== JSON.stringify(manifest?.viewports)) fail("viewport identity drift");
  for (const viewport of requiredViewports) {
    if (!Number.isInteger(viewport.width) || viewport.width < 1 || !Number.isInteger(viewport.height) || viewport.height < 1) fail("viewport dimensions are invalid");
  }
  return requiredViewports;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function deterministicEvidence(artifact, viewportId) {
  const evidence = artifact?.render_evidence?.[viewportId];
  assertString(evidence?.screenshot, "screenshot");
  assertString(evidence?.dom, "DOM");
  if (evidence.dom !== evidence.dom.trim()) fail("DOM is not deterministically serialized");
  if (!Array.isArray(evidence.styles)) fail("computed-style projection is missing");
  return {
    screenshot_sha256: sha256(evidence.screenshot),
    dom_sha256: sha256(evidence.dom),
    style_sha256: sha256(stable(evidence.styles))
  };
}

function assertManifest(manifest) {
  for (const field of ["playwright_version", "chromium_version"]) assertString(manifest?.[field], field);
  for (const field of ["font_set_sha256", "renderer_adapter_sha256", "render_host_sha256"]) {
    if (!SHA256.test(manifest?.[field] ?? "")) fail(`${field} hash lineage is invalid`);
  }
}

export function captureRenders({ runId, artifact, manifest, requiredViewports, admissionState }) {
  assertString(runId, "run");
  assertString(artifact?.unit_id, "unit");
  if (!["baseline", "candidate"].includes(artifact?.arm)) fail("arm lineage is invalid");
  assertString(artifact?.bytes, "artifact");
  assertManifest(manifest);
  const viewports = exactViewports(requiredViewports, manifest);
  const before = admissionState?.admitted;
  const artifactHash = sha256(artifact.bytes);
  const receipts = viewports.map((viewport) => ({
    schema_version: 2,
    kind: "effectiveness-v2-render-receipt",
    run_id: runId,
    unit_id: artifact.unit_id,
    arm: artifact.arm,
    viewport_id: viewport.viewport_id,
    viewport_width: viewport.width,
    viewport_height: viewport.height,
    artifact_sha256: artifactHash,
    ...deterministicEvidence(artifact, viewport.viewport_id),
    playwright_version: manifest.playwright_version,
    chromium_version: manifest.chromium_version,
    font_set_sha256: manifest.font_set_sha256,
    renderer_adapter_sha256: manifest.renderer_adapter_sha256,
    render_host_sha256: manifest.render_host_sha256
  }));
  if (admissionState?.admitted !== before) fail("local capture consumed an external ordinal");
  return receipts;
}

export function verifyRenderReceipt(receipt, artifact, manifest, runId) {
  assertString(runId, "run");
  assertManifest(manifest);
  if (receipt?.schema_version !== 2) fail("schema version drift");
  if (receipt?.kind !== "effectiveness-v2-render-receipt") fail("receipt kind drift");
  if (receipt?.run_id !== runId) fail("run identity replay across runs");
  assertString(receipt?.unit_id, "unit");
  if (receipt?.unit_id !== artifact?.unit_id) fail("unit lineage mismatch");
  if (!["baseline", "candidate"].includes(receipt?.arm)) fail("arm lineage is invalid");
  if (receipt?.arm !== artifact?.arm) fail("arm lineage mismatch");
  const viewport = manifest.viewports.find((item) => item.viewport_id === receipt?.viewport_id);
  if (!viewport) fail("viewport identity is not frozen");
  if (receipt?.viewport_width !== viewport.width || receipt?.viewport_height !== viewport.height) fail("viewport dimensions drift");
  assertString(artifact?.bytes, "artifact");
  if (receipt?.artifact_sha256 !== sha256(artifact.bytes)) fail("artifact hash mismatch or cross-artifact replay");
  const evidence = deterministicEvidence(artifact, receipt.viewport_id);
  if (receipt?.screenshot_sha256 !== evidence.screenshot_sha256) fail("screenshot hash mismatch");
  if (receipt?.dom_sha256 !== evidence.dom_sha256) fail("DOM hash mismatch");
  if (receipt?.style_sha256 !== evidence.style_sha256) fail("computed style hash mismatch");
  if (receipt?.playwright_version !== manifest.playwright_version) fail("playwright lineage drift");
  if (receipt?.chromium_version !== manifest.chromium_version) fail("chromium lineage drift");
  if (receipt?.font_set_sha256 !== manifest.font_set_sha256) fail("font set lineage drift");
  if (receipt?.renderer_adapter_sha256 !== manifest.renderer_adapter_sha256) fail("renderer adapter lineage drift");
  if (receipt?.render_host_sha256 !== manifest.render_host_sha256) fail("render host lineage drift");
  return true;
}
