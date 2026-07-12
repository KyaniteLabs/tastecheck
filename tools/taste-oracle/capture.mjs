#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  assertPublicSafe,
  assertRepoRelativePath,
  canonicalJson,
  findClippedProbes,
  hashBytes,
  hashCanonicalJson,
  normalizeEvidenceManifest,
  validateEvidenceManifest,
  verifyArtifactHashes,
} from "./lib/evidence.mjs";
import { loadContractPair } from "./validate-contracts.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const scenarioPath = "evals/taste-oracle/deslop-ui-hard-001/scenario.json";
const outputRootRelative = ".omx/taste-oracle";
const outputRootAbsolute = path.join(repoRoot, outputRootRelative);
const requiredProbes = ["root", "heading", "primary-action", "summary-card", "status"];
const styleProperties = [
  "display", "position", "color", "backgroundColor", "fontFamily", "fontSize",
  "fontWeight", "lineHeight", "letterSpacing", "borderRadius", "borderTopWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
];

function parseOutputArgument(argv) {
  const index = argv.indexOf("--out");
  if (index < 0 || !argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error("usage: npm run oracle:capture -- --out <repo-relative-directory>");
  }
  if (argv.length !== 2 || index !== 0) throw new Error("only --out <directory> is supported");
  const output = argv[index + 1];
  const absolute = resolveOutput(output);
  return { relative: output, absolute };
}

function publicPlatform() {
  if (["darwin", "linux", "win32"].includes(process.platform)) return process.platform;
  return "other";
}

function readPlaywrightVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "node_modules/playwright/package.json"), "utf8"));
  return packageJson.version;
}

function relativeArtifactPath(armId, viewportId, sha256) {
  return path.posix.join("artifacts", `${armId}-${viewportId}-${sha256}.png`);
}

export async function collectPageEvidence(page) {
  return page.evaluate(({ probes, properties }) => {
    const round = (value) => Math.round(value * 100) / 100;
    const domProbes = {};
    const computedStyles = {};
    for (const probe of probes) {
      const matches = [...document.querySelectorAll(`[data-oracle-probe="${probe}"]`)];
      if (matches.length !== 1) throw new Error(`probe ${probe} expected once, found ${matches.length}`);
      const element = matches[0];
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const isVisible = !element.hidden
        && style.display !== "none"
        && style.visibility !== "hidden"
        && style.visibility !== "collapse"
        && element.getClientRects().length > 0;
      domProbes[probe] = {
        tag: element.tagName.toLowerCase(),
        text: isVisible ? element.innerText.replace(/\s+/g, " ").trim() : "",
        visible: isVisible,
        bounds: { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) },
      };
      computedStyles[probe] = Object.fromEntries(properties.map((property) => [property, style[property]]));
    }
    return {
      dom_facts: {
        title: document.title,
        lang: document.documentElement.lang,
        token_set_id: document.documentElement.dataset.oracleTokens ?? null,
        viewport: { width: innerWidth, height: innerHeight },
        document: { scroll_width: document.documentElement.scrollWidth, scroll_height: document.documentElement.scrollHeight },
        landmarks: ["header", "nav", "main"].map((selector) => ({ selector, count: document.querySelectorAll(selector).length })),
        probes: domProbes,
      },
      computed_styles: computedStyles,
    };
  }, { probes: requiredProbes, properties: styleProperties });
}

