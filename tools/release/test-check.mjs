#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import {
  EFFECTIVENESS_SOURCES,
  ENGINEERING_PRODUCERS,
  checkEngineeringReadiness,
  checkReleaseManifest,
  deriveEffectivenessClaim,
} from "./check.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const SOURCE_SHA = "a".repeat(64);
const ARTIFACT_PATH = "artifacts/proof.png";
const ARTIFACT_BYTES = Buffer.from("proof");
const CHECK_IDS = {
  mechanical: ["test", "contracts", "eval-schema", "release-eval-contracts", "source-stability"],
  security: ["effectiveness-claims", "public-replay-surface", "receipt-sanitizer", "source-stability"],
  "clean-clone": ["npm-ci", "test", "contracts", "effectiveness-claims", "head-source-match", "source-stability"],
};
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
  if (id === "context-budget") return { schema_version: 1, skills: Array.from({ length: 19 }, (_, index) => ({ skill: `skill-${index}`, checks: { within_growth_cap: true }, pass: true })), overall_pass: true };
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
    checks: CHECK_IDS[id].map((checkId) => ({ id: checkId, command: "fixture command", passed: true, exit_code: 0, output_sha256: "b".repeat(64) })),
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
  [EFFECTIVENESS_SOURCES["w1-effectiveness"].path, w1Payload],
  [EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].path, v5Payload],
]);
const io = {
  hasFile: (path) => texts.has(path) || path === ARTIFACT_PATH,
  readText: (path) => texts.get(path),
  readBytes: (path) => path === ARTIFACT_PATH ? ARTIFACT_BYTES : Buffer.from(texts.get(path)),
  hasCommand: () => true,
  sourceTreeSha256: () => SOURCE_SHA,
};
const valid = manifestFixture();

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
rejectReceipt("forged minimal receipt", "mechanical", (value) => { for (const key of Object.keys(value)) delete value[key]; Object.assign(value, ENGINEERING_PRODUCERS.mechanical.assertions); }, "generic receipt identity mismatch");
rejectReceipt("missing live artifact", "browser", () => {}, "missing artifact", (candidateIo) => ({ ...candidateIo, hasFile: (path) => path !== ARTIFACT_PATH && candidateIo.hasFile(path) }));
rejectReceipt("tampered live artifact", "browser", () => {}, "artifact SHA-256 mismatch", (candidateIo) => ({ ...candidateIo, readBytes: (path) => path === ARTIFACT_PATH ? Buffer.from("tampered") : candidateIo.readBytes(path) }));
rejectReceipt("absolute command leak", "security", (value) => { value.checks[0].command = "/private/node checker.mjs"; }, "absolute executable path");

const current = JSON.parse(readFileSync(join(root, "contracts/v1/release-receipts.json"), "utf8"));
const currentEffectiveness = deriveEffectivenessClaim(current);
if (currentEffectiveness.status !== "blocked") throw new Error("current immutable effectiveness claim must remain blocked");

console.log("release checker v2 tests passed (registered engineering cells + immutable blocked effectiveness)");
