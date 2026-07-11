#!/usr/bin/env node
/**
 * tools/evals/collect-attempts.mjs — raw attempt collector.
 *
 * Ingests a raw model output file written by any worker (this process, Codex desktop,
 * Terra/Luna threads, or any external runner) and records it in the private ledger.
 *
 * Contract:
 *   - Input must be a JSON file matching the raw-attempt output schema (see below).
 *   - Content-addresses the output body with SHA-256.
 *   - Appends one line to .omx/evidence/tastecheck-v1/raw/ledger.jsonl
 *   - Never overwrites existing blobs (append-only, content-addressed).
 *   - Rejects schema violations, missing fields, and duplicate run_ids.
 *
 * Usage:
 *   node tools/evals/collect-attempts.mjs <input-file.json>
 *   node tools/evals/collect-attempts.mjs --scan   # scan external_writer_glob paths and ingest new files
 *
 * Raw attempt output schema:
 * {
 *   "schema_version": 1,
 *   "skill": string,
 *   "scenario_id": string,
 *   "variant": "baseline" | "upgraded",
 *   "run_id": string,                    // unique per run, e.g. "<skill>-<scenario>-<variant>-<seed>-<iso8601>"
 *   "requested_seed": number | null,     // seed value from job packet (desktop threads cannot guarantee isolation)
 *   "observed_seed": null,               // always null — desktop threads do not expose seed controls
 *   "requested_temperature": number | null, // temperature from job packet
 *   "observed_temperature": null,        // always null — desktop threads do not expose temperature controls
 *   "model_runtime": "gpt-5.6-terra",   // production runtime only; evaluator lane uses gpt-5.6-luna separately
 *   "tool_policy": string,
 *   "prompt_hash": string,               // sha256 of exact prompt text
 *   "context_hash": string,             // sha256 of system/context text
 *   "output_body": string,              // the raw model output text
 *   "started_at": string,               // ISO-8601 UTC or null if not observable
 *   "finished_at": string,              // ISO-8601 UTC or null if not observable
 *   "output_tokens": number,            // token count if observable else null
 *   "failure_class": null | "transport" | "truncation" | "schema_corruption"
 * }
 *
 * failure_class notes: content quality is never a valid failure class; invalid runs are
 * transport/tool failure, truncation before task completion, or schema corruption only.
 */
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RAW_BASE = join(root, ".omx/evidence/tastecheck-v1/raw");
const LEDGER_PATH = join(RAW_BASE, "ledger.jsonl");
const BLOBS_DIR = join(RAW_BASE, "sha256");

const REQUIRED_FIELDS = [
  "schema_version", "skill", "scenario_id", "variant", "run_id",
  "requested_seed", "observed_seed", "requested_temperature", "observed_temperature",
  "model_runtime", "tool_policy",
  "prompt_hash", "context_hash", "output_body",
  "started_at", "finished_at", "output_tokens",
];

const VALID_VARIANTS = new Set(["baseline", "upgraded"]);
const VALID_FAILURE_CLASSES = new Set([null, "transport", "truncation", "schema_corruption"]);

function sha256(s) {
  return createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");
}

