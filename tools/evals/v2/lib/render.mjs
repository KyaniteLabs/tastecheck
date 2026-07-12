import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = require("playwright/package.json").version;
const CHROMIUM_EXECUTABLE = [process.env.TASTECHECK_CHROMIUM_EXECUTABLE, chromium.executablePath(), "/snap/bin/chromium"]
  .find((candidate) => typeof candidate === "string" && candidate.length > 0 && existsSync(candidate));
const VIEWPORT_IDS = ["mobile", "desktop"];
const SHA256 = /^[0-9a-f]{64}$/;
const ADAPTER_IDENTITY = "tastecheck-effectiveness-v2-local-playwright-renderer/1; png=viewport; dom=doctype+outerHTML; styles=document-order/allowlist; motion=disabled";
const CONTEXT_POLICY = "timezone=UTC;locale=en-US;color-scheme=light;reduced-motion=reduce;service-workers=block;network=deny;clock=epoch;random=deterministic";
const STYLE_PROPERTIES = [
  "display", "position", "box-sizing", "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "color", "background-color", "opacity", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-align", "text-decoration-line", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius", "overflow-x", "overflow-y", "visibility", "z-index", "flex-direction",
  "justify-content", "align-items", "gap", "grid-template-columns", "grid-template-rows"
];

