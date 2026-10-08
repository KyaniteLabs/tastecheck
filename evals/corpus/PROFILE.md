# Taste profiles (user-local — never shipped)

tastecheck learns EACH user's taste at runtime. A taste profile is the USER'S OWN data:
- lives on the user's machine (or their private store), loaded via the profile interface
- portable, exportable, deletable; never bundled with the package, never shared between users
- built by the user's own verdicts: cold-start preference picks + every subsequent reaction

The public product ships ZERO preloaded taste data. Objective defect checks
(accessibility floors, credential/privacy leaks) are universal and never personalize;
only the judgment layer (register, boldness, fit-to-intent) is profile-weighted.

## The calibration corpus flow (v1.7.x, 2026-09-28; dominance fit 2026-10-08)

A profile's register weights are EARNED from the user's own verdicts, and the
earning is measured — never vibes:

1. **Import** (`tools/profile/calibration-corpus.mjs`): a user-local verdict
   journal (the loved-corpus shape — verbatim quote, context, principle, desk
   of record) imports into the calibration format. Each entry gets a polarity
   from its verdict kind and a salience map (dimension → signed weight in
   [-1, 1]): how hard each taste dimension drove the verdict. Salience is
   EXPLICIT when the corpus annotates it, otherwise DERIVED by a deterministic
   lexicon over the entry's own words (extraction is our job, never asking the
   user to explain). Every entry records which path produced its salience.
   Entries marked `status: "SuperSeded"` (a later ruling overrode the earlier
   verdict — prune law) are kept for provenance but excluded from fitting and
   splits; the exclusion is counted, never silent.
2. **Calibrate** (`tools/profile/calibrate-profile.mjs`): weights fit in
   closed form with violated-dimension dominance. Each dimension carries TWO
   side weights — `violated[d] = exp(λ·V_d/M)` and `satisfied[d] =
   exp(λ·S_d/M)` — where V_d sums how hard d was violated in denied verdicts,
   S_d how hard it was satisfied in upheld ones, and M is ONE shared scale
   (the max balance over both sides) so the sides compete directly. A conflict
   verdict — one that mixes violated and satisfied dimensions — is decided by
   the violated dimension's weight, not the boldest dimension's prior;
   opposite-side appearances are dominance facts, never balance penalties.
   `weights[d]` (from V_d+S_d) remains the combined aligned-evidence ordering.
   Zero-evidence sides stay at 1.0; when every side weight is 1 the dominance
   scorer reduces exactly to the plain unit-weight sum — the structure adds no
   power the corpus did not earn. Same corpus → same weights, always.
3. **Blind gate** (`tools/profile/blind-gate.mjs`): every 4th scoreable entry
   (sorted by id) is held out. If conflicts exist but none falls in that slice,
   the first id-sorted conflict is swapped into held-out for a deterministic,
   conflict-aware split of the same size. Weights fit on the train split only;
   the uncalibrated profile (the shipped default) predicts each held-out
   verdict's polarity from its salience pattern with the plain unit-weight
   sum, the calibrated profile with the fit's dominance side weights. The
   gate passes ONLY when calibrated accuracy strictly beats uncalibrated. A
   corpus with zero conflict-class entries (mixed violated+satisfied
   dimensions) cannot distinguish any weighting from the default, and the
   gate says so in data (`conflicts.conflict_entry_count`).

Run: `node tools/profile/run-profile-calibration.mjs --corpus <user-local.json>
[--receipt <path>] [--profile-out <path>]`. The runner refuses to read a
corpus from, or write any output into, the product repo — the refusals fire
before any read. Objective defects stay universal; only the judgment layer
personalizes. The suite (`tools/profile/test-*.mjs`) pins all of this with
synthetic fixtures and ships empty of anyone's taste.
