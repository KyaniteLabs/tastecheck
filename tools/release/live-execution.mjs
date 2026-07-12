#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { computeSourceTreeSha256 } from "./engineering-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCER = Object.freeze({ id: "tastecheck-live-execution", version: 1 });
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/;
const NONCE = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const check = (id, passed, detail) => ({ id, passed: Boolean(passed), detail });

export function deriveStatus(checks) {
  return Array.isArray(checks) && checks.length > 0 && checks.every((entry) => entry?.passed === true) ? "pass" : "fail";
}

export function deriveReproducible(checks, artifacts) {
  return deriveStatus(checks) === "pass"
    && Array.isArray(artifacts)
    && artifacts.length > 0
    && artifacts.every((entry) => (
      typeof entry?.id === "string"
      && typeof entry?.path === "string"
      && SAFE_RELATIVE.test(entry.path)
      && SHA256.test(entry.sha256)
      && Number.isInteger(entry.bytes)
      && entry.bytes > 0
    ));
}

function assertRelative(value, label) {
  if (typeof value !== "string" || !SAFE_RELATIVE.test(value) || value.endsWith("/")) throw new Error(`${label} must be a normalized repo-relative path`);
  const absolute = path.resolve(root, value);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error(`${label} escapes repository root`);
  return absolute;
}

function parseArgs(argv) {
  const kind = argv.shift();
  if (!["browser", "e2e"].includes(kind)) throw new Error("usage: live-execution.mjs <browser|e2e> --out <path> --artifact-dir <path> --nonce <nonce>");
  const values = {};
  while (argv.length) {
    const flag = argv.shift();
    if (!["--out", "--artifact-dir", "--nonce"].includes(flag) || !argv.length) throw new Error(`invalid argument ${flag ?? ""}`.trim());
    if (values[flag]) throw new Error(`duplicate argument ${flag}`);
    values[flag] = argv.shift();
  }
  if (!values["--out"] || !values["--artifact-dir"] || !values["--nonce"]) throw new Error("--out, --artifact-dir, and --nonce are required");
  if (!NONCE.test(values["--nonce"])) throw new Error("nonce must be 16-128 public-safe characters");
  return { kind, out: values["--out"], artifactDir: values["--artifact-dir"], nonce: values["--nonce"] };
}

function sourceTreeHash() {
  return computeSourceTreeSha256(root);
}

