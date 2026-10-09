#!/usr/bin/env node
/* cdp-qa.mjs — zero-dependency tastecheck browser evidence driver.

   Launches a locally installed Chrome/Chromium/Edge headless with a throwaway
   profile (never your real profile), drives it over the Chrome DevTools Protocol
   using Node's built-in WebSocket, runs every probe the tastecheck-pass fast lane
   promises, writes evidence.json + screenshots, and prints a verdict-first summary.

   Usage:   node cdp-qa.mjs <url | file path | file://url> [out-dir] [--json]
   Output:  <out-dir>/evidence.json, shot-light.png, shot-dark.png, shot-narrow-390.png
            out-dir defaults to a fresh directory under os.tmpdir().
   Exit:    0 SHIP · 1 HOLD (any probe fail, or a required probe not_run) · 2 tool error
   Needs:   Node 22+ (global WebSocket; Node 20.10+/21 work with --experimental-websocket)
            and a Chrome/Chromium/Edge. Browser lookup order: CHROME_PATH or
            TASTECHECK_CHROME, then playwright/playwright-core chromium if importable,
            then common macOS / Linux / Windows install locations.

   Every probe reports { status: pass|fail|warn|not_run|n/a, evidence } — nothing is
   silently skipped; a probe that cannot run says why. */
import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync, writeFileSync, renameSync, mkdirSync, mkdtempSync, existsSync, rmSync, statSync, readdirSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, delimiter, resolve, isAbsolute } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const TOOL_VERSION = "2.0.0";
const TIMEOUT_MS = Number(process.env.TASTECHECK_TIMEOUT_MS) || 90_000;
const CMD_TIMEOUT_MS = 20_000;

/* Probes whose absence (not_run) blocks a SHIP. Optional probes may be n/a or not_run. */
const PROBES = [
  ["coldLoad", true], ["consoleCold", true], ["keyboard", true], ["reflow320", true],
  ["zoom400", true], ["tapTargets", true], ["contrast", true], ["reducedMotion", false],
  ["themeVariants", false], ["resources", true], ["leaks", true], ["templateSlop", true],
  ["shadowIframes", false],
];

class ToolError extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tail = (s, n = 70) => (String(s).length > n ? "…" + String(s).slice(-(n - 1)) : String(s));
const trunc = (s, n = 160) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

/* ------------------------------------------------------------------ args */
function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const pos = argv.filter((a) => !a.startsWith("--"));
  return { json: flags.has("--json"), help: flags.has("--help"), target: pos[0], out: pos[1] };
}

function toUrl(target) {
  if (/^https?:\/\//i.test(target) || /^file:\/\//i.test(target)) return target;
  if (/^[a-z][a-z0-9+.-]+:/i.test(target) && !/^[a-z]:[\\/]/i.test(target)) {
    throw new ToolError(`unsupported URL scheme in "${target}" (use http(s)://, file://, or a file path)`);
  }
  const abs = isAbsolute(target) ? target : resolve(process.cwd(), target);
  if (!existsSync(abs)) throw new ToolError(`file not found: ${abs}`);
  const p = statSync(abs).isDirectory() ? join(abs, "index.html") : abs;
  if (!existsSync(p)) throw new ToolError(`file not found: ${p}`);
  return pathToFileURL(p).href;
}

/* --------------------------------------------------------- browser lookup */
function onPath(names) {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of (process.env.PATH || "").split(delimiter).filter(Boolean)) {
    for (const n of names) for (const e of exts) {
      const p = join(dir, n + e);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

async function playwrightChromium() {
  const bases = [import.meta.url, pathToFileURL(join(process.cwd(), "noop.js")).href];
  for (const pkg of ["playwright", "playwright-core"]) {
    for (const base of bases) {
      try {
        const resolved = createRequire(base).resolve(pkg);
        const mod = await import(pathToFileURL(resolved).href);
        const chromium = mod.chromium || (mod.default && mod.default.chromium);
        const p = chromium && chromium.executablePath();
        if (p && existsSync(p)) return p;
      } catch { /* not importable from here */ }
    }
  }
  return null;
}

/* Playwright's browser cache, for when the playwright package is absent or wants a
   different revision than the one installed (PLAYWRIGHT_BROWSERS_PATH honored). */
function playwrightCache() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache", "ms-playwright"),
    join(homedir(), "Library", "Caches", "ms-playwright"), process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright")]
    .filter((r) => r && r !== "0" && existsSync(r));
  const rel = [["chrome-linux", "chrome"], ["chrome-linux64", "chrome"], ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"],
    ["chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"], ["chrome-win", "chrome.exe"], ["chrome-win64", "chrome.exe"]];
  for (const r of roots) {
    let dirs = [];
    try { dirs = readdirSync(r).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse(); } catch { /* unreadable */ }
    for (const d of dirs) for (const parts of rel) { const p = join(r, d, ...parts); if (existsSync(p)) return p; }
  }
  return null;
}

async function findBrowser() {
  for (const k of ["CHROME_PATH", "TASTECHECK_CHROME"]) {
    const v = process.env[k];
    if (v) {
      if (existsSync(v)) return { path: v, via: k };
      throw new ToolError(`${k} is set to "${v}" but that file does not exist`);
    }
  }
  const pw = await playwrightChromium();
  if (pw) return { path: pw, via: "playwright" };
  const cached = playwrightCache();
  if (cached) return { path: cached, via: "playwright-cache" };
  const fixed = [];
  if (process.platform === "darwin") {
    fixed.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of roots) {
      fixed.push(
        join(r, "Google", "Chrome", "Application", "chrome.exe"),
        join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
        join(r, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else {
    fixed.push("/opt/google/chrome/chrome", "/snap/bin/chromium", "/usr/bin/microsoft-edge");
  }
  const hit = fixed.find((p) => existsSync(p));
  if (hit) return { path: hit, via: "known-path" };
  const viaPath = onPath(["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "microsoft-edge", "msedge"]);
  if (viaPath) return { path: viaPath, via: "PATH" };
  return null;
}

/* ------------------------------------------------------------ CDP session */
function launch(browserPath, profileDir) {
  const args = [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-dev-shm-usage", "--allow-file-access-from-files", "--disable-background-networking", "--mute-audio",
    "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "--window-size=1440,900",
  ];
  if ((process.getuid && process.getuid() === 0) || process.env.CI) args.push("--no-sandbox");
  args.push("about:blank");
  // Browser subprocesses need platform/runtime configuration, not installer or provider credentials.
  const env = {};
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "DISPLAY", "XDG_RUNTIME_DIR"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return spawn(browserPath, args, { stdio: "ignore", windowsHide: true, env });
}

async function connect(profileDir, child) {
  const portFile = join(profileDir, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 80 && !port; i++) {
    if (child.exitCode !== null) throw new ToolError(`browser exited immediately (code ${child.exitCode}); try another CHROME_PATH`);
    try { port = readFileSync(portFile, "utf8").split("\n")[0].trim(); } catch { await sleep(250); }
  }
  if (!port) throw new ToolError("browser started but DevToolsActivePort never appeared");
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = list.find((t) => t.type === "page");
    if (!page) await sleep(150);
  }
  if (!page) throw new ToolError("browser exposed no page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new ToolError("CDP WebSocket failed to open")); });
  let msgId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? rej(new Error(`${m.error.message}`)) : res(m.result || {});
    } else if (m.method) {
      for (const fn of listeners.get(m.method) || []) { try { fn(m.params || {}); } catch { /* listener bug must not kill the session */ } }
    }
  };
  ws.onclose = () => {
    for (const { rej, timer } of pending.values()) { clearTimeout(timer); rej(new Error("browser connection closed")); }
    pending.clear();
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++msgId;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`CDP ${method} timed out`)); }, CMD_TIMEOUT_MS);
    pending.set(id, { res, rej, timer });
    try { ws.send(JSON.stringify({ id, method, params })); } catch (e) { clearTimeout(timer); pending.delete(id); rej(e); }
  });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  const once = (method, ms) => new Promise((res) => {
    const t = setTimeout(res, ms);
    on(method, () => { clearTimeout(t); res(); });
  });
  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error("page eval failed: " + trunc((d.exception && d.exception.description) || d.text, 240));
    }
    return r.result ? r.result.value : undefined;
  }
  return { send, on, once, evaluate, ws, port };
}

