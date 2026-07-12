#!/usr/bin/env node
import assert from "node:assert/strict";
import { formatCliResult } from "./remediation7-v5-spacing-final.mjs";

assert.deepEqual(formatCliResult({ status: "validated" }), {
  status: "validated",
  release_eligible: false,
  verdict: "validated-evidence-only",
});
assert.equal(formatCliResult({ release_eligible: false }).release_eligible, false);
assert.equal(formatCliResult({ release_eligible: true }).release_eligible, true);
console.log("V5 CLI fail-closed regression passed");
