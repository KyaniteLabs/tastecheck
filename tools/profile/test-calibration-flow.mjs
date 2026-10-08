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

// Prune law: a SuperSeded entry is kept for provenance but excluded from the
// scoreable set (never fitted, never held out), and the exclusion is counted.
const pruned = importCorpus({
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [
    entry({ id: "p-1", salience: { composition: 1 }, status: "SuperSeded" }),
    entry({ id: "p-2", salience: { composition: -1 } }),
  ],
});
assert.equal(pruned.entries[0].status, "SuperSeded", "superseded status is carried on the imported entry");
assert.equal(pruned.entries[0].scoreable, false, "superseded entry is excluded from calibration splits");
assert.equal(pruned.entries[1].scoreable, true, "active entry stays scoreable");
assert.equal(pruned.stats.superseded, 1, "superseded count recorded in stats");
assert.equal(pruned.stats.superseded_scoreable_excluded, 1, "taste-dimension supersession counted");
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
assert.deepEqual(fit1.side_weights, fit2.side_weights, "same corpus -> same dominance side weights, always");
assert.ok(fit1.weights.boldness > 1, "the dimension with aligned evidence gains combined weight");
assert.ok(fit1.side_weights.violated.boldness > fit1.side_weights.satisfied.boldness, "boldness's denial-power exceeds its saving-power where its evidence is violation-heavy");
assert.equal(fit1.side_weights.violated.composition, 1, "zero violation evidence -> the violated side stays at the default weight (per-side silence law)");
assert.ok(fit1.side_weights.violated.boldness > fit1.side_weights.satisfied.composition, "side weights compete on ONE shared scale (dominance comparability)");
assert.equal(fit1.evidence.composition.count > 0, true, "evidence counts are recorded");
passed++;

// --- Blind gate: calibration must measurably predict better ---------------
const gate = runBlindGate(importCorpus(conflictCorpus).entries, fit1.params);
assert.equal(gate.verdict, "pass", `gate should pass on a conflict corpus (got ${gate.verdict}: cal ${gate.calibrated?.accuracy} vs unc ${gate.uncalibrated?.accuracy})`);
assert.ok(gate.delta > 0, "measured delta is positive on conflict data");
assert.equal(gate.split.heldout.length, 2, "deterministic split held out exactly every 4th scoreable entry");
assert.ok(gate.split.heldout.includes("t-4") || gate.split.heldout.includes("t-8"), "the regular held-out slice includes a conflict example");
passed++;

// Conflict presence deterministically shapes the holdout when regular
// modulo positions contain no conflicts.
const stratifiedCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: Array.from({ length: 8 }, (_, index) => entry({
    id: `s-${index + 1}`,
    salience: index < 2 ? { boldness: -1, composition: 0.5 } : { composition: index % 2 ? 1 : -1 },
  })),
};
const stratifiedEntries = importCorpus(stratifiedCorpus).entries;
const stratifiedGate = runBlindGate(stratifiedEntries, fit1.params);
const repeatStratifiedGate = runBlindGate(stratifiedEntries, fit1.params);
assert.deepEqual(stratifiedGate.split, repeatStratifiedGate.split, "conflict-aware split remains deterministic");
assert.ok(stratifiedGate.split.heldout.some((id) => id === "s-1" || id === "s-2"), "held-out always includes a conflict when the corpus contains one");
assert.equal(stratifiedGate.split.heldout.length, 2, "conflict stratification preserves holdout size");
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