/* ------------------------------------------ page-side code (serialized) */
/* Everything below this banner runs INSIDE the page. helpers() is injected with every
   page function so they can walk shadow roots and same-origin iframes uniformly. */
function helpers() {
  const px = (v) => parseFloat(v) || 0;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = 1;
  const cx = cvs.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { // any CSS color syntax -> [r,g,b,a]
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const win = (el) => el.ownerDocument.defaultView || window;
  const cs = (el) => win(el).getComputedStyle(el);
  const parent = (el) => el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
  function all(frames) {
    const out = [];
    const visit = (root) => {
      for (const el of root.querySelectorAll("*")) {
        out.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
        if (frames && el.tagName === "IFRAME") {
          try { const d = el.contentDocument; if (d && d.documentElement) visit(d); } catch { /* cross-origin */ }
        }
      }
    };
    visit(document);
    return out;
  }
  function sel(el) {
    let s = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
    const c = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    if (c) s += "." + c;
    if (!el.id && !c && el.parentElement) {
      const sibs = [...el.parentElement.children].filter((x) => x.tagName === el.tagName);
      if (sibs.length > 1) s += `:nth-of-type(${sibs.indexOf(el) + 1})`;
      const p = el.parentElement;
      s = p.tagName.toLowerCase() + (p.id ? "#" + p.id : "") + " > " + s;
    }
    return (el.getRootNode() instanceof ShadowRoot ? "(shadow) " : "") + s;
  }
  const rectOf = (el) => el.getBoundingClientRect();
  function visible(el) {
    const s = cs(el);
    if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse") return false;
    const r = rectOf(el);
    return r.width > 0 && r.height > 0;
  }
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, bot) => { // composite rgba top over opaque-ish bot
    const a = top[3];
    return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1];
  };
  function deepActive() {
    let a = document.activeElement;
    while (a) {
      if (a.shadowRoot && a.shadowRoot.activeElement) { a = a.shadowRoot.activeElement; continue; }
      if (a.tagName === "IFRAME") {
        try { const d = a.contentDocument; if (d && d.activeElement && d.activeElement !== d.body) { a = d.activeElement; continue; } } catch { /* cross-origin */ }
      }
      break;
    }
    return a;
  }
  const FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable="true"]';
  const INTERACTIVE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],[role="radio"],[onclick],[tabindex]:not([tabindex="-1"])';
  const disabled = (el) => el.matches(":disabled") || el.getAttribute("aria-disabled") === "true";
  return { px, rgba, cs, parent, all, sel, rectOf, visible, ratio, over, lum, deepActive, FOCUSABLE, INTERACTIVE, disabled };
}

