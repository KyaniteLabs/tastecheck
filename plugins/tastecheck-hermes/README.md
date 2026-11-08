# Tastecheck for Hermes (native plugin)

**Frontend ship gate** — before UI work is called done, audit the real rendered page in headless Chrome and get a fail-closed **SHIP / HOLD** verdict with evidence. Wraps the Tastecheck CLI (`v1.7.0`, vendored from commit `5168f89bdd2759b99b81545896c47638727cda14`).

| Surface | What it does |
|---|---|
| `pre_tool_call` | **Hard completion gate**: vetoes `kanban_complete` / `kanban_request_review` calls that claim frontend/UI work — by payload vocabulary, by frontend artifact paths the payload names, or by the task's own body (read-only kanban lookup) — unless the ledger's LATEST verdict **bound to this completion's artifact/workspace** is a fresh SHIP. Latest-wins (a newer HOLD revokes an older SHIP), changed-artifact revocation via sha256, workspace-scoped fallback. Fail closed. |
| `pre_llm_call` | When a message claims frontend/UI work is done, injects a ship-gate brief |
| `post_tool_call` | Appends `tastecheck_audit` verdicts (target, verdict, hold reasons — **no page content**) to a ledger |
| `/tastecheck audit\|profile\|version\|status\|help` | Gateway-safe by default: `audit` refused on gateway unless `allow_audit_slash_on_gateway: true` |
| `tastecheck_audit` | SHIP/HOLD browser audit of a URL or local HTML; evidence.json + screenshots under plugin-data |
| `tastecheck_profile` / `tastecheck_version` | Read-only taste profile (`show`/`export`) / CLI version |
| Skill `tastecheck:tastecheck` | Claim → audit → verdict-first report workflow |
| Desktop half (`desktop/plugin.js`, id `tastecheck-hermes`) | **Taste Roll**: a composer button AND a command-palette entry (⌘K) that restyles YOUR own page — the newest-edited HTML of the session workspace (a newest CSS edit maps to its nearest HTML, named; never `tasteroll.html`, never a sibling project) — into accumulating comparison columns in a stable workspace pane (`tastecheck:tasteroll`, `host.openWorkspace` feature-detected before any side effect). Each column is sandboxed exactly like the built-in preview frame, carries its roll id, and is **gated live**: its exact srcdoc goes to `POST /api/plugins/tastecheck-hermes/roll-audit` (`dashboard/plugin_api.py` — the same vendored CLI on your installed browser) and the column header is stamped **SHIP/HOLD** with reasons. Fail closed: no backend, busy gate or error = visible HOLD; a HOLD column stays. Opt-in via Capabilities ▸ Plugins. |
| Dashboard API (`dashboard/plugin_api.py`) | `POST /roll-audit` (audit one rolled column; fail-closed HOLD) + `GET /health`. Mounted at `/api/plugins/tastecheck-hermes/` by the plugin-API loader; loads the agent half **by path** so there is one audit implementation, and writes verdicts into the same ledger (`source: roll-audit`) the completion gate matches on. |

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

