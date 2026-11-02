# Operator-path QA

`operator-paths.yaml` is the reviewed, fixed operator-path catalog. Its stable IDs retain all 23 paths from the Product QA v0 catalog; C8 adds a fail-closed invalid profile-import check.

From a clean checkout, install the locked project dependencies and run:

```bash
npm ci
qa/run.sh
```

The runner requires Node 22+, Bash for the shell-installer cases, and Chromium/Chrome for browser/audit cases. It uses Playwright from the lockfile for the page paths and the selected installed browser for the ship gate; if no browser executable is on `PATH`, it also checks Playwright's installed Chromium. `TASTECHECK_CHROME` or `CHROME_PATH` can select the browser executable. Installer, CLI, and profile commands run with a per-path empty `HOME`/`USERPROFILE` and separate per-path XDG config/data/cache/state directories; no user profile is read or changed. UI checks use fresh browser contexts and a loopback-only static server.

Each catalog entry prints `PASS`, `FAIL`, or `BLOCKED`. Every path gets a transcript, including command output and assertions. The runner writes `summary.json` and `transcripts/<ID>.log` to a new temporary run directory and prints that directory. Use `qa/run.sh --out <new-directory>` to choose a destination; it must be empty or not yet exist. Any FAIL or BLOCKED makes the runner exit nonzero (1 for failure, 2 when only blocked paths remain).

`npm run test:qa-catalog` validates catalog syntax, required IDs, path metadata, and repository fixtures. It is also part of `npm run test:structural`; it does not run the browser operator paths. Those require `qa/run.sh`.
