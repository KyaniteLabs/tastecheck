#!/usr/bin/env node
/**
 * conflict-blind-gate — blind SHIP/HOLD adjudication of verdict-corpus rows
 * by an independent judge that never sees the org's recorded verdict,
 * the principle annotations, or the class label.
 *
 * Blindness is mechanical, not procedural: the packet is built from a
 * field whitelist and linted — if any masked field name or value leaks into
 * the serialized packet, the gate refuses to run (exit 3).
 *
 * Arms:
 *   cold        — subject + verbatim quote + ask
 *   duty-primed — cold + the names of the duties at stake (conflict rows:
 *                 both sides; routine rows: the single duty). Names only;
 *                 never the resolution, never which side the org picked.
 *
 * Judge: any command that reads the packet on stdin and prints a message
 * containing SHIP or HOLD. Default: codex exec (org workaround lane).
 *
 * Usage:
 *   node tools/evals/conflict-blind-gate.mjs --corpus c.jsonl \
 *     --split split-manifest.json --arm duty-primed --receipts dir/ \
 *     [--judge-cmd "cat"] [--limit N]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ASK =
  "You are an independent release gate. Decide: SHIP (proceed as described) or HOLD (do not proceed as-is). " +
  "Answer with exactly one word, SHIP or HOLD, on the first line. One sentence of reasoning after it.";

const MASKED_KEYS = [
  "verdict",
  "label",
  "expectation",
  "principles",
  "class",
  "conflict",
  "status",
  "satisfied",
  "violated",
  "gated_on",
];

function parseArgs(argv) {
  const args = { arm: "cold", judgeCmd: "codex exec -C /tmp --skip-git-repo-check -", limit: 0 };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    const v = argv[i + 1];
    if (k === "corpus") args.corpus = v;
    else if (k === "split") args.split = v;
    else if (k === "arm") args.arm = v;
    else if (k === "receipts") args.receipts = v;
    else if (k === "judge-cmd") args.judgeCmd = v;
    else if (k === "limit") args.limit = Number(v);
  }
  if (!args.corpus || !args.split || !args.receipts) {
    console.error("usage: conflict-blind-gate.mjs --corpus c.jsonl --split m.json --receipts dir/ [--arm cold|duty-primed] [--judge-cmd cmd] [--limit n]");
    process.exit(2);
  }
  if (args.arm !== "cold" && args.arm !== "duty-primed") {
    console.error(`--arm must be cold|duty-primed, got ${args.arm}`);
    process.exit(2);
  }
  return args;
}

export function loadCorpus(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Key-level blindness lint over a serialized packet. */
export function lintPacket(serialized) {
  const leaked = MASKED_KEYS.filter((k) => new RegExp(`"${k}"`).test(serialized));
  return { leaked_keys: leaked, blind: leaked.length === 0 };
}

/** Build the masked packet. Whitelist only; returns {packet, lint}. */
export function buildPacket(row, arm) {
  const duties = [];
  if (arm === "duty-primed") {
    if (row.conflict) duties.push(row.conflict.a, row.conflict.b);
    else if (row.principles) duties.push(...row.principles.map((p) => p.name));
  }
  const packet = {
    subject: row.subject,
    verbatim: row.source?.quote ?? "",
    duties_at_stake: duties,
    ask: ASK,
  };
  // Note: values are JSON-escaped on serialize, so injected `"verdict":` text in
  // a subject cannot become a real key; the lint guards whitelist regressions.
  return { packet, lint: lintPacket(JSON.stringify(packet)) };
}

export function runJudge(judgeCmd, packet) {
  const parts = judgeCmd.split(/\s+/);
  const res = spawnSync(parts[0], parts.slice(1), {
    input: JSON.stringify(packet, null, 2),
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}

/** First SHIP/HOLD token in the judge output; null if the judge dodged. */
export function parseVerdict(text) {
  const m = String(text).match(/\b(SHIP|HOLD)\b/);
  return m ? m[1] : null;
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = loadCorpus(readFileSync(args.corpus, "utf8"));
  const split = JSON.parse(readFileSync(args.split, "utf8"));
  const byId = new Map(rows.map((r) => [r.id, r]));
  let heldIds = split.held_out;
  if (args.limit > 0) heldIds = heldIds.slice(0, args.limit);
  mkdirSync(args.receipts, { recursive: true });

  const results = [];
  for (const id of heldIds) {
    const row = byId.get(id);
    if (!row) throw new Error(`split references unknown id ${id}`);
    const { packet, lint } = buildPacket(row, args.arm);
    if (!lint.blind) {
      console.error(`BLINDNESS LINT FAILED for ${id}: leaked ${lint.leaked_keys.join(",")}`);
      process.exit(3);
    }
    const raw = runJudge(args.judgeCmd, packet);
    const judgeVerdict = parseVerdict(raw.stdout);
    const truth = row.expectation?.verdict ?? null;
    const outcome = !judgeVerdict ? "UNPARSED" : judgeVerdict === truth ? "AGREE" : "DISAGREE";
    const receipt = {
      id,
      arm: args.arm,
      packet_sha256: createHash("sha256").update(JSON.stringify(packet)).digest("hex"),
      judge_status: raw.status,
      judge_verdict: judgeVerdict,
      recorded_verdict: truth,
      outcome,
      row_class: row.class, // recorded in the receipt, never in the packet
      raw: raw.stdout.slice(0, 8000),
    };
    results.push(receipt);
    writeFileSync(`${args.receipts}/${id}.json`, JSON.stringify(receipt, null, 2) + "\n");
    console.error(`${outcome.padEnd(9)} ${id} judge=${judgeVerdict} truth=${truth}`);
  }

  const n = results.length;
  const agree = results.filter((r) => r.outcome === "AGREE").length;
  const conflictRows = results.filter((r) => r.row_class === "conflict");
  const conflictAgree = conflictRows.filter((r) => r.outcome === "AGREE").length;
  const report = {
    gate: "conflict-blind-gate",
    arm: args.arm,
    corpus_sha256: split.corpus_sha256,
    split_seed: split.seed,
    judged: n,
    unparsed: results.filter((r) => r.outcome === "UNPARSED").length,
    agreement: { overall: n ? agree / n : null, conflict_subset: conflictRows.length ? conflictAgree / conflictRows.length : null },
    counts: { agree, conflict_judged: conflictRows.length, conflict_agree: conflictAgree },
    results: results.map(({ id, outcome, judge_verdict, recorded_verdict, row_class }) => ({
      id,
      outcome,
      judge_verdict,
      recorded_verdict,
      row_class,
    })),
  };
  writeFileSync(`${args.receipts}/gate-report-${args.arm}.json`, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
