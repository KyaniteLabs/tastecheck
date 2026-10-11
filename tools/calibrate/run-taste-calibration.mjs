#!/usr/bin/env node
/**
 * tastecheck taste calibration - measure whether the browser-lane tell detector
 * (skills/tastecheck-pass/assets/gate-audit.js) separates generic AI-default UI
 * ("slop") from deliberate, brief-specific UI ("crafted").
 *
 * Law: evals/taste/TASTE-CORPUS.md. Cases: evals/taste/cases/*.json.
 *
 * Usage:
 *   node tools/calibrate/run-taste-calibration.mjs                  # run + write dated reports
 *   node tools/calibrate/run-taste-calibration.mjs --quiet          # one-line summary
 *   node tools/calibrate/run-taste-calibration.mjs --check          # fail if TP fell or FP rose vs baseline
 *   node tools/calibrate/run-taste-calibration.mjs --write-baseline # record this run as evals/taste/baseline.json
 *   --report-dir <dir>   write reports elsewhere (default evals/taste/reports)
 *
 * No browser -> prints "skipped: no browser" and exits 0 (exit 1 with --check and CI=true).
 * Effectiveness remains BLOCKED; this measures surface-tell detection only.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CASES_DIR = join(ROOT, "evals/taste/cases");
const DEFAULT_REPORT_DIR = join(ROOT, "evals/taste/reports");
const BASELINE_PATH = join(ROOT, "evals/taste/baseline.json");
const AUDIT_JS = join(ROOT, "skills/tastecheck-pass/assets/gate-audit.js");
const FALLBACK_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** Which gate-audit messages are surface/template tells (vs. cold-load state integrity). */
export const TELL_PATTERNS = [
  ["uniform-card-grid", /^uniform card grid/],
  ["stat-counter-band", /^stat-counter band/],
  ["default-display-face", /^display face resolves to/],
  ["pill-text-cta", /^pill text CTA/],
  ["indigo-violet-gradient", /^indigo.violet gradient/],
];
export function classifyFinding(message) {
  for (const [id, re] of TELL_PATTERNS) if (re.test(message)) return id;
  return null;
}