// Dominance law end-to-end (the conflict-class shape): a dimension repeatedly
// violated in denials must out-power one merely satisfied in upholds, and a
// held-out conflict mixing the two must flip to the violated side — which the
// plain unit-weight sum cannot do (its ±1 salience cancels to an abstain).
const dominanceCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [
    entry({ id: "d-1", salience: { "color-register": -1 } }),
    entry({ id: "d-2", salience: { "color-register": -1 } }),
    entry({ id: "d-3", kind: "positive", salience: { boldness: 1 } }),
    entry({ id: "d-5", salience: { "color-register": -0.5 } }),
    entry({ id: "d-6", kind: "positive", salience: { boldness: 0.5 } }),
    entry({ id: "d-7", kind: "positive", salience: { boldness: 0.5 } }),
    // held-out by the deterministic split: d-4, d-8. d-4 is the conflict:
    // boldness satisfied +1, color-register violated -1, verdict DENIED.
    entry({ id: "d-4", salience: { boldness: 1, "color-register": -1 } }),
    entry({ id: "d-8", salience: { "drift-fidelity": -1 } }),
  ],
};
const dominanceFit = calibrateWeights(importCorpus(dominanceCorpus).entries.filter((e) => e.id !== "d-4" && e.id !== "d-8"));
assert.ok(
  dominanceFit.side_weights.violated["color-register"] > dominanceFit.side_weights.satisfied.boldness,
  "violated-dimension dominance: denial power of the violated dimension out-weighs saving power of the satisfied one",
);
const dominanceGate = runBlindGate(importCorpus(dominanceCorpus).entries, fit1.params);
assert.equal(dominanceGate.verdict, "pass", `dominance gate must pass on conflict-class data (got ${dominanceGate.verdict}: cal ${dominanceGate.calibrated?.accuracy} vs unc ${dominanceGate.uncalibrated?.accuracy})`);
assert.ok(dominanceGate.delta > 0, "dominance structure earns a measured positive delta");
const dominanceCase = dominanceGate.per_case.find((row) => row.id === "d-4");
assert.equal(dominanceCase.calibrated.correct, true, "calibrated profile resolves the conflict to the violated side");
assert.equal(dominanceCase.uncalibrated.abstain, true, "plain unit-weight sum cancels to an abstain on the same conflict");
passed++;

// Shared scale: one unit of violation balance buys exactly what one unit of
// satisfaction balance buys — the two sides must stay comparable.
const sharedScaleCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: [
    entry({ id: "q-1", salience: { boldness: -1 } }),
    entry({ id: "q-2", kind: "positive", salience: { composition: 1 } }),
    entry({ id: "q-3", salience: { "type-voice": -0.5 } }),
    entry({ id: "q-4", kind: "positive", salience: { "interaction-fit": 0.5 } }),
  ],
};
const sharedFit = calibrateWeights(importCorpus(sharedScaleCorpus).entries);
assert.equal(
  sharedFit.side_weights.violated.boldness,
  sharedFit.side_weights.satisfied.composition,
  "equal violated and satisfied balances earn equal weights (one shared normalization scale)",
);
passed++;

// Reduction law: with zero aligned evidence the fit earns nothing — every
// weight (both sides) stays at the default 1.0 and the gate measures delta 0,
// so the dominance machinery adds no power the corpus did not pay for.
const oppositeSideCorpus = {
  schema_version: 1,
  kind: "tastecheck-calibration-corpus",
  entries: Array.from({ length: 8 }, (_, index) =>
    entry({ id: `o-${index + 1}`, salience: { composition: 1 } })),
};
const oppositeImport = importCorpus(oppositeSideCorpus);
const oppositeFit = calibrateWeights(oppositeImport.entries);
for (const dimension of Object.keys(oppositeFit.weights)) {
  assert.equal(oppositeFit.weights[dimension], 1, `no aligned evidence -> default combined weight for ${dimension}`);
  assert.equal(oppositeFit.side_weights.violated[dimension], 1, `no violation evidence -> default violated weight for ${dimension}`);
  assert.equal(oppositeFit.side_weights.satisfied[dimension], 1, `no satisfaction evidence -> default satisfied weight for ${dimension}`);
}
const oppositeGate = runBlindGate(oppositeImport.entries, fit1.params);
assert.equal(oppositeGate.delta, 0, "an all-default fit cannot distinguish itself from the default (delta 0)");
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
