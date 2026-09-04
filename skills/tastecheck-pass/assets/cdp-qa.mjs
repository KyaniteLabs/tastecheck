#!/usr/bin/env node
/* cdp-qa.mjs — zero-dependency tastecheck evidence driver.
   Spawns system Chrome headless (temp profile), drives it over CDP via Node's
   built-in WebSocket. NEVER touches the CEO's Chrome profile/session (browser-host law).
   Usage: node cdp-qa.mjs <file-url> <out-dir>
   Evidence: cold-load gate audit, keyboard tab trace, reflow checks, contrast samples,
   AX-tree summary, radio/export path, screenshots (light/dark/narrow). */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TARGET = process.argv[2];
const OUT = process.argv[3] || "/tmp/p1qa-evidence";
mkdirSync(OUT, { recursive: true });
const E = {}; // evidence bag

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", "--user-data-dir=" + OUT + "/profile",
  "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

async function waitPort(file, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { return readFileSync(file, "utf8").split("\n")[0]; } catch { await sleep(250); }
  }
  throw new Error("DevToolsActivePort never appeared");
}
const port = await waitPort(OUT + "/profile/DevToolsActivePort");

// fetch page target ws url
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0; const pending = new Map(); const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) events.push(m);
};
function send(method, params = {}) {
  return new Promise((res) => {
    const id = ++msgId; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

// ---------- 1. cold load ----------
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Page.navigate", { url: TARGET });
await sleep(2500);
E.coldLoad = await evaluate(`(() => {
  const doc = document.querySelector("#docview article h1");
  return { title: document.title, docOpen: doc ? doc.textContent : null,
    docBtns: document.querySelectorAll(".dlink").length,
    groups: document.querySelectorAll(".grptitle").length,
    cur: document.querySelector('.dlink[aria-current="true"]') ? true : false,
    hasMain: !!document.querySelector("main#main"), hasSkip: !!document.querySelector("a.skip"),
    hasNav: !!document.querySelector("aside[aria-label]"), bodyText: document.body.innerText.length };
})()`);

// ---------- 2. gate-audit.js (fresh load, before interactions) ----------
const auditSrc = readFileSync(new URL("./gate-audit.js", import.meta.url), "utf8");
E.gateAudit = await evaluate(`(() => {
  window.__cap = []; ["log","warn","error"].forEach(k => {
    const orig = console[k].bind(console); console[k] = (...a) => { window.__cap.push(k + ": " + a.join(" ")); orig(...a); };
  });
  try { ${auditSrc} gateAudit(); } catch (e) { window.__cap.push("error: threw " + e.message); }
  return window.__cap;
})()`);

// ---------- 3. keyboard tab trace ----------
const focusLog = [];
for (let i = 0; i < 14; i++) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  focusLog.push(await evaluate(`(() => { const e = document.activeElement; if (!e || e === document.body) return "body";
    const s = getComputedStyle(e); return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") +
      (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : "") +
      " | outline:" + s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor; })()`));
}
E.tabTrace = focusLog;

// ---------- 4. reflow: 320px + 200% text-ish (overflow scan) ----------
async function overflowAt(width) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1400, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  return evaluate(`(() => {
    const bad = [];
    document.querySelectorAll("body *").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > document.documentElement.clientWidth + 2 && getComputedStyle(el).position !== "fixed") {
        const t = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 30);
        bad.push(el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + " right=" + Math.round(r.right) + (t ? " «" + t + "»" : ""));
      }
    });
    return { vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, overflowEls: bad.slice(0, 6) };
  })()`);
}
E.reflow320 = await overflowAt(320);
E.reflowNarrow = await overflowAt(390);
await send("Emulation.clearDeviceMetricsOverride");

// ---------- 5. contrast sampling (computed, rendered nodes, light) ----------
E.contrast = await evaluate(`(() => {
  const sel = [["body","ink/paper"], [".muted","muted"], ["a[data-internal]","link"], ["article a","link2"],
    [".chip","chip"], [".chip.review","chip-review"], [".btn.primary","btn-primary"], [".masthead h1","head"],
    [".gate","gate"], [".csum b","csum"], [".dq","dq"]];
  const out = [];
  sel.forEach(([s, n]) => { const el = document.querySelector(s); if (!el) return;
    const c = getComputedStyle(el); let bg = c.backgroundColor, txt = c.color;
    let p = el.parentElement; while (bg === "rgba(0, 0, 0, 0)" && p) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
    out.push({ n, fg: txt, bg, font: c.fontSize }); });
  return out;
})()`);

// ---------- 6. curate path: open, radio, note, storage, export ----------
await evaluate(`document.querySelector('.viewbtn[data-view="curate"]').click()`);
await sleep(400);
E.curate = await evaluate(`(() => {
  const cards = document.querySelectorAll(".dcard").length;
  const radios = document.querySelectorAll('input[type="radio"]').length;
  const first = document.querySelector(".dcard");
  const legendOk = !!first && !!first.querySelector("legend");
  return { cards, radios, legendOk, h1: document.querySelector(".curhead h1") ? document.querySelector(".curhead h1").textContent : null };
})()`);
// radio via keyboard: focus first radio then arrow? use real click-equivalent: dispatch space after focus
await evaluate(`(() => { const r = document.querySelector('.dcard input[value="approve"]'); r.focus(); return document.activeElement === r; })()`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
await sleep(200);
E.radio = await evaluate(`(() => { const d = document.querySelector(".dcard"); return { dataSt: d.getAttribute("data-st"),
  ls: JSON.parse(localStorage.getItem("p1-curation-v1") || "{}").decisions || {} }; })()`);
await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: OUT, eventsEnabled: true });
E.export = await evaluate(`(() => { const before = document.querySelectorAll("a[download]").length;
  document.getElementById("exp").click(); return { before, toast: (document.getElementById("status").textContent || "") }; })()`);
await sleep(1500);
const fs = await import("node:fs");
E.downloadFiles = fs.readdirSync(OUT).filter((f) => f.endsWith(".json"));
// reset local state
await evaluate(`localStorage.removeItem("p1-curation-v1")`);

// ---------- 7. AX tree summary ----------
await send("Accessibility.enable");
const ax = await send("Accessibility.getFullAXTree");
const roles = {};
(ax.result.nodes || []).forEach((n) => { roles[n.role && n.role.value] = (roles[n.role && n.role.value] || 0) + 1; });
const names = (ax.result.nodes || []).filter((n) => ["banner", "navigation", "main", "contentinfo", "heading", "radio"].includes(n.role && n.role.value)).slice(0, 30)
  .map((n) => (n.role ? n.role.value : "?") + ":" + ((n.name && n.name.value) || "").slice(0, 40));
E.ax = { roles, sample: names };

// ---------- 8. screenshots ----------
async function shot(name, features) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features });
  await sleep(500);
  await evaluate(`document.querySelector('.dlink[data-id="DIGEST-CEO-2026-09-03.md"]').click()`);
  await sleep(500);
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT + "/shot-" + name + ".png", Buffer.from(s.result.data, "base64"));
  await evaluate(`document.querySelector('.viewbtn[data-view="curate"]').click()`);
  await sleep(300);
  const s2 = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT + "/shot-" + name + "-curate.png", Buffer.from(s2.result.data, "base64"));
}
await shot("light", [{ name: "prefers-color-scheme", value: "light" }]);
await shot("dark", [{ name: "prefers-color-scheme", value: "dark" }]);

writeFileSync(OUT + "/evidence.json", JSON.stringify(E, null, 2));
console.log("EVIDENCE WRITTEN:", OUT + "/evidence.json");
try { chrome.kill(); } catch {}
process.exit(0);