function publicPlatform() {
  return ["darwin", "linux", "win32"].includes(process.platform) ? process.platform : "other";
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

async function withServer(run) {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const absolute = assertRelative(relative, "request path");
      const stat = fs.statSync(absolute);
      const file = stat.isDirectory() ? path.join(absolute, "index.html") : absolute;
      response.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const address = server.address();
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function storeArtifact(artifactDirRelative, id, bytes) {
  const digest = hash(bytes);
  if (!SHA256.test(digest)) throw new Error("artifact hashing failed");
  const relative = path.posix.join(artifactDirRelative, `${id}-${digest}.png`);
  const absolute = assertRelative(relative, "artifact path");
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  if (fs.existsSync(absolute)) {
    if (!fs.readFileSync(absolute).equals(bytes)) throw new Error(`content-addressed artifact collision: ${relative}`);
  } else {
    const temporary = `${absolute}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    fs.renameSync(temporary, absolute);
  }
  return { id, path: relative, sha256: digest, bytes: bytes.length };
}

async function inspectSurface(browser, baseUrl, surface, route, viewport, artifactDir, checks, artifacts) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    checks.push(check(`${surface}-${viewport.id}-http`, response?.ok() === true, response?.ok() ? "HTTP surface loaded" : "HTTP surface did not load"));
    const measurements = await page.evaluate(() => ({
      title: document.title.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: document.querySelectorAll("main").length,
    }));
    checks.push(check(`${surface}-${viewport.id}-title`, measurements.title.length > 0, "Document title is present"));
    checks.push(check(`${surface}-${viewport.id}-main`, measurements.main === 1, "Exactly one main landmark is rendered"));
    checks.push(check(`${surface}-${viewport.id}-no-overflow`, measurements.overflow <= 1, "No horizontal viewport overflow"));
    await new Promise((resolve) => setImmediate(resolve));
    checks.push(check(`${surface}-${viewport.id}-no-console-errors`, errors.length === 0, errors.length ? `${errors.length} browser error events` : "No console or page errors"));
    const bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
    artifacts.push(storeArtifact(artifactDir, `${surface}-${viewport.id}`, bytes));
  } finally {
    await page.close();
  }
}

async function runBrowser(browser, artifactDir) {
  const checks = [];
  const artifacts = [];
  const surfaces = [
    ["landing", "/index.html"],
    ["gallery", "/samples/index.html"],
    ["integration", "/demos/skill-integration.html"],
  ];
  const viewports = [{ id: "desktop", width: 1440, height: 1000 }, { id: "mobile", width: 390, height: 844 }];
  await withServer(async (baseUrl) => {
    for (const [surface, route] of surfaces) {
      for (const viewport of viewports) await inspectSurface(browser, baseUrl, surface, route, viewport, artifactDir, checks, artifacts);
    }
  });
  return { checks, artifacts };
}

function validateInstall(checks) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tastecheck-live-install-"));
  try {
    fs.mkdirSync(path.join(home, ".claude"));
    const output = execFileSync("bash", ["install.sh", "--yes"], { cwd: root, env: { ...process.env, HOME: home }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const skills = JSON.parse(fs.readFileSync(path.join(root, "skills.json"), "utf8")).skills.map((entry) => entry.name).sort();
    const installed = fs.readdirSync(path.join(home, ".agents", "skills")).sort();
    const linksValid = installed.every((name) => {
      const link = path.join(home, ".agents", "skills", name);
      return fs.lstatSync(link).isSymbolicLink() && fs.realpathSync(link) === path.join(root, "skills", name);
    });
    checks.push(check("install-command-completed", output.includes("Done. Canonical skills"), "Installer completed non-interactively"));
    checks.push(check("install-canonical-skills", JSON.stringify(installed) === JSON.stringify(skills) && linksValid, `${installed.length} canonical skill links verified`));
    const expectedCommands = fs.readdirSync(path.join(root, "commands")).filter((name) => name.endsWith(".md")).sort();
    const installedCommands = fs.readdirSync(path.join(home, ".claude", "commands")).filter((name) => name.endsWith(".md")).sort();
    const commandsValid = installedCommands.every((name) => fs.lstatSync(path.join(home, ".claude", "commands", name)).isSymbolicLink());
    checks.push(check("install-operator-commands", JSON.stringify(installedCommands) === JSON.stringify(expectedCommands) && commandsValid, `${installedCommands.length} operator command links verified`));
  } catch {
    checks.push(check("install-command-completed", false, "Installer failed"));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

async function runOperatorE2E(browser, artifactDir) {
  const checks = [];
  const artifacts = [];
  validateInstall(checks);
  await withServer(async (baseUrl) => {
    for (const viewport of [{ id: "desktop", width: 1440, height: 1000 }, { id: "mobile", width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const response = await page.goto(`${baseUrl}/demos/skill-integration.html`, { waitUntil: "networkidle" });
        checks.push(check(`operator-${viewport.id}-http`, response?.ok() === true, "Integration surface loaded"));
        const result = await page.evaluate(() => {
          const api = window.tastecheckIntegration;
          api.setTheme("dark"); const dark = document.documentElement.dataset.theme === "dark";
          api.setTheme("contrast"); const contrast = document.documentElement.dataset.theme === "contrast";
          api.cycleState(); const loading = document.querySelector('[data-test="primary-action"]').getAttribute("aria-busy") === "true";
          api.submitInvalid(); const invalid = document.querySelector('[data-test="form-status"]').textContent.includes("Fix the highlighted");
          const valid = api.submitValid().includes("12 cilantro bunches saved");
          api.showEmpty(); const empty = document.querySelector('[data-test="task-list"]').textContent.includes("No prep gaps");
          api.showError(); const error = document.querySelector('[data-test="task-list"]').textContent.includes("Supplier feed unavailable");
          api.retryList(); const retryText = document.querySelector('[data-test="task-list"]').textContent; const retry = retryText.includes("Cold line") && retryText.includes("Grill");
          return { skillCount: api.skillCount, dark, contrast, loading, invalid, valid, empty, error, retry };
        });
        if (viewport.id === "desktop") {
          checks.push(check("operator-skill-coverage", result.skillCount === 19, "All 19 skills exposed by browser contract"));
          checks.push(check("operator-theme-paths", result.dark && result.contrast, "Dark and high-contrast paths executed"));
          checks.push(check("operator-component-state", result.loading, "Loading component state executed"));
          checks.push(check("operator-invalid-form", result.invalid, "Invalid form path executed"));
          checks.push(check("operator-valid-form", result.valid, "Valid form path executed"));
          checks.push(check("operator-empty-state", result.empty, "Empty state executed"));
          checks.push(check("operator-error-state", result.error, "Error state executed"));
          checks.push(check("operator-retry-state", result.retry, "Retry recovery executed"));
        }
        checks.push(check(`operator-${viewport.id}-no-overflow`, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), "No horizontal viewport overflow"));
        checks.push(check(`operator-${viewport.id}-no-console-errors`, errors.length === 0, errors.length ? `${errors.length} browser error events` : "No console or page errors"));
        const bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
        artifacts.push(storeArtifact(artifactDir, `operator-${viewport.id}`, bytes));
      } finally {
        await page.close();
      }
    }
  });
  return { checks, artifacts };
}

function writeReceipt(relative, receipt) {
  const absolute = assertRelative(relative, "receipt path");
  if (fs.existsSync(absolute)) throw new Error("accepted receipt already exists; choose a new output path or remove it explicitly before a new run");
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, canonical(receipt), { flag: "wx" });
  fs.renameSync(temporary, absolute);
}

export async function produceLiveReceipt({ kind, out, artifactDir, nonce }) {
  assertRelative(out, "receipt path");
  assertRelative(path.posix.join(artifactDir, "placeholder"), "artifact directory");
  if (!NONCE.test(nonce)) throw new Error("nonce must be 16-128 public-safe characters");
  const startedAt = new Date().toISOString();
  const sourceTreeSha256 = sourceTreeHash();
  const playwrightVersion = JSON.parse(fs.readFileSync(path.join(root, "node_modules/playwright/package.json"), "utf8")).version;
  const browser = await chromium.launch({ headless: true });
  try {
    const execution = kind === "browser" ? await runBrowser(browser, artifactDir) : await runOperatorE2E(browser, artifactDir);
    const receipt = {
      schema_version: 1,
      kind,
      producer_id: "tastecheck.release.live-execution.v1",
      producer: PRODUCER,
      source_tree_sha256: sourceTreeSha256,
      nonce,
      runtime: { node: process.version, playwright: playwrightVersion, browser: browser.version(), platform: publicPlatform() },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      executed: true,
      reproducible: deriveReproducible(execution.checks, execution.artifacts),
      artifacts: execution.artifacts,
      checks: execution.checks,
      status: deriveStatus(execution.checks),
    };
    writeReceipt(out, receipt);
    if (receipt.status !== "pass") throw new Error(`live ${kind} checks failed; failing receipt preserved at ${out}`);
    return receipt;
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const receipt = await produceLiveReceipt(options);
  console.log(canonical({ path: options.out, sha256: hash(canonical(receipt)), status: receipt.status }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`live execution failed: ${error.message}`); process.exitCode = 1; });
}
