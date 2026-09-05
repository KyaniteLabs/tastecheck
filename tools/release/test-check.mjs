#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, dirname, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import {
  EFFECTIVENESS_SOURCES,
  ENGINEERING_PRODUCERS,
  GENERIC_CHECKS,
  checkEngineeringReadiness,
  checkReleaseManifest,
  deriveEffectivenessClaim,
  PUBLIC_STATUS_RECEIPT,
  verifyFinalSourceReceiptDigests,
} from "./check.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const SOURCE_SHA = "a".repeat(64);
const ARTIFACT_PATH = "artifacts/proof.png";
const ARTIFACT_BYTES = Buffer.from("proof");

function assertSortedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSortedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  assert.deepEqual(Object.keys(value), [...Object.keys(value)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)), `${label} keys must be stable and sorted`);
  for (const [key, child] of Object.entries(value)) assertSortedKeys(child, `${label}.${key}`);
}

function copyFixtureFile(sourceRoot, fixtureRoot, relativePath) {
  const destination = join(fixtureRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(sourceRoot, relativePath), destination);
}

function buildProjectFactsFixture(sourceRoot) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-project-facts-"));
  for (const relativePath of [
    "tools/release/release-facts.json",
    "package.json",
    "skills.json",
    "contracts/v1/commands.json",
    "README.md",
    "llms.txt",
    "index.html",
    "docs/LAUNCH.md",
    "docs/VERIFICATION.md",
    "samples/index.html",
  ]) copyFixtureFile(sourceRoot, fixtureRoot, relativePath);

  mkdirSync(join(fixtureRoot, "skills"), { recursive: true });
  for (const entry of readdirSync(join(sourceRoot, "skills"), { withFileTypes: true })) {
    if (entry.isDirectory()) mkdirSync(join(fixtureRoot, "skills", entry.name));
  }
  cpSync(join(sourceRoot, "commands"), join(fixtureRoot, "commands"), { recursive: true });
  mkdirSync(join(fixtureRoot, "samples"), { recursive: true });
  for (const entry of readdirSync(join(sourceRoot, "samples"), { withFileTypes: true })) {
    if (!entry.isDirectory() || !existsSync(join(sourceRoot, "samples", entry.name, "index.html"))) continue;
    mkdirSync(join(fixtureRoot, "samples", entry.name));
    copyFileSync(join(sourceRoot, "samples", entry.name, "index.html"), join(fixtureRoot, "samples", entry.name, "index.html"));
  }
  return fixtureRoot;
}