export function loadCases() {
  return readdirSync(CASES_DIR).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const c = JSON.parse(readFileSync(join(CASES_DIR, f), "utf8"));
    c._file = f;
    return c;
  });
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp" };
function startServer() {
  const server = createServer((req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = resolve(ROOT, "." + rel);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(file));
    } catch { res.writeHead(500).end(); }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function launchBrowser() {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { return null; }
  try { return await chromium.launch(); } catch { /* fall through */ }
  if (existsSync(FALLBACK_CHROME)) { try { return await chromium.launch({ executablePath: FALLBACK_CHROME }); } catch { /* none */ } }
  return null;
}

async function auditOne(browser, base, c) {
  const viewports = [];
  for (const vp of c.viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const assetErrors = [];
    page.on("response", (r) => { if (r.status() >= 400) assetErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    let rec;
    try {
      await page.goto(`${base}/${c.target}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.addScriptTag({ path: AUDIT_JS });
      const audit = await page.evaluate(() => window.__gateAudit);
      const findings = [...audit.fails.map((m) => ({ level: "fail", message: m })), ...audit.warns.map((m) => ({ level: "warn", message: m }))]
        .map((f) => ({ ...f, tell: classifyFinding(f.message) }));
      rec = { viewport: vp.name, width: vp.width, verdict: audit.verdict, tells: findings.filter((f) => f.tell), other_findings: findings.filter((f) => !f.tell), notes: audit.notes, asset_errors: assetErrors };
    } catch (error) {
      rec = { viewport: vp.name, width: vp.width, error: String(error.message || error).split("\n")[0], asset_errors: assetErrors };
    }
    await ctx.close();
    viewports.push(rec);
  }
  const errored = viewports.some((v) => v.error);
  const tellIds = [...new Set(viewports.flatMap((v) => (v.tells || []).map((t) => t.tell)))];
  const fired = tellIds.length > 0;
  let outcome;
  if (errored) outcome = "ERROR";
  else if (c.label === "slop") outcome = fired ? "TP" : "FN";
  else outcome = fired ? "FP" : "TN";
  return { id: c.id, label: c.label, group: c.source_group, kind: c.provenance.kind, target: c.target, outcome, tells_fired: tellIds, viewports };
}

const ratio = (n, d) => (d ? Math.round((n / d) * 1000) / 1000 : null);
export function metrics(results) {
  const n = (o) => results.filter((r) => r.outcome === o).length;
  const TP = n("TP"), FN = n("FN"), TN = n("TN"), FP = n("FP");
  return { cases: results.length, errors: n("ERROR"), TP, FN, TN, FP, recall: ratio(TP, TP + FN), precision: ratio(TP, TP + FP), fpr: ratio(FP, FP + TN), fnr: ratio(FN, FN + TP) };
}
const pct = (v) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

function renderMarkdown(report) {
  const L = [];
  L.push(`# Taste calibration - ${report.date}`, "");
  L.push("Detector: `skills/tastecheck-pass/assets/gate-audit.js` (surface tells only). Law: `evals/taste/TASTE-CORPUS.md`.", "");
  L.push("**Scope:** this measures whether countable surface tells separate slop-labeled from crafted-labeled pages. It does not measure composition or brand fit, and it does not clear the effectiveness BLOCKED status.", "");
  L.push("| slice | cases | TP | FN | TN | FP | recall | precision | FPR | FNR |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const [name, m] of [["overall", report.overall], ["repo-sourced", report.repo], ["authored", report.authored]])
    L.push(`| ${name} | ${m.cases} | ${m.TP} | ${m.FN} | ${m.TN} | ${m.FP} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.fpr)} | ${pct(m.fnr)} |`);
  L.push("", `Browser: ${report.browser}. Viewports: 1280x800 and 390x844.`, "");
  L.push(`Caught ONLY by the default-display-face tell (no structural or gradient tell): ${report.tp_face_only.length} of ${report.overall.TP} true positives${report.tp_face_only.length ? " - " + report.tp_face_only.map((i) => "`" + i + "`").join(", ") : ""}.`, "");
  L.push("## Misses and false alarms", "");
  const bad = report.results.filter((r) => ["FN", "FP", "ERROR"].includes(r.outcome));
  if (!bad.length) L.push("None.");
  for (const r of bad) {
    const detail = r.outcome === "FP" ? `tells fired: ${r.tells_fired.join(", ")}` : r.outcome === "FN" ? `no template tell fired (verdicts: ${r.viewports.map((v) => v.verdict).join(" / ")})` : r.viewports.map((v) => v.error).filter(Boolean).join("; ");
    L.push(`- **${r.outcome}** \`${r.id}\` (${r.group}, label ${r.label}): ${detail}`);
  }
  L.push("", "## Per-case table", "", "| case | group | label | outcome | desktop | mobile | tells fired |", "|---|---|---|---|---|---|---|");
  for (const r of report.results) {
    const v = (name) => r.viewports.find((x) => x.viewport === name)?.verdict || "error";
    L.push(`| ${r.id} | ${r.group} | ${r.label} | ${r.outcome} | ${v("desktop")} | ${v("mobile")} | ${r.tells_fired.join(", ") || "-"} |`);
  }
  L.push("", "## Findings detail (template tells)", "");
  for (const r of report.results) {
    const lines = r.viewports.flatMap((v) => (v.tells || []).map((t) => `  - ${v.viewport}: ${t.level.toUpperCase()} ${t.message}`));
    if (lines.length) L.push(`- \`${r.id}\``, ...lines);
  }
  const other = report.results.filter((r) => r.viewports.some((v) => v.other_findings?.length));
  if (other.length) {
    L.push("", "## Non-tell findings (cold-load state; ignored for scoring)", "");
    for (const r of other) for (const v of r.viewports) for (const f of v.other_findings || []) L.push(`- \`${r.id}\` ${v.viewport}: ${f.level.toUpperCase()} ${f.message}`);
  }
  const assets = report.results.filter((r) => r.viewports.some((v) => v.asset_errors?.length));
  if (assets.length) {
    L.push("", "## Asset errors (404s while loading)", "");
    for (const r of assets) L.push(`- \`${r.id}\`: ${[...new Set(r.viewports.flatMap((v) => v.asset_errors))].join(", ")}`);
  }
  return L.join("\n") + "\n";
}

export async function run({ reportDir = DEFAULT_REPORT_DIR, write = true } = {}) {
  const cases = loadCases();
  const browser = await launchBrowser();
  if (!browser) return { skipped: true };
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  try { for (const c of cases) results.push(await auditOne(browser, base, c)); }
  finally { await browser.close(); server.close(); }
  const date = new Date().toISOString().slice(0, 10);
  const report = {
    schema_version: 1, kind: "taste-calibration-report", date,
    detector: "skills/tastecheck-pass/assets/gate-audit.js", browser: `chromium ${browser.version?.() || ""}`.trim(),
    scope: "surface-tells-only; effectiveness remains BLOCKED",
    overall: metrics(results), repo: metrics(results.filter((r) => r.group === "repo")), authored: metrics(results.filter((r) => r.group === "authored")),
    tp_face_only: results.filter((r) => r.outcome === "TP" && r.tells_fired.length === 1 && r.tells_fired[0] === "default-display-face").map((r) => r.id),
    results,
  };
  if (write) {
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(join(reportDir, `taste-${date}.json`), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(reportDir, `taste-${date}.md`), renderMarkdown(report));
  }
  return { report, reportDir };
}

export function checkAgainstBaseline(report) {
  if (!existsSync(BASELINE_PATH)) return { ok: false, problems: ["no baseline at evals/taste/baseline.json (run --write-baseline)"] };
  const base = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const problems = [];
  if (report.overall.errors) problems.push(`${report.overall.errors} case(s) errored`);
  if (report.overall.TP < base.overall.TP) problems.push(`TP decreased ${base.overall.TP} -> ${report.overall.TP}`);
  if (report.overall.FP > base.overall.FP) problems.push(`FP increased ${base.overall.FP} -> ${report.overall.FP}`);
  for (const r of report.results) {
    const was = base.outcomes?.[r.id];
    if (was === "TP" && r.outcome !== "TP") problems.push(`case ${r.id}: TP -> ${r.outcome}`);
    if (was === "TN" && r.outcome === "FP") problems.push(`case ${r.id}: TN -> FP`);
  }
  const notes = [];
  if (report.overall.TP > base.overall.TP) notes.push(`TP improved ${base.overall.TP} -> ${report.overall.TP} (refresh the baseline deliberately)`);
  if (report.overall.FP < base.overall.FP) notes.push(`FP improved ${base.overall.FP} -> ${report.overall.FP} (refresh the baseline deliberately)`);
  return { ok: problems.length === 0, problems, notes };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const ri = args.indexOf("--report-dir");
  const reportDir = ri >= 0 ? resolve(args[ri + 1]) : DEFAULT_REPORT_DIR;
  const out = await run({ reportDir });
  if (out.skipped) {
    console.log("skipped: no browser");
    process.exit(flag("--check") && process.env.CI === "true" ? 1 : 0);
  }
  const { report } = out;
  const o = report.overall;
  if (flag("--quiet")) console.log(`taste-calibration: ${o.cases} cases TP ${o.TP} FN ${o.FN} TN ${o.TN} FP ${o.FP} | recall ${pct(o.recall)} FPR ${pct(o.fpr)}`);
  else {
    console.log(renderMarkdown(report));
    console.log(`reports: ${join(reportDir, `taste-${report.date}.{json,md}`)}`);
  }
  if (flag("--write-baseline")) {
    const baseline = { schema_version: 1, kind: "taste-calibration-baseline", date: report.date, scope: report.scope, overall: report.overall, repo: report.repo, authored: report.authored, outcomes: Object.fromEntries(report.results.map((r) => [r.id, r.outcome])) };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`baseline written: ${BASELINE_PATH}`);
  }
  if (flag("--check")) {
    const res = checkAgainstBaseline(report);
    for (const n of res.notes || []) console.log(`note: ${n}`);
    if (!res.ok) { for (const p of res.problems) console.error(`REGRESSION: ${p}`); process.exit(1); }
    console.log("taste-calibration check: ok (no TP loss, no FP gain vs baseline)");
  }
  if (report.overall.errors) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