/* contrast over every visible text node; pass opts.frames to include same-origin iframes */
function pageContrast(H) {
  const { all, cs, parent, rgba, ratio, over, visible, sel, px, rectOf } = H;
  const bad = [];
  let checked = 0, skipped = 0, worst = null;
  const seen = new Set();
  for (const el of all(true)) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|TITLE|META|LINK|SVG|OPTION)$/i.test(el.tagName)) continue;
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length > 0) { hasText = true; break; }
    if (!hasText || seen.has(el)) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const r = rectOf(el);
    if (r.width <= 1 && r.height <= 1) continue; // sr-only
    if (el.closest("[disabled],[aria-disabled='true']")) { skipped++; continue; }
    const s = cs(el);
    if (s.webkitTextFillColor && rgba(s.webkitTextFillColor)[3] === 0 && rgba(s.color)[3] !== 0) { skipped++; continue; } // gradient text
    // effective opacity and backgrounds up the flat tree
    let opacity = 1, layers = [], indeterminate = false;
    for (let p = el; p; p = parent(p)) {
      const ps = cs(p);
      opacity *= parseFloat(ps.opacity);
      if (!indeterminate) {
        const bi = ps.backgroundImage;
        const bg = rgba(ps.backgroundColor);
        if (bi && bi !== "none" && !layers.some((l) => l[3] >= 1)) { indeterminate = true; }
        else if (bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; }
      }
    }
    if (indeterminate) { skipped++; continue; }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    const fg0 = rgba(s.color);
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], base);
    const rt = ratio(fg, base);
    const size = px(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    checked++;
    if (!worst || rt < worst.ratio) worst = { sel: sel(el), ratio: +rt.toFixed(2) };
    if (rt < need) bad.push({ sel: sel(el), ratio: +rt.toFixed(2), need, text: (el.textContent || "").trim().slice(0, 30) });
  }
  return { checked, skipped, worst, bad: bad.length, sample: bad.slice(0, 5) };
}

/* horizontal reflow at the current viewport; offenders ignore html/body overflow hacks */
function pageReflow(H) {
  const { all, cs, rectOf, sel, visible } = H;
  const de = document.documentElement;
  const vw = de.clientWidth, sw = de.scrollWidth;
  const offenders = [], clipped = [];
  const clips = (s) => s.overflowX !== "visible";
  for (const el of all(false)) {
    if (el === document.body || el === de) continue;
    const s = cs(el);
    if (s.position === "fixed" || !visible(el)) continue;
    const r = rectOf(el);
    if (r.right > vw + 1) {
      let contained = false;
      for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
        if (clips(cs(p)) && rectOf(p).right <= vw + 1) { contained = true; break; }
      }
      if (!contained) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
        offenders.push(`${sel(el)} right=${Math.round(r.right)}${t ? ` «${t}»` : ""}`);
      }
    }
    if ((s.overflowX === "hidden" || s.overflowX === "clip") && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 2 && (el.textContent || "").trim()) {
      if (el.children.length === 0 || s.textOverflow !== "ellipsis") clipped.push(`${sel(el)} scrollW=${el.scrollWidth} clientW=${el.clientWidth}`);
    }
  }
  const fixedCover = [];
  for (const el of all(false)) {
    const s = cs(el);
    if ((s.position === "fixed" || s.position === "sticky") && visible(el)) {
      const r = rectOf(el);
      if (r.height / window.innerHeight > 0.4 && r.width / vw > 0.5) fixedCover.push(`${sel(el)} ${Math.round(r.height)}px tall of ${window.innerHeight}px`);
    }
  }
  return { vw, sw, offenders: offenders.slice(0, 5), nOff: offenders.length, clipped: clipped.slice(0, 4), nClip: clipped.length, fixedCover: fixedCover.slice(0, 3) };
}