function testProjectFactsByteStability() {
  const fixtureRoot = buildProjectFactsFixture(root);
  const generated = [
    "skills.json",
    "contracts/v1/commands.json",
    "README.md",
    "llms.txt",
    "index.html",
    "docs/LAUNCH.md",
    "docs/VERIFICATION.md",
    "samples/index.html",
  ];
  try {
    const commandsPath = join(fixtureRoot, "contracts/v1/commands.json");
    writeFileSync(commandsPath, `${JSON.stringify(JSON.parse(readFileSync(commandsPath, "utf8")))}\n`);
    const script = join(root, "tools/release/project-facts.mjs");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--write"], { env: { ...process.env, TZ: "UTC", TASTECHECK_PROJECT_FACTS_TEST: "first" } });
    const first = generated.map((path) => readFileSync(join(fixtureRoot, path)));
    assertSortedKeys(JSON.parse(first[0].toString("utf8")), "skills.json");
    assertSortedKeys(JSON.parse(first[1].toString("utf8")), "contracts/v1/commands.json");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--write"], { env: { ...process.env, TZ: "Pacific/Honolulu", TASTECHECK_PROJECT_FACTS_TEST: "second" } });
    const second = generated.map((path) => readFileSync(join(fixtureRoot, path)));
    assert.deepEqual(second, first, "two project-facts runs must produce identical bytes across environment changes");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--check"], { env: { ...process.env, TZ: "America/Los_Angeles", TASTECHECK_PROJECT_FACTS_TEST: "check" } });
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

testProjectFactsByteStability();

const w1Payload = JSON.stringify({
  schema_version: 1,
  kind: "immutable-w1-effectiveness-projection",
  source_evidence_sha256: EFFECTIVENESS_SOURCES["w1-effectiveness"].source_evidence_sha256,
  effectiveness_status: "blocked",
  jobs: { complete: 12, required: 12 },
  judgments: { complete: 27, required: 27 },
  paired: { pass_count: 0, required_count: 3 },
  diversity: { pass_count: 0, required_count: 3 },
  immutable_stop_rule: true,
});
const v5Payload = JSON.stringify({
  schema_version: 1,
  kind: "immutable-terminal-v5-effectiveness-projection",
  source_evidence_sha256: EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].source_evidence_sha256,
  effectiveness_status: "blocked",
  release_eligible: false,
  mean_delta: 0.3,
  threshold: 0.6,
  preference: { current: 11, total: 12 },
  immutable_stop_rule: true,
});

function receiptFixture(id) {
  if (id === "context-budget") return { schema_version: 1, source_tree_sha256: SOURCE_SHA, skills: Array.from({ length: 19 }, (_, index) => ({ skill: `skill-${index}`, checks: { within_growth_cap: true }, pass: true })), overall_pass: true };
  if (id === "browser" || id === "e2e") return {
    schema_version: 1,
    kind: id,
    producer_id: "tastecheck.release.live-execution.v1",
    producer: { id: "tastecheck-live-execution", version: 1 },
    source_tree_sha256: SOURCE_SHA,
    nonce: "fixture-release-0001",
    runtime: { node: "v26.0.0", playwright: "1.61.1", browser: "fixture", platform: "other" },
    started_at: "2026-07-11T00:00:00.000Z",
    finished_at: "2026-07-11T00:00:01.000Z",
    executed: true,
    reproducible: true,
    artifacts: [{ id: "proof", path: ARTIFACT_PATH, sha256: hash(ARTIFACT_BYTES), bytes: ARTIFACT_BYTES.length }],
    checks: [{ id: "fixture-check", passed: true, detail: "Fixture passed" }],
    status: "pass",
  };
  return {
    schema_version: 1,
    kind: id,
    producer_id: `tastecheck.release.${id}.v1`,
    source_tree_sha256: SOURCE_SHA,
    nonce: "fixture-release-0001",
    started_at: "2026-07-11T00:00:00.000Z",
    finished_at: "2026-07-11T00:00:01.000Z",
    checks: GENERIC_CHECKS[id].map(([checkId, command]) => ({ id: checkId, command, passed: true, exit_code: 0, output_sha256: "b".repeat(64) })),
    status: "pass",
    reproducible: true,
  };
}

function manifestFixture() {
  const payloads = Object.fromEntries(Object.keys(ENGINEERING_PRODUCERS).map((id) => [id, JSON.stringify(receiptFixture(id))]));
  return {
    schema_version: 2,
    target_release: "1.0.0",
    engineering_readiness: {
      required_cells: Object.entries(ENGINEERING_PRODUCERS).map(([id, producer]) => ({
        id,
        path: producer.path,
        sha256: hash(payloads[id]),
        producer_id: id,
        assertions: structuredClone(producer.assertions),
      })),
    },
    effectiveness_claim: {
      claimed_status: "blocked",
      sources: [
        { id: "w1-effectiveness", path: EFFECTIVENESS_SOURCES["w1-effectiveness"].path, sha256: hash(w1Payload) },
        { id: "terminal-v5-effectiveness", path: EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].path, sha256: hash(v5Payload) },
      ],
    },
  };
}