function validateAttempt(raw, filePath) {
  const errors = [];
  if (raw.schema_version !== 1) errors.push("schema_version must be 1");
  for (const f of REQUIRED_FIELDS) {
    if (raw[f] === undefined) errors.push(`missing required field: ${f}`);
  }
  // Enforce production executor
  if (raw.model_runtime && raw.model_runtime !== "gpt-5.6-terra") {
    errors.push(`model_runtime must be gpt-5.6-terra for production runs, got: ${raw.model_runtime}`);
  }
  // Enforce null observed controls (desktop threads do not expose seed/temperature)
  if ("observed_seed" in raw && raw.observed_seed !== null) {
    errors.push("observed_seed must be null — desktop threads do not expose seed controls");
  }
  if ("observed_temperature" in raw && raw.observed_temperature !== null) {
    errors.push("observed_temperature must be null — desktop threads do not expose temperature controls");
  }
  if (!VALID_VARIANTS.has(raw.variant)) errors.push(`variant must be "baseline" or "upgraded", got: ${raw.variant}`);
  if (!VALID_FAILURE_CLASSES.has(raw.failure_class ?? null)) {
    errors.push(`failure_class must be null, "transport", "truncation", or "schema_corruption" — content quality is never a valid failure class`);
  }
  if (typeof raw.prompt_hash !== "string" || !/^[0-9a-f]{64}$/.test(raw.prompt_hash)) {
    errors.push("prompt_hash must be a 64-char hex string");
  }
  if (typeof raw.context_hash !== "string" || !/^[0-9a-f]{64}$/.test(raw.context_hash)) {
    errors.push("context_hash must be a 64-char hex string");
  }
  if (typeof raw.output_body !== "string" || raw.output_body.length === 0) {
    errors.push("output_body must be a non-empty string");
  }
  if (errors.length > 0) {
    console.error(`Schema errors in ${filePath}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

function loadLedgerIds() {
  const ids = new Set();
  if (!existsSync(LEDGER_PATH)) return ids;
  const lines = readFileSync(LEDGER_PATH, "utf8").trim().split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.run_id) ids.add(entry.run_id);
    } catch {}
  }
  return ids;
}

function ingestFile(inputPath) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (e) {
    console.error(`Cannot parse ${inputPath}: ${e.message}`);
    process.exit(1);
  }

  validateAttempt(raw, inputPath);

  const existingIds = loadLedgerIds();
  if (existingIds.has(raw.run_id)) {
    console.log(`run_id "${raw.run_id}" already in ledger — skipping (idempotent)`);
    return;
  }

  // Content-address the output body
  const bodyDigest = sha256(raw.output_body);
  mkdirSync(BLOBS_DIR, { recursive: true });
  const blobPath = join(BLOBS_DIR, bodyDigest);
  if (!existsSync(blobPath)) {
    writeFileSync(blobPath, raw.output_body);
  }

  // Write ledger entry (never includes raw output body)
  const entry = {
    run_id: raw.run_id,
    skill: raw.skill,
    scenario_id: raw.scenario_id,
    variant: raw.variant,
    requested_seed: raw.requested_seed,
    observed_seed: null,
    requested_temperature: raw.requested_temperature ?? null,
    observed_temperature: null,
    model_runtime: raw.model_runtime,
    tool_policy: raw.tool_policy,
    prompt_hash: raw.prompt_hash,
    context_hash: raw.context_hash,
    output_digest: bodyDigest,
    output_ref: `sha256:${bodyDigest}`,
    output_tokens: raw.output_tokens,
    started_at: raw.started_at,
    finished_at: raw.finished_at,
    failure_class: raw.failure_class ?? null,
  };

  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  appendFileSync(LEDGER_PATH, JSON.stringify(entry) + "\n");
  console.log(`Ingested: ${raw.run_id} → sha256:${bodyDigest.slice(0, 16)}...`);
}

// Scan external_writer_glob paths from pilot manifest
function scanExternalFiles() {
  const manifestPath = join(root, "evals/generated/pilot-manifest.json");
  if (!existsSync(manifestPath)) {
    console.log("No pilot-manifest.json found; run pilot-manifest.mjs --write first");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const existingIds = loadLedgerIds();
  let scanned = 0;
  let ingested = 0;

  for (const cell of manifest.cells) {
    if (!cell.external_writer_glob) continue;
    const dir = join(root, cell.evidence_path.replace(/\/[^/]+$/, ""));
    if (!existsSync(dir)) continue;

    const prefix = `upgraded-${cell.seed}-`;
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
    for (const f of files) {
      scanned++;
      const filePath = join(dir, f);
      let raw;
      try { raw = JSON.parse(readFileSync(filePath, "utf8")); } catch { continue; }
      if (existingIds.has(raw.run_id)) continue;
      ingestFile(filePath);
      ingested++;
    }
  }
  console.log(`Scan complete: ${scanned} external files found, ${ingested} newly ingested`);
}

const [,, inputArg] = process.argv;

if (inputArg === "--scan") {
  scanExternalFiles();
} else if (inputArg) {
  if (!existsSync(inputArg)) {
    console.error(`File not found: ${inputArg}`);
    process.exit(1);
  }
  ingestFile(inputArg);
} else {
  console.log("Usage:");
  console.log("  node tools/evals/collect-attempts.mjs <input-file.json>");
  console.log("  node tools/evals/collect-attempts.mjs --scan");
  process.exit(1);
}
