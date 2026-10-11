#!/usr/bin/env node
/** Validates the taste corpus and exercises the taste calibration runner. */
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { run, checkAgainstBaseline, classifyFinding } from "./run-taste-calibration.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CASES = join(ROOT, "evals/taste/cases");
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error(`FAIL: ${msg}`); } };

const files = readdirSync(CASES).filter((f) => f.endsWith(".json")).sort();
ok(files.length >= 30, `expected >= 30 cases, found ${files.length}`);
const ids = new Set();
const count = { slop: 0, crafted: 0, repo: 0, authored: 0 };
for (const f of files) {
  let c;
  try { c = JSON.parse(readFileSync(join(CASES, f), "utf8")); } catch (e) { ok(false, `${f} invalid JSON`); continue; }
  ok(c.schema_version === 1, `${f}: schema_version 1`);
  ok(c.kind === "taste-case", `${f}: kind taste-case`);
  ok(c.id === f.replace(/\.json$/, ""), `${f}: id matches filename`);
  ok(!ids.has(c.id), `${f}: duplicate id`); ids.add(c.id);
  ok(["slop", "crafted"].includes(c.label), `${f}: label`);
  ok(["repo", "authored"].includes(c.source_group), `${f}: source_group`);
  ok(["repo-sample", "repo-demo", "authored-fixture"].includes(c.provenance?.kind), `${f}: provenance.kind`);
  ok(typeof c.provenance?.why_this_label === "string" && c.provenance.why_this_label.length > 20, `${f}: provenance.why_this_label`);
  ok(c.provenance?.path || c.provenance?.description, `${f}: provenance path or description`);
  ok((c.provenance?.kind === "authored-fixture") === (c.source_group === "authored"), `${f}: authored-fixture iff authored group`);
  ok(typeof c.target === "string" && c.target.endsWith(".html") && !c.target.startsWith("/") && !c.target.includes(".."), `${f}: target is a repo-relative html path`);
  ok(existsSync(join(ROOT, c.target)), `${f}: target exists (${c.target})`);
  ok(Array.isArray(c.viewports) && c.viewports.length >= 2 && c.viewports.every((v) => v.width > 0 && v.height > 0 && v.name), `${f}: viewports`);
  count[c.label]++; count[c.source_group]++;
}
ok(count.slop >= 16, `slop cases >= 16 (${count.slop})`);
ok(count.crafted >= 14, `crafted cases >= 14 (${count.crafted})`);
ok(files.filter((f) => f.startsWith("fixture-slop-")).length >= 15, "at least 15 authored slop fixtures");
ok(files.filter((f) => f.startsWith("fixture-crafted-")).length >= 6, "at least 6 authored crafted fixtures");
ok(classifyFinding("pill text CTA: x") === "pill-text-cta" && classifyFinding("content at opacity 0 on load") === null, "classifyFinding");

const dir = mkdtempSync(join(tmpdir(), "taste-cal-"));
try {
  const out = await run({ reportDir: dir });
  if (out.skipped) {
    console.log("skipped: no browser (corpus validated; runner not exercised)");
    process.exit(failed || (process.env.CI === "true") ? 1 : 0);
  }
  const { report } = out;
  const m = report.overall;
  ok(m.cases === files.length, "report covers every case");
  ok(m.errors === 0, `no errored cases (${m.errors})`);
  ok(m.TP + m.FN === count.slop && m.TN + m.FP === count.crafted, "confusion counts add up to label totals");
  for (const k of ["recall", "precision", "fpr", "fnr"]) ok(k in m, `report has ${k}`);
  ok(report.repo.cases + report.authored.cases === m.cases, "repo + authored split covers all cases");
  const jsonReport = readdirSync(dir).find((f) => /^taste-\d{4}-\d\d-\d\d\.json$/.test(f));
  const mdReport = readdirSync(dir).find((f) => /^taste-\d{4}-\d\d-\d\d\.md$/.test(f));
  ok(jsonReport && mdReport, "dated JSON + Markdown reports written");
  if (mdReport) { const md = readFileSync(join(dir, mdReport), "utf8"); ok(/BLOCKED/.test(md) && /\| overall \|/.test(md) && /Per-case table/.test(md), "markdown report has scope note, summary and per-case table"); }
  const chk = checkAgainstBaseline(report);
  ok(chk.ok, `baseline check passes: ${(chk.problems || []).join("; ")}`);
  const worse = structuredClone(report); worse.overall.FP += 1;
  ok(!checkAgainstBaseline(worse).ok, "check fails when FP increases");
  const lower = structuredClone(report); lower.overall.TP -= 1;
  ok(!checkAgainstBaseline(lower).ok, "check fails when TP decreases");
} finally { rmSync(dir, { recursive: true, force: true }); }

if (failed) { console.error(`${failed} taste-calibration test failure(s)`); process.exit(1); }
console.log(`taste-calibration tests passed (${files.length} cases: ${count.slop} slop / ${count.crafted} crafted; ${count.repo} repo / ${count.authored} authored)`);