const texts = new Map([
  ...Object.entries(ENGINEERING_PRODUCERS).map(([id, { path }]) => [path, JSON.stringify(receiptFixture(id))]),
  [PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: SOURCE_SHA })],
  [EFFECTIVENESS_SOURCES["w1-effectiveness"].path, w1Payload],
  [EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].path, v5Payload],
]);
const io = {
  targetRelease: "1.0.0",
  hasFile: (path) => texts.has(path) || path === ARTIFACT_PATH,
  readText: (path) => texts.get(path),
  readBytes: (path) => path === ARTIFACT_PATH ? ARTIFACT_BYTES : Buffer.from(texts.get(path)),
  hasCommand: () => true,
  sourceTreeSha256: () => SOURCE_SHA,
  contextBudgetReport: () => receiptFixture("context-budget"),
  requiredLiveCheckIds: () => ["fixture-check"],
  requiredLiveArtifactIds: () => ["proof"],
};
const valid = manifestFixture();

const finalSourceGate = verifyFinalSourceReceiptDigests(valid, io);
if (finalSourceGate.status !== "ready" || finalSourceGate.errors.length !== 0) {
  throw new Error(`valid final-source receipt gate failed: ${finalSourceGate.errors.join("; ")}`);
}

function rejectFinalSourceGate(label, mutate, expected) {
  const candidateTexts = new Map(texts);
  mutate(candidateTexts);
  const candidateIo = { ...io, readText: (path) => candidateTexts.get(path), hasFile: (path) => candidateTexts.has(path) };
  const result = verifyFinalSourceReceiptDigests(valid, candidateIo);
  if (!result.errors.some((error) => error.includes(expected))) {
    throw new Error(`${label} did not fail with ${expected}: ${result.errors.join("; ")}`);
  }
}

rejectFinalSourceGate("stale engineering receipt", (candidateTexts) => {
  candidateTexts.set(ENGINEERING_PRODUCERS.mechanical.path, JSON.stringify({ ...receiptFixture("mechanical"), source_tree_sha256: "c".repeat(64) }));
}, "mechanical: receipt source_tree_sha256 does not match final source digest");
rejectFinalSourceGate("stale public status receipt", (candidateTexts) => {
  candidateTexts.set(PUBLIC_STATUS_RECEIPT, JSON.stringify({ source_tree_sha256: "c".repeat(64) }));
}, "public status: source_tree_sha256 does not match final source digest");

