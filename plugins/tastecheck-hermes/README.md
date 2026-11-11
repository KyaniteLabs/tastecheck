# Tastecheck for Hermes (native plugin)

**Frontend ship gate** — before UI work is called done, audit the real rendered page in headless Chrome and get a fail-closed **SHIP / HOLD** verdict with evidence. Runs the Tastecheck CLI (`v1.7.0`) from files vendored inside this plugin and verified against `vendor/MANIFEST.json` before every run.

| Surface | What it does |
|---|---|
| `pre_tool_call` | **Hard completion gate.** Vetoes `kanban_complete` / `kanban_request_review` calls that *declare* frontend work until a fresh, signed SHIP covers it. See [Completion gate](#completion-gate). |
| `pre_llm_call` | Advisory only: when a message claims frontend/UI work is done, injects a ship-gate brief. Words never block anything. |
| `/tastecheck audit\|profile\|version\|status\|help` | Gateway-safe by default: `audit` refused on messaging surfaces unless `allow_audit_slash_on_gateway: true`; `status` shows file names, not absolute paths, there. |
| `tastecheck_audit` | SHIP/HOLD browser audit of an http(s) URL or an HTML page/dir inside the session workspace; evidence.json + screenshots under plugin-data. Records the verdict in the signed ledger. |
| `tastecheck_profile` / `tastecheck_version` | Read-only taste profile (`show`/`export`) / CLI version |
| Skill `tastecheck-hermes:tastecheck` | Claim → audit → verdict-first report workflow |
| Desktop half (`desktop/plugin.js`, id `tastecheck-hermes`) | **Taste Roll**: a composer button AND a command-palette entry (⌘K) that restyles YOUR own page — the ACTIVE file when the host exposes a supported active-file seam (no Hermes Desktop build does today, SDK-audited 2026-11-08; the missing seam is a recorded host prerequisite), else the newest-edited HTML of the session workspace honestly labeled as a fallback pick with an explicit tap-a-file handoff in the strip (never `tasteroll.html`, never a sibling project) — into accumulating comparison columns in a stable workspace pane (`tastecheck:tasteroll`, `host.openWorkspace` feature-detected before any side effect). Each column is sandboxed exactly like the built-in preview frame, carries its roll id, and is **gated live**: its exact srcdoc goes to `POST /api/plugins/tastecheck-hermes/roll-audit` and the column header is stamped **SHIP/HOLD** with reasons. Fail closed: no backend, busy gate or error = visible HOLD; a HOLD column stays. Column verdicts never satisfy the completion gate. A column whose page needs relative files (a relative image, a linked stylesheet) is refused with a HOLD naming them, because a srcdoc copy can't load them; inline them or audit the built page. Opt-in via Capabilities ▸ Plugins. |
| Dashboard API (`dashboard/plugin_api.py`) | `POST /roll-audit` (audit one rolled column; fail-closed HOLD) + `GET /health`. Mounted at `/api/plugins/tastecheck-hermes/`; loads the agent half **by path** so there is one audit implementation and one settings source. |

## Completion gate

A completion is gated only when it **declares** frontend work, in one of three ways:

1. **Structured artifacts** — string values in `args.target|targets|artifacts|paths` or `metadata.target|targets|artifacts|paths|changed_files|files` that are renderable (`.html`/`.htm`/`.xhtml`, a directory with `index.html`, an http(s) URL) or frontend sources (`.css .scss .sass .less .tsx .jsx .vue .svelte .astro`). Other files (`README.md`, `server.py`) are ignored.
2. **Explicit flag** — `metadata.tastecheck: true` (or `metadata.frontend: true`).
3. **Card marker** — the kanban card carries the `tastecheck-hermes:tastecheck`, `tastecheck` or `tastecheck-pass` skill, or a body line `tastecheck: required`. Read with a read-only (`mode=ro`) connection to the board the call names (`args.board`), card identity resolved like the completion tool: args id → hook id → `HERMES_KANBAN_TASK` (the env id only in a dispatcher-owned worker, never in a delegated child or a cron run beside one). A card that cannot be read blocks (fail closed).

Summaries, card titles and JSON keys are never scanned for vocabulary.

Release rules (fail closed):

- **Each declared page/URL** needs its own latest-wins fresh SHIP (a newer HOLD revokes it). Local pages: the page bytes AND every file the loopback server sent during that audit must be unchanged. URLs: the SHIP must be recorded in the same workspace and be younger than `gate_url_ship_ttl_seconds` (default 30 min), since a URL's content cannot be hashed.
- **Each declared source file** must exist inside the workspace and be covered by a valid SHIP: either it was served during that audit with the same bytes, or (compiled sources) it was last modified before the newest SHIP audit started.
- **Flag or marker only:** every page/loopback URL audited in this workspace is considered; any latest HOLD blocks, and at least one valid SHIP is required.
- Only signed entries written by `audit()` count. ERROR outcomes (tool failure, identity mismatch, page changed mid-audit) neither release nor revoke; a mistyped path records nothing. Taste Roll column verdicts never count. An unreadable ledger blocks. If a verdict cannot be written to the ledger, that target stays blocked until a later audit records.

**Ledger integrity, honestly:** entries are HMAC-SHA256 signed with a per-profile key (`plugin-data/tastecheck-hermes/ledger.key`, mode 0600). That defeats an agent hand-editing `verdict_ledger.json` with a file tool. It does not stop code running as your OS user that deliberately reads the key — nothing inside a same-user plugin can.

## Install

```bash
hermes plugins install KyaniteLabs/tastecheck --subdir plugins/tastecheck-hermes
hermes plugins enable tastecheck-hermes
```

The plugin has **one identity everywhere** — folder, `plugin.yaml` name, dashboard
manifest and desktop id are all `tastecheck-hermes`. That is load-bearing: the
gateway mounts (and consent-gates) backend routes under the dashboard manifest
name, so a plugin whose agent-half name differs from its dashboard/desktop id
would install "enabled" but 404 every `/api/plugins/<id>/` call. One name, one
`plugins.enabled` entry, both halves live.

Requires **Node ≥ 22** and a local **Chrome / Chromium** (set `CHROME_PATH` or `TASTECHECK_CHROME` to pick one explicitly; both pass the scrubbed child env). The desktop half loads from the same install (`<hermes home>/plugins/tastecheck-hermes/desktop/plugin.js`) and appears in Desktop ▸ Capabilities ▸ Plugins, off until you enable it.

## Disclosure

- **Code it runs:** `vendor/tastecheck/` holds the exact CLI files it needs (`bin/tastecheck.mjs`, `bin/profile.mjs`, `tools/lib/main-entry.mjs`, `package.json`, the CDP audit runner and its in-page probe — about 150 KB, plain JavaScript, no dependencies). Every file is checked against the sha256 in `vendor/MANIFEST.json` before each run; a missing or modified file refuses to run. Nothing is downloaded, no npm, no lifecycle scripts. `node tools/hermes/sync-plugin-vendor.mjs --check` (CI) keeps the copy identical to the repository source. Override with `tastecheck_command` (e.g. `tastecheck` after a global install).
- **Network:** `audit` opens the page in headless Chrome. A local page is served read-only from the session workspace over `http://127.0.0.1:<random port>` for the length of that one audit (hidden paths, traversal, symlinks out of the workspace, non-web file types and foreign Host headers are refused; data-shaped files — `.json .map .webmanifest .txt .xml` — are served only from the audited page's own directory tree); the browser never gets `file://` access. The page may make its own network requests. **Link checks are off by default:** the CLI would otherwise GET up to 25 same-origin `<a href>` targets to check for 404s; the plugin passes `--no-link-fetch` unless `fetch_links: true`, and the evidence records `linkFetch`. JavaScript dialogs (`alert`/`confirm`/`prompt`) are dismissed, never accepted. Tastecheck sends no telemetry. The desktop half makes no network calls of its own.
- **Filesystem:** nothing is written into your project. Audit evidence (last 20 runs), the signed verdict ledger and its key, and the taste profile (`TASTECHECK_PROFILE`) live under `<HERMES_HOME>/plugin-data/tastecheck-hermes/` (per profile). A profile from the pre-0.2.0 `plugin-data/tastecheck/` dir is copied over once; the old directory is left alone. Retention keeps the newest 20 audits **older than a grace window (2× the CLI timeout, min 10 min)**. Tool results over 20k chars are returned as bounded JSON (`truncated: true`) with the full result under `results/`. Ledger writes are file-locked; an unreadable ledger is moved aside to `verdict_ledger.json.corrupt-<ts>` with a warning, never silently replaced.
- **Desktop folder grant:** Taste Roll reads your project only through the SDK folder grant (`ctx.files`): no grant, no read. Surface resolution is workspace-scoped and seam-first: a supported active-file seam (feature-detected; none exists in current Hermes Desktop builds — recorded as an unmet host prerequisite) binds the first click to the file you are on, with CSS/non-frontend active files mapping to the nearest HTML in the same workspace (named); with no seam, the newest-edit pick is a FALLBACK, labeled as such in the strip ("no active-file API in this Desktop build") with an explicit tap-a-file handoff — mtime is never claimed to be your active surface. Files outside the session workspace are never read and `tasteroll.html` is never eligible. Column iframes are `sandbox="allow-forms allow-scripts"`, `allow="fullscreen"`, `referrerpolicy="no-referrer"` — opaque origin, exactly the built-in preview frame's posture. Roll history (seeds + file path only) persists in plugin storage.
- **Per-column gate traffic and retention:** each rolled column's srcdoc is POSTed to this plugin's own backend namespace (`/api/plugins/tastecheck-hermes/roll-audit`) and audited with the same vendored CLI + installed browser. The column IS persisted as `column.html` under `<HERMES_HOME>/plugin-data/tastecheck-hermes/roll-audits/<timestamp>/page/` (latest 40 kept) as evidence — plain local files inside your Hermes profile; the sandboxed iframe posture applies to RENDERING, not these files. Delete the `roll-audits` directory to drop them. `dashboard/plugin_api.py` is imported by the gateway's plugin-API loader only when this plugin is enabled.
- **Hermes imports:** public plugin API — `plugins.plugin_storage`, `agent.runtime_cwd.resolve_agent_cwd`, `gateway.session_context.get_session_env`, `hermes_cli.config.load_config_readonly`. One private import, disclosed and flagged by the validator: `hermes_cli.kanban_db` (`kanban_db_path` + `get_task`, read-only, only for the card-marker check; wrapped in try/except, so a Hermes change disables the marker rather than breaking the gate's other triggers).
- **Local paths:** relative audit targets resolve against the active Hermes session workspace (`resolve_agent_cwd`), not the service's launch dir. Local targets outside that workspace are refused — serve them yourself and audit the URL.
- **Chrome sandbox:** Chrome keeps its sandbox, except when the CLI runs as root or with `CI` set, where Chrome refuses to start sandboxed; there it runs with `--no-sandbox` and the evidence records `browser.sandbox: false`. Don't audit untrusted pages as root.
- **Processes:** the CLI checks for a stray Chrome with `ps` (POSIX) and kills its own tree with `taskkill` on Windows; it touches no other process.
- **Timeouts / browser:** `timeout_seconds` is the overall deadline for one call. The CLI runs in its own process group; on timeout or cancellation the whole tree (CLI → CDP runner → Chrome) is killed. A cold-start Chrome can miss the CLI's 20 s port probe — that one transient is retried once, inside the same deadline, only if at least 20 s remain.
- **Child environment:** exactly these variables are passed when set — `PATH HOME USER LANG LC_ALL TMPDIR TMP TEMP DISPLAY XDG_CACHE_HOME PLAYWRIGHT_BROWSERS_PATH LOCALAPPDATA PROGRAMFILES TASTECHECK_TIMEOUT_MS HTTP_PROXY HTTPS_PROXY NO_PROXY` (and lowercase proxy forms) `CHROME_PATH TASTECHECK_CHROME` — plus `NO_COLOR=1` and `TASTECHECK_PROFILE`. Nothing else, so no API keys or Hermes secrets; `NODE_OPTIONS` is deliberately excluded. `TMPDIR`/`TMP`/`TEMP` point at a fresh `tc-*` directory this plugin creates per run and deletes afterwards, so a killed Chrome never strands its profile.
- **Gateway:** `/tastecheck audit` is refused on messaging surfaces (the dispatcher's `platform`/`source` first, then the session's via `get_session_env`; default-deny for unknown surfaces) unless `allow_audit_slash_on_gateway: true`. Agent tools still work. Replies on messaging surfaces have absolute paths, your home and the workspace path scrubbed. Slash arguments take one target: quote a path with spaces; extra words are an error, never silently dropped.
- **Not exposed:** CLI `install` / `uninstall` / `calibrate`, and profile writes (`accept/reject/forget/import/reset`). To change the profile this plugin reads, point the Tastecheck CLI at the same file:

  ```bash
  TASTECHECK_PROFILE="$HERMES_HOME/plugin-data/tastecheck-hermes/profile.json" \
    npx tastecheck profile accept <tell> --reason "house style" --scope https://example.com
  ```

  `/tastecheck profile show` then shows the change; the next audit applies it.
- **No background jobs;** nothing runs unless a hook matches or you call a tool/slash/click.

## Settings (`plugins.entries.tastecheck-hermes.settings`)

```yaml
plugins:
  entries:
    tastecheck-hermes:
      settings:
        timeout_seconds: 300
```

| Key | Default | Notes |
|---|---|---|
| `tastecheck_command` | `""` | Empty = vendored, hash-verified CLI (recommended). Set e.g. `tastecheck` for a global install. |
| `inject_on_ship` | `true` | pre_llm_call ship-gate brief |
| `allow_audit_slash_on_gateway` | `false` | gateway safety |
| `timeout_seconds` | `240` | overall deadline per CLI call; also sets the retention grace (2×, min 600 s) |
| `gate_completions` | `true` | pre_tool_call completion veto (fail closed) |
| `gate_ship_ttl_seconds` | `21600` | how recent a SHIP of a local page must be |
| `gate_url_ship_ttl_seconds` | `1800` | how recent a SHIP of an http(s) URL must be |
| `fetch_links` | `false` | let the CLI GET up to 25 same-origin links to check for 404s |

## Verdict boundary (fail closed)

`SHIP` is returned **only** when the CLI exited 0 AND evidence for *this run's exact target* says SHIP AND (local pages) the page bytes did not change while the audit ran. No parseable evidence, a missing target identity, a foreign target, a tool/process error, or a timeout are all **HOLD** to the caller and recorded as ERROR in the ledger. Evidence-free SHIP is never returned.

## Tests

```bash
pip install pytest hypothesis fastapi pydantic                # test deps (the plugin itself needs none)
python3 -m pytest plugins/tastecheck-hermes/tests -q          # gate, ledger, server, vendor, verdicts
node tools/hermes/sync-plugin-vendor.mjs --check              # vendored CLI == repository source
node --import ./tests/register.mjs --test tests/harness.test.mjs   # from plugins/tastecheck-hermes/desktop
```

Python tests run against the Hermes v0.21.6 `gateway/session_context.py` and `agent/runtime_cwd.py`, vendored verbatim under `tests/hermes_runtime/`. `tests/test_gate_dispatch.py` needs an installed Hermes and skips without one; CI installs Hermes v0.21.6 pinned by commit and sets `TASTECHECK_REQUIRE_RUNTIME=1`, which turns that skip into a failure. The desktop harness runs the real `plugin.js` in node against clean-room SDK/react stubs — it proves the plugin's own logic (grant flow, HTML discovery, column accumulation, sandbox attributes, seeded determinism, history restored under a different folder grant), not a live Desktop integration.

## Demo (< 90 s)

See `demo/90-seconds.md` — gate-first, opens on your own project via Taste Roll, ends on the audit verdict. Icon master: `docs/hero/tastecheck-hermes-a1.png` in the repository (kept out of the plugin install).

License: MIT (same as Tastecheck).