- **Downloads code (audit surface):** first CLI use fetches the commit-addressed source tarball `https://codeload.github.com/KyaniteLabs/tastecheck/tar.gz/5168f89bdd2759b99b81545896c47638727cda14` (source only — no binaries, no npm, no install lifecycle scripts; extraction is sanitized and refuses symlinks/traversal; a `vendor-stamp.json` records url/sha256/bytes). The old `npx -y github:…` default is broken on npm 10.9.9 and ran package lifecycle scripts — it is gone. Override with `tastecheck_command` (e.g. `tastecheck` after a global install).
- **Network:** `audit` opens the URL or local file you name in headless Chrome (that page may make its own network requests). Tastecheck itself sends no telemetry. The desktop half makes no network calls.
- **Filesystem:** nothing is written into your project. Audit evidence (last 20 runs), the verdict ledger, the vendored CLI and the taste profile (`TASTECHECK_PROFILE`) live under `<HERMES_HOME>/plugin-data/tastecheck/` (per profile). Each audit gets its own exclusive evidence dir; retention keeps the newest 20 **older than a grace window (2× the CLI timeout, min 10 min)** so in-flight audits and just-returned results can never be deleted by a concurrent prune. Tool results over 20k chars are returned as bounded JSON (`truncated: true`) with the full result saved under `results/`. Ledger appends are file-locked.
- **Desktop folder grant:** Taste Roll reads your project only through the SDK folder grant (`ctx.files`): no grant, no read. Surface resolution is workspace-scoped: the newest-edited HTML in the session cwd wins; a newest CSS edit maps to the nearest HTML in the same workspace (both named in the pane header); files outside the session workspace are never read and `tasteroll.html` is never eligible. Column iframes are `sandbox="allow-forms allow-scripts"`, `allow="fullscreen"`, `referrerpolicy="no-referrer"` — opaque origin, exactly the built-in preview frame's posture. Roll history (seeds + file path only) persists in plugin storage.
- **Per-column gate traffic:** each rolled column's srcdoc is POSTed to this plugin's own backend namespace (`/api/plugins/tastecheck-hermes/roll-audit`) and audited with the same vendored CLI + installed browser; the response is a verdict only (no page content stored). `dashboard/plugin_api.py` is imported by the gateway's plugin-API loader only when this plugin is enabled (user-plugin trust gate).
- **Known validator warning (disclosed):** two private imports — `gateway.session_context.session_is_messaging_surface` (platform detection) and `hermes_cli.kanban_db` (read-only `get_task` for the completion gate's task-body claim) — catalog rule 9 flags them; both are read-only, wrapped in try/except, and can break on Hermes releases.
- **Local paths:** relative audit targets resolve against the active Hermes session workspace (`resolve_agent_cwd`), not the service's launch dir.
- **Timeouts / browser:** the CLI runs in its own process group; on timeout or cancellation the whole tree (CLI → CDP runner → Chrome) is killed. Chrome's singleton socket path is capped at ~104 chars, so the child gets `/tmp` as TMPDIR when the ambient TMPDIR is long; a cold-start Chrome can miss the CLI's 20 s port probe — that one transient is retried once.
- **Secrets:** child env is scrubbed (PATH/HOME/locale/display/proxy/browser-path vars only). No API keys are required or copied from Hermes secret scope.
- **Gateway:** `/tastecheck audit` is refused on messaging surfaces (Hermes `session_is_messaging_surface()`, task-local) unless `allow_audit_slash_on_gateway: true`. Agent tools still work.
- **Not in v0.1.0:** CLI `install` / `uninstall` / `calibrate`, and profile writes (`accept/reject/forget/import/reset`) — use the Tastecheck CLI directly.
- **No background jobs;** nothing runs unless a hook matches or you call a tool/slash/click.

## Settings (`plugins.entries.tastecheck.settings`)

| Key | Default | Notes |
|---|---|---|
| `tastecheck_command` | `""` | Empty = vendored pinned source (recommended). Set e.g. `tastecheck` for a global install. |
| `inject_on_ship` | `true` | pre_llm_call ship-gate brief |
| `allow_audit_slash_on_gateway` | `false` | gateway safety |
| `timeout_seconds` | `240` | per CLI call; also sets the retention grace (2×, min 600 s) |
| `gate_completions` | `true` | pre_tool_call completion veto (fail closed) |
| `gate_ship_ttl_seconds` | `21600` | how recent a ledger SHIP satisfies the gate |

## Verdict boundary (fail closed)

`SHIP` is returned **only** when the CLI exited 0 AND evidence for *this run's exact target* says SHIP. No parseable evidence, a missing target identity, a foreign target, a tool/process error, or a timeout are all **HOLD**. Evidence-free SHIP is never returned.

## Tests

```bash
python3 -m pytest plugins/tastecheck-hermes/tests -q          # gate, retention, vendor, verdicts
node --import ./tests/register.mjs --test tests/harness.test.mjs   # from plugins/tastecheck-hermes/desktop
```

Python tests run against the Hermes v0.21.6 `gateway/session_context.py` and `agent/runtime_cwd.py`, vendored verbatim under `tests/hermes_runtime/`. The desktop harness runs the real `plugin.js` in node against clean-room SDK/react stubs — it proves the plugin's own logic (grant flow, HTML discovery, column accumulation, sandbox attributes, seeded determinism), not a live Desktop integration.

## Demo (< 90 s)

See `demo/90-seconds.md` — gate-first, opens on your own project via Taste Roll, ends on the audit verdict. Icon: `assets/tastecheck-r21.png` (approved master).

License: MIT (same as Tastecheck).