let sourceReads = 0;
const changingSourceIo = {
  ...io,
  sourceTreeSha256: () => (++sourceReads === 1 ? SOURCE_SHA : "d".repeat(64)),
};
const changingSource = verifyFinalSourceReceiptDigests(valid, changingSourceIo);
if (!changingSource.errors.includes("source tree changed while final-source receipt gate was running")) {
  throw new Error(`source mutation during final-source receipt gate was not detected: ${changingSource.errors.join("; ")}`);
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const releaseSchema = JSON.parse(readFileSync(join(root, "contracts/v1/release-receipts.schema.json"), "utf8"));
const w1Schema = JSON.parse(readFileSync(join(root, "contracts/v1/release-effectiveness-w1.schema.json"), "utf8"));
const v5Schema = JSON.parse(readFileSync(join(root, "contracts/v1/release-effectiveness-terminal-v5.schema.json"), "utf8"));
if (!ajv.compile(releaseSchema)(valid)) throw new Error("valid manifest fixture failed JSON Schema");
if (!ajv.compile(w1Schema)(JSON.parse(w1Payload))) throw new Error("valid W1 projection failed JSON Schema");
if (!ajv.compile(v5Schema)(JSON.parse(v5Payload))) throw new Error("valid terminal V5 projection failed JSON Schema");

const engineering = checkEngineeringReadiness(valid, io);
if (engineering.errors.length || engineering.status !== "ready") throw new Error(`valid engineering fixture failed: ${engineering.errors.join("; ")}`);
const effectiveness = deriveEffectivenessClaim(valid, io);
if (effectiveness.errors.length || effectiveness.status !== "blocked") throw new Error(`immutable red evidence did not derive blocked: ${JSON.stringify(effectiveness)}`);
if (checkReleaseManifest(valid, io).length) throw new Error(`valid split release manifest failed: ${checkReleaseManifest(valid, io).join("; ")}`);

function reject(label, mutate, expected) {
  const candidate = structuredClone(valid);
  mutate(candidate);
  const errors = checkReleaseManifest(candidate, io);
  if (!errors.some((error) => error.includes(expected))) throw new Error(`${label} did not fail with ${expected}: ${errors.join("; ")}`);
}

reject("unknown root field", (m) => { m.surprise = true; }, "unknown field");
reject("unknown engineering field", (m) => { m.engineering_readiness.note = "trust me"; }, "unknown field");
reject("unknown cell field", (m) => { m.engineering_readiness.required_cells[0].manual = true; }, "unknown field");
reject("manual producer", (m) => { m.engineering_readiness.required_cells[0].producer_id = "manual"; }, "unregistered producer");
reject("orphan path", (m) => { m.engineering_readiness.required_cells[0].path = "tmp/manual.json"; }, "registered path");
reject("missing producer", (m) => { m.engineering_readiness.required_cells.pop(); }, "missing registered producer");
reject("duplicate producer", (m) => { m.engineering_readiness.required_cells.push(structuredClone(m.engineering_readiness.required_cells[0])); }, "duplicate cell id");
reject("placeholder engineering hash", (m) => { m.engineering_readiness.required_cells[0].sha256 = "0".repeat(64); }, "placeholder SHA-256");
reject("stale engineering hash", (m) => { m.engineering_readiness.required_cells[0].sha256 = "f".repeat(64); }, "pinned SHA-256");
reject("unsupported effective status", (m) => { m.effectiveness_claim.claimed_status = "effective"; }, "claimed_status must be blocked");
reject("missing effectiveness source", (m) => { m.effectiveness_claim.sources.pop(); }, "missing immutable effectiveness source");
reject("placeholder effectiveness hash", (m) => { m.effectiveness_claim.sources[0].sha256 = "0".repeat(64); }, "placeholder SHA-256");
reject("stale effectiveness hash", (m) => { m.effectiveness_claim.sources[0].sha256 = "f".repeat(64); }, "pinned SHA-256");

const forgedTexts = new Map(texts);
forgedTexts.set(EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].path, JSON.stringify({ ...JSON.parse(v5Payload), release_eligible: true }));
const forgedIo = { ...io, hasFile: (path) => forgedTexts.has(path), readText: (path) => forgedTexts.get(path) };
if (!deriveEffectivenessClaim(valid, forgedIo).errors.some((error) => error.includes("pinned SHA-256"))) throw new Error("forged effective evidence bypassed immutable hash binding");

function rejectProjection(label, id, mutate, expected) {
  const candidate = structuredClone(valid);
  const candidateTexts = new Map(texts);
  const source = candidate.effectiveness_claim.sources.find((item) => item.id === id);
  const payload = JSON.parse(candidateTexts.get(source.path));
  mutate(payload);
  const text = JSON.stringify(payload);
  candidateTexts.set(source.path, text);
  source.sha256 = hash(text);
  const candidateIo = { ...io, hasFile: (path) => candidateTexts.has(path), readText: (path) => candidateTexts.get(path) };
  const errors = deriveEffectivenessClaim(candidate, candidateIo).errors;
  if (!errors.some((error) => error.includes(expected))) throw new Error(`${label} did not fail with ${expected}: ${errors.join("; ")}`);
}

