#!/usr/bin/env node
/**
 * Suite test for the calibration corpus — the dogfood gate's in-test form.
 * Runs the full calibration in-memory (no file writes) and enforces the
 * corpus laws: every case cites its desk of record, known-open cases are
 * explicit, and the measured FP/FN counts are not worse than the recorded
 * baseline (the same check `npm run calibrate:check` applies).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCalibration, checkAgainstBaseline } from "./run-calibration.mjs";

let passed = 0;

const report = runCalibration({ write: false });
assert.equal(report.kind, "tastecheck-calibration-report");
assert.ok(report.corpus.case_count >= 16, `corpus shrank: ${report.corpus.case_count}`);
assert.equal(report.corpus.bad + report.corpus.clean, report.corpus.case_count);
passed++;

// Rates are consistent with counts (every measurement claim reconciles).
const { counts, rates } = report;
assert.equal(rates.false_positive_rate, counts.FP + counts.TN === 0 ? 0 : Number((counts.FP / (counts.FP + counts.TN)).toFixed(4)));
assert.equal(rates.false_negative_rate, counts.FN + counts.TP === 0 ? 0 : Number((counts.FN / (counts.FN + counts.TP)).toFixed(4)));
passed++;

// Known-open law: every known-open FN is listed in the report's floor section.
const knownOpenFn = report.cases.filter((row) => row.known_open && row.result === "FN");
assert.deepEqual(report.known_open.map((item) => item.id).sort(), knownOpenFn.map((row) => row.id).sort());
passed++;

// The v0 standing floor is exactly the hollow-signal residual — if this
// flips to TP a cure landed: update the case expectation and the baseline.
assert.equal(knownOpenFn.filter((row) => row.class === "hollow-signal-verification").length, 1);
passed++;

// Clean cases must never leak forbidden strings into the emitted report.
assert.equal(report.cases.filter((row) => row.label === "clean" && row.result === "FP").length, counts.FP);
passed++;

// Dogfood gate: no regression vs the recorded baseline.
const baselineVerdict = checkAgainstBaseline(report);
assert.equal(baselineVerdict.ok, true, baselineVerdict.failures?.join("; ") ?? "baseline check failed");
passed++;

// Loved-corpus journal law: every entry quotes a CEO verdict verbatim, cites
// its desk of record, extracts one principle, and ids stay unique.
import { existsSync } from "node:fs";
const lovedPath = new URL("../../evals/corpus/loved/loved-corpus.json", import.meta.url);
// Taste profiles are USER-LOCAL and never shipped in-repo (privacy law 2026-09-25).
// When a local profile is present it must be well-formed; when absent, skip.
const loved = existsSync(lovedPath) ? JSON.parse(readFileSync(lovedPath, "utf8")) : { entries: [] };
if (loved.entries.length === 0) { console.log("loved-corpus: no user-local profile present — profile checks skipped"); }

if (loved.entries.length > 0) assert.ok(loved.entries.length >= 15, `loved-corpus too thin: ${loved.entries.length}`);
const lovedIds = new Set(loved.entries.map((entry) => entry.id));
assert.equal(lovedIds.size, loved.entries.length, "loved-corpus ids must be unique");
for (const entry of loved.entries) {
  for (const field of ["id", "product", "date", "kind", "verdict_quote", "context", "principle"]) {
    assert.ok(typeof entry[field] === "string" && entry[field].length > 0, `loved-corpus ${entry.id}: ${field} required`);
  }
  assert.ok(entry.source?.desk, `loved-corpus ${entry.id}: source.desk required`);
}
passed++;

console.log(`calibration corpus tests: ${passed} passed (corpus ${report.corpus.case_count} cases; FPR ${rates.false_positive_rate}, FNR ${rates.false_negative_rate}; loved-corpus ${loved.entries.length} entries)`);
