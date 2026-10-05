# Taste profiles (planned design, not implemented)

Status: roadmap. No taste-profile code exists in this repository today, and
TasteCheck does not learn anything about you at runtime. This file records the
intended design so that contributors do not build something that conflicts
with it.

## The plan

A taste profile would be the user's own data:

- stored on the user's machine (or their private store), never in this repo
- portable, exportable and deletable
- never bundled with the package and never shared between users
- built from the user's own verdicts: a few starting preference picks, then
  their reactions to results

The public package would ship no preloaded taste data. Objective checks
(accessibility floors, credential and privacy leaks) would stay universal and
never personalize. Only the judgment layer (register, boldness, fit to intent)
would be weighted by a profile.

## Why it is not in the repo

An earlier calibration set built from one person's verdicts was removed from
the public repository for privacy. Taste data is personal, so any future
profile feature will keep it local by design.
