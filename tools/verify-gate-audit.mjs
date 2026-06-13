#!/usr/bin/env node
// Gate-audit asset regression — pure Node, no browser, no dependency.
//
// Executes skills/tastecheck-pass/assets/gate-audit.js VERBATIM against a minimal
// hand-authored fake DOM and asserts its structured + console contract. Scope is
// deliberate (the fidelity line from the plan's consensus review): this guards only
// the ATTRIBUTE-PURE checks — check 1 ([hidden] defeated by a CSS display rule) and
// check 3 (aria-busy on a fresh load) — plus the window.__gateAudit / console output
// contract. It does NOT emulate computed-style cascade, layout, or case-insensitive
// substring selectors, so it makes NO claim about the layout-dependent checks (card
// grids, stat bands, pill CTAs, gradient, font face). Those are protected by the real
// browser fixture in tools/smoke/fixtures/ (see tools/smoke/README.md) instead — a
// fake-DOM shim faithful enough to run them honestly would be a partial browser, and
// a shim that's subtly wrong would be a green test that lies.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const assetPath = join(root, "skills/tastecheck-pass/assets/gate-audit.js");
const goldenPath = join(root, "tools/smoke/fixtures/gate-audit-golden.txt");
const assetText = readFileSync(assetPath, "utf8");

const failures = [];
const fail = (m) => failures.push(m);

// ---- minimal fake DOM -------------------------------------------------------
const STYLE_DEFAULTS = {
  display: "block", visibility: "visible", opacity: "1", fontSize: "16px",
  borderRadius: "0px", boxShadow: "none", backgroundImage: "none", fontFamily: "Georgia",
  borderTopWidth: "0px", borderBottomWidth: "0px", borderLeftWidth: "0px", borderRightWidth: "0px",
};
const RECT_DEFAULT = { width: 100, height: 40 };

