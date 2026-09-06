#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  checkPublicStatus,
  derivePublicStatus,
  deriveReceiptStatus,
  renderPublicSurfaces,
} from "./project-public-status.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const current = derivePublicStatus(root);

assert.deepEqual(checkPublicStatus(root), [], "committed public status projection must match current receipt bytes");
assert.equal(current.claims.length, 4);
assert.equal(current.claims.find((claim) => claim.id === "effectiveness")?.status, "blocked");
assert.match(current.source_tree_sha256, /^[a-f0-9]{64}$/);

const stale = deriveReceiptStatus({
  kind: "browser",
  currentSource: "a".repeat(64),
  receipt: {
    kind: "browser",
    producer_id: "tastecheck.release.live-execution.v1",
    source_tree_sha256: "b".repeat(64),
    status: "pass",
    executed: true,
    reproducible: true,
    checks: [{ id: "check", passed: true }],
  },
  requiredCheckIds: [],
});
assert.equal(stale.status, "unverified", "stale receipts cannot render PASS");

const failed = deriveReceiptStatus({
  kind: "browser",
  currentSource: "a".repeat(64),
  receipt: {
    kind: "browser",
    producer_id: "tastecheck.release.live-execution.v1",
    source_tree_sha256: "a".repeat(64),
    status: "fail",
    executed: true,
    reproducible: true,
    checks: [{ id: "check", passed: false }],
  },
  requiredCheckIds: [],
});
assert.equal(failed.status, "hold", "failed receipts must render HOLD");

const missing = deriveReceiptStatus({ kind: "browser", currentSource: "a".repeat(64), receipt: null });
assert.equal(missing.status, "unverified", "missing receipts must render UNVERIFIED");

const genericPass = deriveReceiptStatus({
  kind: "mechanical",
  currentSource: "a".repeat(64),
  receipt: {
    kind: "mechanical",
    producer_id: "tastecheck.release.mechanical.v1",
    source_tree_sha256: "a".repeat(64),
    status: "pass",
    reproducible: true,
    checks: [{ id: "check", passed: true }],
  },
  requiredCheckIds: [],
});
assert.equal(genericPass.status, "pass", "generic engineering receipts do not require live-browser fields");

const genericFail = deriveReceiptStatus({
  kind: "mechanical",
  currentSource: "a".repeat(64),
  receipt: {
    kind: "mechanical",
    producer_id: "tastecheck.release.mechanical.v1",
    source_tree_sha256: "a".repeat(64),
    status: "fail",
    reproducible: false,
    checks: [{ id: "check", passed: false }],
  },
  requiredCheckIds: [],
});
assert.equal(genericFail.status, "hold", "failed generic receipts must render HOLD");

const surfaces = renderPublicSurfaces({ ...current, overall_status: "unverified" });
assert.match(surfaces.readme, /Release status: UNVERIFIED/);
assert.match(surfaces.landing, /release evidence: UNVERIFIED/);
assert.match(surfaces.gate, /Gate: UNVERIFIED/);
assert.doesNotMatch(surfaces.readme, /brightgreen|verified-npm/);

const schema = JSON.parse(readFileSync(join(root, "contracts/v1/release-public-status.schema.json"), "utf8"));
assert.deepEqual(schema.required, ["schema_version", "kind", "target_release", "source_tree_sha256", "manifest", "claims", "overall_status"]);
assert.deepEqual(schema.properties.claims.items.$ref, "#/$defs/claim");

console.log("public release status projection tests passed (receipt hashes, freshness, failed/stale fail-closed states)");
