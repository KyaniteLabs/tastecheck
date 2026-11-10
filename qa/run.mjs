#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  createReadStream, existsSync, mkdirSync, readdirSync, lstatSync, readlinkSync,
  readFileSync, writeFileSync, statSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.mjs";
import {
  Blocked, countStatuses, createRunState, exitCodeFor, pathStatusFor, runnerProvenance,
} from "./run-state.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_BIN = resolve(ROOT, "bin/tastecheck.mjs");
const DIMENSIONS = ["ref", "vibe", "mode", "sig"];
const MIME = new Map([
  [".html", "text/html; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".svg", "image/svg+xml"], [".png", "image/png"],
  [".ico", "image/x-icon"], [".txt", "text/plain; charset=utf-8"],
]);

class CheckFailed extends Error {}
const fail = (message) => { throw new CheckFailed(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };

function findOnPath(command) {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":")) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = join(dir, command + extension);
      if (existsSync(candidate)) return resolve(candidate);
    }
  }
  return null;
}

async function findChrome() {
  const requested = process.env.TASTECHECK_CHROME || process.env.CHROME_PATH;
  const candidates = [requested, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome"];
  for (const candidate of candidates.filter(Boolean)) {
    const executable = isAbsolute(candidate) || candidate.includes("/") || candidate.includes("\\")
      ? resolve(candidate) : findOnPath(candidate);
    if (!executable || !existsSync(executable)) continue;
    const version = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (version.status === 0) return { executable, version: (version.stdout || version.stderr || "").trim() };
  }
  try {
    const { chromium } = await import("playwright");
    const executable = chromium.executablePath();
    if (existsSync(executable)) {
      const version = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 10_000 });
      if (version.status === 0) return { executable, version: (version.stdout || version.stderr || "").trim() };
    }
  } catch { /* Playwright may be absent; report a blocked browser path below. */ }
  return null;
}

function minimalEnv(home, chromePath, stateRoot = home) {
  const result = {};
  const allow = ["PATH", "SystemRoot", "WINDIR", "PATHEXT", "COMSPEC", "LANG", "LC_ALL", "LC_CTYPE", "TZ"];
  for (const key of allow) if (process.env[key]) result[key] = process.env[key];
  result.HOME = home;
  result.USERPROFILE = home;
  result.XDG_CONFIG_HOME = join(stateRoot, "config");
  result.XDG_DATA_HOME = join(stateRoot, "data");
  result.XDG_CACHE_HOME = join(stateRoot, "cache");
  result.XDG_STATE_HOME = join(stateRoot, "state");
  result.TMPDIR = tmpdir();
  result.TMP = result.TMPDIR;
  result.TEMP = result.TMPDIR;
  result.CI = "1";
  if (chromePath) {
    result.TASTECHECK_CHROME = chromePath;
    result.CHROME_PATH = chromePath;
  }
  for (const dir of [result.XDG_CONFIG_HOME, result.XDG_DATA_HOME, result.XDG_CACHE_HOME, result.XDG_STATE_HOME, result.TMPDIR]) {
    mkdirSync(dir, { recursive: true });
  }
  return result;
}

function readPackage() {
  return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
}

function assertSkillLinks(home) {
  const source = resolve(ROOT, "skills");
  const names = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  requireThat(names.length === 20, `expected 20 source skills, found ${names.length}`);
  const installedDir = join(home, ".agents", "skills");
  const installed = readdirSync(installedDir).sort();
  requireThat(installed.length === 20, `expected 20 installed skill links, found ${installed.length}`);
  requireThat(JSON.stringify(installed) === JSON.stringify(names), "installed names differ from the 20 source skills");
  for (const name of names) {
    const link = join(installedDir, name);
    requireThat(lstatSync(link).isSymbolicLink(), `${name} is not a symlink`);
    const rawTarget = readlinkSync(link);
    const target = resolve(dirname(link), rawTarget);
    requireThat(target === resolve(source, name), `${name} points to ${target}, not this checkout`);
  }
  return names.length;
}

