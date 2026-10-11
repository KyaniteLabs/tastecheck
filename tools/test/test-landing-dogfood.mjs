#!/usr/bin/env node
// Dogfood: TasteCheck's own gate-audit must return a clean verdict for TasteCheck's own homepage.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Serve over http like GitHub Pages does: font preloads are CORS fetches and cannot work from file://.
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer((req, res) => {
  const path = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!path.startsWith(root) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const pageUrl = `http://127.0.0.1:${server.address().port}/index.html`;
const auditPath = resolve(root, "skills/tastecheck-pass/assets/gate-audit.js");
const fallbackExe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function launch() {
  try {
    return await chromium.launch();
  } catch (first) {
    if (existsSync(fallbackExe)) {
      try { return await chromium.launch({ executablePath: fallbackExe }); } catch { /* fall through */ }
    }
    return { error: first };
  }
}

const browser = await launch();
if (browser.error) {
  server.close();
  console.log(`skipped: no browser (${String(browser.error.message).split("\n")[0]})`);
  process.exit(0);
}

const problems = [];
for (const [width, height] of [[1280, 800], [390, 844]]) {
  const label = `${width}x${height}`;
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${label}: console error: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${label}: page error: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`${label}: request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${label}: HTTP ${r.status()} ${r.url()}`); });
  await page.goto(pageUrl, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: auditPath });
  const audit = await page.evaluate(() => window.__gateAudit);
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  if (!audit) problems.push(`${label}: window.__gateAudit missing`);
  else {
    for (const f of audit.fails ?? []) problems.push(`${label}: gate FAIL: ${f}`);
    for (const w of audit.warns ?? []) problems.push(`${label}: gate WARN: ${w}`);
  }
  if (overflow.scroll > overflow.inner) problems.push(`${label}: horizontal overflow (scrollWidth ${overflow.scroll} > ${overflow.inner})`);
  console.log(`${label}: verdict ${audit?.verdict}`);
  await page.close();
}
await browser.close();
server.close();

if (problems.length) {
  console.error(`landing dogfood failed (${problems.length})`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log("landing dogfood passed: the gate passes its own homepage at 1280 and 390");
