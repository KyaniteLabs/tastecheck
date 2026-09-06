#!/usr/bin/env node
// Unit tests for tools/lib/nima.mjs — pure verdict/status logic + mocked HTTP client.
// No live NIMA service required: fetch is swapped for the client cases.
import assert from "node:assert/strict";
import {
  aestheticStatus,
  NIMA_WARN_THRESHOLD,
  isNimaAvailable,
  scoreNima,
  _resetNimaHealthCache,
  nimaVerdict,
  combinedVerdict,
} from "./nima.mjs";

// --- Pure status logic (no service) --------------------------------------
assert.equal(NIMA_WARN_THRESHOLD, 5.5, "Phase 1 WARN threshold is 5.5");
assert.equal(aestheticStatus(null), "n/a");
assert.equal(aestheticStatus(undefined), "n/a");
assert.equal(aestheticStatus(0), "warn");
assert.equal(aestheticStatus(1), "warn");
assert.equal(aestheticStatus(NIMA_WARN_THRESHOLD - 0.01), "warn");
assert.equal(aestheticStatus(NIMA_WARN_THRESHOLD), "ok", "threshold is inclusive on the ok side");
assert.equal(aestheticStatus(NIMA_WARN_THRESHOLD + 1), "ok");
assert.equal(aestheticStatus(10), "ok");

// --- Verdict merge (Phase 1: WARN-only) ----------------------------------
// Mirrors exactly how inspectSurface() applies the rule: low score upgrades a CLEAN
// gate to REVIEW WARNS; n/a and ok never change it; FAIL is never softened or created.
function mergedVerdict(gateVerdict, nimaScore) {
  if (nimaScore == null) return gateVerdict;
  if (nimaScore < NIMA_WARN_THRESHOLD && gateVerdict === "CLEAN") return "REVIEW WARNS";
  return gateVerdict;
}
assert.equal(mergedVerdict("CLEAN", 4.0), "REVIEW WARNS", "low score upgrades CLEAN");
assert.equal(mergedVerdict("CLEAN", NIMA_WARN_THRESHOLD), "CLEAN", "ok score leaves CLEAN untouched");
assert.equal(mergedVerdict("CLEAN", null), "CLEAN", "n/a never changes verdict");
assert.equal(mergedVerdict("REVIEW WARNS", 2.0), "REVIEW WARNS", "REVIEW WARNS is unchanged");
assert.equal(mergedVerdict("FAIL", 2.0), "FAIL", "FAIL is never softened");
assert.equal(mergedVerdict("FAIL", null), "FAIL", "FAIL unchanged when n/a");
assert.equal(mergedVerdict("CLEAN", 9.0), "CLEAN", "high score does not fail a clean gate");

// --- Plan-API aliases (Phase 1 WARN-only; nimaVerdict NEVER returns "fail") -----
assert.equal(nimaVerdict(null), "n/a");
assert.equal(nimaVerdict(2.0), "warn", "low score → warn, never fail (Phase 1)");
assert.equal(nimaVerdict(NIMA_WARN_THRESHOLD), "pass");
assert.equal(combinedVerdict({ verdict: "CLEAN" }, 2.0), "REVIEW WARNS", "low score upgrades CLEAN");
assert.equal(combinedVerdict({ verdict: "CLEAN" }, null), "CLEAN", "n/a leaves CLEAN");
assert.equal(combinedVerdict({ verdict: "CLEAN" }, NIMA_WARN_THRESHOLD), "CLEAN", "ok leaves CLEAN");
assert.equal(combinedVerdict({ verdict: "FAIL" }, 2.0), "FAIL", "FAIL never softened by NIMA");
assert.equal(combinedVerdict({ verdict: "REVIEW WARNS" }, 9.0), "REVIEW WARNS", "REVIEW WARNS never upgraded to CLEAN by a good NIMA score");
assert.equal(combinedVerdict(null, 1.0), "HOLD", "missing gate evidence is non-shippable");
assert.equal(combinedVerdict({}, 1.0), "HOLD", "empty gate evidence is non-shippable");
assert.equal(combinedVerdict({ verdict: "UNKNOWN" }, 1.0), "HOLD", "unknown gate verdict is non-shippable");

// --- Client graceful degradation (mocked fetch, no network) --------------
const realFetch = globalThis.fetch;
const validHistogram = Array.from({ length: 10 }, () => 0.1);

// health down → unavailable → score null (no /score call).
_resetNimaHealthCache();
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/health")) return { ok: false };
  throw new Error("unexpected /score fetch while health is down");
};
assert.equal(await isNimaAvailable(), false, "health down → unavailable");
assert.equal(await scoreNima(Buffer.from([0xff, 0xd8, 0xff])), null, "unavailable → null score");

// health up + valid /score payload → parsed { score, histogram }.
_resetNimaHealthCache();
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/health")) return { ok: true };
  if (String(url).endsWith("/score")) return { ok: true, json: async () => ({ score: 6.42, histogram: validHistogram }) };
  throw new Error(`unexpected fetch ${url}`);
};
assert.equal(await isNimaAvailable(), true, "health up → available");
const scored = await scoreNima(Buffer.from([0xff, 0xd8, 0xff]));
assert.equal(typeof scored?.score, "number");
assert.equal(scored.score, 6.42);
assert.deepEqual(scored.histogram, validHistogram, "histogram has the canonical ten-bin shape");

// Score boundaries are inclusive; non-finite, non-numeric, and out-of-range
// values are malformed service responses, not aesthetic verdicts.
for (const score of [1, 10]) {
  _resetNimaHealthCache();
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/health")) return { ok: true };
    return { ok: true, json: async () => ({ score, histogram: validHistogram }) };
  };
  assert.equal((await scoreNima(Buffer.from([0xff])))?.score, score, `inclusive score boundary ${score} is accepted`);
}
for (const score of [NaN, Infinity, -Infinity, 0, 10.01]) {
  _resetNimaHealthCache();
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/health")) return { ok: true };
    return { ok: true, json: async () => ({ score, histogram: validHistogram }) };
  };
  assert.equal(await scoreNima(Buffer.from([0xff])), null, `invalid score ${String(score)} → null`);
}

for (const histogram of [
  [1, 0],
  [...validHistogram.slice(0, 9), -0.1],
  [...validHistogram.slice(0, 9), NaN],
  [...validHistogram.slice(0, 9), 0.2],
]) {
  _resetNimaHealthCache();
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/health")) return { ok: true };
    return { ok: true, json: async () => ({ score: 6, histogram }) };
  };
  assert.equal(await scoreNima(Buffer.from([0xff])), null, "malformed histogram → null");
}

// health up but malformed payload (no numeric score) → null.
_resetNimaHealthCache();
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/health")) return { ok: true };
  return { ok: true, json: async () => ({ oops: true }) };
};
assert.equal(await scoreNima(Buffer.from([0xff])), null, "missing numeric score field → null");

// health up but /score returns non-OK → null.
_resetNimaHealthCache();
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/health")) return { ok: true };
  return { ok: false, status: 400 };
};
assert.equal(await scoreNima(Buffer.from([0xff])), null, "non-OK /score response → null");

globalThis.fetch = realFetch;
console.log("nima.mjs unit tests passed");
