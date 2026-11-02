// cdp-qa.mjs integration test: clean fixture ships, bad fixture holds with the right
// probes failing, and the repo's own index.html runs end to end with every probe present.
// Skips (exit 0) only when no browser can be found or Node lacks a global WebSocket.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const script = join(root, "skills/tastecheck-pass/assets/cdp-qa.mjs");
const fx = (n) => join(root, "tools/test/fixtures/cdp-qa", n);
const PROBE_KEYS = ["coldLoad", "consoleCold", "keyboard", "reflow320", "zoom400", "tapTargets", "contrast",
  "reducedMotion", "themeVariants", "resources", "leaks", "templateSlop", "shadowIframes"];
const STATUSES = new Set(["pass", "fail", "warn", "not_run", "n/a"]);

if (typeof WebSocket === "undefined") { console.log("skipped: no browser (Node 22+ global WebSocket required)"); process.exit(0); }

function run(target) {
  const out = mkdtempSync(join(tmpdir(), "cdp-qa-test-"));
  const r = spawnSync(process.execPath, [script, target, out, "--no-profile"], { encoding: "utf8", timeout: 120_000 });
  const evPath = join(out, "evidence.json");
  const ev = existsSync(evPath) ? JSON.parse(readFileSync(evPath, "utf8")) : null;
  return { r, ev, out };
}

function runFixture(html, { atRoot = false } = {}) {
  const fixtureDir = mkdtempSync(join(root, ".cdp-qa-contrast-test-"));
  const target = atRoot ? join(root, `${basename(fixtureDir)}.html`) : join(fixtureDir, "fixture.html");
  writeFileSync(target, html);
  return { ...run(target), fixtureDir, target };
}

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };
const outs = [];

const clean = run(fx("clean.html"));
outs.push(clean.out);
if (clean.r.status === 2 && /no Chrome\/Chromium\/Edge found/.test(clean.r.stderr)) {
  console.log("skipped: no browser");
  process.exit(0);
}
check(clean.r.status === 0 && /^SHIP\n/.test(clean.r.stdout), `clean fixture SHIPs (exit ${clean.r.status}) ${clean.r.stderr.slice(0, 200)}`);
check(clean.ev && PROBE_KEYS.every((k) => clean.ev.probes[k]), "clean: every probe key present");
check(clean.ev && Object.values(clean.ev.probes).every((p) => STATUSES.has(p.status) && p.evidence !== undefined && String(p.evidence).length > 0), "clean: every probe has a valid status and evidence");
check(clean.ev && !Object.values(clean.ev.probes).some((p) => p.status === "fail"), "clean: no failing probe");
check(clean.ev && ["shot-light.png", "shot-dark.png", "shot-narrow-390.png"].every((f) => existsSync(join(clean.out, f))), "clean: three screenshots written");
check(clean.ev && clean.ev.probes.themeVariants.status === "pass", "clean: themed fixture exercises dark variant");
if (clean.ev && clean.r.status !== 0) console.error(clean.r.stdout);

const bad = run(fx("bad.html"));
outs.push(bad.out);
check(bad.r.status === 1 && /^HOLD\n/.test(bad.r.stdout), `bad fixture HOLDs with exit 1 (exit ${bad.r.status}) ${bad.r.stderr.slice(0, 200)}`);
if (bad.ev) {
  const p = bad.ev.probes;
  for (const k of ["consoleCold", "resources", "reflow320", "zoom400", "contrast", "leaks", "keyboard"]) {
    check(p[k].status === "fail", `bad: ${k} fails — ${String(p[k].evidence).slice(0, 110)}`);
  }
  check(/missing-hero/.test(p.resources.evidence), "bad: resources evidence names the 404 image");
  check(/\/Users\/someone/.test(p.leaks.evidence), "bad: leaks evidence names the machine path");
} else check(false, "bad: evidence.json written");

