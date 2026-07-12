#!/usr/bin/env node
/**
 * tools/evals/adjudicate.mjs — adjudication hooks for evaluation disagreements.
 *
 * Triggers when judges split on baseline/upgraded preference, differ by >1 point on a
 * blocking dimension, or disagree on diagnostic/gate truth.
 *
 * Contract:
 *   - No majority vote can override a contract/safety regression.
 *   - Adjudicator sees outputs, all cited evidence, and rubric — but NOT author identity.
 *   - Writes a pending adjudication request to .omx/evidence/tastecheck-v1/adjudication/
 *   - Blocks (exit 1) until the adjudicator resolves or marks the request skipped (not applicable).
 *
 * Usage:
 *   node tools/evals/adjudicate.mjs --check <skill> <scenario_id>  # check adjudication status
 *   node tools/evals/adjudicate.mjs --list                          # list all pending requests
 *   node tools/evals/adjudicate.mjs --create <judgments-file.json> # detect splits, create requests
 *   node tools/evals/adjudicate.mjs --resolve <request-id> <verdict-file.json>  # record resolution
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const ADJ_DIR = join(root, ".omx/evidence/tastecheck-v1/adjudication");

const BLOCKING_DIMENSIONS = ["brief_fit", "specificity", "usability", "skill_requirements"];
const MAX_DIMENSION_DELTA = 1.0;

function sha256(s) { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

// Detect disagreements from a judgment file
// judgments: [{run_pair_id, judge_id, preference: "A"|"B", scores: {dim: number}, flags: []}]
function detectDisagreements(judgments) {
  // Group by run_pair_id
  const byPair = {};
  for (const j of judgments) {
    if (!byPair[j.run_pair_id]) byPair[j.run_pair_id] = [];
    byPair[j.run_pair_id].push(j);
  }

  const triggers = [];
  for (const [pairId, pairJudgments] of Object.entries(byPair)) {
    if (pairJudgments.length < 2) continue;

    // Check 1: split preference (judges disagree on A vs B)
    const prefs = pairJudgments.map((j) => j.preference);
    const prefSet = new Set(prefs);
    if (prefSet.size > 1) {
      triggers.push({ run_pair_id: pairId, trigger: "split_preference", detail: `Judges split: ${prefs.join(", ")}` });
    }

    // Check 2: >1 point delta on any blocking dimension
    for (const dim of BLOCKING_DIMENSIONS) {
      const scores = pairJudgments.map((j) => j.scores?.[dim]).filter((s) => s !== undefined);
      if (scores.length < 2) continue;
      const delta = Math.max(...scores) - Math.min(...scores);
      if (delta > MAX_DIMENSION_DELTA) {
        triggers.push({ run_pair_id: pairId, trigger: "blocking_dimension_delta", dimension: dim, delta: parseFloat(delta.toFixed(2)) });
      }
    }

    // Check 3: disagreement on diagnostic/gate truth
    const truthFlags = pairJudgments.flatMap((j) => (j.flags ?? []).filter((f) => f.startsWith("truth:")));
    if (truthFlags.length > 0 && new Set(truthFlags).size > 1) {
      triggers.push({ run_pair_id: pairId, trigger: "diagnostic_truth_disagreement", flags: truthFlags });
    }

    // Check 4: any judge flagged contract/safety regression — these can never be majority-voted away
    const safetyFlags = pairJudgments.flatMap((j) => (j.flags ?? []).filter((f) => f.startsWith("safety:") || f.startsWith("contract:")));
    if (safetyFlags.length > 0) {
      triggers.push({ run_pair_id: pairId, trigger: "contract_safety_regression", flags: safetyFlags, note: "No majority vote can override a contract/safety regression" });
    }
  }
  return triggers;
}

function createRequest(triggers, judgmentFile) {
  if (triggers.length === 0) { console.log("No adjudication triggers detected."); return; }
  mkdirSync(ADJ_DIR, { recursive: true });
  const created = [];
  for (const trigger of triggers) {
    const reqId = `adj-${trigger.run_pair_id}-${sha256(JSON.stringify(trigger))}`;
    const reqPath = join(ADJ_DIR, `${reqId}.json`);
    if (existsSync(reqPath)) { console.log(`Already exists: ${reqId}`); continue; }
    const request = {
      schema_version: 1,
      request_id: reqId,
      status: "pending",
      run_pair_id: trigger.run_pair_id,
      trigger,
      judgment_source: judgmentFile.replace(root, "").replace(/^\//, ""),
      note: "Adjudicator: review both outputs with rubric evidence (NOT author identity). Write resolved verdict to --resolve.",
      created_at_utc: "2026-07-11T00:00:00Z",
    };
    writeFileSync(reqPath, JSON.stringify(request, null, 2));
    console.log(`Created adjudication request: ${reqId}`);
    created.push(reqId);
  }
  return created;
}

function listRequests() {
  if (!existsSync(ADJ_DIR)) { console.log("No adjudication requests."); return; }
  const files = readdirSync(ADJ_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) { console.log("No adjudication requests."); return; }
  for (const f of files) {
    try {
      const req = JSON.parse(readFileSync(join(ADJ_DIR, f), "utf8"));
      console.log(`[${req.status}] ${req.request_id} — ${req.trigger?.trigger ?? "unknown"} (pair: ${req.run_pair_id})`);
    } catch {}
  }
}

function checkStatus(skill, scenarioId) {
  if (!existsSync(ADJ_DIR)) { console.log("No adjudication requests."); return true; }
  const files = readdirSync(ADJ_DIR).filter((f) => f.endsWith(".json"));
  const pending = files.filter((f) => {
    try {
      const req = JSON.parse(readFileSync(join(ADJ_DIR, f), "utf8"));
      return req.status === "pending" && req.run_pair_id?.includes(`${skill}-${scenarioId}`);
    } catch { return false; }
  });
  if (pending.length > 0) {
    console.error(`BLOCKED: ${pending.length} pending adjudication request(s) for ${skill}/${scenarioId}`);
    for (const f of pending) console.error(`  ${f}`);
    return false;
  }
  console.log(`No pending adjudication for ${skill}/${scenarioId}`);
  return true;
}

function resolveRequest(requestId, verdictFile) {
  const reqPath = join(ADJ_DIR, `${requestId}.json`);
  if (!existsSync(reqPath)) { console.error(`Request not found: ${requestId}`); process.exit(1); }
  if (!existsSync(verdictFile)) { console.error(`Verdict file not found: ${verdictFile}`); process.exit(1); }
  const req = JSON.parse(readFileSync(reqPath, "utf8"));
  const verdict = JSON.parse(readFileSync(verdictFile, "utf8"));
  if (!verdict.verdict || !verdict.reasoning) {
    console.error("Verdict file must contain 'verdict' and 'reasoning' fields");
    process.exit(1);
  }
  req.status = "resolved";
  req.resolution = {
    verdict: verdict.verdict,
    reasoning: verdict.reasoning,
    adjudicator_provenance: verdict.adjudicator_provenance ?? "unspecified",
    resolved_at_utc: verdict.resolved_at_utc ?? "2026-07-11T00:00:00Z",
  };
  writeFileSync(reqPath, JSON.stringify(req, null, 2));
  console.log(`Resolved: ${requestId} → ${verdict.verdict}`);
}

// CLI dispatch
const [,, cmd, ...rest] = process.argv;
if (cmd === "--list") {
  listRequests();
} else if (cmd === "--check") {
  const [skill, scenarioId] = rest;
  if (!skill || !scenarioId) { console.error("Usage: adjudicate.mjs --check <skill> <scenario_id>"); process.exit(1); }
  const ok = checkStatus(skill, scenarioId);
  if (!ok) process.exit(1);
} else if (cmd === "--create") {
  const [judgmentFile] = rest;
  if (!judgmentFile || !existsSync(judgmentFile)) { console.error("Usage: adjudicate.mjs --create <judgments.json>"); process.exit(1); }
  const judgments = JSON.parse(readFileSync(judgmentFile, "utf8"));
  const triggers = detectDisagreements(judgments);
  createRequest(triggers, judgmentFile);
} else if (cmd === "--resolve") {
  const [requestId, verdictFile] = rest;
  if (!requestId || !verdictFile) { console.error("Usage: adjudicate.mjs --resolve <request-id> <verdict.json>"); process.exit(1); }
  resolveRequest(requestId, verdictFile);
} else {
  console.log("Usage:");
  console.log("  node tools/evals/adjudicate.mjs --list");
  console.log("  node tools/evals/adjudicate.mjs --check <skill> <scenario_id>");
  console.log("  node tools/evals/adjudicate.mjs --create <judgments.json>");
  console.log("  node tools/evals/adjudicate.mjs --resolve <request-id> <verdict.json>");
}
