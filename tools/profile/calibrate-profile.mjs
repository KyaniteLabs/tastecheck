/**
 * Calibration runner — a verdict set adjusts a profile's dimension weights.
 * Measured, not vibes: the fit is a closed-form, deterministic function of the
 * imported corpus, and every parameter is recorded in the receipt so the same
 * corpus always produces the same weights.
 *
 * Model (per taste dimension d), with violated-dimension dominance:
 *   V_d = Σ |salience(entry)[d]|   over DENIED entries where d was violated
 *   S_d = Σ  salience(entry)[d]    over UPHELD entries where d was satisfied
 *   side_scale = max(V_d, S_d) over all dimensions — ONE shared scale
 *   violated[d]  = clamp(exp(λ · V_d / side_scale), W_MIN, W_MAX)
 *   satisfied[d] = clamp(exp(λ · S_d / side_scale), W_MIN, W_MAX)
 *   weights[d]   = clamp(exp(λ · (V_d + S_d) / side_scale), W_MIN, W_MAX)
 *
 * Dominance law (the 2026-10-08 lever): a conflict verdict — one that mixes
 * violated and satisfied dimensions — is decided by the VIOLATED dimension's
 * power, not by the boldest dimension's prior. A single scalar per dimension
 * cannot express that: it conflates how hard a dimension denies surfaces with
 * how hard it saves them. The fit therefore carries TWO weights per dimension,
 * both normalized on the same shared scale so they compete directly in the
 * prediction sum. Opposite-side appearances (satisfied-in-denial,
 * violated-in-uphold) are dominance facts — the verdict shows they were
 * outweighed — and are never subtracted from the aligned side's evidence.
 *
 * B_d := V_d + S_d is the aligned vote balance (the fit's evidence). Silence
 * never invents a weight: a side with zero evidence stays at 1.0 (the
 * uncalibrated default). With every side weight at 1.0 the dominance scorer
 * reduces exactly to the plain unit-weight sum, so the structure adds no power
 * the corpus did not earn. Same corpus → same weights, always.
 */
import { TASTE_DIMENSIONS } from "./dimensions.mjs";

export const CALIBRATION_PARAMS = Object.freeze({
  lambda: 1,
  weight_min: 0.25,
  weight_max: 4,
});

const round4 = (value) => Number(value.toFixed(4));
const clampWeight = (value, params) => Math.min(params.weight_max, Math.max(params.weight_min, value));

/**
 * Fit profile weights from scoreable entries (entries whose salience touches
 * at least one taste dimension). Returns { weights, side_weights, evidence,
 * params, scoreable_count } where weights is the combined aligned-evidence
 * weight per dimension, side_weights = { violated, satisfied } are the
 * per-side dominance weights the scorer uses, and evidence[d] records the
 * balances and per-side confidence.
 */
export function calibrateWeights(entries, params = CALIBRATION_PARAMS) {
  const scoreable = entries.filter((entry) => entry.scoreable);
  if (!scoreable.length) {
    throw new Error("calibration needs at least one scoreable entry (salience on a taste dimension)");
  }
  const POLARITY_SIGN = { denied: -1, upheld: 1 };
  const sides = {
    violated: new Map(TASTE_DIMENSIONS.map((dimension) => [dimension, { balance: 0, count: 0 }])),
    satisfied: new Map(TASTE_DIMENSIONS.map((dimension) => [dimension, { balance: 0, count: 0 }])),
  };
  for (const entry of scoreable) {
    const side = entry.polarity === POLARITY_SIGN.denied ? "violated" : "satisfied";
    for (const [dimension, salience] of Object.entries(entry.salience)) {
      if ((side === "violated" && salience >= 0) || (side === "satisfied" && salience <= 0)) continue; // opposite-side appearance: a dominance fact, never balance evidence
      const cell = sides[side].get(dimension);
      if (!cell) continue; // process dimensions are imported but never personalized
      cell.balance += side === "violated" ? -salience : salience;
      cell.count += 1;
    }
  }
  const sideScale = Math.max(
    0,
    ...[...sides.violated.values(), ...sides.satisfied.values()].map((cell) => cell.balance),
  );
  const weights = {};
  const sideWeights = { violated: {}, satisfied: {} };
  const evidence = {};
  for (const dimension of TASTE_DIMENSIONS) {
    const violated = sides.violated.get(dimension);
    const satisfied = sides.satisfied.get(dimension);
    const alignedBalance = violated.balance + satisfied.balance;
    const scaled = sideScale === 0 ? 0 : params.lambda * (alignedBalance / sideScale);
    weights[dimension] = round4(clampWeight(Math.exp(scaled), params));
    for (const [side, cell] of [["violated", violated], ["satisfied", satisfied]]) {
      const sideScaled = sideScale === 0 ? 0 : params.lambda * (cell.balance / sideScale);
      sideWeights[side][dimension] = round4(clampWeight(Math.exp(sideScaled), params));
    }
    evidence[dimension] = {
      balance: round4(alignedBalance),
      count: violated.count + satisfied.count,
      confidence: round4((violated.count + satisfied.count) / scoreable.length),
      violation_balance: round4(violated.balance),
      violation_count: violated.count,
      satisfaction_balance: round4(satisfied.balance),
      satisfaction_count: satisfied.count,
    };
  }
  return {
    weights,
    side_weights: sideWeights,
    evidence,
    params,
    scoreable_count: scoreable.length,
  };
}