async function captureOne(browser, arm, viewport, tokens, outputRelative, artifactRoot, options = {}) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const failures = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => { globalThis.__ORACLE_TOKENS__ = value; }, tokens);
    await page.goto(pathToFileURL(path.join(repoRoot, arm.fixture_path)).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}" });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const viewportSize = page.viewportSize();
    const innerSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    if (viewportSize?.width !== viewport.width || viewportSize?.height !== viewport.height
      || innerSize.width !== viewport.width || innerSize.height !== viewport.height) {
      throw new Error(`viewport drift: expected ${viewport.width}x${viewport.height}, received ${innerSize.width}x${innerSize.height}`);
    }
    const { dom_facts: domFacts, computed_styles: computedStyles } = await collectPageEvidence(page);
    if (domFacts.token_set_id !== tokens.token_set_id) throw new Error("fixture did not consume the canonical token set");
    const clippedProbes = findClippedProbes(domFacts);
    if (clippedProbes.length > 0) throw new Error(`viewport clipping: ${clippedProbes.join(", ")}`);
    if (failures.length > 0) throw new Error(failures.join("; "));
    const screenshotAbsolute = path.join(artifactRoot, "artifacts", `${arm.id}-${viewport.id}.png`);
    fs.mkdirSync(path.dirname(screenshotAbsolute), { recursive: true });
    await page.screenshot({ path: screenshotAbsolute, fullPage: false, animations: "disabled" });
    if (options.afterScreenshot) await options.afterScreenshot(page, { arm, viewport });
    // Screenshot and page-error events can be delivered after the screenshot
    // promise resolves. Give both the page and Node event loop a turn, then
    // fail before any capture can be accepted.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await new Promise((resolve) => setImmediate(resolve));
    if (failures.length > 0) throw new Error(failures.join("; "));
    const screenshotSha256 = hashBytes(fs.readFileSync(screenshotAbsolute));
    return {
      capture: {
        arm_id: arm.id,
        viewport_id: viewport.id,
        screenshot_path: relativeArtifactPath(arm.id, viewport.id, screenshotSha256),
        screenshot_sha256: screenshotSha256,
        dom_facts: domFacts,
        dom_sha256: hashCanonicalJson(domFacts),
        computed_styles: computedStyles,
        style_sha256: hashCanonicalJson(computedStyles),
      },
      staged_absolute: screenshotAbsolute,
    };
  } finally {
    await page.close();
  }
}

function assertExistingComponentsAreRealDirectories(repoRelativePath) {
  const repoReal = fs.realpathSync(repoRoot);
  let current = repoRoot;
  for (const segment of repoRelativePath.split("/")) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`output path contains a symbolic link: ${repoRelativePath}`);
    if (!stat.isDirectory()) throw new Error(`output path component is not a directory: ${repoRelativePath}`);
    const expectedReal = path.join(repoReal, ...path.relative(repoRoot, current).split(path.sep));
    if (fs.realpathSync(current) !== expectedReal) throw new Error(`output path escapes its realpath boundary: ${repoRelativePath}`);
  }
}

function ensureSafeDirectoryChain(repoRelativePath) {
  let current = repoRoot;
  for (const segment of repoRelativePath.split("/")) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      fs.mkdirSync(current);
      stat = fs.lstatSync(current);
    }
    if (stat.isSymbolicLink()) throw new Error(`output path contains a symbolic link: ${repoRelativePath}`);
    if (!stat.isDirectory()) throw new Error(`output path component is not a directory: ${repoRelativePath}`);
  }
  assertExistingComponentsAreRealDirectories(repoRelativePath);
}

export function resolveOutput(outputRelative) {
  assertRepoRelativePath(outputRelative);
  if (!outputRelative.startsWith(`${outputRootRelative}/`)) {
    throw new Error(`output must be inside the dedicated output root ${outputRootRelative}/`);
  }
  const absolute = path.resolve(repoRoot, outputRelative);
  if (!absolute.startsWith(`${outputRootAbsolute}${path.sep}`)) {
    throw new Error(`output must be inside the dedicated output root ${outputRootRelative}/`);
  }
  assertExistingComponentsAreRealDirectories(outputRelative);
  return absolute;
}

function readManifest(manifestAbsolute) {
  try {
    return JSON.parse(fs.readFileSync(manifestAbsolute, "utf8"));
  } catch {
    return null;
  }
}

function referencedArtifacts(manifest) {
  return new Set((manifest?.captures ?? []).map((capture) => capture?.screenshot_path).filter(Boolean));
}

