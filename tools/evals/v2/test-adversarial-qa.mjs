import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { QA_CASES, runAdversarialQa, verifyNetworkIsolation } from "./adversarial-qa.mjs";

const requiredCases = [
  { id: "dirty-tree-and-source-drift", suite: "rehearsal" },
  { id: "historical-copy-and-indirection", suite: "registry" },
  { id: "commitment-and-opening-attacks", suite: "registry" },
  { id: "secret-lifecycle-and-disclosure", suite: "registry" },
  { id: "identifier-ordering-and-rebinding", suite: "judges" },
  { id: "execution-render-and-replay-drift", suite: "render" },
  { id: "late-exclusions-and-packet-transformation", suite: "generation" },
  { id: "anchor-aggregation-and-evidence-attacks", suite: "judges" },
  { id: "dispatch-cost-and-partial-production", suite: "generation" },
  { id: "ledger-reservation-and-repeat-synthesis", suite: "synthesis" },
  { id: "unknown-fields-and-validator-drift", suite: "judges" },
  { id: "failed-anchors-and-family-collapse", suite: "judges" },
  { id: "citation-span-cross-arm-and-stale-evidence", suite: "judges" },
  { id: "render-viewport-artifact-and-host-tampering", suite: "render" },
  { id: "unmask-map-completeness-and-coordinate-forgery", suite: "synthesis" },
  { id: "ordinal-failure-no-retry-or-substitution", suite: "rehearsal" }
];

assert.equal(QA_CASES.length, 16);
assert.deepEqual(
  QA_CASES.map(({ id, suite }) => `${suite}:${id}`).sort(),
  requiredCases.map(({ id, suite }) => `${suite}:${id}`).sort()
);
assert.equal(new Set(QA_CASES.map((entry) => entry.id)).size, QA_CASES.length);

const repoRoot = new URL("../../../", import.meta.url).pathname;
mkdirSync(join(repoRoot, ".scratch"), { recursive: true });
assert.deepEqual(verifyNetworkIsolation({ repoRoot }).probe_blocked, true);

const scratch = mkdtempSync(join(repoRoot, ".scratch/tastecheck-v2-qa-test-"));
const outside = mkdtempSync(join(tmpdir(), "tastecheck-v2-qa-outside-"));
try {
  const receiptPath = join(scratch, "receipt.json");
  const receipt = runAdversarialQa({ receiptPath, repoRoot });
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.external_calls, 0);
  assert.equal(receipt.network_probe_blocked, true);
  assert.ok(Number.isInteger(receipt.blocked_ip_attempts));
  assert.equal(receipt.exact_case_set, true);
  assert.match(receipt.suite_digest, /^[a-f0-9]{64}$/);
  assert.equal(receipt.cases.length, QA_CASES.length);
  assert.ok(receipt.cases.every((entry) => entry.state === "passed"));
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
  assert.ok(!JSON.stringify(receipt).includes(scratch));

  const link = join(scratch, "redirect");
  symlinkSync(outside, link);
  assert.throws(
    () => runAdversarialQa({ receiptPath: join(link, "escaped.json"), repoRoot }),
    /symlink/i
  );
  assert.throws(
    () => runAdversarialQa({ receiptPath: join(repoRoot, "../escaped.json"), repoRoot }),
    /inside|repository/i
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
}

console.log("effectiveness-v2 adversarial QA contract passed; external calls 0");