function pageTapTargets(H) {
  const { all, cs, rectOf, sel, visible, INTERACTIVE, disabled } = H;
  const small = [], medium = [];
  let checked = 0, exempt = 0, min = null;
  for (const el of all(false)) {
    if (!el.matches(INTERACTIVE) || disabled(el) || !visible(el)) continue;
    const s = cs(el);
    let r = rectOf(el);
    if (r.right <= 0 || r.bottom <= 0) continue; // parked off-screen (skip links etc.)
    if (/^(checkbox|radio)$/.test(el.type || "") && el.labels && el.labels[0]) {
      const lr = rectOf(el.labels[0]);
      if (lr.width * lr.height > r.width * r.height) r = lr;
    }
    if (r.width <= 1 && r.height <= 1) continue;
    if (s.display === "inline" && el.tagName === "A") { exempt++; continue; } // inline text link exception
    checked++;
    const m = Math.min(r.width, r.height);
    if (!min || m < min.m) min = { m, sel: sel(el), w: Math.round(r.width), h: Math.round(r.height) };
    if (m < 24) small.push(`${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    else if (m < 44) medium.push(`${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { checked, exempt, min, small: small.slice(0, 5), nSmall: small.length, nMedium: medium.length, medium: medium.slice(0, 3) };
}

function pageKeyboardPre(H) {
  const { all, cs, visible, FOCUSABLE, disabled } = H;
  const sig = (el) => { const s = cs(el); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderTopColor, s.backgroundColor, s.color, s.textDecorationLine, s.transform].join("|"); };
  window.__tcBase = new WeakMap();
  window.__tcIds = new WeakMap();
  window.__tcN = 0;
  let n = 0, posTab = 0;
  for (const el of all(true)) {
    if (!el.matches(FOCUSABLE) || disabled(el)) continue;
    const ti = el.getAttribute("tabindex");
    if (ti !== null && parseInt(ti, 10) < 0) continue;
    if (!visible(el)) continue;
    if (ti !== null && parseInt(ti, 10) > 0) posTab++;
    n++;
    window.__tcBase.set(el, sig(el));
  }
  window.__tcSig = sig;
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  window.scrollTo(0, 0);
  return { n, posTab };
}

function pageKeyboardStep(H) {
  const { deepActive, cs, rgba, px, sel, rectOf } = H;
  const el = deepActive();
  if (!el || el === document.body || el === document.documentElement) return { body: true };
  let id = window.__tcIds.get(el);
  if (!id) { id = ++window.__tcN; window.__tcIds.set(el, id); }
  const s = cs(el), r = rectOf(el);
  const proxy = r.width < 2 || r.height < 2 || parseFloat(s.opacity) === 0; // visually-hidden native control: styling lives on a sibling
  const outline = s.outlineStyle !== "none" && px(s.outlineWidth) > 0 && rgba(s.outlineColor)[3] > 0;
  const base = window.__tcBase.get(el);
  const changed = base !== undefined && base !== window.__tcSig(el);
  const shadow = s.boxShadow !== "none" && (!base || !base.includes(s.boxShadow));
  return { id, sel: sel(el), indicator: outline || shadow || changed, proxy };
}

function pageResources(H) {
  const { all } = H;
  const links = [], missing = [];
  const seen = new Set();
  for (const a of all(true)) {
    if (a.tagName !== "A" || !a.hasAttribute("href")) continue;
    const raw = a.getAttribute("href").trim();
    if (!raw || /^(mailto:|tel:|javascript:|data:|sms:)/i.test(raw)) continue;
    if (raw.startsWith("#")) {
      const id = decodeURIComponent(raw.slice(1));
      if (id && id !== "top" && !document.getElementById(id) && !document.querySelector(`[name="${CSS.escape(id)}"]`)) missing.push(raw);
      continue;
    }
    if (!seen.has(a.href)) { seen.add(a.href); links.push(a.href); }
  }
  const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.currentSrc.startsWith("data:")).map((i) => i.currentSrc);
  return { links, missing, brokenImgs: imgs };
}

function pageText(H) {
  const { all } = H;
  const parts = [document.body ? document.body.innerText : ""];
  const attrs = [];
  for (const el of all(true)) {
    if (el.shadowRoot) parts.push(el.shadowRoot.textContent || "");
    if (el.tagName === "IFRAME") { try { parts.push(el.contentDocument.body.innerText); } catch { /* cross-origin */ } }
    for (const a of ["alt", "title", "aria-label", "placeholder"]) { const v = el.getAttribute && el.getAttribute(a); if (v) attrs.push(v); }
  }
  return (parts.join("\n") + "\n" + attrs.join("\n")).slice(0, 1_000_000);
}

function pageColdLoad(H) {
  const de = document.documentElement;
  const text = document.body ? document.body.innerText.trim() : "";
  const imgs = document.images.length;
  return {
    title: document.title, lang: de.getAttribute("lang") || "", viewportMeta: !!document.querySelector('meta[name="viewport"]'),
    h1: document.querySelectorAll("h1").length, textLen: text.length, imgs, readyState: document.readyState,
    landmarks: ["main", "nav", "header", "footer"].filter((t) => document.querySelector(t) || document.querySelector(`[role="${t === "nav" ? "navigation" : t === "header" ? "banner" : t === "footer" ? "contentinfo" : t}"]`)),
  };
}

function pageMotion(H) {
  const anims = (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === "running");
  const infinite = anims.filter((a) => { try { return a.effect.getComputedTiming().iterations === Infinity; } catch { return false; } });
  const names = infinite.slice(0, 3).map((a) => a.animationName || a.constructor.name);
  const videos = [...document.querySelectorAll("video")].filter((v) => v.autoplay && !v.paused);
  return { running: anims.length, infinite: infinite.length, names, autoplayVideos: videos.length };
}

function pageThemeProbe(H) {
  const { cs, rgba } = H;
  const eff = () => { for (const el of [document.body, document.documentElement]) { const c = rgba(cs(el).backgroundColor); if (c[3] > 0) return c.map((v) => Math.round(v)).join(","); } return "255,255,255,1"; };
  let mqRules = 0;
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) mqRules++; } catch { /* cross-origin sheet */ }
  }
  return { bg: eff(), fg: rgba(cs(document.body).color).map((v) => Math.round(v)).join(","), mqRules, dataTheme: !!document.querySelector("[data-theme]") || /dark|light/.test(document.documentElement.className) };
}

function pageShadowFrames(H) {
  const { all } = H;
  let shadow = 0, same = 0, cross = 0;
  const crossSrc = [];
  for (const el of all(true)) {
    if (el.shadowRoot) shadow++;
    if (el.tagName === "IFRAME") {
      let ok = false;
      try { ok = !!(el.contentDocument && el.contentDocument.documentElement); } catch { ok = false; }
      if (ok) same++; else { cross++; crossSrc.push(el.src || "(srcdoc/blank)"); }
    }
  }
  return { shadow, same, cross, crossSrc: crossSrc.slice(0, 3) };
}

