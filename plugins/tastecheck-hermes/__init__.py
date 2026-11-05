"""Tastecheck — native Hermes plugin (frontend ship gate).

Surfaces:
  pre_llm_call   -> when a message claims UI/frontend work is done, inject a ship-gate brief
  post_tool_call -> record tastecheck_audit verdicts in a profile-local ledger
  /tastecheck    -> audit | profile [show|export] | version | status | help
  tools          -> tastecheck_audit / tastecheck_profile / tastecheck_version
  skill          -> skills/tastecheck/SKILL.md

Child processes get a scrubbed env; audit evidence, the verdict ledger and the taste
profile live under <HERMES_HOME>/plugin-data/tastecheck/. Only public ctx.* APIs.
install / uninstall / calibrate and profile writes are intentionally NOT exposed.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shlex
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

PLUGIN_NAME = "tastecheck"
PINNED_SRC = "github:KyaniteLabs/tastecheck#5168f89bdd2759b99b81545896c47638727cda14"
DEFAULTS: Dict[str, Any] = {
    "tastecheck_command": f"npx -y {PINNED_SRC}",
    "inject_on_ship": True,
    "allow_audit_slash_on_gateway": False,
    "timeout_seconds": 240,
}
LEDGER_MAX = 200
AUDITS_KEEP = 20

_UI_RE = re.compile(
    r"\b(?:ui|frontend|front-end|landing ?page|website|web ?page|page|site|design|css|layout|"
    r"component|dashboard|screen)\b",
    re.IGNORECASE,
)
_SHIP_RE = re.compile(
    r"\b(?:done|finished|complete(?:d)?|ship(?:ped|ping)?|launch(?:ed|ing)?|ready to "
    r"(?:ship|launch|merge|deploy|go)|looks good|lgtm|polish(?:ed)?|deslop|taste ?check)\b",
    re.IGNORECASE,
)

_ctx = None


def _cfg(key: str) -> Any:
    try:
        val = _ctx.get_config(key, None) if _ctx is not None else None
    except Exception:
        val = None
    return DEFAULTS[key] if val is None else val


def _data_dir() -> Path:
    try:
        from plugins.plugin_storage import plugin_data_dir

        return plugin_data_dir(PLUGIN_NAME)
    except Exception:
        home = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
        p = Path(home) / "plugin-data" / PLUGIN_NAME
        p.mkdir(parents=True, exist_ok=True)
        return p


def _ledger_path() -> Path:
    return _data_dir() / "verdict_ledger.json"


def _load_json(path: Path, default: Any) -> Any:
    try:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.debug("tastecheck: failed reading %s", path, exc_info=True)
    return default


def _save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def _on_gateway() -> bool:
    plat = (os.environ.get("HERMES_PLATFORM") or os.environ.get("HERMES_SESSION_PLATFORM") or "").lower()
    return bool(plat) and plat not in {"cli", "tui", "desktop", "local", "acp"}


# --- child process ----------------------------------------------------------

_ENV_ALLOW = (
    "PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP", "DISPLAY",
    "NODE_OPTIONS", "npm_config_cache", "NPM_CONFIG_CACHE", "XDG_CACHE_HOME",
    "PLAYWRIGHT_BROWSERS_PATH", "LOCALAPPDATA", "PROGRAMFILES", "TASTECHECK_TIMEOUT_MS",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
)


def _scrubbed_env() -> Dict[str, str]:
    """Minimal env for the Tastecheck child — never hand it full os.environ."""
    env = {k: os.environ[k] for k in _ENV_ALLOW if os.environ.get(k)}
    env["NO_COLOR"] = "1"
    # Keep the taste profile per Hermes profile instead of ~/.tastecheck.
    env["TASTECHECK_PROFILE"] = str(_data_dir() / "profile.json")
    return env


def run_tastecheck(args: List[str]) -> Dict[str, Any]:
    cmd = shlex.split(str(_cfg("tastecheck_command"))) + args
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=int(_cfg("timeout_seconds")),
            env=_scrubbed_env(), cwd=str(_data_dir()),
        )
    except FileNotFoundError as exc:
        return {"ok": False, "error": f"tastecheck not runnable (need Node >=22 + npx): {exc}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "tastecheck timed out"}
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    res: Dict[str, Any] = {"ok": proc.returncode in (0, 1), "exit": proc.returncode}
    data: Any = None
    i = out.find("{")
    if i >= 0:
        try:
            data, _ = json.JSONDecoder().raw_decode(out[i:])
        except json.JSONDecodeError:
            data = None
    if data is not None:
        res["data"] = data
    else:
        res["text"] = out[:8000]
    if err:
        res["stderr"] = err[-600:]
    if proc.returncode not in (0, 1) and not out:
        res["error"] = err[-800:] or f"exit {proc.returncode}"
    return res


# --- operations -------------------------------------------------------------

def _resolve_target(target: str) -> str:
    t = str(target or "").strip()
    if not t:
        raise ValueError("target is required (http(s) URL or local file/dir)")
    if re.match(r"^https?://", t, re.IGNORECASE):
        return t
    if re.match(r"^[a-z][a-z0-9+.-]*:", t, re.IGNORECASE) and not re.match(r"^[a-zA-Z]:[\\/]", t):
        raise ValueError("only http(s) URLs or local paths are allowed")
    p = Path(t).expanduser()
    p = (Path.cwd() / p).resolve() if not p.is_absolute() else p.resolve()
    if not p.exists():
        raise ValueError(f"path does not exist: {p}")
    return str(p)


def _prune_audits(root: Path) -> None:
    try:
        dirs = sorted([d for d in root.iterdir() if d.is_dir()], key=lambda d: d.name)
        import shutil

        for d in dirs[:-AUDITS_KEEP]:
            shutil.rmtree(d, ignore_errors=True)
    except Exception:
        logger.debug("tastecheck: prune failed", exc_info=True)


def audit(target: str) -> Dict[str, Any]:
    tgt = _resolve_target(target)
    root = _data_dir() / "audits"
    out_dir = root / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    res = run_tastecheck(["audit", tgt, str(out_dir), "--json"])
    res["evidence_dir"] = str(out_dir)
    if "data" not in res:
        ev = _load_json(out_dir / "evidence.json", None)
        if ev is not None:
            res["data"] = ev
    if isinstance(res.get("data"), dict):
        res["verdict"] = res["data"].get("verdict")
    elif res.get("exit") in (0, 1):
        res["verdict"] = "SHIP" if res["exit"] == 0 else "HOLD"
    _prune_audits(root)
    return res


def profile(action: str = "show") -> Dict[str, Any]:
    action = (action or "show").lower()
    if action not in {"show", "export"}:
        return {"ok": False, "error": "only show/export are exposed; edit your taste profile with the tastecheck CLI"}
    return run_tastecheck(["profile", action])


def version() -> Dict[str, Any]:
    return run_tastecheck(["--version"])


# --- hooks ------------------------------------------------------------------

_BRIEF = (
    "[Tastecheck ship gate] This message claims frontend/UI work is done or ready to ship. "
    "Verdict first, fail closed: run `tastecheck_audit` on the real rendered artifact "
    "(dev-server URL or built HTML) before agreeing. Lead with SHIP or HOLD, list each "
    "hold reason with its evidence (selector, measurement, console line), and treat any "
    "required probe that could not run as HOLD. Checkmarks are not execution evidence."
)


def _on_pre_llm(user_message: str = "", **_: Any) -> Optional[Dict[str, str]]:
    try:
        if (_cfg("inject_on_ship") and user_message
                and _SHIP_RE.search(user_message) and _UI_RE.search(user_message)):
            return {"context": _BRIEF}
    except Exception:
        logger.debug("tastecheck: pre_llm_call failed", exc_info=True)
    return None


def _on_post_tool(tool_name: str = "", args: Optional[Dict[str, Any]] = None, result: Any = None,
                  **_: Any) -> None:
    """Verdict ledger: target + verdict + hold reasons only (no page content)."""
    try:
        if tool_name != "tastecheck_audit":
            return None
        payload = result
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        if not isinstance(payload, dict):
            return None
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        entry = {
            "ts": int(time.time()),
            "target": str((args or {}).get("target", ""))[:300],
            "verdict": payload.get("verdict"),
            "hold_reasons": [str(r)[:200] for r in (data.get("holdReasons") or [])][:10],
            "evidence_dir": payload.get("evidence_dir"),
        }
        ledger = _load_json(_ledger_path(), [])
        ledger.append(entry)
        _save_json(_ledger_path(), ledger[-LEDGER_MAX:])
    except Exception:
        logger.debug("tastecheck: post_tool_call failed", exc_info=True)
    return None


# --- tools ------------------------------------------------------------------

AUDIT_SCHEMA = {
    "name": "tastecheck_audit",
    "description": (
        "Run the Tastecheck browser ship gate against a rendered page (http(s) URL or local "
        "HTML file/dir). Returns SHIP/HOLD, hold reasons and probe evidence; evidence.json and "
        "screenshots are saved under plugin-data. Needs Node >=22 and Chrome/Chromium."
    ),
    "parameters": {
        "type": "object",
        "properties": {"target": {"type": "string", "description": "URL or local path to audit"}},
        "required": ["target"],
    },
}
PROFILE_SCHEMA = {
    "name": "tastecheck_profile",
    "description": "Read the local Tastecheck taste profile (show or export). Read-only.",
    "parameters": {
        "type": "object",
        "properties": {"action": {"type": "string", "enum": ["show", "export"], "default": "show"}},
    },
}
VERSION_SCHEMA = {
    "name": "tastecheck_version",
    "description": "Report the Tastecheck CLI version this plugin runs.",
    "parameters": {"type": "object", "properties": {}},
}


def _wrap(fn):
    def handler(args: Optional[Dict[str, Any]] = None, **_: Any) -> str:
        try:
            return json.dumps(fn(args or {}), ensure_ascii=False)[:20000]
        except ValueError as exc:
            return json.dumps({"ok": False, "error": str(exc)})
        except Exception as exc:
            logger.debug("tastecheck tool failed", exc_info=True)
            return json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
    return handler


_tool_audit = _wrap(lambda a: audit(a.get("target", "")))
_tool_profile = _wrap(lambda a: profile(a.get("action", "show")))
_tool_version = _wrap(lambda a: version())


# --- slash ------------------------------------------------------------------

_SAFE_SLASH = {"audit", "profile", "version", "status", "help"}
_HELP = (
    "/tastecheck — frontend ship gate\n"
    "  /tastecheck audit <url-or-path>     SHIP/HOLD browser audit (evidence under plugin-data)\n"
    "  /tastecheck profile [show|export]   Read your local taste profile\n"
    "  /tastecheck version                 CLI version\n"
    "  /tastecheck status                  Recent verdict-ledger entries\n"
    "Not exposed: install, uninstall, calibrate, profile accept/reject/forget/import/reset.\n"
    "On gateway platforms, audit is refused unless allow_audit_slash_on_gateway: true."
)


def _fmt(res: Dict[str, Any]) -> str:
    if res.get("error") and "data" not in res:
        return f"Tastecheck failed: {res['error']}"
    if res.get("verdict"):
        data = res.get("data") if isinstance(res.get("data"), dict) else {}
        reasons = data.get("holdReasons") or []
        lines = [str(res["verdict"])] + [f"- {r}" for r in reasons[:10]]
        lines.append(f"evidence: {res.get('evidence_dir')}")
        return "\n".join(lines)
    if "data" in res:
        return json.dumps(res["data"], indent=2, ensure_ascii=False)[:3500]
    return str(res.get("text", ""))[:3500]


def _slash(raw_args: str) -> str:
    parts = shlex.split((raw_args or "").strip())
    cmd = parts[0].lower() if parts else "help"
    rest = parts[1:]
    if cmd in {"help", "-h", "--help"}:
        return _HELP
    if cmd not in _SAFE_SLASH:
        return f"Unknown or blocked subcommand `{cmd}`. Allowed: {', '.join(sorted(_SAFE_SLASH))}."
    if cmd == "audit" and _on_gateway() and not _cfg("allow_audit_slash_on_gateway"):
        return ("/tastecheck audit is disabled on gateway platforms (opens local files/URLs). "
                "Ask the agent to use the tool instead, or set allow_audit_slash_on_gateway: true.")
    try:
        if cmd == "status":
            return json.dumps(_load_json(_ledger_path(), [])[-10:], indent=2)
        if cmd == "version":
            return _fmt(version())
        if cmd == "profile":
            return _fmt(profile(rest[0] if rest else "show"))
        if cmd == "audit":
            if not rest:
                return "Usage: /tastecheck audit <url-or-path>"
            res = audit(rest[0])
            _on_post_tool("tastecheck_audit", {"target": rest[0]}, res)
            return _fmt(res)
    except ValueError as exc:
        return f"{exc}\n\n{_HELP}"
    except Exception as exc:
        logger.debug("tastecheck slash failed", exc_info=True)
        return f"Tastecheck error: {type(exc).__name__}: {exc}"
    return _HELP


# --- register ---------------------------------------------------------------

def register(ctx) -> None:
    global _ctx
    _ctx = ctx
    ctx.register_hook("pre_llm_call", _on_pre_llm)
    ctx.register_hook("post_tool_call", _on_post_tool)
    ctx.register_command(
        "tastecheck",
        handler=_slash,
        description="Tastecheck frontend ship gate (audit/profile/version/status).",
        args_hint="audit <url-or-path> | profile [show|export] | version | status",
    )
    for schema, handler, emoji in (
        (AUDIT_SCHEMA, _tool_audit, "🎨"),
        (PROFILE_SCHEMA, _tool_profile, "🧭"),
        (VERSION_SCHEMA, _tool_version, "ℹ️"),
    ):
        ctx.register_tool(
            name=schema["name"], toolset="tastecheck", schema=schema, handler=handler,
            description=schema["description"], emoji=emoji,
        )
    skills_dir = Path(__file__).parent / "skills"
    if skills_dir.is_dir():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists():
                try:
                    ctx.register_skill(child.name, skill_md)
                except Exception:
                    logger.debug("tastecheck: register_skill failed for %s", child.name, exc_info=True)