function resolveArtifact(outputAbsolute, relative) {
  assertRepoRelativePath(relative);
  if (!relative.startsWith("artifacts/") || relative === "artifacts/") {
    throw new Error(`artifact path must be output-root-relative: ${relative}`);
  }
  const artifactsAbsolute = path.join(outputAbsolute, "artifacts");
  const absolute = path.resolve(outputAbsolute, relative);
  if (!absolute.startsWith(`${artifactsAbsolute}${path.sep}`)) {
    throw new Error(`artifact path escapes publication root: ${relative}`);
  }
  return absolute;
}

function syncPath(absolute) {
  const descriptor = fs.openSync(absolute, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function removeCreatedArtifacts(createdPaths, manifestAbsolute) {
  const committedReferences = referencedArtifacts(readManifest(manifestAbsolute));
  for (const artifact of createdPaths) {
    if (!committedReferences.has(artifact.relative)) fs.rmSync(artifact.absolute, { force: true });
  }
}

function hashExistingArtifact(absolute) {
  const before = fs.lstatSync(absolute);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`existing artifact must be a regular file and not a symbolic link: ${path.basename(absolute)}`);
  }
  const descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`existing artifact changed during verification: ${path.basename(absolute)}`);
    }
    return hashBytes(fs.readFileSync(descriptor));
  } finally {
    fs.closeSync(descriptor);
  }
}

