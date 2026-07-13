// tools/test/nima.test.mjs — unit tests for NIMA verdict + merge logic.
// No NIMA service required; covers pure functions only.
// Run: node --test tools/test/nima.test.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  nimaVerdict,
  combinedVerdict,
  NIMA_WARN,
  NIMA_FAIL,
} from "../lib/nima.mjs";

// ---------------------------------------------------------------------------
// nimaVerdict — Phase 1: WARN-only (never "fail")
// ---------------------------------------------------------------------------

describe("nimaVerdict", () => {
  it("returns 'n/a' for null (service down)", () => {
    assert.equal(nimaVerdict(null), "n/a");
  });

  it("returns 'n/a' for undefined", () => {
    assert.equal(nimaVerdict(undefined), "n/a");
  });

  it("returns 'pass' for scores >= NIMA_WARN", () => {
    assert.equal(nimaVerdict(5.5), "pass");
    assert.equal(nimaVerdict(6.0), "pass");
    assert.equal(nimaVerdict(10.0), "pass");
  });

  it("returns 'warn' for scores < NIMA_WARN", () => {
    assert.equal(nimaVerdict(5.49), "warn");
    assert.equal(nimaVerdict(4.0), "warn");
    assert.equal(nimaVerdict(1.0), "warn");
  });

  it("Phase 1 never returns 'fail' even for very low scores", () => {
    assert.equal(NIMA_FAIL, Infinity);
    assert.equal(nimaVerdict(1.0), "warn");
    assert.equal(nimaVerdict(0.1), "warn");
  });

  it("boundary: score exactly at NIMA_WARN is 'pass'", () => {
    assert.equal(nimaVerdict(NIMA_WARN), "pass");
  });
});

// ---------------------------------------------------------------------------
// combinedVerdict
// ---------------------------------------------------------------------------

describe("combinedVerdict", () => {
  it("CLEAN gate + pass NIMA → CLEAN", () => {
    assert.equal(combinedVerdict({ verdict: "CLEAN" }, 7.0), "CLEAN");
  });

  it("CLEAN gate + warn NIMA → REVIEW WARNS", () => {
    assert.equal(combinedVerdict({ verdict: "CLEAN" }, 4.0), "REVIEW WARNS");
  });

  it("CLEAN gate + n/a NIMA → CLEAN (never downgrades)", () => {
    assert.equal(combinedVerdict({ verdict: "CLEAN" }, null), "CLEAN");
  });

  it("REVIEW WARNS gate + pass NIMA → REVIEW WARNS", () => {
    assert.equal(combinedVerdict({ verdict: "REVIEW WARNS" }, 8.0), "REVIEW WARNS");
  });

  it("FAIL gate + pass NIMA → FAIL (gate dominates)", () => {
    assert.equal(combinedVerdict({ verdict: "FAIL" }, 9.0), "FAIL");
  });

  it("null gate + n/a NIMA → CLEAN (graceful default)", () => {
    assert.equal(combinedVerdict(null, null), "CLEAN");
    assert.equal(combinedVerdict(undefined, null), "CLEAN");
  });

  it("missing verdict defaults to CLEAN", () => {
    assert.equal(combinedVerdict({}, 6.0), "CLEAN");
  });
});
