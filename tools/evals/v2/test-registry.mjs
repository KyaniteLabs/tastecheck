import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, chmodSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistry, groupByStratum, validateCorpusSeparation } from "./lib/registry.mjs";
import { appendEvent, validateLedger } from "./lib/ledger.mjs";
import { verifyHistoricalAuthority, verifyHistoricalSeparation, validateV2InputPath } from "./lib/historical-authority.mjs";
import { assertProductionCommitment, createRandomization } from "./lib/randomization.mjs";
import { createBuildAuthority } from "./lib/packet-build-authority.mjs";
import { createOpenAuthority } from "./lib/synthesis-open-authority.mjs";
import { recordQaCase } from "./lib/qa-case.mjs";

const root = new URL("../../../", import.meta.url).pathname;
assert.doesNotMatch(readFileSync(join(root, "tools/evals/v2/lib/packet-build-authority.mjs"), "utf8"), /openCommittedMap|synthesis-open-authority/);
const registry = loadRegistry(root);
const frozenRegistry = JSON.parse(readFileSync(join(root, "evals/v2/scenario-registry.json"), "utf8"));
assert.equal(registry.scenarios.length, 12);
assert.deepEqual(Object.values(groupByStratum(registry)).map((rows) => rows.length), [2, 2, 2, 2, 2, 2]);
assert.deepEqual(registry.scenarios.map((row) => row.sha256), [...registry.scenarios.map((row) => row.sha256)].sort());
assert.deepEqual(frozenRegistry.scenarios, registry.scenarios.map(({ scenario_id, sha256 }) => ({ scenario_id, sha256 })));
assert.deepEqual(frozenRegistry.anchors, registry.anchors.map(({ anchor_id, sha256 }) => ({ anchor_id, sha256 })));
assert.doesNotThrow(() => validateCorpusSeparation(registry));
assert.throws(() => validateCorpusSeparation({ ...registry, scenarios: registry.scenarios.slice(1) }), /exactly 12/);
assert.throws(() => validateCorpusSeparation({ ...registry, scenarios: registry.scenarios.map((row, i) => i ? row : { ...row, surprise: true }) }), /unknown/);
assert.throws(() => validateCorpusSeparation({ ...registry, scenarios: registry.scenarios.map((row, i) => i === 1 ? { ...row, scenario_id: registry.scenarios[0].scenario_id } : row) }), /duplicate scenario id/);
assert.throws(() => validateCorpusSeparation({ ...registry, anchors: registry.anchors.map((row, i) => i ? row : { ...row, kind: "taste" }) }), /invalid/);
assert.throws(() => validateCorpusSeparation({ ...registry, anchors: registry.anchors.map((row, i) => i ? row : { ...row, surprise: true }) }), /invalid/);
assert.throws(() => validateCorpusSeparation({ ...registry, anchors: registry.anchors.map((row, i) => i ? row : { ...row, label_order: [0, 0] }) }), /invalid/);
assert.throws(() => validateCorpusSeparation({ ...registry, scenarios: registry.scenarios.map((row, i) => i ? row : { ...registry.scenarios[1], scenario_id: "copy" }) }), /duplicate|overlap/);

const first = appendEvent(undefined, null, { type: "protocol_frozen", at: "2026-07-12T00:00:00Z" });
const second = appendEvent(undefined, first, { type: "production_admitted", at: "2026-07-12T00:01:00Z" });
assert.doesNotThrow(() => validateLedger([first, second]));
assert.throws(() => appendEvent(undefined, { ...first, event_sha256: "0".repeat(64) }, { type: "production_admitted" }), /predecessor/);
assert.throws(() => validateLedger([second]), /initial|predecessor/);

const authority = JSON.parse(readFileSync(join(root, "evals/v2/historical-authority.json"), "utf8"));
assert.doesNotThrow(() => verifyHistoricalAuthority(root, authority));
assert.throws(() => validateV2InputPath("evals/receipts/v1/immutable/w1-effectiveness.json"), /historical/);