/* ------------------------------------------------------------------- main */
const page = (fn, ...args) => `(${fn})((${helpers})(), ...${JSON.stringify(args)})`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target) {
    process.stderr.write("usage: node cdp-qa.mjs <url | file path | file://url> [out-dir] [--json]\n");
    return args.help ? 0 : 2;
  }
  if (typeof WebSocket === "undefined") {
    throw new ToolError(`cdp-qa requires Node 22+ (global WebSocket); you have ${process.version}. Upgrade Node, or on Node 20.10+/21 run: node --experimental-websocket ${process.argv[1]} ...`);
  }
  const url = toUrl(args.target);
  const found = await findBrowser();
  if (!found) {
    throw new ToolError([
      "no Chrome/Chromium/Edge found. Install one, or point at it with CHROME_PATH, e.g.",
      "  CHROME_PATH=/usr/bin/chromium node cdp-qa.mjs <target>          (macOS/Linux)",
      '  $env:CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"   (Windows PowerShell)',
      "(TASTECHECK_CHROME works too; an installed playwright/playwright-core chromium is picked up automatically)",
    ].join("\n"));
  }
  const OUT = args.out ? resolve(args.out) : mkdtempSync(join(tmpdir(), "tastecheck-qa-"));
  mkdirSync(OUT, { recursive: true });
  const auditPath = new URL("./gate-audit.js", import.meta.url);
  const auditSrc = existsSync(auditPath) ? readFileSync(auditPath, "utf8") : null;

  const profile = mkdtempSync(join(tmpdir(), "tastecheck-profile-"));
  const child = launch(found.path, profile);
  let cleaned = false;
  let cdp = null;
  const cleanup = async () => {
    if (cleaned) return; cleaned = true;
    try { if (cdp) cdp.ws.close(); } catch { /* already closed */ }
    try {
      if (child.exitCode === null) {
        if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        else child.kill("SIGKILL");
        await Promise.race([new Promise((r) => child.once("exit", r)), sleep(2000)]);
      }
    } catch { /* best effort */ }
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* best effort */ }
  };
  process.on("exit", () => { try { child.kill("SIGKILL"); rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ } });
  const die = (sig) => () => { cleanup().finally(() => process.exit(sig === "INT" ? 130 : 2)); };
  process.on("SIGINT", die("INT")); process.on("SIGTERM", die("TERM"));
  const timer = setTimeout(() => {
    process.stderr.write(`cdp-qa: timed out after ${TIMEOUT_MS / 1000}s\n`);
    cleanup().finally(() => process.exit(2));
  }, TIMEOUT_MS);

  try {
    cdp = await connect(profile, child);
    const { send, on, once, evaluate } = cdp;
    const browserVersion = await send("Browser.getVersion").then((v) => v.product).catch(() => "unknown");

    /* ---- event capture */
    const cold = { console: [], exceptions: [] };
    let coldOpen = true;
    const net = new Map(); // requestId -> {url, status, failed}
    const bad = [];
    on("Runtime.consoleAPICalled", (p) => { if (coldOpen && (p.type === "error" || p.type === "warning")) cold.console.push({ level: p.type === "error" ? "error" : "warn", text: trunc((p.args || []).map((a) => a.value ?? a.description ?? "").join(" "), 140) }); });
    on("Runtime.exceptionThrown", (p) => { if (coldOpen) cold.exceptions.push(trunc((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text, 140)); });
    on("Log.entryAdded", (p) => { const e = p.entry; if (coldOpen && e.source !== "network" && (e.level === "error" || e.level === "warning")) cold.console.push({ level: e.level === "error" ? "error" : "warn", text: trunc(e.text, 140) }); });
    on("Network.requestWillBeSent", (p) => net.set(p.requestId, { url: p.request.url, status: null }));
    on("Network.responseReceived", (p) => { const r = net.get(p.requestId) || { url: p.response.url }; r.status = p.response.status; net.set(p.requestId, r); if (p.response.status >= 400) bad.push(`${p.response.status} ${p.response.url}`); });
    on("Network.loadingFailed", (p) => {
      const r = net.get(p.requestId);
      if (!r || /^(data|blob|chrome-extension):/.test(r.url) || p.errorText === "net::ERR_ABORTED" || p.canceled) return;
      bad.push(`${p.errorText} ${r.url}`);
    });
    on("Page.javascriptDialogOpening", () => { send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); });

    const setMedia = (scheme = "light", motion = "no-preference") => send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: motion }] });
    const viewport = (w, h, dsf = 1) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile: false });

    await Promise.all(["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"].map((m) => send(m)));
    await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    await setMedia("light", "no-preference");
    await viewport(1440, 900);

    /* ---- cold load */
    const loaded = once("Page.loadEventFired", 30_000);
    const nav = await send("Page.navigate", { url });
    if (nav.errorText) throw new ToolError(`could not load ${url}: ${nav.errorText}`);
    await loaded;
    await sleep(1200); // settle: late scripts, fonts, lazy content that renders without input
    const coldInfo = await evaluate(page(pageColdLoad));
    const gate = auditSrc ? await evaluate(`${auditSrc}\n;JSON.parse(JSON.stringify(window.__gateAudit || null))`).catch((e) => ({ error: e.message })) : null;
    coldOpen = false;

    /* ---- probe runner: never silently skip */
    const probes = {};
    const run = async (name, fn) => {
      try { probes[name] = await fn(); }
      catch (e) { probes[name] = { status: "not_run", evidence: `probe error: ${trunc(e.message, 200)}` }; }
    };

    await run("coldLoad", async () => {
      const issues = [], warns = [];
      if (coldInfo.textLen < 1) issues.push("body has no visible text (blank page)");
      if (!coldInfo.title) warns.push("no <title>");
      if (!coldInfo.lang) warns.push("no html lang");
      if (!coldInfo.viewportMeta) warns.push("no viewport meta");
      if (coldInfo.h1 === 0) warns.push("no <h1>");
      let gateNote = "gate-audit.js missing";
      if (gate && gate.fails) {
        gateNote = `gate-audit cold-load: ${gate.fails.length} fail`;
        issues.push(...gate.fails.map((f) => trunc(f, 100)).slice(0, 4));
        const coldWarns = (gate.warns || []).filter((w) => /opacity 0|skeleton/.test(w));
        warns.push(...coldWarns.map((w) => trunc(w, 100)).slice(0, 2));
      } else if (gate && gate.error) gateNote = `gate-audit error: ${trunc(gate.error, 80)}`;
      const base = `title "${trunc(coldInfo.title, 40)}", ${coldInfo.textLen} chars of text, h1×${coldInfo.h1}`;
      if (issues.length) return { status: "fail", evidence: `${issues.join("; ")} (${base})` };
      if (warns.length) return { status: "warn", evidence: `${warns.join("; ")} (${base})` };
      return { status: "pass", evidence: `${base}; ${gateNote}` };
    });

    await run("consoleCold", async () => {
      const errs = [...cold.exceptions.map((t) => `exception: ${t}`), ...cold.console.filter((c) => c.level === "error").map((c) => `error: ${c.text}`)];
      const warns = cold.console.filter((c) => c.level === "warn").map((c) => `warn: ${c.text}`);
      if (errs.length) return { status: "fail", evidence: `${errs.length} error(s) on cold load: ${errs.slice(0, 3).join(" | ")}` };
      if (warns.length) return { status: "warn", evidence: `${warns.length} warning(s) on cold load: ${warns.slice(0, 3).join(" | ")}` };
      return { status: "pass", evidence: "0 console errors/warnings and 0 uncaught exceptions on cold load" };
    });

    await run("templateSlop", async () => {
      if (!gate) return { status: "not_run", evidence: "assets/gate-audit.js not found next to cdp-qa.mjs" };
      if (gate.error) return { status: "not_run", evidence: `gate-audit.js failed to run: ${trunc(gate.error, 120)}` };
      const tells = (gate.warns || []).filter((w) => !/opacity 0|skeleton/.test(w));
      if (tells.length) return { status: "warn", evidence: `${tells.length} template tell(s): ${tells.slice(0, 3).map((w) => trunc(w, 90)).join(" | ")}` };
      return { status: "pass", evidence: `gate-audit verdict ${gate.verdict}; no uniform card grids, stat bands, pill CTAs, default faces or indigo gradient` };
    });

    await run("keyboard", async () => {
      const pre = await evaluate(page(pageKeyboardPre));
      if (pre.n === 0) return { status: "n/a", evidence: "no focusable elements on the page" };
      const max = Math.min(pre.n + 3, 80);
      const steps = [];
      for (let i = 0; i < max; i++) {
        await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        const st = await evaluate(page(pageKeyboardStep));
        steps.push(st);
        if (st.body && i > 0) break; // focus left the document: natural end of the tab cycle
      }
      const hits = steps.filter((s) => !s.body);
      const ids = new Set(hits.map((s) => s.id));
      let run1 = 1, maxRun = 1;
      for (let i = 1; i < hits.length; i++) { run1 = hits[i].id === hits[i - 1].id ? run1 + 1 : 1; maxRun = Math.max(maxRun, run1); }
      const noRing = [...new Map(hits.filter((s) => !s.indicator && !s.proxy).map((s) => [s.id, s.sel])).values()];
      const trap = maxRun >= 4 || (pre.n >= 6 && hits.length >= pre.n && ids.size < pre.n / 2);
      const order = hits.slice(0, 6).map((s) => s.sel).join(" → ");
      const stats = `${ids.size}/${pre.n} focusables reached in ${steps.length} Tab presses; order: ${trunc(order, 100)}`;
      if (trap) return { status: "fail", evidence: `keyboard trap: focus stuck/cycling in ${ids.size} of ${pre.n} focusables (${stats})` };
      if (hits.length === 0) return { status: "fail", evidence: `Tab never moved focus to any of ${pre.n} focusable elements` };
      if (noRing.length) return { status: "fail", evidence: `no visible focus indicator on ${noRing.length}: ${noRing.slice(0, 3).join(", ")} (${stats})` };
      const warns = [];
      if (pre.posTab) warns.push(`${pre.posTab} element(s) with tabindex>0 override natural order`);
      if (pre.n - ids.size > 2) warns.push(`${pre.n - ids.size} focusable(s) not reached by Tab (cross-origin iframe or hidden?)`);
      if (warns.length) return { status: "warn", evidence: `${warns.join("; ")} (${stats})` };
      return { status: "pass", evidence: stats };
    });

    const reflowProbe = (label) => async () => {
      const r = await evaluate(page(pageReflow));
      const dims = `${label}: scrollWidth ${r.sw} vs clientWidth ${r.vw}`;
      if (r.sw > r.vw + 1 || r.nOff > 0) return { status: "fail", evidence: `horizontal overflow — ${dims}; ${r.nOff} element(s) past the right edge: ${r.offenders.slice(0, 3).join(", ")}` };
      const warns = [];
      if (r.nClip) warns.push(`${r.nClip} clipped text container(s): ${r.clipped.slice(0, 2).join(", ")}`);
      if (r.fixedCover.length) warns.push(`fixed/sticky element covers much of the viewport: ${r.fixedCover.join(", ")}`);
      if (warns.length) return { status: "warn", evidence: `${warns.join("; ")} (${dims})` };
      return { status: "pass", evidence: `no horizontal scroll or clipping — ${dims}` };
    };
    await viewport(320, 900);
    await sleep(350);
    await run("reflow320", reflowProbe("320px"));
    await viewport(320, 256, 4); // 1280x1024 at 400% zoom == 320x256 CSS px
    await sleep(350);
    await run("zoom400", reflowProbe("400% zoom (320x256 CSS px)"));

    await viewport(390, 844);
    await sleep(350);
    await run("tapTargets", async () => {
      const r = await evaluate(page(pageTapTargets));
      if (r.checked === 0) return { status: "n/a", evidence: `no standalone interactive elements (${r.exempt} inline text links exempt)` };
      const m = r.min ? `smallest ${r.min.w}x${r.min.h} ${r.min.sel}` : "";
      if (r.nSmall) return { status: "fail", evidence: `${r.nSmall}/${r.checked} target(s) under 24x24 CSS px: ${r.small.slice(0, 3).join(", ")}` };
      if (r.nMedium) return { status: "warn", evidence: `${r.nMedium}/${r.checked} target(s) under the 44px recommendation (all ≥24px): ${r.medium.join(", ")}` };
      return { status: "pass", evidence: `${r.checked} targets all ≥44px; ${m}` };
    });

    /* ---- contrast + themes + motion at desktop */
    await viewport(1440, 900);
    await sleep(250);
    await run("contrast", async () => {
      const r = await evaluate(page(pageContrast));
      if (r.checked === 0) return { status: "not_run", evidence: `no measurable text pairs (${r.skipped} skipped: gradients/images/disabled)` };
      const w = r.worst ? `worst ${r.worst.ratio}:1 at ${r.worst.sel}` : "";
      if (r.bad) return { status: "fail", evidence: `${r.bad}/${r.checked} text pair(s) below WCAG AA: ${r.sample.slice(0, 3).map((s) => `${s.sel} ${s.ratio}:1 (needs ${s.need}) «${s.text}»`).join(", ")}` };
      return { status: "pass", evidence: `${r.checked} text pairs ≥ AA; ${w}${r.skipped ? `; ${r.skipped} skipped (background image/gradient)` : ""}` };
    });

    let lightTheme = null, darkTheme = null, darkContrast = null;
    try {
      lightTheme = await evaluate(page(pageThemeProbe));
      await setMedia("dark");
      await sleep(350);
      darkTheme = await evaluate(page(pageThemeProbe));
      darkContrast = await evaluate(page(pageContrast));
    } finally { await setMedia("light").catch(() => {}); }
    await run("themeVariants", async () => {
      const themed = lightTheme.bg !== darkTheme.bg || lightTheme.fg !== darkTheme.fg;
      if (!themed) {
        if (lightTheme.mqRules > 0) return { status: "warn", evidence: `${lightTheme.mqRules} prefers-color-scheme rule(s) exist but body colors are identical in dark (bg ${darkTheme.bg})` };
        if (lightTheme.dataTheme) return { status: "warn", evidence: "page uses [data-theme]/class theming that was not toggled; only prefers-color-scheme was exercised" };
        return { status: "n/a", evidence: "no prefers-color-scheme variant detected (identical colors in light and dark)" };
      }
      const w = darkContrast.worst ? `worst ${darkContrast.worst.ratio}:1 at ${darkContrast.worst.sel}` : "no measurable text";
      if (darkContrast.bad) return { status: "fail", evidence: `dark variant: ${darkContrast.bad}/${darkContrast.checked} text pair(s) below AA: ${darkContrast.sample.slice(0, 3).map((s) => `${s.sel} ${s.ratio}:1`).join(", ")}` };
      return { status: "pass", evidence: `dark variant (bg ${lightTheme.bg} → ${darkTheme.bg}): ${darkContrast.checked} text pairs ≥ AA; ${w}` };
    });

    await run("reducedMotion", async () => {
      await setMedia("light", "no-preference"); await sleep(500);
      const before = await evaluate(page(pageMotion));
      await setMedia("light", "reduce"); await sleep(500);
      const after = await evaluate(page(pageMotion));
      await setMedia("light", "no-preference");
      if (before.infinite + before.autoplayVideos + before.running === 0) return { status: "n/a", evidence: "no running animations, transitions or autoplay video on cold load" };
      if (after.infinite > 0 || after.autoplayVideos > 0) return { status: "fail", evidence: `under prefers-reduced-motion: reduce still ${after.infinite} infinite animation(s) [${after.names.join(", ")}] and ${after.autoplayVideos} autoplaying video(s) (normal: ${before.infinite} infinite)` };
      return { status: "pass", evidence: `reduce stops continuous motion: infinite animations ${before.infinite}→${after.infinite}, running ${before.running}→${after.running}` };
    });

    await run("resources", async () => {
      const r = await evaluate(page(pageResources));
      const failed = [...new Set(bad)];
      const brokenLinks = [];
      let external = 0, checked = 0;
      const origin = /^https?:/i.test(url) ? new URL(url).origin : null;
      const todo = [];
      for (const href of r.links) {
        let u; try { u = new URL(href); } catch { brokenLinks.push(`${href} (unparseable)`); continue; }
        if (u.protocol === "file:" && url.startsWith("file:")) {
          checked++;
          let p; try { p = fileURLToPath(new URL(u.pathname, "file://")); } catch { p = null; }
          if (p && !existsSync(p)) brokenLinks.push(`missing file ${tail(href, 70)}`);
        } else if (origin && u.origin === origin) todo.push(u.href);
        else external++;
      }
      const slice = todo.slice(0, 25);
      for (let i = 0; i < slice.length; i += 5) {
        await Promise.all(slice.slice(i, i + 5).map(async (h) => {
          checked++;
          try {
            const res = await fetch(h, { redirect: "follow", signal: AbortSignal.timeout(8000) });
            if (res.status >= 400) brokenLinks.push(`${res.status} ${trunc(h, 80)}`);
            try { await res.body?.cancel(); } catch { /* ignore */ }
          } catch (e) { brokenLinks.push(`unreachable ${trunc(h, 80)} (${e.cause?.code || e.name})`); }
        }));
      }
      const skippedNote = todo.length > 25 ? `; ${todo.length - 25} same-origin links not fetched (cap 25)` : "";
      const summary = `${net.size} requests, ${failed.length} failed; ${checked + r.missing.length} links checked, ${external} external not fetched${skippedNote}`;
      const problems = [
        ...failed.slice(0, 4).map((f) => `request ${tail(f, 90)}`),
        ...r.brokenImgs.filter((i) => !failed.some((f) => f.endsWith(i))).slice(0, 2).map((i) => `broken image ${tail(i, 70)}`),
        ...brokenLinks.slice(0, 4).map((l) => `link ${l}`),
        ...r.missing.slice(0, 3).map((m) => `in-page anchor ${m} has no target`),
      ];
      if (problems.length) return { status: "fail", evidence: `${problems.join("; ")} (${summary})` };
      return { status: "pass", evidence: summary };
    });

    await run("leaks", async () => {
      const text = await evaluate(page(pageText));
      const fails = [], warns = [];
      const uniq = (re, f = (x) => x) => [...new Set([...text.matchAll(re)].map((m) => f(m[0])))];
      const paths = uniq(/(?<![\w.-])(?:\/Users\/[^\s/'"<>)]+|\/home\/[a-z_][\w.-]*|[A-Za-z]:\\Users\\[^\s\\'"]+|\/private\/var\/\S+|\/var\/folders\/\S+)/g);
      if (paths.length) fails.push(`machine path(s): ${paths.slice(0, 3).map((p) => trunc(p, 50)).join(", ")}`);
      const secrets = uniq(/\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/g, (s) => s.slice(0, 4) + "…[redacted]");
      if (secrets.length) fails.push(`credential-shaped string(s): ${secrets.join(", ")}`);
      if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) fails.push("SSN-shaped number");
      const luhn = (d) => { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
      const cards = uniq(/\b(?:\d[ -]?){13,19}\b/g).filter((c) => { const d = c.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && luhn(d) && !/^(\d)\1+$/.test(d); });
      if (cards.length) fails.push("payment-card-shaped number (passes Luhn)");
      const emails = uniq(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g).filter((e) => !/@example\.(com|org|net)$/i.test(e) && !/@\d+x\b/.test(e) && !/\.(png|jpe?g|webp|svg|gif)$/i.test(e));
      if (emails.length) warns.push(`email address(es) visible: ${emails.slice(0, 3).join(", ")}`);
      const local = uniq(/\b(?:localhost|127\.0\.0\.1):\d{2,5}\b/g);
      if (local.length) warns.push(`local dev address visible: ${local.slice(0, 2).join(", ")}`);
      if (/lorem ipsum|dolor sit amet/i.test(text)) warns.push("placeholder copy (lorem ipsum)");
      if (fails.length) return { status: "fail", evidence: fails.join("; ") };
      if (warns.length) return { status: "warn", evidence: warns.join("; ") };
      return { status: "pass", evidence: `scanned ${text.length} chars of rendered text/alt/aria-label (incl. shadow roots, same-origin iframes): no machine paths, credentials, PII patterns or placeholder copy` };
    });

    await run("shadowIframes", async () => {
      const r = await evaluate(page(pageShadowFrames));
      if (!r.shadow && !r.same && !r.cross) return { status: "n/a", evidence: "no shadow roots or iframes on the page" };
      const cov = `${r.shadow} open shadow root(s) and ${r.same} same-origin iframe(s) traversed by the contrast, overflow, tap-target, text and focus probes`;
      if (r.cross) return { status: "warn", evidence: `${r.cross} cross-origin iframe(s) NOT inspectable (${r.crossSrc.map((s) => trunc(s, 60)).join(", ")}); ${cov}` };
      return { status: "pass", evidence: cov };
    });

    /* ---- screenshots */
    const shots = [];
    const shot = async (name, scheme, w, h) => {
      try {
        await setMedia(scheme); await viewport(w, h); await sleep(400);
        const s = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(OUT, name), Buffer.from(s.data, "base64"));
        shots.push(name);
      } catch (e) { shots.push(`${name} (failed: ${trunc(e.message, 60)})`); }
    };
    await shot("shot-light.png", "light", 1440, 900);
    await shot("shot-dark.png", "dark", 1440, 900);
    await shot("shot-narrow-390.png", "light", 390, 844);

    /* ---- verdict + atomic evidence write */
    for (const [name] of PROBES) if (!probes[name]) probes[name] = { status: "not_run", evidence: "probe did not execute" };
    const holdReasons = [];
    for (const [name, required] of PROBES) {
      const s = probes[name].status;
      if (s === "fail") holdReasons.push(`${name} failed`);
      else if (s === "not_run" && required) holdReasons.push(`${name} not run`);
    }
    const verdict = holdReasons.length ? "HOLD" : "SHIP";
    const evidence = {
      tool: "tastecheck cdp-qa", version: TOOL_VERSION, verdict, holdReasons,
      target: args.target, url, generatedAt: new Date().toISOString(),
      browser: { product: browserVersion, found: found.via }, node: process.version,
      outDir: OUT, screenshots: shots, probes,
    };
    const tmp = join(OUT, ".evidence.json.tmp");
    writeFileSync(tmp, JSON.stringify(evidence, null, 2) + "\n");
    renameSync(tmp, join(OUT, "evidence.json"));

    let outText;
    if (args.json) outText = JSON.stringify(evidence, null, 2) + "\n";
    else {
      const lines = [verdict];
      if (holdReasons.length) lines.push(`  hold: ${holdReasons.join(", ")}`);
      for (const [name] of PROBES) lines.push(`  ${probes[name].status.toUpperCase().padEnd(7)} ${name.padEnd(14)} ${trunc(probes[name].evidence)}`);
      lines.push(`evidence: ${join(OUT, "evidence.json")}`);
      outText = lines.join("\n") + "\n";
    }
    clearTimeout(timer);
    await cleanup();
    await new Promise((r) => process.stdout.write(outText, r));
    return verdict === "SHIP" ? 0 : 1;
  } catch (e) {
    clearTimeout(timer);
    await cleanup();
    throw e;
  }
}

main().then((code) => process.exit(code), (e) => {
  process.stderr.write(`cdp-qa: ${e instanceof ToolError ? e.message : e.stack || e.message}\n`);
  process.exit(2);
});
