# Tastecheck for Hermes (native plugin)

**Frontend ship gate** — before UI work is called done, audit the real rendered page in headless Chrome and get a fail-closed **SHIP / HOLD** verdict with evidence. Wraps the Tastecheck CLI (`v1.7.0`, pinned to commit `5168f89bdd2759b99b81545896c47638727cda14`).

| Surface | What it does |
|---|---|
| `pre_llm_call` | When a message claims frontend/UI work is done or ready to ship, injects a ship-gate brief |
| `post_tool_call` | Appends `tastecheck_audit` verdicts (target, verdict, hold reasons — **no page content**) to a ledger |
| `/tastecheck audit\|profile\|version\|status\|help` | Gateway-safe by default: `audit` refused on gateway unless `allow_audit_slash_on_gateway: true` |
| `tastecheck_audit` | SHIP/HOLD browser audit of a URL or local HTML; evidence.json + screenshots under plugin-data |
| `tastecheck_profile` | Read-only view of the local taste profile (`show` / `export`) |
| `tastecheck_version` | CLI version |
| Skill `tastecheck:tastecheck` | Claim → audit → verdict-first report workflow |

## Install

```bash
hermes plugins install KyaniteLabs/tastecheck --subdir plugins/tastecheck-hermes
hermes plugins enable tastecheck
```

Requires **Node ≥ 22**, `npx` on PATH, and a local **Chrome / Chromium** (or a Playwright browser via `PLAYWRIGHT_BROWSERS_PATH`).

## Disclosure

- **Downloads code:** first use runs `npx -y github:KyaniteLabs/tastecheck#5168f89bdd2759b99b81545896c47638727cda14` (fetches that exact commit from GitHub). Override with `tastecheck_command` (e.g. `tastecheck` after a global install). Will switch to the npm package once it is published.
- **Network:** `audit` opens the URL or local file you name in headless Chrome; that page may make its own network requests. Tastecheck itself sends no telemetry.
- **Filesystem:** nothing is written into your project. Audit evidence (last 20 runs), the verdict ledger and the taste profile (`TASTECHECK_PROFILE`) live under `<HERMES_HOME>/plugin-data/tastecheck/` (per profile).
- **Secrets:** child env is scrubbed (PATH/HOME/locale/display/proxy/npm cache/Playwright path only). No API keys are required or copied from Hermes secret scope.
- **Gateway:** `/tastecheck audit` is refused on gateway platforms unless `allow_audit_slash_on_gateway: true`. Agent tools still work.
- **Not in v0.1.0:** `install` / `uninstall` (write skill links into agent homes), `calibrate`, and profile writes (`accept/reject/forget/import/reset`) — use the Tastecheck CLI directly.
- **No background jobs;** nothing runs unless a hook matches or you call a tool/slash.

## Settings (`plugins.entries.tastecheck.settings`)

| Key | Default | Notes |
|---|---|---|
| `tastecheck_command` | `npx -y github:KyaniteLabs/tastecheck#5168f89…` | CLI prefix |
| `inject_on_ship` | `true` | pre_llm_call ship-gate brief |
| `allow_audit_slash_on_gateway` | `false` | gateway safety |
| `timeout_seconds` | `240` | per CLI call |

## Known issues

- First call is slow (GitHub fetch via npx); offline machines need a pre-installed `tastecheck` on PATH.
- Node < 22 or no Chrome → audit exits 2 (tool error); report it as HOLD (not run).
- No Desktop pane, 2:1 banner, or screenshots yet.

## Demo (< 90s)

```text
/tastecheck version
/tastecheck audit http://localhost:5173
/tastecheck status
```

Or ask the agent: "The landing page is done — ready to ship?"

License: MIT (same as Tastecheck).
