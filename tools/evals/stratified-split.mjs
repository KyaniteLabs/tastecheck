#!/usr/bin/env node
/**
 * stratified-split — deterministic train/held-out split for verdict corpora,
 * keyed on class presence (round-2 cure for the blind-gate no-win class:
 * a held-out split that happens to contain zero conflict rows cannot measure
 * the thing the gate exists to measure).
 *
 * Law this tool encodes (dispatch 2026-09-28, tastecheck conflict-harvest):
 *   The held-out set ALWAYS contains at least one row of every class that
 *   exists in the corpus, whenever the corpus is large enough to allow it.
 *
 * Determinism: row order is derived from sha256(id + ":" + seed), never from
 * file order; the repair pass moves the lowest-hash member of a missing class
 * from train to held-out. Same corpus + seed + ratio => byte-identical split.
 *
 * Usage:
 *   node tools/evals/stratified-split.mjs --corpus <file.jsonl> \
 *     [--ratio 0.4] [--seed round-2] [--out <split-manifest.json>]
 *
 * Corpus row shape (v1 verdict-case schema, org-side profiles law):
 *   { id, class, expectation: { verdict }, ... }   // class: "conflict" | ...
 * Only id + class are read here; the gate reads the rest.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = { ratio: 0.4, seed: "round-2", out: null, corpus: null };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    const v = argv[i + 1];
    if (k === "ratio") args.ratio = Number(v);
    else if (k === "seed") args.seed = String(v);
    else if (k === "out") args.out = v;
    else if (k === "corpus") args.corpus = v;
  }
  if (!args.corpus) {
    console.error("usage: stratified-split.mjs --corpus <file.jsonl> [--ratio 0.4] [--seed s] [--out manifest.json]");
    process.exit(2);
  }
  if (!(args.ratio > 0 && args.ratio < 1)) {
    console.error(`--ratio must be in (0,1), got ${args.ratio}`);
    process.exit(2);
  }
  return args;
}

export function loadCorpus(text) {
  const rows = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (err) {
      throw new Error(`corpus line ${i + 1} is not JSON: ${err.message}`);
    }
    if (typeof row.id !== "string" || !row.id) throw new Error(`corpus line ${i + 1}: missing id`);
    if (typeof row.class !== "string" || !row.class) throw new Error(`corpus line ${i + 1}: missing class`);
    rows.push(row);
  }
  if (!rows.length) throw new Error("corpus is empty");
  return rows;
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/**
 * Deterministic stratified split.
 * 1. Hash-order all rows within each class bucket (sha256(id:seed)).
 * 2. Round-robin deal each bucket into held-out until the global ratio is met.
 * 3. Repair pass: for every class present in the corpus but absent from
 *    held-out, move that bucket's lowest-hash train row into held-out.
 * 4. Invariant check: every corpus class appears in held-out, or the corpus
 *    genuinely has too few rows of that class to spare one (|class| == 1 and
 *    the split would empty the corpus) — reported, not silently dropped.
 */
export function stratifiedSplit(rows, { ratio = 0.4, seed = "round-2" } = {}) {
  const hashOf = (row) => sha(`${row.id}:${seed}`);
  const byClass = new Map();
  for (const row of rows) {
    if (!byClass.has(row.class)) byClass.set(row.class, []);
    byClass.get(row.class).push(row);
  }
  for (const bucket of byClass.values()) bucket.sort((a, b) => hashOf(a).localeCompare(hashOf(b)));

  const target = Math.max(1, Math.round(rows.length * ratio));
  const heldOut = new Set();
  // round-robin across class buckets so early classes cannot monopolize
  const classNames = [...byClass.keys()].sort();
  let filled = 0;
  for (let round = 0; filled < target; round += 1) {
    let progressed = false;
    for (const cn of classNames) {
      if (filled >= target) break;
      const bucket = byClass.get(cn);
      if (round < bucket.length) {
        heldOut.add(bucket[round].id);
        filled += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const repairs = [];
  for (const cn of classNames) {
    if ([...byClass.get(cn)].some((r) => heldOut.has(r.id))) continue;
    const spare = byClass.get(cn).find((r) => !heldOut.has(r.id));
    if (!spare) continue; // single-row class: cannot split, reported below
    heldOut.add(spare.id);
    repairs.push({ moved: spare.id, class: cn, reason: "class-absent-from-held-out" });
  }

  const train = rows.filter((r) => !heldOut.has(r.id)).map((r) => r.id).sort();
  const held = rows.filter((r) => heldOut.has(r.id)).map((r) => r.id).sort();
  // corpus hash is canonical over sorted serializations so file order cannot change it
  const corpusSha = sha([...rows].map((r) => JSON.stringify(r)).sort().join("\n"));

  const classCounts = Object.fromEntries([...byClass.entries()].map(([cn, b]) => [cn, b.length]));
  const heldClassCounts = Object.fromEntries(
    classNames.map((cn) => [cn, rows.filter((r) => r.class === cn && heldOut.has(r.id)).length]),
  );
  const unsplittable = classNames.filter(
    (cn) => heldClassCounts[cn] === 0 && classCounts[cn] > 0 && classCounts[cn] === rows.length,
  );

  return {
    corpus_sha256: corpusSha,
    seed,
    ratio,
    counts: { total: rows.length, train: train.length, held_out: held.length },
    class_counts: classCounts,
    held_out_class_counts: heldClassCounts,
    invariants: {
      deterministic: true,
      every_class_in_held_out: classNames.every((cn) => heldClassCounts[cn] > 0 || classCounts[cn] === 1),
      unsplittable_single_class_corpus: unsplittable,
    },
    repairs,
    train,
    held_out: held,
  };
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = loadCorpus(readFileSync(args.corpus, "utf8"));
  const manifest = stratifiedSplit(rows, { ratio: args.ratio, seed: args.seed });
  const json = JSON.stringify(manifest, null, 2);
  if (args.out) writeFileSync(args.out, json + "\n");
  process.stdout.write(json + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
