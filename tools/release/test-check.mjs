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

function manifestFixture() {
  const payloads = Object.fromEntries(Object.entries(ENGINEERING_PRODUCERS).map(([id, producer]) => [id, JSON.stringify({ schema_version: 1, ...producer.assertions })]));
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
  ...Object.entries(ENGINEERING_PRODUCERS).map(([id, { path, assertions }]) => [path, JSON.stringify({ schema_version: 1, ...assertions })]),
  [EFFECTIVENESS_SOURCES["w1-effectiveness"].path, w1Payload],
  [EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].path, v5Payload],
]);
const io = { hasFile: (path) => texts.has(path), readText: (path) => texts.get(path), hasCommand: () => true };
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
const forgedIo = { hasFile: (path) => forgedTexts.has(path), readText: (path) => forgedTexts.get(path), hasCommand: () => true };
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
  const candidateIo = { hasFile: (path) => candidateTexts.has(path), readText: (path) => candidateTexts.get(path), hasCommand: () => true };
  const errors = deriveEffectivenessClaim(candidate, candidateIo).errors;
  if (!errors.some((error) => error.includes(expected))) throw new Error(`${label} did not fail with ${expected}: ${errors.join("; ")}`);
}

rejectProjection("forged W1 source binding", "w1-effectiveness", (value) => { value.source_evidence_sha256 = "0".repeat(64); }, "canonical source evidence hash mismatch");
rejectProjection("forged W1 effectiveness", "w1-effectiveness", (value) => { value.effectiveness_status = "effective"; }, "effectiveness_status must remain blocked");
rejectProjection("forged W1 completion", "w1-effectiveness", (value) => { value.jobs.complete = 11; }, "completed jobs must remain 12/12");
rejectProjection("forged V5 source binding", "terminal-v5-effectiveness", (value) => { value.source_evidence_sha256 = "0".repeat(64); }, "canonical source evidence hash mismatch");
rejectProjection("weakened V5 threshold", "terminal-v5-effectiveness", (value) => { value.threshold = 0.3; }, "historical delta 0.3 and threshold 0.6 must be preserved");
rejectProjection("promoted V5 verdict", "terminal-v5-effectiveness", (value) => { value.release_eligible = true; value.effectiveness_status = "effective"; }, "immutable release_eligible must remain false");

const current = JSON.parse(readFileSync(join(root, "contracts/v1/release-receipts.json"), "utf8"));
const currentErrors = checkReleaseManifest(current);
if (currentErrors.length) throw new Error(`current release manifest failed: ${currentErrors.join("; ")}`);
const currentEffectiveness = deriveEffectivenessClaim(current);
if (currentEffectiveness.status !== "blocked") throw new Error("current immutable effectiveness claim must remain blocked");

console.log("release checker v2 tests passed (registered engineering cells + immutable blocked effectiveness)");