function lstatMaybe(absolute) {
  try {
    return fs.lstatSync(absolute);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function acquirePublicationLock(lockAbsolute, options = {}) {
  const ownerToken = randomUUID();
  // Never steal or expire this lock automatically. If a crashed publisher
  // leaves it behind, an operator must confirm no publisher is active, remove
  // <output>/.publish.lock manually, and retry.
  let descriptor;
  try {
    descriptor = fs.openSync(lockAbsolute, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("active publication lock exists; verify no publisher is active, remove it manually, and retry");
    }
    throw error;
  }
  const opened = fs.fstatSync(descriptor);
  try {
    const payload = `${JSON.stringify({ version: 1, owner_token: ownerToken })}\n`;
    (options.writeLock ?? fs.writeFileSync)(descriptor, payload);
    (options.syncLock ?? fs.fsyncSync)(descriptor);
  } catch (error) {
    fs.closeSync(descriptor);
    descriptor = undefined;
    const current = lstatMaybe(lockAbsolute);
    if (current && current.dev === opened.dev && current.ino === opened.ino) {
      fs.rmSync(lockAbsolute, { force: true });
    }
    throw error;
  }
  return { descriptor, ownerToken };
}

function releasePublicationLock(lockAbsolute, lock) {
  fs.closeSync(lock.descriptor);
  try {
    const current = JSON.parse(fs.readFileSync(lockAbsolute, "utf8"));
    if (current.owner_token === lock.ownerToken) fs.rmSync(lockAbsolute, { force: true });
  } catch {
    // Never remove a lock whose ownership cannot be proven.
  }
}

export async function publishEvidence(outputAbsolute, manifest, stagedArtifacts, options = {}) {
  const outputRelative = path.relative(repoRoot, path.resolve(outputAbsolute)).split(path.sep).join("/");
  if (resolveOutput(outputRelative) !== path.resolve(outputAbsolute)) throw new Error("publication output boundary mismatch");
  const manifestErrors = validateEvidenceManifest(manifest);
  if (manifestErrors.some((entry) => entry.code === "public_safe")) {
    throw new Error(`public-safe evidence validation failed: ${JSON.stringify(manifestErrors)}`);
  }
  if (manifestErrors.length > 0) throw new Error(`evidence validation failed: ${JSON.stringify(manifestErrors)}`);
  assertPublicSafe(manifest);
  ensureSafeDirectoryChain(outputRelative);
  const artifactsAbsolute = path.join(outputAbsolute, "artifacts");
  ensureSafeDirectoryChain(`${outputRelative}/artifacts`);
  const manifestAbsolute = path.join(outputAbsolute, "manifest.json");
  const lockAbsolute = path.join(outputAbsolute, ".publish.lock");
  const manifestTempAbsolute = `${manifestAbsolute}.tmp-${randomUUID()}`;
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const createdArtifacts = [];
  let lock;
  let committed = false;
  const sync = options.syncPath ?? syncPath;
  try {
    lock = acquirePublicationLock(lockAbsolute, options);
    const existingManifest = readManifest(manifestAbsolute);
    if (existingManifest && validateEvidenceManifest(existingManifest).length === 0) {
      throw new Error("accepted manifest already exists; choose a new run directory");
    }
    for (const staged of stagedArtifacts) {
      const targetAbsolute = resolveArtifact(outputAbsolute, staged.capture.screenshot_path);
      if (lstatMaybe(targetAbsolute)) {
        if (hashExistingArtifact(targetAbsolute) !== staged.capture.screenshot_sha256) {
          throw new Error(`content-address collision: ${staged.capture.screenshot_path}`);
        }
        continue;
      }
      const artifactTempAbsolute = `${targetAbsolute}.tmp-${randomUUID()}`;
      try {
        fs.copyFileSync(staged.staged_absolute, artifactTempAbsolute, fs.constants.COPYFILE_EXCL);
        if (hashBytes(fs.readFileSync(artifactTempAbsolute)) !== staged.capture.screenshot_sha256) {
          throw new Error(`staged artifact verification failed: ${staged.capture.screenshot_path}`);
        }
        sync(artifactTempAbsolute);
        try {
          fs.linkSync(artifactTempAbsolute, targetAbsolute);
          createdArtifacts.push({ relative: staged.capture.screenshot_path, absolute: targetAbsolute });
          sync(artifactsAbsolute);
        } catch (error) {
          if (error.code !== "EEXIST" || hashExistingArtifact(targetAbsolute) !== staged.capture.screenshot_sha256) throw error;
        }
      } finally {
        fs.rmSync(artifactTempAbsolute, { force: true });
      }
    }

    fs.writeFileSync(manifestTempAbsolute, manifestBytes, { flag: "wx" });
    sync(manifestTempAbsolute);
    if (!Buffer.from(`${JSON.stringify(JSON.parse(fs.readFileSync(manifestTempAbsolute, "utf8")), null, 2)}\n`).equals(manifestBytes)) {
      throw new Error("temporary manifest verification failed");
    }
    const artifactErrors = verifyArtifactHashes(manifest, outputAbsolute);
    if (artifactErrors.length > 0) throw new Error(`evidence validation failed: ${JSON.stringify(artifactErrors)}`);
    if (options.verifyPublished) await options.verifyPublished({ manifest, manifest_temp_path: manifestTempAbsolute });
    if (options.beforeCommitMarker) await options.beforeCommitMarker({ manifest });

    // This single rename is the commit marker. A successful run directory is
    // immutable; subsequent captures must choose a fresh directory.
    fs.renameSync(manifestTempAbsolute, manifestAbsolute);
    committed = true;
    try {
      sync(outputAbsolute);
    } catch (cause) {
      const error = new Error("evidence manifest committed; directory durability sync is uncertain", { cause });
      error.code = "EVIDENCE_COMMITTED_DURABILITY_UNCERTAIN";
      error.publication = {
        committed: true,
        durability: "uncertain",
        manifest_authoritative: true,
        manifest_path: path.posix.join(outputRelative, "manifest.json"),
        manifest_file_sha256: hashBytes(manifestBytes),
      };
      throw error;
    }
    // No automatic artifact GC: every immutable generation remains available
    // to readers holding a previously committed manifest. Reclamation is an
    // explicit offline/manual maintenance operation.
    return { manifestAbsolute, manifestBytes };
  } finally {
    fs.rmSync(manifestTempAbsolute, { force: true });
    if (!committed) removeCreatedArtifacts(createdArtifacts, manifestAbsolute);
    if (lock) releasePublicationLock(lockAbsolute, lock);
  }
}

export async function captureEvidence(outputRelative, options = {}) {
  // This is intentionally the first operation: callers of the exported API
  // receive the same path containment guarantee as the CLI, before any load,
  // browser launch, directory creation, or artifact write.
  const outputAbsolute = resolveOutput(outputRelative);
  const acceptedManifest = readManifest(path.join(outputAbsolute, "manifest.json"));
  if (acceptedManifest && validateEvidenceManifest(acceptedManifest).length === 0) {
    throw new Error("accepted manifest already exists; choose a new run directory");
  }
  const parentAbsolute = path.dirname(outputAbsolute);
  ensureSafeDirectoryChain(path.posix.dirname(outputRelative));
  const stagingAbsolute = fs.mkdtempSync(path.join(parentAbsolute, `.${path.basename(outputAbsolute)}.staging-`));
  const loadContracts = options.loadContracts ?? (() => loadContractPair(repoRoot, scenarioPath));
  const launchBrowser = options.launchBrowser ?? (() => chromium.launch({ headless: true }));
  const captureArm = options.captureArm ?? captureOne;
  const publish = options.publish ?? publishEvidence;
  let browser = options.browser;
  let ownsBrowser = false;
  const closeOwnedBrowser = async () => {
    if (!ownsBrowser || !browser) return;
    const ownedBrowser = browser;
    browser = undefined;
    await ownedBrowser.close();
  };
  const captures = [];
  const stagedArtifacts = [];
  try {
    const { scenario, tokens, errors } = loadContracts();
    if (errors.length > 0) throw new Error(`contract validation failed: ${JSON.stringify(errors)}`);
    if (!browser) {
      browser = await launchBrowser();
      ownsBrowser = true;
    }
    for (const arm of scenario.arms) {
      for (const viewport of scenario.viewports) {
        const staged = await captureArm(browser, arm, viewport, tokens, outputRelative, stagingAbsolute, options);
        captures.push(staged.capture);
        stagedArtifacts.push(staged);
      }
    }
    await closeOwnedBrowser();
    const manifest = normalizeEvidenceManifest({
      schema_version: 1,
      scenario_id: scenario.scenario_id,
      captured_at: new Date().toISOString(),
      runtime: { browser: "chromium", playwright: readPlaywrightVersion(), platform: publicPlatform() },
      viewports: scenario.viewports,
      arms: scenario.arms.map((arm) => arm.id),
      captures,
    });
    const manifestErrors = validateEvidenceManifest(manifest);
    if (manifestErrors.length > 0) throw new Error(`evidence validation failed: ${JSON.stringify(manifestErrors)}`);
    assertPublicSafe(manifest);
    const { manifestBytes } = await publish(outputAbsolute, manifest, stagedArtifacts, options);
    const manifestPath = path.posix.join(outputRelative, "manifest.json");
    return {
      manifest_path: manifestPath,
      manifest_file_sha256: hashBytes(manifestBytes),
      manifest_canonical_sha256: hashCanonicalJson(manifest),
      screenshot_count: manifest.captures.length,
    };
  } finally {
    try {
      await closeOwnedBrowser();
    } finally {
      fs.rmSync(stagingAbsolute, { recursive: true, force: true });
    }
  }
}

async function main() {
  const output = parseOutputArgument(process.argv.slice(2));
  const receipt = await captureEvidence(output.relative);
  assertPublicSafe(receipt);
  console.log(`${canonicalJson(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error.code === "EVIDENCE_COMMITTED_DURABILITY_UNCERTAIN") {
      console.error(canonicalJson({ error: error.code, ...error.publication }));
    }
    console.error(`taste-oracle capture failed: ${error.message}`);
    process.exitCode = 1;
  });
}