const temp = mkdtempSync(join(tmpdir(), "tastecheck-v2-registry-"));
try {
  const ledgerPath = join(temp, "ledger.jsonl");
  appendEvent(ledgerPath, null, { type: "protocol_frozen" });
  const onDiskFirst = JSON.parse(readFileSync(ledgerPath, "utf8"));
  appendEvent(ledgerPath, onDiskFirst, { type: "production_admitted" });
  writeFileSync(ledgerPath, `${JSON.stringify({ ...onDiskFirst, event_sha256: "0".repeat(64) })}\n`);
  assert.throws(() => appendEvent(ledgerPath, onDiskFirst, { type: "bad" }), /hash|predecessor/);
  writeFileSync(`${ledgerPath}.lock`, "held");
  assert.throws(() => appendEvent(ledgerPath, onDiskFirst, { type: "locked" }), /lock/);
  rmSync(`${ledgerPath}.lock`);
  writeFileSync(`${ledgerPath}.next`, "stale");
  writeFileSync(ledgerPath, `${JSON.stringify(onDiskFirst)}\n`);
  assert.doesNotThrow(() => appendEvent(ledgerPath, onDiskFirst, { type: "after-crash" }));
  const historical = join(root, authority.entries[0].path);
  const exact = join(temp, "renamed.json");
  writeFileSync(exact, readFileSync(historical));
  assert.throws(() => verifyHistoricalSeparation([exact], authority, root), /historical|overlap/);
  const wrapped = join(temp, "wrapped.json");
  writeFileSync(wrapped, JSON.stringify({ wrapper: JSON.parse(readFileSync(historical, "utf8")) }));
  assert.throws(() => verifyHistoricalSeparation([wrapped], authority, root), /historical|overlap/);
  const link = join(temp, "linked.json");
  symlinkSync(historical, link);
  assert.throws(() => verifyHistoricalSeparation([link], authority, root), /historical|overlap/);
  const indirect = join(temp, "indirect.json");
  writeFileSync(indirect, JSON.stringify({ reference: exact }));
  assert.throws(() => verifyHistoricalSeparation([indirect], authority, root), /historical|overlap/);
  writeFileSync(indirect, JSON.stringify({ source: exact }));
  assert.throws(() => verifyHistoricalSeparation([indirect], authority, root), /historical|overlap/);
  const near = join(temp, "near.txt");
  writeFileSync(near, readFileSync(historical, "utf8").replace(/"/g, "").replace(/,/g, " "));
  assert.throws(() => verifyHistoricalSeparation([near], authority, root), /historical|overlap/);
  recordQaCase("historical-copy-and-indirection");

  const secretRoot = join(temp, "secrets");
  mkdirSync(secretRoot);
  const created = createRandomization({ domain: "effectiveness-v2-test", secretRoot });
  assert.equal(Object.hasOwn(created, "seed"), false);
  assert.match(created.commitment.commitment_sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(createBuildAuthority(created.privateStateRef)), ["buildPackets"]);
  assert.deepEqual(Object.keys(createOpenAuthority(created.privateStateRef)), ["openCommittedMap"]);
  assert.equal(createBuildAuthority(created.privateStateRef).buildPackets({ unit: 1 }).packet_set_sha256.length, 64);
  assert.throws(() => createOpenAuthority(created.privateStateRef).openCommittedMap(), /reservation/);
  assert.equal("seed" in createBuildAuthority(created.privateStateRef), false);
  chmodSync(created.privateStateRef.secretPath, 0o644);
  assert.throws(() => createBuildAuthority(created.privateStateRef).buildPackets({}), /permission/);
  chmodSync(created.privateStateRef.secretPath, 0o600);
  writeFileSync(created.privateStateRef.secretPath, "replacement", { mode: 0o600 });
  assert.throws(() => createBuildAuthority(created.privateStateRef).buildPackets({}), /commitment|replacement/);
  rmSync(created.privateStateRef.secretPath);
  assert.throws(() => createBuildAuthority(created.privateStateRef).buildPackets({}), /missing/);
  recordQaCase("commitment-and-opening-attacks");
  recordQaCase("secret-lifecycle-and-disclosure");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

assert.throws(() => assertProductionCommitment(JSON.parse(readFileSync(join(root, "evals/v2/randomization-commitment.json"), "utf8"))), /production not started/);
const trackedCommitment = JSON.parse(readFileSync(join(root, "evals/v2/randomization-commitment.json"), "utf8"));
assert.equal(trackedCommitment.adapter_sha256, createHash("sha256").update(readFileSync(join(root, "tools/evals/v2/lib/packet-build-authority.mjs"))).digest("hex"));

console.log("effectiveness-v2 registry tests passed");