function assertNoRepositoryLinks(home) {
  const candidates = [".agents", ".claude", ".codex", ".gemini", ".cursor", ".kilocode", ".kimi"];
  const prefix = `${resolve(ROOT, "skills")}${sep}`;
  for (const agentHome of candidates) {
    const dir = join(home, agentHome, "skills");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (!lstatSync(file).isSymbolicLink()) continue;
      const target = resolve(dirname(file), readlinkSync(file));
      requireThat(!target.startsWith(prefix), `repository skill link remains after uninstall: ${agentHome}/${name}`);
    }
  }
}

function childCommand(ctx, label, executable, args, options = {}) {
  const cwd = options.cwd || ROOT;
  ctx.log(`$ ${label} ${JSON.stringify(args)}`);
  const result = spawnSync(executable, args, {
    cwd,
    env: ctx.env,
    encoding: "utf8",
    timeout: options.timeout || 120_000,
    maxBuffer: 12 * 1024 * 1024,
  });
  ctx.log(`exit: ${result.status === null ? "null" : result.status}${result.signal ? `; signal: ${result.signal}` : ""}`);
  if (result.error) ctx.log(`spawn error: ${result.error.message}`);
  if (result.stdout) ctx.log(`stdout:\n${result.stdout.replace(/\n$/, "")}`);
  if (result.stderr) ctx.log(`stderr:\n${result.stderr.replace(/\n$/, "")}`);
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "", error: result.error };
}

function assertExit(result, expected, description) {
  requireThat(result.status === expected, `${description}: expected exit ${expected}, got ${result.status}${result.error ? ` (${result.error.message})` : ""}`);
}

