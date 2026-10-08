# Taste profiles (user-local — never shipped)

tastecheck learns EACH user's taste at runtime. A taste profile is the USER'S OWN data:
- lives on the user's machine (or their private store), loaded via the profile interface
- portable, exportable, deletable; never bundled with the package, never shared between users
- built by the user's own verdicts: cold-start preference picks + every subsequent reaction

The public product ships ZERO preloaded taste data. Objective defect checks
(accessibility floors, credential/privacy leaks) are universal and never personalize;
only the judgment layer (register, boldness, fit-to-intent) is profile-weighted.

## The calibration corpus flow (v1.7.x, 2026-09-28)

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
   closed form — w_d = exp(λ·B_d/B_max) clamped to [0.25, 4], where B_d is the
   polarity-weighted vote balance of dimension d. Zero-evidence dimensions
   stay at 1.0 with confidence 0. Same corpus → same weights, always.
3. **Blind gate** (`tools/profile/blind-gate.mjs`): every 4th scoreable entry
   (sorted by id) is held out. If conflicts exist but none falls in that slice,
   the first id-sorted conflict is swapped into held-out for a deterministic,
   conflict-aware split of the same size. Weights fit on the train split only; calibrated
   and uncalibrated (all-1.0) profiles predict each held-out verdict's polarity
   from its salience pattern. The gate passes ONLY when calibrated accuracy
   strictly beats uncalibrated. A corpus with zero conflict-class entries
   (mixed violated+satisfied dimensions) cannot distinguish any weighting from
   the default, and the gate says so in data (`conflicts.conflict_entry_count`).

Run: `node tools/profile/run-profile-calibration.mjs --corpus <user-local.json>
[--receipt <path>] [--profile-out <path>]`. The runner refuses to read a
corpus from, or write any output into, the product repo — the refusals fire
before any read. Objective defects stay universal; only the judgment layer
personalizes. The suite (`tools/profile/test-*.mjs`) pins all of this with
synthetic fixtures and ships empty of anyone's taste.