// Atomic match for the finite selector vocabulary the asset actually uses.
function atom(node, a) {
  a = a.trim();
  if (a === "*") return true;
  let m;
  if ((m = a.match(/^\[([a-z-]+)="([^"]*)"\s*(i)?\]$/))) {
    return String(node.attrs[m[1]] ?? "") === m[2];
  }
  if ((m = a.match(/^\[class\*="([^"]*)"\s*i\]$/))) {
    const v = m[1].toLowerCase();
    return node.classList.some((c) => c.toLowerCase().includes(v));
  }
  if ((m = a.match(/^\[([a-z-]+)\]$/))) {
    const key = m[1];
    return key === "hidden" ? node.attrs.hidden === true : node.attrs[key] != null;
  }
  return node.tagName === a.toUpperCase(); // bare tag name
}
const matchesSel = (node, sel) => sel.split(",").some((g) => atom(node, g));

let ALL = []; // every node in the current fixture, document order

function mk(tag, opts = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    id: opts.id || "",
    classList: opts.classes ? [...opts.classes] : [],
    attrs: opts.attrs || {},
    _style: { ...STYLE_DEFAULTS, ...(opts.style || {}) },
    _rect: { ...RECT_DEFAULT, ...(opts.rect || {}) },
    _ownText: opts.text || "",
    children: opts.children || [],
    parentElement: null,
    get textContent() {
      return this._ownText + this.children.map((c) => c.textContent).join("");
    },
    getBoundingClientRect() { return { ...this._rect, top: 0, left: 0, right: this._rect.width, bottom: this._rect.height }; },
    matches(sel) { return matchesSel(this, sel); },
    closest(sel) { let e = this; while (e) { if (matchesSel(e, sel)) return e; e = e.parentElement; } return null; },
    contains(other) { let e = other; while (e) { if (e === this) return true; e = e.parentElement; } return false; },
    querySelectorAll(sel) {
      const descend = (n, out) => { for (const c of n.children) { if (matchesSel(c, sel) || sel === "*") out.push(c); descend(c, out); } return out; };
      return descend(this, []);
    },
  };
  for (const c of node.children) c.parentElement = node;
  return node;
}

function makeDoc(body) {
  ALL = [];
  const walk = (n) => { ALL.push(n); n.children.forEach(walk); };
  walk(body);
  const everythingUnderBody = ALL.filter((n) => n !== body);
  return {
    body,
    querySelectorAll(sel) {
      if (sel === "body *") return everythingUnderBody;
      if (sel === "body, body *") return [body, ...everythingUnderBody];
      return ALL.filter((n) => matchesSel(n, sel));
    },
    querySelector(sel) { return ALL.find((n) => matchesSel(n, sel)) || null; },
  };
}

// Run the asset verbatim against a fixture; return {result, log}.
function audit(body) {
  const logs = [];
  const prevLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  globalThis.window = {};
  globalThis.document = makeDoc(body);
  globalThis.getComputedStyle = (el) => el._style;
  try {
    new Function(assetText)();
  } finally {
    console.log = prevLog;
  }
  return { result: globalThis.window.__gateAudit, fn: globalThis.window.gateAudit, log: logs.join("\n") };
}

// ---- fixtures ---------------------------------------------------------------
// Case A — [hidden] defeated by display:block (check 1). Canonical golden fixture.
const caseA = mk("body", { children: [
  mk("div", { attrs: { hidden: true }, style: { display: "block" }, text: "boom" }),
]});
// Case B — aria-busy stuck on a fresh load (check 3).
const caseB = mk("body", { children: [
  mk("div", { attrs: { "aria-busy": "true" }, text: "loading" }),
]});
// Case C — [hidden] correctly applied (display:none): clean control (check 1 negative).
const caseC = mk("body", { children: [
  mk("div", { attrs: { hidden: true }, style: { display: "none" }, text: "hidden ok" }),
]});

// ---- assertions -------------------------------------------------------------
const a = audit(caseA);
const b = audit(caseB);
const c = audit(caseC);

// Structured contract.
for (const [label, run] of [["A", a], ["B", b], ["C", c]]) {
  const r = run.result;
  if (!r || typeof r !== "object") { fail(`case ${label}: window.__gateAudit is not an object`); continue; }
  if (typeof r.verdict !== "string") fail(`case ${label}: result.verdict is not a string`);
  for (const k of ["fails", "warns", "notes"]) if (!Array.isArray(r[k])) fail(`case ${label}: result.${k} is not an array`);
  if (typeof run.fn !== "function") fail(`case ${label}: window.gateAudit is not a re-run function`);
  if (!/TASTECHECK GATE AUDIT/.test(run.log)) fail(`case ${label}: console path did not emit the report`);
}

// If the structured contract is broken, the per-check assertions below would crash on
// undefined results — report cleanly and stop here instead.
if (failures.length) {
  console.error(`gate-audit verification failed (${failures.length})`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

// Check 1 — [hidden] defeated → FAIL, exactly one fail line, names the defect.
if (a.result.verdict !== "FAIL") fail(`case A: expected verdict FAIL, got ${a.result?.verdict}`);
if (a.result.fails.length !== 1) fail(`case A: expected 1 fail, got ${a.result?.fails.length}`);
if (!/\[hidden\] rendered visible/.test(a.result.fails[0] || "")) fail(`case A: fail line did not name the hidden-defeat defect`);

// Check 3 — aria-busy visible → FAIL naming the busy state.
if (b.result.verdict !== "FAIL") fail(`case B: expected verdict FAIL, got ${b.result?.verdict}`);
if (!b.result.fails.some((f) => /aria-busy="true" on a fresh load/.test(f))) fail(`case B: no aria-busy fail line`);

// Check 1 negative — correctly hidden → CLEAN.
if (c.result.verdict !== "CLEAN") fail(`case C: expected verdict CLEAN, got ${c.result?.verdict}`);
if (c.result.fails.length || c.result.warns.length) fail(`case C: expected no fails/warns, got ${c.result.fails.length}/${c.result.warns.length}`);

// Verbatim console (Principle 4) — golden-string equality on the canonical fixture.
// Regenerate with: UPDATE_GOLDEN=1 node tools/verify-gate-audit.mjs
if (process.env.UPDATE_GOLDEN) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "tools/smoke/fixtures"), { recursive: true });
  writeFileSync(goldenPath, a.log + "\n");
  console.log("gate-audit: golden updated");
} else {
  let golden;
  try { golden = readFileSync(goldenPath, "utf8"); } catch { fail(`golden missing: ${goldenPath} (run UPDATE_GOLDEN=1)`); }
  if (golden !== undefined && a.log + "\n" !== golden) {
    fail("case A: console output drifted from the committed golden (Principle 4: verbatim paste path changed)");
    fail(`  got:\n${a.log}`);
  }
}

if (failures.length) {
  console.error(`gate-audit verification failed (${failures.length})`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("gate-audit asset verification passed (checks 1 & 3 + structured/console contract)");
