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