async function startStaticServer() {
  const server = createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname); }
    catch { response.writeHead(400).end("bad URL"); return; }
    const relativePath = pathname.replace(/^\/+/, "") || "index.html";
    let file = resolve(ROOT, relativePath);
    if (file !== ROOT && !file.startsWith(`${ROOT}${sep}`)) { response.writeHead(403).end("forbidden"); return; }
    if (!existsSync(file)) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found"); return; }
    try {
      const stat = statSync(file);
      if (stat.isDirectory()) {
        const index = join(file, "index.html");
        if (existsSync(index)) file = index;
        else {
          const entries = readdirSync(file).sort().map((entry) => `<li><a href="${encodeURIComponent(entry)}">${escapeHtml(entry)}</a></li>`).join("");
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><title>Index</title><ul>${entries}</ul>`);
          return;
        }
      }
      response.writeHead(200, { "Content-Type": MIME.get(extname(file).toLowerCase()) || "application/octet-stream", "Cache-Control": "no-store" });
      createReadStream(file).on("error", () => { if (!response.headersSent) response.writeHead(500); response.end("read error"); }).pipe(response);
    } catch {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("server error");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function readUiState(page) {
  return page.evaluate(() => {
    const inventory = JSON.parse(document.getElementById("tasteroll-inventory").textContent);
    const id = document.documentElement.getAttribute("data-roll");
    const row = inventory.rolls.find((candidate) => candidate.id === id) || null;
    const attrs = Object.fromEntries(["ref", "vibe", "mode", "sig"].map((dim) => [dim, document.documentElement.getAttribute(`data-${dim}`)]));
    return {
      inventoryCount: inventory.rolls.length,
      id,
      row,
      attrs,
      displayedRoll: document.getElementById("rollId")?.textContent?.trim(),
      heroRoll: document.getElementById("heroRollId")?.textContent?.trim(),
      live: document.getElementById("live")?.textContent?.trim() || "",
    };
  });
}

function assertValidUiState(state, label) {
  requireThat(state.inventoryCount === 1536, `${label}: expected 1536 inventory rows, got ${state.inventoryCount}`);
  requireThat(state.row !== null, `${label}: ${state.id} is not an inventory row`);
  requireThat(state.displayedRoll === state.id && state.heroRoll === state.id, `${label}: displayed roll ids do not match html[data-roll]`);
  for (const dimension of DIMENSIONS) requireThat(state.attrs[dimension] === state.row[dimension], `${label}: data-${dimension} does not match inventory row ${state.id}`);
}

async function getBrowser(runtime, home, stateRoot) {
  if (!runtime.chrome) throw new Blocked("Chromium/Chrome is not installed or could not be launched");
  if (runtime.browser) return runtime.browser;
  let playwright;
  try { playwright = await import("playwright"); }
  catch (error) { throw new Blocked(`Playwright is unavailable; install the locked project dependencies (npm ci): ${error.message}`); }
  try {
    runtime.browser = await playwright.chromium.launch({
      headless: true,
      executablePath: runtime.chrome.executable,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      env: minimalEnv(home, runtime.chrome.executable, stateRoot),
      timeout: 30_000,
    });
    runtime.log(`browser: ${runtime.chrome.version}`);
    return runtime.browser;
  } catch (error) {
    throw new Blocked(`Chromium launch failed: ${error.message}`);
  }
}

async function newUiPage(runtime, home, ctx, suffix = "") {
  if (!runtime.staticServer) runtime.staticServer = await startStaticServer();
  const browser = await getBrowser(runtime, home, ctx.stateRoot);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  if (ctx.id === "U5") {
    try { await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: runtime.staticServer.origin }); }
    catch (error) { ctx.log(`clipboard permissions unavailable: ${error.message}`); }
    await context.addInitScript(() => {
      window.__qaClipboardWrites = [];
      try {
        const nativeClipboard = navigator.clipboard;
        const nativeWrite = nativeClipboard.writeText.bind(nativeClipboard);
        const instrumented = Object.create(nativeClipboard);
        instrumented.writeText = async (text) => {
          window.__qaClipboardWrites.push(String(text));
          await nativeWrite(String(text));
        };
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: instrumented });
      } catch (error) { window.__qaClipboardError = String(error); }
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  const url = `${runtime.staticServer.origin}/tasteroll.html${suffix}`;
  try { await page.goto(url, { waitUntil: "load", timeout: 30_000 }); }
  catch (error) { await context.close(); throw new CheckFailed(`page failed to load ${url}: ${error.message}`); }
  return { context, page, errors, requests, url, origin: runtime.staticServer.origin };
}

function closeUi(ui) { return ui.context.close(); }

async function runPath(path, runtime, outputDir) {
  const lines = [`# ${path.id} — ${path.surface}`, `Action: ${path.action}`, `Expected: ${path.expected}`, `Fixtures: ${path.fixtures.join(", ") || "none"}`];
  const home = runtime.runState.home(path.id);
  const stateRoot = runtime.runState.xdg(path.id);
  mkdirSync(home, { recursive: true });
  const env = minimalEnv(home, runtime.chrome?.executable, stateRoot);
  const ctx = {
    id: path.id,
    env,
    home,
    stateRoot,
    log: (line) => lines.push(String(line)),
    exec: (label, executable, args, options) => childCommand(ctx, label, executable, args, options),
    cli: (args, options) => childCommand(ctx, "node bin/tastecheck.mjs", process.execPath, [PACKAGE_BIN, ...args], options),
    profile: (args, options) => childCommand(ctx, "node bin/tastecheck.mjs profile", process.execPath, [PACKAGE_BIN, "profile", ...args], options),
  };
  let failure = null;
  const started = Date.now();
  try {
    requireThat(readdirSync(home).length === 0, `${path.id}: HOME must be empty before its operator path starts`);
    ctx.log("HOME starts empty; XDG config/data/cache/state are isolated separately");
    switch (path.operation) {
      case "install.bash-fresh": {
        if (!findOnPath("bash")) throw new Blocked("bash is required for install.sh operator paths");
        const result = ctx.exec("bash install.sh", "bash", [resolve(ROOT, "install.sh"), "--no-commands"]);
        assertExit(result, 0, path.id);
        ctx.log(`verified skill symlinks: ${assertSkillLinks(home)}`);
        break;
      }
      case "install.bash-idempotent": {
        if (!findOnPath("bash")) throw new Blocked("bash is required for install.sh operator paths");
        for (let index = 1; index <= 2; index++) {
          const result = ctx.exec(`bash install.sh pass ${index}`, "bash", [resolve(ROOT, "install.sh"), "--no-commands"]);
          assertExit(result, 0, `${path.id} pass ${index}`);
          ctx.log(`pass ${index} verified links: ${assertSkillLinks(home)}`);
        }
        break;
      }
      case "install.bash-uninstall": {
        if (!findOnPath("bash")) throw new Blocked("bash is required for install.sh operator paths");
        assertExit(ctx.exec("bash install.sh install", "bash", [resolve(ROOT, "install.sh"), "--no-commands"]), 0, `${path.id} install`);
        assertSkillLinks(home);
        assertExit(ctx.exec("bash install.sh uninstall", "bash", [resolve(ROOT, "install.sh"), "--uninstall"]), 0, `${path.id} uninstall`);
        assertNoRepositoryLinks(home);
        break;
      }
      case "install.node-fresh": {
        assertExit(ctx.cli(["install", "--no-commands"]), 0, path.id);
        ctx.log(`verified skill symlinks: ${assertSkillLinks(home)}`);
        break;
      }
      case "install.node-uninstall": {
        assertExit(ctx.cli(["install", "--no-commands"]), 0, `${path.id} install`);
        assertSkillLinks(home);
        assertExit(ctx.cli(["uninstall"]), 0, `${path.id} uninstall`);
        assertNoRepositoryLinks(home);
        break;
      }
      case "cli.version": {
        const result = ctx.cli(["--version"]);
        assertExit(result, 0, path.id);
        requireThat(result.stdout.trim() === String(readPackage().version), `version output ${JSON.stringify(result.stdout.trim())} differs from package.json`);
        break;
      }
      case "cli.usage": {
        const result = ctx.cli([]);
        assertExit(result, 0, path.id);
        requireThat(/Usage:/.test(result.stdout) && result.stderr === "", "usage did not print cleanly to stdout");
        break;
      }
      case "cli.unknown": {
        const result = ctx.cli(["bogus-command"]);
        assertExit(result, 2, path.id);
        requireThat(/unknown command: bogus-command/.test(result.stderr) && /Usage:/.test(result.stderr), "unknown-command error or usage text missing");
        break;
      }
      case "profile.show-empty": {
        const result = ctx.profile(["show"]);
        assertExit(result, 0, path.id);
        requireThat(/entries: 0/.test(result.stdout) && /every tell is judged by the defaults/.test(result.stdout), "empty profile/default behavior was not reported");
        requireThat(!existsSync(join(home, ".tastecheck", "profile.json")), "show unexpectedly created profile state");
        break;
      }
      case "profile.accept-reject": {
        assertExit(ctx.profile(["accept", "uniform-card-grid", "--reason", "intentional product catalog"]), 0, `${path.id} accept`);
        assertExit(ctx.profile(["reject", "pill-cta", "--reason", "do not ship template CTA"]), 0, `${path.id} reject`);
        const shown = ctx.profile(["show"]);
        assertExit(shown, 0, `${path.id} show`);
        requireThat(/uniform-card-grid: accept/.test(shown.stdout) && /pill-cta: reject/.test(shown.stdout) && /entries: 2/.test(shown.stdout), "accept/reject decisions not visible in show");
        break;
      }
      case "profile.export-import": {
        const exportFile = resolve(outputDir, "fixtures", "C6-profile-export.json");
        mkdirSync(dirname(exportFile), { recursive: true });
        assertExit(ctx.profile(["accept", "uniform-card-grid", "--reason", "round-trip fixture"]), 0, `${path.id} accept`);
        assertExit(ctx.profile(["export", exportFile]), 0, `${path.id} export`);
        const exported = JSON.parse(readFileSync(exportFile, "utf8"));
        requireThat(exported.entries.length === 1 && exported.entries[0].tell === "uniform-card-grid", "export did not contain the expected profile entry");
        assertExit(ctx.profile(["reset", "--yes"]), 0, `${path.id} reset before import`);
        assertExit(ctx.profile(["import", exportFile]), 0, `${path.id} import`);
        const shown = ctx.profile(["show"]);
        assertExit(shown, 0, `${path.id} show`);
        requireThat(/entries: 1/.test(shown.stdout) && /uniform-card-grid: accept/.test(shown.stdout), "import did not restore the exported decision");
        break;
      }
      case "profile.forget-reset": {
        assertExit(ctx.profile(["accept", "uniform-card-grid", "--reason", "forget test"]), 0, `${path.id} first accept`);
        const forgotten = ctx.profile(["forget", "uniform-card-grid"]);
        assertExit(forgotten, 0, `${path.id} forget`);
        requireThat(/forgot 1 decision/.test(forgotten.stdout), "forget did not remove exactly one decision");
        const shown = ctx.profile(["show"]);
        assertExit(shown, 0, `${path.id} show after forget`);
        requireThat(/entries: 0/.test(shown.stdout), "forgotten decision remains in profile");
        assertExit(ctx.profile(["accept", "pill-cta"]), 0, `${path.id} second accept`);
        const profileFile = join(home, ".tastecheck", "profile.json");
        requireThat(existsSync(profileFile), "profile was not created before reset");
        assertExit(ctx.profile(["reset", "--yes"]), 0, `${path.id} reset`);
        requireThat(!existsSync(profileFile), "reset did not remove the profile file");
        break;
      }
      case "profile.invalid-import": {
        assertExit(ctx.profile(["accept", "uniform-card-grid", "--reason", "preserve me"]), 0, `${path.id} seed profile`);
        const profileFile = join(home, ".tastecheck", "profile.json");
        const before = readFileSync(profileFile);
        const invalid = resolve(ROOT, "qa/fixtures/profile-invalid.json");
        const result = ctx.profile(["import", invalid]);
        assertExit(result, 2, path.id);
        requireThat(/refused/.test(result.stderr), "invalid import did not fail closed with a refusal");
        requireThat(readFileSync(profileFile).equals(before), "invalid import changed the existing profile bytes");
        break;
      }
      case "audit.ship":
      case "audit.hold-slop": {
        if (!runtime.chrome) throw new Blocked("No Chromium/Chrome executable is available for the audit");
        const target = path.operation === "audit.ship" ? resolve(ROOT, "tasteroll.html") : resolve(ROOT, "evals/taste/fixtures/slop/10-testimonial-cards.html");
        const expected = path.operation === "audit.ship" ? { code: 0, verdict: "SHIP" } : { code: 1, verdict: "HOLD" };
        const evidenceDir = resolve(outputDir, "evidence", path.id);
        mkdirSync(evidenceDir, { recursive: true });
        const result = ctx.cli(["audit", target, evidenceDir, "--json"], { timeout: 180_000 });
        assertExit(result, expected.code, path.id);
        const evidenceFile = join(evidenceDir, "evidence.json");
        requireThat(existsSync(evidenceFile), "audit did not retain evidence.json");
        const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
        requireThat(evidence.verdict === expected.verdict, `expected ${expected.verdict}, got ${evidence.verdict}`);
        requireThat(evidence.probes && Object.keys(evidence.probes).length >= 10, "audit evidence does not contain the expected probe set");
        if (expected.verdict === "HOLD") requireThat(Object.values(evidence.probes).some((probe) => probe.status === "fail"), "HOLD has no failed probe evidence");
        ctx.log(`evidence verdict: ${evidence.verdict}; probe count: ${Object.keys(evidence.probes).length}`);
        break;
      }
      case "audit.usage-error": {
        const result = ctx.cli(["audit"]);
        assertExit(result, 2, path.id);
        requireThat(/missing <url-or-path>/.test(result.stderr) && /Usage: tastecheck audit/.test(result.stderr), "missing-target usage error was not printed");
        break;
      }
      case "ui.cold-load": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          const state = await readUiState(ui.page);
          assertValidUiState(state, path.id);
          ctx.log(`initial state: ${JSON.stringify({ id: state.id, attrs: state.attrs, inventoryCount: state.inventoryCount })}`);
        } finally { await closeUi(ui); }
        break;
      }
      case "ui.roll": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          const before = await readUiState(ui.page);
          assertValidUiState(before, `${path.id} initial`);
          await ui.page.locator("#diceBtn").click();
          await ui.page.waitForFunction((oldId) => document.documentElement.dataset.roll !== oldId, before.id);
          const after = await readUiState(ui.page);
          assertValidUiState(after, `${path.id} after click`);
          requireThat(after.id !== before.id, "roll id did not change");
          requireThat(after.live.includes(after.id), "live region did not announce the new id");
          ctx.log(`roll changed ${before.id} -> ${after.id}; tuple ${JSON.stringify(after.attrs)}`);
        } finally { await closeUi(ui); }
        break;
      }
      case "ui.lock": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          let prior = await readUiState(ui.page);
          assertValidUiState(prior, `${path.id} initial`);
          const ref = prior.attrs.ref;
          const button = ui.page.locator('.lock[data-dim="ref"]');
          await button.click();
          requireThat(await button.getAttribute("aria-pressed") === "true", "ref lock did not set aria-pressed=true");
          const lockMessage = (await ui.page.locator("#live").textContent()) || "";
          requireThat(lockMessage.includes(`ref locked at ${ref}`), `lock live-region message missing: ${lockMessage}`);
          let changedUnlocked = false;
          for (let attempt = 0; attempt < 40 && !changedUnlocked; attempt++) {
            const previous = prior;
            await ui.page.locator("#diceBtn").click();
            await ui.page.waitForFunction((oldId) => document.documentElement.dataset.roll !== oldId, previous.id);
            prior = await readUiState(ui.page);
            assertValidUiState(prior, `${path.id} roll ${attempt + 1}`);
            requireThat(prior.attrs.ref === ref, `locked ref changed from ${ref} to ${prior.attrs.ref}`);
            changedUnlocked = DIMENSIONS.filter((dim) => dim !== "ref").some((dim) => prior.attrs[dim] !== previous.attrs[dim]);
          }
          requireThat(changedUnlocked, "no unlocked dimension changed in 40 valid rolls");
          requireThat(prior.live.includes(prior.id), "live region did not announce the roll");
          ctx.log(`ref stayed locked at ${ref}; unlocked tuple changed to ${JSON.stringify(prior.attrs)}`);
        } finally { await closeUi(ui); }
        break;
      }
      case "ui.unlock": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          let prior = await readUiState(ui.page);
          assertValidUiState(prior, `${path.id} initial`);
          const button = ui.page.locator('.lock[data-dim="ref"]');
          await button.click();
          requireThat(await button.getAttribute("aria-pressed") === "true", "ref lock did not engage before unlock test");
          await button.click();
          requireThat(await button.getAttribute("aria-pressed") === "false", "ref lock did not set aria-pressed=false on unlock");
          const unlockMessage = (await ui.page.locator("#live").textContent()) || "";
          requireThat(unlockMessage.includes(`ref unlocked from ${prior.attrs.ref}`), `unlock live-region message missing: ${unlockMessage}`);
          const originalRef = prior.attrs.ref;
          let changed = false;
          for (let attempt = 0; attempt < 40 && !changed; attempt++) {
            const previous = prior;
            await ui.page.locator("#diceBtn").click();
            await ui.page.waitForFunction((oldId) => document.documentElement.dataset.roll !== oldId, previous.id);
            prior = await readUiState(ui.page);
            assertValidUiState(prior, `${path.id} roll ${attempt + 1}`);
            changed = prior.attrs.ref !== originalRef;
          }
          requireThat(changed, "unlocked ref did not change in 40 valid rolls");
          requireThat(prior.live.includes(prior.id), "live region did not announce the re-roll");
          ctx.log(`ref unlocked from ${originalRef} to ${prior.attrs.ref}`);
        } finally { await closeUi(ui); }
        break;
      }
      case "ui.share": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          const before = await readUiState(ui.page);
          assertValidUiState(before, `${path.id} initial`);
          await ui.page.locator("#shareBtn").click();
          await ui.page.waitForFunction(() => /^(Link copied\.|Copy unavailable)/.test(document.getElementById("live")?.textContent || ""), null, { timeout: 10_000 });
          const result = await ui.page.evaluate(() => ({
            writes: window.__qaClipboardWrites || [],
            error: window.__qaClipboardError || null,
            live: document.getElementById("live")?.textContent || "",
            currentId: document.documentElement.dataset.roll,
          }));
          requireThat(result.writes.length === 1, `native clipboard write was not observed (install error: ${result.error || "none"})`);
          const copied = new URL(result.writes[0]);
          requireThat(copied.searchParams.get("roll") === result.currentId, `clipboard URL does not contain current roll ${result.currentId}`);
          requireThat(result.live.startsWith("Link copied.") && result.live.includes(result.currentId), `copy confirmation missing: ${result.live}`);
          ctx.log(`native write resolved with ${copied.origin}${copied.pathname}?roll=${copied.searchParams.get("roll")}`);
          ctx.log(`live region: ${result.live}`);
        } finally { await closeUi(ui); }
        break;
      }
      case "ui.deep-link-hostile": {
        const linked = await newUiPage(runtime, home, ctx, "?roll=r0004");
        try {
          const state = await readUiState(linked.page);
          assertValidUiState(state, `${path.id} deep link`);
          requireThat(state.id === "r0004", `deep link loaded ${state.id}, not r0004`);
          ctx.log(`r0004 tuple: ${JSON.stringify(state.attrs)}`);
        } finally { await closeUi(linked); }
        const hostile = await newUiPage(runtime, home, ctx, "?roll=__proto__");
        try {
          const state = await readUiState(hostile.page);
          assertValidUiState(state, `${path.id} hostile link`);
          requireThat(state.id !== "__proto__", "hostile parameter resolved as an inherited property");
          requireThat(hostile.errors.length === 0, `hostile URL produced browser errors: ${hostile.errors.join("; ")}`);
          ctx.log(`hostile fallback: ${state.id} ${JSON.stringify(state.attrs)}`);
        } finally { await closeUi(hostile); }
        break;
      }
      case "ui.no-external-requests": {
        const ui = await newUiPage(runtime, home, ctx);
        try {
          const state = await readUiState(ui.page);
          assertValidUiState(state, path.id);
          const external = ui.requests.filter((url) => new URL(url).origin !== ui.origin);
          requireThat(external.length === 0, `external requests observed: ${external.join(", ")}`);
          requireThat(ui.errors.length === 0, `browser errors observed: ${ui.errors.join("; ")}`);
          ctx.log(`requests: ${JSON.stringify(ui.requests)}`);
          ctx.log("external requests: 0; browser console/page errors: 0");
        } finally { await closeUi(ui); }
        break;
      }
      case "http.static-responses": {
        if (!runtime.staticServer) runtime.staticServer = await startStaticServer();
        const endpoints = [
          ["/", 200, "text/html"], ["/tasteroll.html", 200, "text/html"], ["/samples/", 200, "text/html"],
          ["/samples/tasteroll/", 200, "text/html"], ["/skills.json", 200, "application/json"],
          ["/index.html", 200, "text/html"], ["/qa-path-that-does-not-exist", 404, "text/plain"],
        ];
        for (const [endpoint, expectedStatus, expectedType] of endpoints) {
          const response = await fetch(`${runtime.staticServer.origin}${endpoint}`);
          const contentType = response.headers.get("content-type") || "";
          requireThat(response.status === expectedStatus, `${endpoint}: expected HTTP ${expectedStatus}, got ${response.status}`);
          requireThat(contentType.startsWith(expectedType), `${endpoint}: expected ${expectedType}, got ${contentType}`);
          ctx.log(`${endpoint}: HTTP ${response.status}; ${contentType}`);
          if (response.ok && endpoint === "/skills.json") requireThat(Array.isArray(JSON.parse(await response.text()).skills), "/skills.json body is not a skills manifest");
          else await response.arrayBuffer();
        }
        break;
      }
      default:
        fail(`no implementation for catalog operation ${path.operation}`);
    }
  } catch (error) {
    failure = error;
  }
  const status = pathStatusFor(failure);
  if (failure) ctx.log(`${status}: ${failure.stack || failure.message}`);
  const elapsed = Date.now() - started;
  ctx.log(`${status} ${path.id} (${elapsed} ms)`);
  writeFileSync(join(outputDir, "transcripts", `${path.id}.log`), `${lines.join("\n")}\n`);
  console.log(`${status} ${path.id}: ${path.action}`);
  return { id: path.id, surface: path.surface, operation: path.operation, status, elapsed_ms: elapsed, action: path.action, expected: path.expected };
}

