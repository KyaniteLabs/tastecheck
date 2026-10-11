# Taste profile

Status: a small first version (v0) ships. It records decisions you make by
hand. It does not learn anything on its own.

## What v0 does

A taste profile is a JSON file you own. It lives on your machine at
`$TASTECHECK_PROFILE`, or `~/.tastecheck/profile.json` if that is not set. The
directory is created with mode 0700 and the file with 0600. Nothing reads the
network, nothing uploads it, and this repository and the npm package ship no
profile data.

You manage it with `tastecheck profile`:

- `show` prints the file path, the number of entries and each decision.
- `accept <tell> [--reason "..."] [--scope <origin-or-glob>]` says you keep this
  tell on purpose, for example a uniform card grid on a real product catalog.
- `reject <tell> [--reason "..."]` says you want this tell treated strictly.
- `forget <tell>` removes your decision for a tell.
- `export [file]` and `import <file>` move the profile between machines. Import
  checks the format and refuses files with unknown fields.
- `reset --yes` deletes the file.

Each entry has a tell, a decision (accept or reject), a reason, an optional
scope and a date. A scope is either an origin such as `https://example.com`, or
a glob such as `*example.com/shop/*`, matched against the URL being audited.
Without a scope the decision applies everywhere.

The tells are the ones the template check can report: `uniform-card-grid`,
`stat-counter-band`, `safe-display-face`, `pill-cta` and
`indigo-violet-gradient`.

## How the audit uses it

Only the `templateSlop` check reads the profile. It reads the file by default
if it exists. Use `--profile <file>` to point at another file and `--no-profile`
to ignore it.

- An accepted tell (whose scope matches the URL) no longer counts toward the
  `templateSlop` status. It still appears in the evidence, marked as accepted by
  your taste profile with your reason.
- A rejected tell makes `templateSlop` fail, which makes the verdict HOLD.
- If a tell is both accepted and rejected for the same URL, reject wins.
- `evidence.json` gets a `profile` block with the file path, the decisions that
  were applied, and `ignored_objective: true`.

With no profile file the audit behaves exactly as it did before.

## What never changes

The objective checks ignore the profile completely: keyboard, contrast, reflow
at 320px, 400% zoom, tap targets, resources, leaks, cold-load console, cold
load and reduced motion. A profile cannot turn a failing accessibility or leak
check into a pass.

## Not built yet

- Starting preference picks (a short set of choices to seed a profile).
- Learning from your verdict history automatically. Today every entry is one you
  typed.
- Weighting register and boldness, and fit to intent. v0 only covers the
  individual template tells.
- Any claim that a profile makes results more accurate. That has not been
  measured, so none is made.

## Why no taste data is in the repo

An earlier calibration set built from one person's verdicts was removed from the
public repository for privacy. Taste data is personal, so profiles stay local
by design and must not be committed.

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

