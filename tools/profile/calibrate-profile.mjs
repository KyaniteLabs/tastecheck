/**
 * Calibration runner — a verdict set adjusts a profile's dimension weights.
 * Measured, not vibes: the fit is a closed-form, deterministic function of the
 * imported corpus, and every parameter is recorded in the receipt so the same
 * corpus always produces the same weights.
 *
 * Model (per taste dimension d):
 *   B_d = Σ polarity(entry) × salience(entry)[d]   over scoreable entries
 *   w_d = clamp(exp(λ · B_d / B_max), W_MIN, W_MAX) with B_max = max|B_d|
 *
 * B_d is the running vote balance: dimensions that repeatedly sided with
 * upheld verdicts push their weight up, dimensions that sided with denied
 * verdicts push it down. Zero-evidence dimensions stay at weight 1 (the
 * uncalibrated default) with confidence 0 — silence never invents a weight.
 */
import { TASTE_DIMENSIONS } from "./dimensions.mjs";

export const CALIBRATION_PARAMS = Object.freeze({
  lambda: 1,
  weight_min: 0.25,
  weight_max: 4,
});

const round4 = (value) => Number(value.toFixed(4));

/**
 * Fit profile weights from scoreable entries (entries whose salience touches
 * at least one taste dimension). Returns { weights, evidence, params } where
 * evidence[d] = { balance, count, confidence } and confidence is the share of
 * scoreable entries that speak about d.
 */
export function calibrateWeights(entries, params = CALIBRATION_PARAMS) {
  const scoreable = entries.filter((entry) => entry.scoreable);
  if (!scoreable.length) {
    throw new Error("calibration needs at least one scoreable entry (salience on a taste dimension)");
  }
  const balances = new Map(TASTE_DIMENSIONS.map((dimension) => [dimension, { balance: 0, count: 0 }]));
  for (const entry of scoreable) {
    for (const [dimension, salience] of Object.entries(entry.salience)) {
      const cell = balances.get(dimension);
      if (!cell) continue; // process dimensions are imported but never personalized
      cell.balance += entry.polarity * salience;
      cell.count += 1;
    }
  }
  const maxAbsBalance = Math.max(...[...balances.values()].map((cell) => Math.abs(cell.balance)), 0);
  const weights = {};
  const evidence = {};
  for (const dimension of TASTE_DIMENSIONS) {
    const { balance, count } = balances.get(dimension);
    const scaled = maxAbsBalance === 0 ? 0 : params.lambda * (balance / maxAbsBalance);
    weights[dimension] = round4(Math.min(params.weight_max, Math.max(params.weight_min, Math.exp(scaled))));
    evidence[dimension] = {
      balance: round4(balance),
      count,
      confidence: round4(count / scoreable.length),
    };
  }
  return {
    weights,
    evidence,
    params,
    scoreable_count: scoreable.length,
  };
}