async function main() {
  const args = process.argv.slice(2);
  let requestedOut = process.env.QA_OUT_DIR || null;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--out" && args[index + 1]) requestedOut = args[++index];
    else if (args[index] === "--help" || args[index] === "-h") {
      console.log("usage: qa/run.sh [--out <new-run-directory>]\nRuns the versioned TasteCheck operator-path catalog with isolated HOME directories.");
      return 0;
    } else throw new Error(`unknown argument ${args[index]}`);
  }

  const catalog = loadCatalog();
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  const outputDir = resolve(requestedOut || join(tmpdir(), `tastecheck-qa-${runId}`));
  if (existsSync(outputDir) && readdirSync(outputDir).length) throw new Error(`output directory is not empty: ${outputDir}`);
  mkdirSync(join(outputDir, "transcripts"), { recursive: true });
  const chrome = await findChrome();
  const runState = createRunState(ROOT);
  const runtime = { chrome, browser: null, staticServer: null, runState, log: (message) => console.log(message) };
  console.log(`TasteCheck QA: ${catalog.paths.length} catalog paths`);
  console.log(`Browser: ${chrome ? chrome.version : "unavailable (browser paths will be BLOCKED)"}`);
  const results = [];
  try {
    for (const path of catalog.paths) results.push(await runPath(path, runtime, outputDir));
  } finally {
    if (runtime.browser) await runtime.browser.close().catch(() => {});
    if (runtime.staticServer) await new Promise((resolveClose) => runtime.staticServer.server.close(resolveClose));
    runState.cleanup();
  }

  const summary = {
    schema_version: 2,
    repository: catalog.repository,
    ...runnerProvenance(ROOT, catalog.tested_merge_sha),
    run_id: runId,
    node: process.version,
    browser: chrome?.version || null,
    total: results.length,
    ...countStatuses(results),
    results,
  };
  writeFileSync(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`QA result: ${summary.passed}/${summary.total} PASS, ${summary.failed} FAIL, ${summary.blocked} BLOCKED`);
  console.log(`Transcripts and summary retained in: ${outputDir}`);
  return exitCodeFor(summary);
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(`QA runner error: ${error.stack || error.message}`);
  process.exitCode = 1;
});