const highStroke = runFixture(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>High contrast stroke</title><style>
  body { margin: 0; background: #000; color: #fff; }
  .stroke-high { margin: 40px; font: 800 60px/1 sans-serif; color: transparent; -webkit-text-fill-color: transparent; -webkit-text-stroke: 2px #fff; }
</style></head><body><p class="stroke-high" aria-hidden="true">ROLL</p></body></html>`);
outs.push(highStroke.out, highStroke.fixtureDir);
check(highStroke.ev && highStroke.ev.probes.contrast.status === "pass", `high-contrast text stroke passes even with transparent fill and aria-hidden (exit ${highStroke.r.status})`);
check(highStroke.ev && /p\.stroke-high/.test(highStroke.ev.probes.contrast.evidence), "high-contrast aria-hidden stroke is included in measured contrast evidence");

const lowPaint = runFixture(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Low contrast paint controls</title><style>
  body { margin: 0; background: #fff; color: #111; font: 18px/1.5 sans-serif; }
  .stroke-wrap { margin: 20px; padding: 8px; background: #222; }
  .stroke-low { margin: 0; font: 800 60px/1 sans-serif; color: transparent; -webkit-text-fill-color: transparent; -webkit-text-stroke: 2px #333; }
  .ordinary-low { margin: 20px; color: #ccc; }
</style></head><body><div class="stroke-wrap"><p class="stroke-low" aria-hidden="true">ROLL</p></div><p class="ordinary-low" aria-hidden="true">Ordinary faint text</p></body></html>`);
outs.push(lowPaint.out, lowPaint.fixtureDir);
check(lowPaint.ev && lowPaint.ev.probes.contrast.status === "fail", `low-contrast stroke and ordinary text remain failures when aria-hidden (exit ${lowPaint.r.status})`);
check(lowPaint.ev && /p\.stroke-low/.test(lowPaint.ev.probes.contrast.evidence), "low-contrast aria-hidden stroke remains in failure evidence");
check(lowPaint.ev && /p\.ordinary-low/.test(lowPaint.ev.probes.contrast.evidence), "ordinary low-contrast aria-hidden text remains in failure evidence");

const sourcePage = readFileSync(join(root, "tasteroll.html"), "utf8");
const sourceMarker = "</body>";
check(sourcePage.includes(sourceMarker), "source page has a closing body marker for a derived deterministic probe fixture");
const displayWord = runFixture(sourcePage.replace(sourceMarker, '<script>document.documentElement.dataset.sig = "display-word";</script></body>'), { atRoot: true });
outs.push(displayWord.out, displayWord.fixtureDir, displayWord.target);
check(displayWord.ev && displayWord.ev.probes.contrast.status === "pass", `real tasteroll display-word state passes measured contrast (exit ${displayWord.r.status})`);
check(displayWord.ev && /1 transparent-fill text stroke\(s\) measured/.test(displayWord.ev.probes.contrast.evidence), "real tasteroll aria-hidden display-word is counted as measured stroke paint");
check(displayWord.ev && displayWord.ev.probes.resources.status === "pass", "real tasteroll display-word fixture preserves checkout-relative resources");

const idx = run(join(root, "index.html"));
outs.push(idx.out);
check(idx.ev && (idx.r.status === 0 || idx.r.status === 1), `index.html runs to a verdict (exit ${idx.r.status})`);
check(idx.ev && PROBE_KEYS.every((k) => idx.ev.probes[k] && STATUSES.has(idx.ev.probes[k].status)), "index.html: every probe key present with valid status");
if (idx.ev) console.log(`index.html: ${idx.ev.verdict}\n` + PROBE_KEYS.map((k) => `  ${idx.ev.probes[k].status.padEnd(7)} ${k} — ${String(idx.ev.probes[k].evidence).slice(0, 140)}`).join("\n"));

const json = spawnSync(process.execPath, [script, fx("clean.html"), clean.out, "--json"], { encoding: "utf8", timeout: 120_000 });
let parsed = null; try { parsed = JSON.parse(json.stdout); } catch { /* checked below */ }
check(parsed && parsed.probes && parsed.verdict, "--json prints evidence JSON to stdout");

const missing = spawnSync(process.execPath, [script, join(root, "no-such-file.html")], { encoding: "utf8" });
check(missing.status === 2, "missing target is a tool error (exit 2)");

for (const o of outs) rmSync(o, { recursive: true, force: true });
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("cdp-qa tests passed");
