# ROLE: SOL — INDEPENDENT REVIEWER, STREAK ROUND 1 (tastecheck, fresh streak after reset)
Ladder note: fresh streak = top rung (you). Two prior floor passes (champion) returned no on three reasons — resolve them WITH FILESYSTEM ACCESS (they couldn't):
1. "Byte-exact checksums sound only if verified against the vendor payload" — VERIFY IT: _retrofit-2026-09-04/W1-DESLOP-UI-CHECKSUMS.json vs the vendor payload source; recompute sha256s yourself.
2. "Inventory 20/20/8 not user-reproducible" — CHECK: can a user run the repo's own generator scripts and reproduce the release-facts? Run them.
3. Register phrasing: the audit register documents historical findings; verify every row's fix exists in the branch (git log/diff main..retrofit/2026-09-04).
Then your own full false-green hunt (chain: verify, public-status, lint, contracts).
VERDICT: end EXACTLY 'FULLY-GREEN: yes' or 'FULLY-GREEN: no' + findings. Read-only repo access; write only STREAK-sol.md in _retrofit-2026-09-04/. No installs/network.
