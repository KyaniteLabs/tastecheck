#!/usr/bin/env node
/**
 * tastecheck profile calibration — import a user-local verdict corpus, fit
 * the profile's dimension weights, and run the blind-validation gate against
 * held-out verdicts. Receipts land only where the user points them.
 *
 * Usage (paths are USER-LOCAL data — the repo is never a valid destination):
 *   node tools/profile/run-profile-calibration.mjs --corpus <path> \
 *     [--receipt <path>] [--profile-out <path>]
 *
 * Privacy law (evals/corpus/PROFILE.md): the corpus and both outputs are the
 * user's own taste data. This runner REFUSES to read a corpus from inside the
 * product repo or write any output into it — the product ships EMPTY of
 * anyone's taste.
 */
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadCorpus } from "./calibration-corpus.mjs";
import { calibrateWeights, CALIBRATION_PARAMS } from "./calibrate-profile.mjs";
import { runBlindGate } from "./blind-gate.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");

export function assertUserLocalPath(targetPath, label) {
  const resolved = isAbsolute(targetPath) ? resolve(targetPath) : resolve(process.cwd(), targetPath);
  if (resolved === REPO_ROOT || resolved.startsWith(`${REPO_ROOT}/`)) {
    throw new Error(
      `${label} path is inside the product repo (${resolved}) — profile data is user-local and never enters the repo (privacy law, evals/corpus/PROFILE.md)`,
    );
  }
  return resolved;
}

export function runProfileCalibration({ corpusPath, receiptPath, profileOutPath, write = true }) {
  // Privacy refusals fire BEFORE any read or write: the repo is never a
  // valid source or destination for user-local taste data.
  const corpusResolved = assertUserLocalPath(corpusPath, "corpus");
  const receiptResolved = assertUserLocalPath(receiptPath ?? corpusResolved.replace(/\.json$/, "") + "-gate-receipt.json", "receipt");
  const profileResolved = assertUserLocalPath(profileOutPath ?? corpusResolved.replace(/\.json$/, "") + "-profile-weights.json", "profile");
  const corpus = loadCorpus(corpusResolved);
  const calibration = calibrateWeights(corpus.entries, CALIBRATION_PARAMS);
  const gate = runBlindGate(corpus.entries, CALIBRATION_PARAMS);
  const ranAt = new Date().toISOString();

  const receipt = {
    schema_version: 1,
    kind: "tastecheck-profile-calibration-receipt",
    ran_at: ranAt,
    corpus_path: corpusResolved,
    import_stats: corpus.stats,
    calibration: {
      params: calibration.params,
      scoreable_count: calibration.scoreable_count,
      weights: calibration.weights,
      side_weights: calibration.side_weights,
      evidence: calibration.evidence,
    },
    gate,
  };

  if (write) {
    mkdirSync(dirname(receiptResolved), { recursive: true });
    mkdirSync(dirname(profileResolved), { recursive: true });
    writeFileSync(receiptResolved, `${JSON.stringify(receipt, null, 2)}\n`);
    writeFileSync(profileResolved, `${JSON.stringify({ schema_version: 1, kind: "tastecheck-profile-weights", generated_at: ranAt, source_corpus: corpusResolved, weights: calibration.weights, side_weights: calibration.side_weights, evidence: calibration.evidence, params: calibration.params }, null, 2)}\n`);
    receipt.outputs = { receipt: receiptResolved, profile: profileResolved };
  }

  return { receipt, corpus };
}

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const corpusPath = flag("corpus");
  if (!corpusPath) {
    console.error("usage: node tools/profile/run-profile-calibration.mjs --corpus <user-local-corpus.json> [--receipt <path>] [--profile-out <path>]");
    process.exit(2);
  }
  let result;
  try {
    result = runProfileCalibration({ corpusPath, receiptPath: flag("receipt"), profileOutPath: flag("profile-out") });
  } catch (error) {
    console.error(`profile calibration failed: ${error.message}`);
    process.exit(1);
  }
  const { receipt } = result;
  console.log(`imported: ${receipt.import_stats.total} verdicts (${receipt.import_stats.scoreable} taste-scoreable, ${receipt.import_stats.process_only} process-only, ${receipt.import_stats.derived} derived salience)`);
  console.log(`blind gate: ${receipt.gate.verdict} — calibrated ${receipt.gate.calibrated?.accuracy ?? "-"} vs uncalibrated ${receipt.gate.uncalibrated?.accuracy ?? "-"} (delta ${receipt.gate.delta ?? "-"}) on ${receipt.gate.split.heldout.length} held-out verdicts`);
  if (receipt.gate.conflicts?.note) console.log(`conflicts: ${receipt.gate.conflicts.note}`);
  if (receipt.outputs) console.log(`receipt: ${receipt.outputs.receipt}\nprofile: ${receipt.outputs.profile}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
