#!/usr/bin/env node
/**
 * Suite tests for the CEO-verdict calibration flow (tools/profile/):
 * corpus import laws, deterministic weight fitting, and the blind-validation
 * gate. All corpora here are SYNTHETIC fixtures built in tmp dirs — the suite
 * itself ships empty of anyone's taste (privacy law, PROFILE.md).
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importCorpus, loadCorpus } from "./calibration-corpus.mjs";
import { calibrateWeights } from "./calibrate-profile.mjs";
import { runBlindGate } from "./blind-gate.mjs";
import { runProfileCalibration } from "./run-profile-calibration.mjs";

let passed = 0;

function entry(overrides) {
  return {
    id: "t-1",
    product: "synthetic",
    date: "2026-09-28",
    kind: "negative",
    verdict_quote: "synthetic verdict quote for the flow test",
    context: "synthetic context",
    principle: "synthetic principle",
    source: { desk: "synthetic/desk.md:1" },
    ...overrides,
  };
}

// --- Import laws -----------------------------------------------------------
assert.throws(() => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [] }), /non-empty array/, "empty corpus rejected");
assert.throws(() => importCorpus({ schema_version: 2, kind: "tastecheck-calibration-corpus", entries: [entry()] }), /schema_version/, "wrong schema rejected");
assert.throws(() => importCorpus({ schema_version: 1, kind: "something-else", entries: [entry()] }), /kind must be/, "wrong corpus kind rejected");
assert.throws(
  () => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [entry({ verdict_quote: " " })] }),
  /verdict_quote required/,
  "empty verdict quote rejected (verbatim-quote law)",
);
assert.throws(
  () => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [entry({ source: {} })] }),
  /source\.desk required/,
  "missing desk-of-record citation rejected (corpus law)",
);
assert.throws(
  () => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [entry(), entry()] }),
  /duplicate id/,
  "duplicate ids rejected",
);
assert.throws(
  () => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [entry({ salience: { "not-a-dimension": 1 } })] }),
  /not a canonical dimension/,
  "non-canonical salience dimension rejected",
);
assert.throws(
  () => importCorpus({ schema_version: 1, kind: "tastecheck-calibration-corpus", entries: [entry({ salience: { boldness: 1.5 } })] }),
  /\[-1, 1\]/,
  "out-of-range salience rejected",
);
passed++;

// Derived salience: a raw loved-corpus entry imports as-is via the lexicon.
const derived = importCorpus({
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [entry({ id: "d-1", verdict_quote: "i hate the diagonal lines, it does not read as glass", principle: "the metaphor IS the spec" })],
});
assert.equal(derived.entries[0].salience_source, "derived");
assert.ok(derived.entries[0].salience["material-depth"] < 0, "lexicon maps material language with the verdict's negative sign");
passed++;

// Explicit salience wins and process-only entries are imported but not scoreable.
const mixed = importCorpus({
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [
    entry({ id: "m-1", salience: { "verification-cost": -1 } }),
    entry({ id: "m-2", kind: "positive", salience: {} }),
  ],
});
assert.equal(mixed.entries[0].layer, "process");
assert.equal(mixed.entries[0].scoreable, false, "process-only verdict never personalizes taste weights");
assert.equal(mixed.entries[1].salience_source, "explicit");
assert.equal(mixed.entries[1].scoreable, false, "explicit-empty salience is imported and counted, not dropped");
assert.equal(mixed.stats.process_only, 2);
passed++;

// --- Runner: deterministic, measured --------------------------------------
const conflictCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [
    entry({ id: "t-1", salience: { boldness: -1, composition: 1 } }),
    entry({ id: "t-2", salience: { boldness: -0.8, composition: 0.6 } }),
    entry({ id: "t-3", kind: "positive", salience: { boldness: 1, composition: -0.6 } }),
    entry({ id: "t-5", kind: "positive", salience: { boldness: 0.8, composition: -0.8 } }),
    entry({ id: "t-6", salience: { boldness: -1 } }),
    entry({ id: "t-7", kind: "positive", salience: { composition: 0.7, boldness: 0.5 } }),
    entry({ id: "t-8", salience: { boldness: -0.9, composition: 0.9 } }),
    // held-out by the deterministic split (sorted index % 4 === 3): t-4, t-8
    entry({ id: "t-4", kind: "positive", salience: { boldness: 0.8, composition: -0.8 } }),
    entry({ id: "t-9", salience: { boldness: -1, composition: 0.5 } }),
  ],
};
const fit1 = calibrateWeights(importCorpus(conflictCorpus).entries);
const fit2 = calibrateWeights(importCorpus(conflictCorpus).entries);
assert.deepEqual(fit1.weights, fit2.weights, "same corpus -> same weights, always");
assert.ok(fit1.weights.boldness > 1, "the dimension that sides with upheld verdicts gains weight");
assert.ok(fit1.weights.composition < 1, "the dominated dimension loses relative weight");
assert.equal(fit1.evidence.composition.count > 0, true, "evidence counts are recorded");
passed++;

// --- Blind gate: calibration must measurably predict better ---------------
const gate = runBlindGate(importCorpus(conflictCorpus).entries, fit1.params);
assert.equal(gate.verdict, "pass", `gate should pass on a conflict corpus (got ${gate.verdict}: cal ${gate.calibrated?.accuracy} vs unc ${gate.uncalibrated?.accuracy})`);
assert.ok(gate.delta > 0, "measured delta is positive on conflict data");
assert.equal(gate.split.heldout.length, 2, "deterministic split held out exactly every 4th scoreable entry");
passed++;

// A conflict-free corpus cannot distinguish any weighting from the default:
// the gate says no-win IN DATA, never fakes a claim.
const flatCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: Array.from({ length: 8 }, (_, index) =>
    entry({ id: `f-${index + 1}`, salience: { composition: index % 2 ? 1 : -1 }, kind: index % 2 ? "positive" : "negative" })),
};
const flatGate = runBlindGate(importCorpus(flatCorpus).entries, fit1.params);
assert.equal(flatGate.verdict, "no-win", "conflict-free corpus cannot claim calibration wins");
assert.equal(flatGate.conflicts.conflict_entry_count, 0, "zero conflicts is reported as the measured reason");
assert.equal(flatGate.delta, 0, "delta is honestly zero, not massaged");
passed++;

// Small corpora refuse to gate at all rather than guessing.
const tinyGate = runBlindGate(importCorpus({ ...conflictCorpus, entries: conflictCorpus.entries.slice(0, 3) }).entries, fit1.params);
assert.equal(tinyGate.verdict, "insufficient-corpus");
passed++;

// --- CLI flow: receipts land only where the user points -------------------
const tmp = mkdtempSync(join(tmpdir(), "tastecheck-profile-test-"));
const corpusPath = join(tmp, "corpus.json");
writeFileSync(corpusPath, JSON.stringify(conflictCorpus, null, 2));
const loaded = loadCorpus(corpusPath);
assert.equal(loaded.stats.total, conflictCorpus.entries.length);
const { receipt } = runProfileCalibration({
  corpusPath,
  receiptPath: join(tmp, "receipt.json"),
  profileOutPath: join(tmp, "weights.json"),
  write: true,
});
assert.equal(receipt.kind, "tastecheck-profile-calibration-receipt");
assert.equal(receipt.gate.verdict, "pass");
assert.ok(receipt.outputs.receipt.startsWith(tmpdir()), "receipt written to the user-local path");
passed++;

console.log(`profile calibration flow tests: ${passed} passed (gate delta ${gate.delta}, calibrated ${gate.calibrated.accuracy} vs uncalibrated ${gate.uncalibrated.accuracy} on held-out)`);
