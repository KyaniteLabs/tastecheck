#!/usr/bin/env node
/**
 * tools/evals/run-w1-pilot.mjs — W1 pilot job orchestrator.
 *
 * Reads evals/w1/job-manifest.json and for each pending job:
 *   1. Loads the prompt packet from evals/w1/jobs/<job_id>.json
 *   2. Checks for externally-written raw output files (Terra/Luna Codex threads)
 *   3. Validates any found output files via the canonical w1-attempt-validator
 *   4. Appends validated attempts to the raw-attempt ledger (idempotent: skips
 *      attempt_ids already present in the ledger)
 *   5. Updates job status in the manifest
 *
 * In --dry-run mode: prints what would be run without executing.
 * In --validate-only mode: validates existing output files only (no ledger writes).
 *
 * Note: This runner does NOT call the model directly. Model execution is performed
 * by external Codex threads writing to .omx/evidence/tastecheck-v1/raw/<job_id>-attempt-<n>.json.
 * This runner discovers, validates, and registers those outputs.
 *
 * Usage:
 *   node tools/evals/run-w1-pilot.mjs [--dry-run] [--validate-only] [--job <job_id>]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { validateAttempt, loadPacket } from "./lib/w1-attempt-validator.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const manifestPath = join(root, "evals/w1/job-manifest.json");
// Raw ledger and raw outputs live exclusively under .omx — never under evals/
const ledgerPath = join(root, ".omx/evidence/tastecheck-v1/raw/ledger.jsonl");
const outputsDir = join(root, ".omx/evidence/tastecheck-v1/raw");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const validateOnly = args.includes("--validate-only");
const filterJob = args.includes("--job") ? args[args.indexOf("--job") + 1] : null;

// Scan only attempt filenames — <job_id>-attempt-<n>.json
const ATTEMPT_RE = /^[a-z][a-z0-9-]+-(?:baseline|upgraded)-seed\d+-attempt-\d+\.json$/;

// Load manifest
if (!existsSync(manifestPath)) {
  console.error("BLOCKED: job-manifest.json not found at", manifestPath);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const jobs = manifest.jobs.filter((j) => !filterJob || j.job_id === filterJob);

if (dryRun) {
  console.log(`W1 pilot -- DRY RUN (${jobs.length} jobs)`);
  for (const job of jobs) {
    console.log(`  [${job.status}] ${job.job_id} (${job.run_type}, seed ${job.requested_seed})`);
  }
  console.log("\nExternal output directory:", outputsDir);
  console.log("Filename convention: <job_id>-attempt-<n>.json");
  console.log("Validation: tools/evals/lib/w1-attempt-validator.mjs");
  process.exit(0);
}

mkdirSync(outputsDir, { recursive: true });

// Build set of already-registered attempt_ids from ledger (idempotency guard)
const registeredAttemptIds = new Set();
if (existsSync(ledgerPath)) {
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim());
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.attempt_id) registeredAttemptIds.add(entry.attempt_id);
    } catch { /* skip malformed lines */ }
  }
}

let registeredCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const job of jobs) {
  const packet = loadPacket(root, job.job_id);
  if (!packet) {
    console.error(`  [error] ${job.job_id}: no packet file found at evals/w1/jobs/${job.job_id}.json`);
    errorCount++;
    continue;
  }

  // Look for externally-written output files matching only the attempt filename pattern
  const jobPattern = new RegExp(
    `^${job.job_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-attempt-\\d+\\.json$`
  );
  let outputFiles = [];
  if (existsSync(outputsDir)) {
    outputFiles = readdirSync(outputsDir)
      .filter((f) => ATTEMPT_RE.test(f) && jobPattern.test(f))
      .sort();
  }

  if (outputFiles.length === 0) {
    console.log(`  [pending] ${job.job_id} — no output files found`);
    continue;
  }

  for (const file of outputFiles) {
    const filePath = join(outputsDir, file);
    let attempt;
    try {
      attempt = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (e) {
      console.error(`  [error] ${file}: invalid JSON — ${e.message}`);
      errorCount++;
      continue;
    }

    // Idempotency: skip if this attempt_id is already in the ledger
    if (attempt.attempt_id && registeredAttemptIds.has(attempt.attempt_id)) {
      console.log(`  [skip-dup] ${file} — attempt_id "${attempt.attempt_id}" already in ledger`);
      skippedCount++;
      if (attempt.status === "complete") job.status = "complete";
      continue;
    }

    // Canonical validation
    const attemptPacket = loadPacket(root, attempt.job_id, attempt.attempt_id);
    const validationErrors = validateAttempt(attempt, attemptPacket, root);
    if (validationErrors.length > 0) {
      console.error(`  [error] ${file}: validation failed:`);
      for (const e of validationErrors) console.error(`    - ${e}`);
      errorCount++;
      continue;
    }

    if (validateOnly) {
      console.log(`  [valid] ${file}`);
      continue;
    }

    // Append to ledger — preserve date_utc from attempt; never synthesize a timestamp
    const ledgerEntry = {
      attempt_id: attempt.attempt_id,
      job_id: attempt.job_id,
      executor: attempt.executor,
      requested_seed: attempt.requested_seed,
      observed_seed: null,
      run_type: attempt.run_type,
      status: attempt.status,
      output_ref: `.omx/evidence/tastecheck-v1/raw/${file}`,
      raw_output_hash: attempt.raw_output_hash,
      external_source: attempt.external_source,
      external_source_lane: attempt.external_source_lane,
      ...(attempt.date_utc !== undefined ? { date_utc: attempt.date_utc } : {}),
    };
    appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + "\n");
    registeredAttemptIds.add(attempt.attempt_id);
    console.log(`  [registered] ${file} → ledger`);
    registeredCount++;

    if (attempt.status === "complete") {
      job.status = "complete";
      job.attempt_count = (job.attempt_count ?? 0) + 1;
    }
  }
}

// Persist updated manifest (only when not validate-only)
if (!validateOnly) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

const pending = manifest.jobs.filter((j) => j.status === "pending").length;
const complete = manifest.jobs.filter((j) => j.status === "complete").length;
console.log(
  `\nW1 pilot: ${complete}/12 complete, ${pending} pending, ${registeredCount} registered, ${skippedCount} skipped (dup), ${errorCount} errors`
);
if (errorCount > 0) process.exit(1);