function fail(message) {
  throw new Error(`production_incomplete: render ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  try {
    return sha256(readFileSync(path));
  } catch {
    fail("Chromium executable identity cannot be measured");
  }
}

const RENDERER_ADAPTER_SHA256 = fileSha256(fileURLToPath(import.meta.url));

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function assertString(value, name) {
  if (typeof value !== "string" || value.length === 0) fail(`${name} lineage is missing`);
}

function assertHash(value, name) {
  if (!SHA256.test(value ?? "")) fail(`${name} hash lineage is invalid`);
}

function exactViewports(requiredViewports, manifest) {
  if (!Array.isArray(requiredViewports) || requiredViewports.length !== 2) fail("viewport set must contain exactly mobile and desktop");
  if (requiredViewports.some((item, index) => item?.viewport_id !== VIEWPORT_IDS[index])) fail("viewport order must be mobile then desktop");
  if (stable(requiredViewports) !== stable(manifest?.viewports)) fail("viewport identity drift");
  for (const viewport of requiredViewports) {
    if (!Number.isInteger(viewport.width) || viewport.width < 1 || !Number.isInteger(viewport.height) || viewport.height < 1) fail("viewport dimensions are invalid");
  }
  return requiredViewports;
}

function fontSetSha256() {
  let listed;
  try {
    listed = execFileSync("fc-list", ["--format=%{file}\\n"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    fail("font-set identity cannot be measured with fc-list");
  }
  const files = [...new Set(listed.split("\n").filter(Boolean))].sort();
  if (files.length === 0) fail("font-set identity is empty");
  const contents = files.map((file) => {
    try {
      return sha256(readFileSync(file));
    } catch {
      fail("font-set identity changed during capture");
    }
  });
  return sha256(stable(contents));
}

async function localIdentity() {
  let browser;
  try {
    if (!CHROMIUM_EXECUTABLE) fail("no local Chromium executable is available");
    const executableSha256 = fileSha256(CHROMIUM_EXECUTABLE);
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
    const chromiumVersion = browser.version();
    if (fileSha256(CHROMIUM_EXECUTABLE) !== executableSha256) fail("Chromium executable drift during identity measurement");
    const host = sha256(stable({
      adapter: ADAPTER_IDENTITY,
      adapter_sha256: RENDERER_ADAPTER_SHA256,
      context_policy: CONTEXT_POLICY,
      playwright_version: PLAYWRIGHT_VERSION,
      chromium_version: chromiumVersion,
      chromium_executable: CHROMIUM_EXECUTABLE,
      chromium_executable_sha256: executableSha256,
      node_version: process.version,
      platform: platform(),
      arch: arch(),
      release: release()
    }));
    return {
      playwright_version: PLAYWRIGHT_VERSION,
      chromium_version: chromiumVersion,
      font_set_sha256: fontSetSha256(),
      renderer_adapter_sha256: RENDERER_ADAPTER_SHA256,
      render_host_sha256: host
    };
  } catch (error) {
    fail(`local Playwright/Chromium identity unavailable: ${error.message}`);
  } finally {
    await browser?.close();
  }
}

export async function getLocalRenderManifest(viewports) {
  if (!Array.isArray(viewports) || viewports.length !== 2) fail("viewport set must contain exactly mobile and desktop");
  const identity = await localIdentity();
  return { ...identity, viewports: structuredClone(viewports) };
}

function assertManifest(manifest, identity) {
  for (const field of ["playwright_version", "chromium_version"]) assertString(manifest?.[field], field);
  for (const field of ["font_set_sha256", "renderer_adapter_sha256", "render_host_sha256"]) assertHash(manifest?.[field], field);
  if (identity) {
    for (const field of ["playwright_version", "chromium_version", "font_set_sha256", "renderer_adapter_sha256", "render_host_sha256"]) {
      if (manifest[field] !== identity[field]) fail(`${field.replaceAll("_", " ")} drift from local frozen renderer`);
    }
  }
}

function evidenceId({ runId, artifact, artifactHash, viewportId }) {
  return sha256(stable({ domain: "effectiveness-v2-render-evidence-1", run_id: runId, unit_id: artifact.unit_id, arm: artifact.arm, artifact_id: artifact.artifact_id, artifact_sha256: artifactHash, viewport_id: viewportId }));
}

function assertReceiptEvidence(receipt) {
  assertString(receipt?.evidence_id, "evidence");
  assertString(receipt?.screenshot_png_base64, "screenshot");
  assertString(receipt?.serialized_dom, "DOM");
  if (!Array.isArray(receipt?.computed_styles)) fail("computed style projection is missing");
  let png;
  try {
    png = Buffer.from(receipt.screenshot_png_base64, "base64");
  } catch {
    fail("screenshot is not base64 PNG evidence");
  }
  if (png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail("screenshot is not PNG evidence");
  return { png, dom: receipt.serialized_dom, styles: receipt.computed_styles };
}

async function pageEvidence(page, bytes) {
  await page.setContent(bytes, { waitUntil: "load" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const computedStyles = await page.evaluate((properties) => [...document.querySelectorAll("*")].map((element, index) => {
    const computed = getComputedStyle(element);
    return {
      index,
      tag_name: element.tagName.toLowerCase(),
      id: element.id,
      class_name: element.className instanceof SVGAnimatedString ? element.className.baseVal : String(element.className || ""),
      properties: Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]))
    };
  }), STYLE_PROPERTIES);
  const dom = await page.evaluate(() => `${document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : ""}${document.documentElement.outerHTML}`);
  const screenshot = await page.screenshot({ type: "png" });
  return { screenshot, dom, computedStyles };
}

async function createDeterministicContext(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block"
  });
  const deniedRequests = [];
  await context.addInitScript(() => {
    const epoch = 1_704_067_200_000;
    const NativeDate = Date;
    class FrozenDate extends NativeDate {
      constructor(...args) { super(...(args.length === 0 ? [epoch] : args)); }
      static now() { return epoch; }
    }
    Object.setPrototypeOf(FrozenDate, NativeDate);
    globalThis.Date = FrozenDate;
    let state = 0x12345678;
    Math.random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    Object.defineProperty(performance, "now", { configurable: false, value: () => 0 });
    Object.defineProperty(performance, "timeOrigin", { configurable: false, value: epoch });
    const nativeAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => nativeAnimationFrame(() => callback(0));
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: false,
      value: (values) => {
        for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 256);
        return values;
      }
    });
    Object.defineProperty(crypto, "randomUUID", {
      configurable: false,
      value: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const nibble = Math.floor(Math.random() * 16);
        return (character === "x" ? nibble : (nibble & 0x3) | 0x8).toString(16);
      })
    });
    for (const api of ["WebSocket", "WebTransport", "RTCPeerConnection", "webkitRTCPeerConnection", "mozRTCPeerConnection"]) {
      Object.defineProperty(globalThis, api, { configurable: false, value: class { constructor() { throw new Error(`${api} is disabled in local render capture`); } } });
    }
  });
  if (typeof context.routeWebSocket !== "function") fail("WebSocket deny policy is unavailable");
  await context.route("**/*", async (route) => {
    deniedRequests.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (webSocket) => webSocket.close());
  return { context, deniedRequests };
}

function writeEvidence(receipt, evidenceDir) {
  if (typeof evidenceDir !== "string" || evidenceDir.length === 0) fail("evidence directory is required for local PNG capture");
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  const prefix = join(evidenceDir, receipt.evidence_id);
  try {
    writeFileSync(`${prefix}.png`, Buffer.from(receipt.screenshot_png_base64, "base64"), { flag: "wx" });
    writeFileSync(`${prefix}.dom.html`, receipt.serialized_dom, { encoding: "utf8", flag: "wx" });
    writeFileSync(`${prefix}.styles.json`, `${stable(receipt.computed_styles)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    fail(`evidence write rejected (stale replay or collision): ${error.message}`);
  }
}

export async function captureRenders({ runId, artifact, manifest, requiredViewports, admissionState, evidenceDir }) {
  assertString(runId, "run");
  assertString(artifact?.artifact_id, "artifact id");
  assertString(artifact?.unit_id, "unit");
  if (!["baseline", "candidate"].includes(artifact?.arm)) fail("arm lineage is invalid");
  assertString(artifact?.bytes, "artifact");
  const before = admissionState?.admitted;
  const identity = await localIdentity();
  assertManifest(manifest, identity);
  const viewports = exactViewports(requiredViewports, manifest);
  const artifactHash = sha256(artifact.bytes);
  const executableSha256 = fileSha256(CHROMIUM_EXECUTABLE);
  let browser;
  try {
    if (!CHROMIUM_EXECUTABLE) fail("no local Chromium executable is available");
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
    if (browser.version() !== manifest.chromium_version || fileSha256(CHROMIUM_EXECUTABLE) !== executableSha256) fail("Chromium drift during local capture");
    const receipts = [];
    for (const viewport of viewports) {
      const { context, deniedRequests } = await createDeterministicContext(browser, viewport);
      try {
        const page = await context.newPage();
        const { screenshot, dom, computedStyles } = await pageEvidence(page, artifact.bytes);
        if (deniedRequests.length !== 0) fail(`network request blocked; local capture is incomplete (${deniedRequests[0]})`);
        const id = evidenceId({ runId, artifact, artifactHash, viewportId: viewport.viewport_id });
        const receipt = {
          schema_version: 2,
          kind: "effectiveness-v2-render-receipt",
          run_id: runId,
          unit_id: artifact.unit_id,
          arm: artifact.arm,
          artifact_id: artifact.artifact_id,
          evidence_id: id,
          viewport_id: viewport.viewport_id,
          viewport_width: viewport.width,
          viewport_height: viewport.height,
          artifact_sha256: artifactHash,
          screenshot_png_base64: screenshot.toString("base64"),
          serialized_dom: dom,
          computed_styles: computedStyles,
          screenshot_sha256: sha256(screenshot),
          dom_sha256: sha256(dom),
          style_sha256: sha256(stable(computedStyles)),
          ...identity
        };
        writeEvidence(receipt, evidenceDir);
        receipts.push(receipt);
      } finally {
        await context.close();
      }
    }
    if (fileSha256(CHROMIUM_EXECUTABLE) !== executableSha256) fail("Chromium executable drift after local capture");
    if (admissionState?.admitted !== before) fail("local capture consumed an external ordinal");
    assertManifest(manifest, await localIdentity());
    return receipts;
  } finally {
    await browser?.close();
  }
}

export async function verifyRenderReceipt(receipt, artifact, manifest, runId) {
  assertString(runId, "run");
  const identity = await localIdentity();
  assertManifest(manifest, identity);
  if (receipt?.schema_version !== 2) fail("schema version drift");
  if (receipt?.kind !== "effectiveness-v2-render-receipt") fail("receipt kind drift");
  if (receipt?.run_id !== runId) fail("run identity replay across runs");
  assertString(receipt?.unit_id, "unit");
  assertString(receipt?.artifact_id, "artifact id");
  if (receipt.unit_id !== artifact?.unit_id) fail("unit lineage mismatch");
  if (receipt.artifact_id !== artifact?.artifact_id) fail("artifact id lineage mismatch");
  if (!["baseline", "candidate"].includes(receipt?.arm) || receipt.arm !== artifact?.arm) fail("arm lineage mismatch");
  const viewport = manifest.viewports?.find((item) => item.viewport_id === receipt?.viewport_id);
  if (!viewport) fail("viewport identity is not frozen");
  if (receipt.viewport_width !== viewport.width || receipt.viewport_height !== viewport.height) fail("viewport dimensions drift");
  assertString(artifact?.bytes, "artifact");
  const artifactHash = sha256(artifact.bytes);
  if (receipt.artifact_sha256 !== artifactHash) fail("artifact hash mismatch or cross-artifact replay");
  if (receipt.evidence_id !== evidenceId({ runId, artifact, artifactHash, viewportId: receipt.viewport_id })) fail("evidence lineage mismatch or stale replay");
  const evidence = assertReceiptEvidence(receipt);
  if (receipt.screenshot_sha256 !== sha256(evidence.png)) fail("screenshot hash mismatch");
  if (receipt.dom_sha256 !== sha256(evidence.dom)) fail("DOM hash mismatch");
  if (receipt.style_sha256 !== sha256(stable(evidence.styles))) fail("computed style hash mismatch");
  for (const field of ["playwright_version", "chromium_version", "font_set_sha256", "renderer_adapter_sha256", "render_host_sha256"]) {
    if (receipt[field] !== manifest[field]) fail(`${field.replaceAll("_", " ")} lineage drift`);
  }
  return true;
}

export async function verifyRenderReceipts(receipts, artifact, manifest, runId, requiredViewports) {
  const viewports = exactViewports(requiredViewports, manifest);
  if (!Array.isArray(receipts) || receipts.length !== viewports.length) fail("viewport receipt set is incomplete");
  for (const [index, viewport] of viewports.entries()) {
    if (receipts[index]?.viewport_id !== viewport.viewport_id) fail("viewport receipt order or membership drift");
    await verifyRenderReceipt(receipts[index], artifact, manifest, runId);
  }
  return true;
}

export function verifyRenderEvidence(receipt, evidenceDir) {
  const evidence = assertReceiptEvidence(receipt);
  if (typeof evidenceDir !== "string" || evidenceDir.length === 0) fail("evidence directory is required for verification");
  const prefix = join(evidenceDir, receipt.evidence_id);
  let screenshot;
  let dom;
  let styles;
  try {
    screenshot = readFileSync(`${prefix}.png`);
    dom = readFileSync(`${prefix}.dom.html`, "utf8");
    styles = JSON.parse(readFileSync(`${prefix}.styles.json`, "utf8"));
  } catch (error) {
    fail(`evidence files are missing or malformed: ${error.message}`);
  }
  if (sha256(screenshot) !== receipt.screenshot_sha256 || !screenshot.equals(evidence.png)) fail("screenshot evidence hash mismatch");
  if (sha256(dom) !== receipt.dom_sha256 || dom !== evidence.dom) fail("DOM evidence hash mismatch");
  const serializedStyles = stable(styles);
  if (sha256(serializedStyles) !== receipt.style_sha256 || serializedStyles !== stable(evidence.styles)) fail("styles evidence hash mismatch");
  return true;
}