rejectProjection("forged W1 source binding", "w1-effectiveness", (value) => { value.source_evidence_sha256 = "0".repeat(64); }, "canonical source evidence hash mismatch");
rejectProjection("forged W1 effectiveness", "w1-effectiveness", (value) => { value.effectiveness_status = "effective"; }, "effectiveness_status must remain blocked");
rejectProjection("forged W1 completion", "w1-effectiveness", (value) => { value.jobs.complete = 11; }, "completed jobs must remain 12/12");
rejectProjection("forged V5 source binding", "terminal-v5-effectiveness", (value) => { value.source_evidence_sha256 = "0".repeat(64); }, "canonical source evidence hash mismatch");
rejectProjection("weakened V5 threshold", "terminal-v5-effectiveness", (value) => { value.threshold = 0.3; }, "historical delta 0.3 and threshold 0.6 must be preserved");
rejectProjection("promoted V5 verdict", "terminal-v5-effectiveness", (value) => { value.release_eligible = true; value.effectiveness_status = "effective"; }, "immutable release_eligible must remain false");

function rejectReceipt(label, id, mutate, expected, ioMutate = (candidateIo) => candidateIo) {
  const candidate = structuredClone(valid);
  const candidateTexts = new Map(texts);
  const cell = candidate.engineering_readiness.required_cells.find((entry) => entry.id === id);
  const receipt = JSON.parse(candidateTexts.get(cell.path));
  mutate(receipt);
  const text = JSON.stringify(receipt);
  candidateTexts.set(cell.path, text);
  cell.sha256 = hash(text);
  const candidateIo = ioMutate({ ...io, readText: (path) => candidateTexts.get(path), hasFile: (path) => candidateTexts.has(path) || path === ARTIFACT_PATH });
  const errors = checkEngineeringReadiness(candidate, candidateIo).errors;
  if (!errors.some((error) => error.includes(expected))) throw new Error(`${label} did not fail with ${expected}: ${errors.join("; ")}`);
}

rejectReceipt("stale source", "mechanical", (value) => { value.source_tree_sha256 = "c".repeat(64); }, "source_tree_sha256 is stale");
rejectReceipt("forged duplicate context rows", "context-budget", (value) => { value.skills = Array.from({ length: 19 }, () => structuredClone(value.skills[0])); }, "does not exactly match recomputed");
rejectReceipt("forged context metric", "context-budget", (value) => { value.skills[0].skill_md_tokens = 1; }, "does not exactly match recomputed");
rejectReceipt("stale context source", "context-budget", (value) => { value.source_tree_sha256 = "c".repeat(64); }, "source_tree_sha256 is stale");
rejectReceipt("forged minimal receipt", "mechanical", (value) => { for (const key of Object.keys(value)) delete value[key]; Object.assign(value, ENGINEERING_PRODUCERS.mechanical.assertions); }, "generic receipt identity mismatch");
rejectReceipt("missing live artifact", "browser", () => {}, "missing artifact", (candidateIo) => ({ ...candidateIo, hasFile: (path) => path !== ARTIFACT_PATH && candidateIo.hasFile(path) }));
rejectReceipt("tampered live artifact", "browser", () => {}, "artifact SHA-256 mismatch", (candidateIo) => ({ ...candidateIo, readBytes: (path) => path === ARTIFACT_PATH ? Buffer.from("tampered") : candidateIo.readBytes(path) }));
rejectReceipt("incomplete live check set", "browser", (value) => { value.checks[0].id = "wrong-check"; }, "live check set");
rejectReceipt("absolute command leak", "security", (value) => { value.checks[0].command = "/private/node checker.mjs"; }, "absolute executable path");
rejectReceipt("forged generic command", "mechanical", (value) => { value.checks[0].command = "printf trust-me"; }, "command does not match the registered producer");

const current = JSON.parse(readFileSync(join(root, "contracts/v1/release-receipts.json"), "utf8"));
const currentEffectiveness = deriveEffectivenessClaim(current);
if (currentEffectiveness.status !== "blocked") throw new Error("current immutable effectiveness claim must remain blocked");

console.log("release checker v2 tests passed (registered engineering cells + immutable blocked effectiveness)");
