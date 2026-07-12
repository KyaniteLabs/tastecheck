#!/usr/bin/env node
/**
 * tools/evals/evaluators/collect-attempt.mjs — raw attempt collector.
 *
 * Reads a raw attempt JSON, content-addresses the output body,
 * and appends a ledger entry to .omx/evidence/tastecheck-v1/raw/ledger.jsonl.
 * Supports externally written output files from Codex desktop / Terra / Luna threads.
 *
 * Raw attempt schema:
 * {
 *   "skill":                 string,                      // e.g. "component-states"
 *   "scenario_id":           string,                      // e.g. "component-states-async-destructive-control"
 *   "variant":               "baseline"|"upgraded",
 *   "requested_seed":        number|null,                 // seed from job packet; null if not applicable
 *   "observed_seed":         null,                        // always null — desktop threads do not expose seed
 *   "requested_temperature": number|null,                 // temperature from job packet
 *   "observed_temperature":  null,                        // always null — desktop threads do not expose temperature
 *   "run_id":                string,                      // unique run identifier
 *   "prompt_hash":           string,                      // sha256 of exact prompt text
 *   "context_hash":          string,                      // sha256 of system/context prompt
 *   "tool_policy":           string,
 *   "model_runtime":         "gpt-5.6-terra",             // production runtime only; evaluator lane uses gpt-5.6-luna
 *   "output_body":           string,                      // full text output
 *   "failure_class":         null|"transport"|"truncation"|"schema_corruption"|"auth_failure",
 *   "provider_request_id":   string|null
 * }
 *
 * Usage: node tools/evals/evaluators/collect-attempt.mjs <raw-attempt.json>
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const rawDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const sha256Dir = join(rawDir, "sha256");
const ledgerPath = join(rawDir, "ledger.jsonl");

const REQUIRED_FIELDS = [
  "skill", "scenario_id", "variant", "run_id",
  "requested_seed", "observed_seed", "requested_temperature", "observed_temperature",
  "prompt_hash", "context_hash", "tool_policy", "model_runtime",
];
const VALID_VARIANTS = new Set(["baseline", "upgraded"]);
const VALID_FAILURE_CLASSES = new Set([null, undefined, "transport", "truncation", "schema_corruption", "auth_failure"]);

function sha256hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

const [,, inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: node tools/evals/evaluators/collect-attempt.mjs <raw-attempt.json>");
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (e) {
  console.error("Cannot read/parse input:", e.message);
  process.exit(1);
}

// Validate required fields
const missing = REQUIRED_FIELDS.filter((f) => raw[f] === undefined || raw[f] === null || raw[f] === "");
if (missing.length) {
  console.error("Missing required fields:", missing.join(", "));
  process.exit(1);
}

if (!VALID_VARIANTS.has(raw.variant)) {
  console.error(`Invalid variant: "${raw.variant}". Must be "baseline" or "upgraded".`);
  process.exit(1);
}

if (raw.model_runtime && raw.model_runtime !== "gpt-5.6-terra") {
  console.error(`model_runtime must be "gpt-5.6-terra" for production runs, got: "${raw.model_runtime}"`);
  process.exit(1);
}

if (raw.observed_seed !== null && raw.observed_seed !== undefined) {
  console.error(`observed_seed must be null — desktop threads do not expose seed controls`);
  process.exit(1);
}

if (raw.observed_temperature !== null && raw.observed_temperature !== undefined) {
  console.error(`observed_temperature must be null — desktop threads do not expose temperature controls`);
  process.exit(1);
}

const failureClass = raw.failure_class ?? null;
if (!VALID_FAILURE_CLASSES.has(failureClass)) {
  console.error(`Invalid failure_class: "${failureClass}".`);
  process.exit(1);
}

// An attempt with no failure_class must have output_body
if (!failureClass && !raw.output_body) {
  console.error("Non-failed attempts must include output_body.");
  process.exit(1);
}

// Content-address the output body (empty string for failed attempts)
const body = raw.output_body ?? "";
const outputDigest = sha256hex(body);
mkdirSync(sha256Dir, { recursive: true });
const blobPath = join(sha256Dir, outputDigest);
if (!existsSync(blobPath)) {
  writeFileSync(blobPath, body, "utf8");
}

// Build ledger entry (no raw paths, no personal data)
const entry = {
  collected_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  skill: raw.skill,
  scenario_id: raw.scenario_id,
  variant: raw.variant,
  requested_seed: raw.requested_seed ?? null,
  observed_seed: null,
  run_id: raw.run_id,
  prompt_hash: raw.prompt_hash,
  context_hash: raw.context_hash,
  tool_policy: raw.tool_policy,
  model_runtime: raw.model_runtime,
  requested_temperature: raw.requested_temperature ?? null,
  observed_temperature: null,
  output_ref: `sha256:${outputDigest}`,
  failure_class: failureClass,
  provider_request_id: raw.provider_request_id ?? null,
};

appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");

console.log(`Collected: ${raw.skill}/${raw.scenario_id}/${raw.variant}/${raw.seed ?? "noseed"}`);
console.log(`  run_id:     ${raw.run_id}`);
console.log(`  output_ref: sha256:${outputDigest}`);
console.log(`  failure:    ${failureClass ?? "none"}`);
console.log(`  ledger:     .omx/evidence/tastecheck-v1/raw/ledger.jsonl`);
