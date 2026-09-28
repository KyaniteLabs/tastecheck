/**
 * Blind-validation gate — only ship calibration if it measurably predicts
 * better. The gate splits the corpus train/held-out deterministically, fits
 * the profile weights on the training split only, and scores both the
 * calibrated and the uncalibrated (all-weights-1) profile on the held-out
 * verdicts. The gate's verdict is a measurement, never a claim: "pass" only
 * when calibrated accuracy strictly beats uncalibrated accuracy, "no-win"
 * with its measured explanation when it does not.
 *
 * Prediction task per held-out entry: from the entry's dimension salience
 * pattern (which dimensions drove the verdict, in which direction), predict
 * the verdict's polarity. pred = Σ w_d × salience_d; sign(pred) must equal
 * the polarity. An exact-zero prediction is an abstain and counts as a miss
 * for both profiles alike.
 */
import { calibrateWeights } from "./calibrate-profile.mjs";

const HOLDOUT_MODULO = 4; // every 4th scoreable entry (sorted by id) is held out

function predictScore(entry, weights) {
  let score = 0;
  for (const [dimension, salience] of Object.entries(entry.salience)) {
    score += (weights[dimension] ?? 1) * salience;
  }
  return score;
}

function scoreEntry(entry, weights) {
  const score = predictScore(entry, weights);
  const predicted = score > 0 ? 1 : score < 0 ? -1 : 0;
  return {
    id: entry.id,
    polarity: entry.polarity,
    predicted,
    correct: predicted === entry.polarity,
    abstain: predicted === 0,
    score: Number(score.toFixed(4)),
    salience: entry.salience,
  };
}

function accuracy(rows) {
  return rows.length === 0 ? null : Number((rows.filter((row) => row.correct).length / rows.length).toFixed(4));
}

/**
 * Count entries whose salience mixes violated and satisfied dimensions — the
 * conflict class where weights (rather than salience signs alone) decide the
 * prediction. A corpus with zero conflicts cannot distinguish any weighting
 * from the default, and the report says so in data.
 */
function conflictCount(entries) {
  return entries.filter((entry) => {
    const values = Object.values(entry.salience);
    return values.some((value) => value > 0) && values.some((value) => value < 0);
  }).length;
}

export function runBlindGate(entries, params) {
  const scoreable = [...entries.filter((entry) => entry.scoreable)].sort((a, b) => a.id.localeCompare(b.id));
  const train = scoreable.filter((_, index) => index % HOLDOUT_MODULO !== HOLDOUT_MODULO - 1);
  const heldout = scoreable.filter((_, index) => index % HOLDOUT_MODULO === HOLDOUT_MODULO - 1);

  const insufficient = train.length < 4 || heldout.length < 2;
  if (insufficient) {
    return {
      verdict: "insufficient-corpus",
      split: { train: train.map((entry) => entry.id), heldout: heldout.map((entry) => entry.id) },
      reason: `blind gate needs >=4 train and >=2 held-out scoreable entries (got ${train.length}/${heldout.length}); grow the corpus per its own law`,
      conflicts: { conflict_entry_count: conflictCount(scoreable) },
    };
  }

  const calibrated = calibrateWeights(train, params);
  const uncalibratedWeights = Object.fromEntries(Object.keys(calibrated.weights).map((dimension) => [dimension, 1]));
  const calibratedRows = heldout.map((entry) => scoreEntry(entry, calibrated.weights));
  const uncalibratedRows = heldout.map((entry) => scoreEntry(entry, uncalibratedWeights));
  const calibratedAccuracy = accuracy(calibratedRows);
  const uncalibratedAccuracy = accuracy(uncalibratedRows);
  const delta = Number((calibratedAccuracy - uncalibratedAccuracy).toFixed(4));
  const conflicts = conflictCount(scoreable);

  return {
    verdict: delta > 0 ? "pass" : "no-win",
    split: { train: train.map((entry) => entry.id), heldout: heldout.map((entry) => entry.id) },
    calibrated: { accuracy: calibratedAccuracy, correct: calibratedRows.filter((row) => row.correct).length, total: heldout.length },
    uncalibrated: { accuracy: uncalibratedAccuracy, correct: uncalibratedRows.filter((row) => row.correct).length, total: heldout.length },
    delta,
    conflicts: { conflict_entry_count: conflicts, note: conflicts === 0 ? "no held-out candidate mixes violated and satisfied dimensions — no weighting can beat the default on this corpus; grow the corpus with conflict-class verdicts" : undefined },
    per_case: heldout.map((entry, index) => ({ id: entry.id, calibrated: calibratedRows[index], uncalibrated: uncalibratedRows[index] })),
    weights: calibrated.weights,
  };
}
