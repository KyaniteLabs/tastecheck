"""Tastecheck — native Hermes plugin (frontend ship gate).

Surfaces:
  pre_llm_call   -> advisory: when a message claims UI work is done, inject a ship-gate brief
  pre_tool_call  -> hard completion gate: vetoes kanban_complete / kanban_request_review
                    calls that DECLARE frontend work (structured artifacts, an explicit
                    flag, or a card marker) until every declared surface has a fresh,
                    signed, identity-valid SHIP in the ledger
  /tastecheck    -> audit | profile [show|export] | version | status | help
  tools          -> tastecheck_audit / tastecheck_profile / tastecheck_version
  skill          -> skills/tastecheck/SKILL.md

The CLI runs from source files vendored inside this plugin (vendor/tastecheck, verified
against vendor/MANIFEST.json before every run; no network fetch, no npm, no lifecycle
scripts). Local targets are served read-only from the session workspace over a
loopback HTTP server that lives only for the audit; the browser never gets file://
access. Child processes get an allowlisted env. Evidence, the HMAC-signed verdict
ledger and the taste profile live under <HERMES_HOME>/plugin-data/tastecheck-hermes/.
install / uninstall / calibrate and profile writes are intentionally NOT exposed.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import os
import re
import shlex
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from contextlib import contextmanager
from enum import Enum
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, unquote, urlsplit

logger = logging.getLogger(__name__)

PLUGIN_NAME = "tastecheck-hermes"
_LEGACY_DATA_NAME = "tastecheck"  # plugin-data dir used before 0.2.0 (profile.json is migrated)
PLUGIN_DIR = Path(__file__).resolve().parent
VENDOR_DIR = PLUGIN_DIR / "vendor" / "tastecheck"
VENDOR_MANIFEST = PLUGIN_DIR / "vendor" / "MANIFEST.json"
DEFAULTS: Dict[str, Any] = {
    # Empty -> the vendored CLI shipped inside this plugin (recommended). Set e.g.
    # "tastecheck" to run a global install instead.
    "tastecheck_command": "",
    "inject_on_ship": True,
    "allow_audit_slash_on_gateway": False,
    "timeout_seconds": 240,
    "gate_completions": True,
    "gate_ship_ttl_seconds": 21600,
    "gate_url_ship_ttl_seconds": 1800,
    # Off by default: following same-origin links (GET) can trigger side effects on the
    # audited origin (logout, delete, one-time tokens). Broken links are then not checked.
    "fetch_links": False,
}
LEDGER_MAX = 200
AUDITS_KEEP = 20
TOOL_RESULT_MAX = 20000
SERVED_MAX = 400  # files recorded per audit (the page plus its subresources)

# Advisory brief only (pre_llm_call). The completion gate never keys on vocabulary.
_UI_RE = re.compile(
    r"\b(?:ui|frontend|front-end|landing ?page|website|web ?page|css|stylesheet|layout|"
    r"component|dashboard)\b",
    re.IGNORECASE,
)
_SHIP_RE = re.compile(
    r"\b(?:done|ship(?:ped|ping)?|launch(?:ed|ing)?|ready to "
    r"(?:ship|launch|merge|deploy|go)|lgtm|deslop|taste ?check)\b",
    re.IGNORECASE,
)

_ctx = None


# --- config -----------------------------------------------------------------

_SETTINGS_CACHE: Dict[str, Any] = {"at": 0.0, "value": {}}


def _settings_from_config() -> Dict[str, Any]:
    """``plugins.entries.tastecheck-hermes.settings`` read straight from the Hermes
    config (public ``hermes_cli.config``). Used when no PluginContext is bound — the
    dashboard router loads this module by path and never gets one."""
    now = time.monotonic()
    if now - _SETTINGS_CACHE["at"] < 5.0:
        return _SETTINGS_CACHE["value"]
    value: Dict[str, Any] = {}
    try:
        from hermes_cli.config import load_config_readonly

        cfg = load_config_readonly() or {}
        entry = ((cfg.get("plugins") or {}).get("entries") or {}).get(PLUGIN_NAME) or {}
        settings = entry.get("settings") if isinstance(entry, dict) else None
        if isinstance(settings, dict):
            value = settings
    except Exception:
        logger.debug("tastecheck: config read failed; using defaults", exc_info=True)
    _SETTINGS_CACHE.update(at=now, value=value)
    return value


def _cfg(key: str) -> Any:
    try:
        if _ctx is not None:
            val = _ctx.get_config(key, None)
        else:
            val = _settings_from_config().get(key)
    except Exception:
        val = None
    return DEFAULTS[key] if val is None else val


# --- storage ----------------------------------------------------------------

_MIGRATED: Dict[str, bool] = {}


def _migrate_legacy(new_dir: Path) -> None:
    """Carry the user's taste profile over from the pre-0.2.0 data dir (copy, never
    move or delete). The old unsigned ledger is not migrated: the gate ignores
    unsigned entries anyway."""
    key = str(new_dir)
    if _MIGRATED.get(key):
        return
    _MIGRATED[key] = True
    try:
        old = new_dir.parent / _LEGACY_DATA_NAME / "profile.json"
        new = new_dir / "profile.json"
        if old.is_file() and not new.exists():
            shutil.copy2(old, new)
    except Exception:
        logger.debug("tastecheck: legacy profile migration failed", exc_info=True)


def _data_dir() -> Path:
    try:
        from plugins.plugin_storage import plugin_data_dir

        p = plugin_data_dir(PLUGIN_NAME)
    except Exception:
        home = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
        p = Path(home) / "plugin-data" / PLUGIN_NAME
        p.mkdir(parents=True, exist_ok=True)
    _migrate_legacy(p)
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
    """Atomic write through a per-writer temp file in the same directory."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


_THREAD_LOCK = threading.Lock()


@contextmanager
def _locked(path: Path):
    """Exclusive cross-thread + cross-process lock for a read-modify-write of *path*."""
    lock_path = path.with_name(path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with _THREAD_LOCK, open(lock_path, "a+b") as fh:
        if os.name == "nt":
            import msvcrt

            fh.seek(0)
            while True:
                try:
                    msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    continue
            try:
                yield
            finally:
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


# --- ledger signing ---------------------------------------------------------
# Entries are HMAC-SHA256 signed with a per-profile key (plugin-data/ledger.key, 0600,
# created from os.urandom). An entry hand-written into the ledger JSON by a file-edit
# tool carries no valid signature and is ignored by the gate. Residual risk (documented):
# a process running as the same OS user can read the key and forge entries; the
# signature raises the bar from "edit a JSON file" to "deliberately steal a key".

def _key_path() -> Path:
    return _data_dir() / "ledger.key"


def _ledger_key() -> bytes:
    path = _key_path()
    try:
        raw = path.read_bytes().strip()
        if len(raw) >= 64:
            return raw
    except FileNotFoundError:
        pass
    fd, tmp = tempfile.mkstemp(prefix=".ledger.key.", dir=str(path.parent))
    try:
        os.write(fd, os.urandom(32).hex().encode("ascii"))
        os.close(fd)
        os.chmod(tmp, 0o600)
        try:
            os.link(tmp, path)  # atomic create-if-absent: a concurrent creator wins once
        except FileExistsError:
            pass
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    raw = path.read_bytes().strip()
    if len(raw) < 64:
        raise RuntimeError(f"tastecheck ledger key {path.name} in the plugin data dir is truncated or "
                           "unreadable; move it aside so a new key is created (old verdicts then stop counting)")
    return raw


def _entry_digest(entry: Dict[str, Any], key: bytes) -> str:
    body = {k: v for k, v in entry.items() if k != "sig"}
    msg = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).hexdigest()


def _sign_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    entry["sig"] = _entry_digest(entry, _ledger_key())
    return entry


def _entry_signed(entry: Dict[str, Any], key: bytes) -> bool:
    sig = entry.get("sig")
    return isinstance(sig, str) and hmac.compare_digest(sig, _entry_digest(entry, key))


# --- session identity -------------------------------------------------------

# Mirrors gateway.session_context.NON_MESSAGING_SESSION_SURFACES (Hermes v0.21.6).
_NON_MESSAGING = frozenset({
    "", "api_server", "cli", "codex", "desktop", "gateway", "kanban", "local",
    "msgraph_webhook", "tool", "tui", "webhook",
})


def _on_gateway() -> bool:
    """True when this turn arrives over a human messaging surface. Uses the PUBLIC
    ``gateway.session_context.get_session_env`` (task-local ContextVars first, then
    env), default-deny like core: an unrecognized identity counts as messaging."""
    try:
        from gateway.session_context import get_session_env
    except ImportError:
        def get_session_env(name: str, default: str = "") -> str:  # type: ignore[misc]
            return os.environ.get(name, default)
    try:
        platform = os.environ.get("HERMES_PLATFORM") or get_session_env("HERMES_SESSION_PLATFORM", "")
        idents = (platform, get_session_env("HERMES_SESSION_SOURCE", ""))
        return any(str(v or "").strip().lower() not in _NON_MESSAGING for v in idents)
    except Exception:
        logger.debug("tastecheck: session identity lookup failed; failing closed", exc_info=True)
        return True


def _agent_cwd() -> Path:
    """The active session's workspace (Hermes resolve_agent_cwd), else the process cwd."""
    try:
        from agent.runtime_cwd import resolve_agent_cwd
    except ImportError:
        return Path.cwd()
    return Path(resolve_agent_cwd())


# --- child process ----------------------------------------------------------

# Exactly these variables reach the CLI child (when set). Nothing else from the parent
# environment is passed. NODE_OPTIONS is deliberately absent: it can preload code.
_ENV_ALLOW = (
    "PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP", "DISPLAY",
    "XDG_CACHE_HOME", "PLAYWRIGHT_BROWSERS_PATH", "LOCALAPPDATA", "PROGRAMFILES",
    "TASTECHECK_TIMEOUT_MS", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy",
    "https_proxy", "no_proxy", "CHROME_PATH", "TASTECHECK_CHROME",
)


def _scrubbed_env() -> Dict[str, str]:
    """Minimal env for the Tastecheck child — never hand it full os.environ."""
    env = {k: os.environ[k] for k in _ENV_ALLOW if os.environ.get(k)}
    env["NO_COLOR"] = "1"
    # Chrome's process-singleton socket path (user-data-dir + SingletonSocket) is
    # capped at ~104 chars by the kernel; a long TMPDIR makes the CLI's profile
    # dir blow the limit and Chrome dies before writing DevToolsActivePort.
    # Pin the child to a short tmpdir unless the operator set a short one.
    tmp = env.get("TMPDIR") or ""
    if len(tmp) > 60:
        env["TMPDIR"] = "/tmp"
    # Keep the taste profile per Hermes profile instead of ~/.tastecheck.
    env["TASTECHECK_PROFILE"] = str(_data_dir() / "profile.json")
    return env


def _descendants(pid: int) -> List[int]:
    """All live descendant pids of *pid* (POSIX `ps`; empty on failure)."""
    try:
        out = subprocess.run(["ps", "-A", "-o", "pid=", "-o", "ppid="], capture_output=True,
                             text=True, timeout=5).stdout
    except Exception:
        return []
    children: Dict[int, List[int]] = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            children.setdefault(int(parts[1]), []).append(int(parts[0]))
    found: List[int] = []
    stack = [pid]
    while stack:
        for child in children.get(stack.pop(), []):
            if child not in found:
                found.append(child)
                stack.append(child)
    return found


def _kill_tree(proc: "subprocess.Popen[str]") -> None:
    """Terminate the CLI and everything it spawned (CLI -> CDP runner -> Chrome)."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        proc.kill()
        return
    # Snapshot before killing: once the parent dies, orphans re-parent and the walk loses them.
    pids = _descendants(proc.pid)
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
    for pid in pids + _descendants(proc.pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


# --- vendored CLI (shipped in this plugin; verified before every run) --------

def _vendor_manifest() -> Dict[str, Any]:
    data = _load_json(VENDOR_MANIFEST, None)
    if not isinstance(data, dict) or not isinstance(data.get("files"), dict) or not data["files"]:
        raise RuntimeError("vendor/MANIFEST.json is missing or malformed")
    return data


def _verified_cli() -> List[str]:
    """Return the node command for the vendored CLI after checking every vendored file
    against the sha256 in vendor/MANIFEST.json. Any missing, extra-path or modified
    file refuses to run (the CLI is never fetched from the network)."""
    files = _vendor_manifest()["files"]
    root = VENDOR_DIR.resolve()
    for rel, want in files.items():
        p = (root / rel).resolve()
        if root not in p.parents:
            raise RuntimeError(f"vendor manifest path escapes the vendor dir: {rel!r}")
        got = _file_sha256(p)
        if got is None:
            raise RuntimeError(f"vendored CLI file missing: {rel}")
        if not hmac.compare_digest(got, str(want)):
            raise RuntimeError(f"vendored CLI file does not match MANIFEST.json: {rel}")
    if "bin/tastecheck.mjs" not in files:
        raise RuntimeError("vendor manifest does not list bin/tastecheck.mjs")
    return ["node", str(root / "bin" / "tastecheck.mjs")]


def _audit_args(cli_target: str, out_dir: Path) -> List[str]:
    args = ["audit", cli_target, str(out_dir), "--json"]
    if not _cfg("fetch_links"):
        args.append("--no-link-fetch")
    return args


def _ok_codes(args: List[str]) -> Tuple[int, ...]:
    """`audit` exits 0 SHIP / 1 HOLD / 2 tool error; every other command exits 0 on success."""
    return (0, 1) if args and args[0] == "audit" else (0,)


def run_tastecheck(args: List[str], timeout: Optional[float] = None) -> Dict[str, Any]:
    run_tmp = ""
    try:
        override = str(_cfg("tastecheck_command") or "").strip()
        cmd = (shlex.split(override) if override else _verified_cli()) + args
    except Exception as exc:
        logger.debug("tastecheck: CLI setup failed", exc_info=True)
        return {"ok": False, "error": f"tastecheck CLI unavailable: {exc}"}
    # The CLI's throwaway Chrome profile and output dirs go under a TMPDIR this process
    # owns and removes after the run, so a timeout kill never strands them.
    run_tmp = tempfile.mkdtemp(prefix="tc-")
    env = _scrubbed_env()
    for var in ("TMPDIR", "TMP", "TEMP"):
        env[var] = run_tmp
    popen_kw: Dict[str, Any] = {}
    if os.name == "nt":
        popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kw["start_new_session"] = True  # own process group so the whole tree can be killed
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL,
            text=True, env=env, cwd=str(_data_dir()), **popen_kw,
        )
    except FileNotFoundError as exc:
        shutil.rmtree(run_tmp, ignore_errors=True)
        return {"ok": False, "error": f"tastecheck not runnable (needs Node >=22 on PATH): {exc}"}
    limit = float(timeout) if timeout is not None else float(_cfg("timeout_seconds"))
    try:
        stdout, stderr = proc.communicate(timeout=max(1.0, limit))
    except subprocess.TimeoutExpired:
        _kill_tree(proc)
        proc.communicate()
        return {"ok": False, "error": "tastecheck timed out"}
    except BaseException:  # cancellation / interpreter shutdown: never leave browser work behind
        _kill_tree(proc)
        proc.communicate()
        raise
    finally:
        if proc.poll() is None:
            _kill_tree(proc)
        elif os.name != "nt":
            try:  # reap strays (e.g. a Chrome the CLI failed to close) left in our group
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
        shutil.rmtree(run_tmp, ignore_errors=True)
    out = (stdout or "").strip()
    err = (stderr or "").strip()
    ok_codes = _ok_codes(args)
    res: Dict[str, Any] = {"ok": proc.returncode in ok_codes, "exit": proc.returncode}
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
    if proc.returncode not in ok_codes:
        res["error"] = err[-800:] or f"exit {proc.returncode}"
    return res


# --- target resolution + confined loopback server ----------------------------

RENDER_SUFFIXES = (".html", ".htm", ".xhtml")
SOURCE_SUFFIXES = (".css", ".scss", ".sass", ".less", ".tsx", ".jsx", ".vue", ".svelte", ".astro")
_SERVE_TYPES = {
    ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
    ".xhtml": "application/xhtml+xml", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json", ".map": "application/json", ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
    ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".wasm": "application/wasm",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
}
# Data-shaped files (config.json, notes.txt, sitemap.xml, source maps) are where a
# workspace keeps things that are not the page. They are served only from inside
# the audited page's own directory tree, never from elsewhere in the workspace.
_DATA_SUFFIXES = frozenset({".json", ".map", ".webmanifest", ".txt", ".xml"})
_SERVE_MAX_BYTES = 64 * 1024 * 1024
_TARGET_MAX = 2048


def _is_url(s: Any) -> bool:
    return isinstance(s, str) and bool(re.match(r"^https?://", s, re.IGNORECASE))


def _is_loopback_url(s: str) -> bool:
    try:
        host = (urlsplit(s).hostname or "").strip("[]").lower()
    except Exception:
        return False
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _inside(child: Path, root: Path) -> bool:
    return child == root or root in child.parents


def _has_hidden_part(p: Path, root: Path) -> bool:
    try:
        rel = p.relative_to(root)
    except ValueError:
        return True
    return any(part.startswith(".") for part in rel.parts)


def _page_of(p: Path) -> Path:
    """A directory target means its index.html (the CLI's own rule)."""
    return p / "index.html" if p.is_dir() else p


def _resolve_target(target: str, root: Optional[Path] = None) -> str:
    """Validate an audit target. http(s) URLs pass through. Local targets must be an
    existing HTML file (or a directory with index.html) INSIDE the confinement root —
    the session workspace unless the caller names one — with no hidden path component.
    Returns the URL or the absolute page path."""
    t = str(target or "").strip()
    if not t:
        raise ValueError("target is required (http(s) URL or an HTML file/dir in the workspace)")
    if len(t) > _TARGET_MAX:
        raise ValueError(f"target is longer than {_TARGET_MAX} characters")
    if _is_url(t):
        return t
    if re.match(r"^[a-z][a-z0-9+.-]*:", t, re.IGNORECASE) and not re.match(r"^[a-zA-Z]:[\\/]", t):
        raise ValueError("only http(s) URLs or local paths are allowed")
    base = (root or _agent_cwd()).resolve()
    p = Path(t).expanduser()
    p = (base / p).resolve() if not p.is_absolute() else p.resolve()
    # Confinement first: never reveal whether a path outside the workspace exists.
    if not _inside(p, base) or _has_hidden_part(p, base):
        raise ValueError("local targets must live inside the session workspace (no hidden "
                         "paths); serve anything else yourself and audit its http URL")
    if not p.exists():
        raise ValueError(f"path does not exist: {p.name}")
    page = _page_of(p)
    if not page.is_file():
        raise ValueError(f"no index.html in directory {p.name}")
    if page.suffix.lower() not in RENDER_SUFFIXES:
        raise ValueError("local targets must be an .html/.htm/.xhtml page or a directory with index.html")
    return str(page)


class _ConfinedServer:
    """Read-only HTTP server on 127.0.0.1:<random> serving ONE root directory for the
    duration of one audit. Refuses hidden path components, traversal, symlinks that
    resolve outside the root, non-web file types and foreign Host headers. Records the
    sha256 of every byte string it serves (the exact bytes sent), so the ledger binds
    the page AND its subresources."""

    def __init__(self, root: Path, data_root: Optional[Path] = None):
        self.root = root.resolve()
        # Data-shaped files are served only from here (the page's directory).
        self.data_root = (data_root or root).resolve()
        self.served: Dict[str, str] = {}
        self.overflow = False   # more distinct files than SERVED_MAX: binding incomplete
        self.conflict = False   # one path served with different bytes: binding ambiguous
        self._lock = threading.Lock()
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_a: Any) -> None:  # silence stderr access log
                return

            def _deny(self, code: int) -> None:
                self.send_response(code)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def _serve(self, body: bool) -> None:
                host = (self.headers.get("Host") or "").lower()
                if host not in {f"127.0.0.1:{server.port}", f"localhost:{server.port}"}:
                    return self._deny(403)
                path = server.lookup(self.path)
                if path is None:
                    return self._deny(404)
                try:
                    with open(path, "rb") as fh:
                        data = fh.read(_SERVE_MAX_BYTES + 1)
                except OSError:
                    return self._deny(404)
                if len(data) > _SERVE_MAX_BYTES:
                    return self._deny(413)
                server.record(path, data)
                self.send_response(200)
                self.send_header("Content-Type", _SERVE_TYPES[path.suffix.lower()])
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                if body:
                    self.wfile.write(data)

            def do_GET(self) -> None:  # noqa: N802
                self._serve(True)

            def do_HEAD(self) -> None:  # noqa: N802
                self._serve(False)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.httpd.daemon_threads = True
        self.port = int(self.httpd.server_address[1])
        self._thread = threading.Thread(target=self.httpd.serve_forever,
                                        kwargs={"poll_interval": 0.2}, daemon=True)

    def lookup(self, raw: str) -> Optional[Path]:
        try:
            path = unquote(urlsplit(raw).path)
        except Exception:
            return None
        if "\x00" in path or "\\" in path:
            return None
        parts = [p for p in path.split("/") if p]
        if any(p.startswith(".") for p in parts):
            return None
        cand = self.root.joinpath(*parts)
        try:
            cand = cand.resolve(strict=True)
        except (OSError, RuntimeError):
            return None
        if cand.is_dir():
            cand = (cand / "index.html")
            if not cand.is_file():
                return None
            cand = cand.resolve()
        if not _inside(cand, self.root) or _has_hidden_part(cand, self.root):
            return None
        if not cand.is_file() or cand.suffix.lower() not in _SERVE_TYPES:
            return None
        if cand.suffix.lower() in _DATA_SUFFIXES and not _inside(cand, self.data_root):
            return None
        return cand

    def record(self, path: Path, data: bytes) -> None:
        """Keep the FIRST digest per path. A different digest for the same path, or more
        files than SERVED_MAX, marks the binding untrustworthy (the audit then cannot SHIP)."""
        digest = hashlib.sha256(data).hexdigest()
        with self._lock:
            key = str(path)
            prior = self.served.get(key)
            if prior is not None:
                if prior != digest:
                    self.conflict = True
                return
            if len(self.served) >= SERVED_MAX:
                self.overflow = True
                return
            self.served[key] = digest

    def url_for(self, page: Path) -> str:
        rel = page.resolve().relative_to(self.root).as_posix()
        return f"http://127.0.0.1:{self.port}/" + quote(rel)

    def __enter__(self) -> "_ConfinedServer":
        self._thread.start()
        return self

    def __exit__(self, *_exc: Any) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self._thread.join(timeout=5)


# --- audit ------------------------------------------------------------------

def _retention_grace() -> float:
    """Prune grace window: longer than twice the CLI timeout (min 10 min). An audit in
    flight (or a result just written) is always younger than this, so concurrent runs'
    retention sweeps can never delete it."""
    try:
        return max(2.0 * float(_cfg("timeout_seconds")), 600.0)
    except Exception:
        return 600.0


def _prune_audits(root: Path) -> None:
    """Delete the oldest audit dirs beyond AUDITS_KEEP — but only among dirs older than
    the retention grace, so in-progress audits and freshly returned evidence survive."""
    try:
        cutoff = time.time() - _retention_grace()
        dirs = sorted(
            [d for d in root.iterdir() if d.is_dir() and not d.name.startswith(".") and d.stat().st_mtime < cutoff],
            key=lambda d: d.name,
        )
        for d in dirs[:-AUDITS_KEEP]:
            shutil.rmtree(d, ignore_errors=True)
    except Exception:
        logger.debug("tastecheck: prune failed", exc_info=True)


class AuditOutcome(str, Enum):
    """The lifecycle of ONE audit result (the dict ``audit()`` returns) and the ``verdict``
    value persisted in each ledger entry. The ONLY place these states are named.

        (unset) ──ship──▶ SHIP ──artifact changed──▶ ERROR
        (unset) ──hold──▶ HOLD
        (unset) ──error─▶ ERROR

    SHIP, HOLD and ERROR are terminal except SHIP → ERROR (the audited bytes changed
    while the audit ran). Nothing ever moves back to SHIP. Callers always see verdict
    HOLD unless the outcome is SHIP; ERROR (tool failure, identity mismatch, changed
    artifact) never supersedes or releases anything in the completion gate."""

    SHIP = "SHIP"
    HOLD = "HOLD"
    ERROR = "ERROR"


# outcome -> (ok, caller-facing verdict). Every outcome writes all three keys together.
_OUTCOME_FIELDS: Dict[AuditOutcome, Tuple[bool, str]] = {
    AuditOutcome.SHIP: (True, "SHIP"),
    AuditOutcome.HOLD: (True, "HOLD"),
    AuditOutcome.ERROR: (False, "HOLD"),
}
# from-state (None = no outcome yet) -> legal to-states.
_OUTCOME_MOVES: Dict[Optional[AuditOutcome], frozenset] = {
    None: frozenset(AuditOutcome),
    AuditOutcome.SHIP: frozenset({AuditOutcome.ERROR}),
    AuditOutcome.HOLD: frozenset(),
    AuditOutcome.ERROR: frozenset(),
}
# Ledger verdicts the completion gate reads; ERROR (and anything unknown) never counts.
GATE_VERDICTS = frozenset({AuditOutcome.SHIP.value, AuditOutcome.HOLD.value})


class IllegalOutcomeTransition(RuntimeError):
    pass


def parse_outcome(value: Any) -> Optional[AuditOutcome]:
    """Tolerant reader: a known outcome string (as stored on disk) or None."""
    try:
        return AuditOutcome(value)
    except ValueError:
        return None


def next_outcome(current: Optional[AuditOutcome], to: AuditOutcome) -> AuditOutcome:
    """The single transition rule. Raises on an illegal move (e.g. HOLD → SHIP)."""
    if to not in _OUTCOME_MOVES[current]:
        frm = current.value if current else "(unset)"
        raise IllegalOutcomeTransition(f"audit outcome cannot move {frm} -> {to.value}")
    return to


def audit_outcome(res: Dict[str, Any]) -> Optional[AuditOutcome]:
    """Current outcome of an audit result; None while no outcome was decided. A
    present-but-unknown value is an illegal state and raises."""
    raw = res.get("outcome")
    if raw is None:
        return None
    parsed = parse_outcome(raw)
    if parsed is None:
        raise IllegalOutcomeTransition(f"unknown audit outcome {raw!r}")
    return parsed


def _set_outcome(res: Dict[str, Any], to: AuditOutcome, reason: Optional[str] = None) -> Dict[str, Any]:
    """Move one audit result to ``to``: writes ``ok``, ``verdict`` and ``outcome`` together
    (and the error reason for ERROR). The only writer of those three keys."""
    to = next_outcome(audit_outcome(res), to)
    res["ok"], res["verdict"] = _OUTCOME_FIELDS[to]
    res["outcome"] = to.value
    if to is AuditOutcome.ERROR and reason is not None:
        res.setdefault("error", reason)
    return res


def _ship(res: Dict[str, Any]) -> Dict[str, Any]:
    return _set_outcome(res, AuditOutcome.SHIP)


def _held(res: Dict[str, Any]) -> Dict[str, Any]:
    return _set_outcome(res, AuditOutcome.HOLD)


def _error(res: Dict[str, Any], reason: str) -> Dict[str, Any]:
    """Fail-closed tool/identity ERROR: the caller sees HOLD; the ledger records ERROR,
    which never supersedes or releases anything."""
    return _set_outcome(res, AuditOutcome.ERROR, reason)


def audit(target: str, source: str = "tool", serve_root: Optional[Path] = None) -> Dict[str, Any]:
    """Run one audit in its own exclusive evidence dir and record the outcome in the
    ledger (the ONLY ledger writer). Fail closed: SHIP only when the CLI exited 0 and
    evidence for *this* target says SHIP and the audited bytes did not change while the
    audit ran; every other outcome is HOLD to the caller. A cold-start Chrome can miss
    the CLI's 20 s DevToolsActivePort probe; that one transient is retried once inside
    the same overall deadline."""
    tgt = _resolve_target(target, serve_root)  # ValueError: nothing ran, nothing recorded
    root = _data_dir() / "audits"
    root.mkdir(parents=True, exist_ok=True)
    budget = float(_cfg("timeout_seconds"))
    deadline = time.monotonic() + budget
    started_at = int(time.time())
    local = not _is_url(tgt)
    page = Path(tgt) if local else None
    before = _file_sha256(page) if page else None
    served: Dict[str, str] = {}
    binding_problem = ""
    res: Dict[str, Any] = {}
    for attempt in (0, 1):
        out_dir = Path(tempfile.mkdtemp(prefix=time.strftime("%Y%m%d-%H%M%S") + "-", dir=str(root)))
        remaining = deadline - time.monotonic()
        if page is not None:
            with _ConfinedServer(serve_root or _agent_cwd(), data_root=page.parent) as srv:
                cli_target = srv.url_for(page)
                res = run_tastecheck(_audit_args(cli_target, out_dir), timeout=remaining)
                served = dict(srv.served)
                binding_problem = ("more files were served than the ledger can bind" if srv.overflow
                                   else "a file changed while it was being served" if srv.conflict
                                   else "")
        else:
            cli_target = tgt
            res = run_tastecheck(_audit_args(cli_target, out_dir), timeout=remaining)
        res["evidence_dir"] = str(out_dir)
        exit_code = res.get("exit")
        cold_start = "DevToolsActivePort" in str(res.get("error") or "") + str(res.get("stderr") or "")
        if (exit_code not in (0, 1) and cold_start and attempt == 0
                and deadline - time.monotonic() > 20):
            logger.debug("tastecheck: cold-start DevToolsActivePort miss; retrying once")
            continue
        break
    res = _finish_audit(res, cli_target, out_dir, root, res.get("exit"))
    if page is not None and binding_problem and audit_outcome(res) is AuditOutcome.SHIP:
        res.pop("data", None)
        _error(res, f"{binding_problem}; the SHIP cannot be bound to exact bytes, re-run the audit")
    if page is not None and audit_outcome(res) is AuditOutcome.SHIP:
        after = _file_sha256(page)
        if before is None or after != before or served.get(str(page)) != before:
            res.pop("data", None)
            _error(res, f"{page.name} changed while it was being audited (or was not the page served); re-run the audit")
    try:
        record_verdict(tgt, res, source=source, served=served if page else None,
                       expected_sha=before, started_at=started_at)
    except Exception as exc:  # the verdict stands; a ledger failure must be visible
        logger.warning("tastecheck: recording the verdict failed: %s", exc)
        res["ledger_error"] = f"{type(exc).__name__}: {exc}"
        if source != "roll-audit":
            # A lost verdict (above all a lost HOLD) must not let an older SHIP release
            # the gate: latch a veto for this target until a later audit records.
            _latch(tgt)
    return res


def _finish_audit(res: Dict[str, Any], tgt: str, out_dir: Path, root: Path,
                  exit_code: Optional[int]) -> Dict[str, Any]:
    """Apply the fail-closed verdict boundary to one completed CLI run."""
    if exit_code not in (0, 1):
        res.pop("data", None)  # tool/process failure: never trust any evidence
        _prune_audits(root)
        return _error(res, res.get("error") or res.get("stderr") or f"tastecheck exit {exit_code}")
    if not isinstance(res.get("data"), dict):
        ev = _load_json(out_dir / "evidence.json", None)  # dir is exclusive to this run
        if isinstance(ev, dict):
            res["data"] = ev
    data = res.get("data")
    if not isinstance(data, dict):
        # No valid evidence for THIS run is HOLD, even when the CLI exited 0.
        res.pop("data", None)
        _error(res, "no valid audit evidence for this run; fail closed")
    elif data.get("target") != tgt:
        # Evidence must carry THIS run's target identity; missing or foreign is HOLD.
        res.pop("data", None)
        _error(res, f"evidence target {str(data.get('target'))[:200]!r} does not match {tgt!r}")
    elif data.get("verdict") == "SHIP" and exit_code == 0:
        _ship(res)
    else:
        _held(res)
    _prune_audits(root)
    return res


def profile(action: str = "show") -> Dict[str, Any]:
    action = (action or "show").lower()
    if action not in {"show", "export"}:
        return {"ok": False, "error": "only show/export are exposed; edit your taste profile with the tastecheck CLI"}
    return run_tastecheck(["profile", action])


def version() -> Dict[str, Any]:
    return run_tastecheck(["--version"])


# --- ledger -----------------------------------------------------------------

def _file_sha256(path: Optional[Path]) -> Optional[str]:
    if path is None:
        return None
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 16), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def _norm_target(t: Any) -> str:
    """Normalize a ledger target / payload path for matching: http(s) URLs keep their
    exact identity; everything else resolves to an absolute path
    against the AGENT cwd (strict=False, so a since-deleted file still compares equal),
    and a directory means its index.html. Record and consumption share this rule."""
    s = str(t or "").strip()
    if not s:
        return ""
    if _is_url(s):
        return s  # exact identity: /app and /app/ can be different pages
    try:
        p = Path(s).expanduser()
        if not p.is_absolute():
            p = _agent_cwd() / p
        p = p.resolve()
        return str(p / "index.html") if p.is_dir() else str(p)
    except Exception:
        return s


class LedgerUnreadable(RuntimeError):
    pass


def _read_ledger() -> List[Any]:
    path = _ledger_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise LedgerUnreadable(str(exc)) from exc
    if not isinstance(data, list):
        raise LedgerUnreadable("ledger is not a list")
    return data


def _payload_verdict(payload: Dict[str, Any]) -> AuditOutcome:
    """Ledger verdict for one audit result: its ``outcome`` (legacy payloads: its
    ``verdict``); anything that is not SHIP/HOLD is ERROR (fail closed)."""
    parsed = parse_outcome(payload.get("outcome") or payload.get("verdict"))
    return parsed if parsed is not None else AuditOutcome.ERROR


def record_verdict(target: str, payload: Dict[str, Any], source: str = "tool", *,
                   served: Optional[Dict[str, str]] = None, expected_sha: Optional[str] = None,
                   started_at: Optional[int] = None) -> Dict[str, Any]:
    """Append one signed verdict entry to the ledger. Called by ``audit()`` (every
    surface: tool, slash, roll-audit), never by a post-hoc hook.

    ``verdict`` is SHIP / HOLD / ERROR: a tool failure, identity mismatch or an
    artifact that changed during the audit is ERROR, which the gate ignores (it neither
    supersedes an earlier SHIP nor releases anything). Local targets carry
    ``target_sha256`` (pre-launch digest when known) and ``served`` (sha256 of every
    file the loopback server sent). The ledger stores no page content."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    verdict = _payload_verdict(payload)
    tgt = _norm_target(str(target))
    tgt_raw = str(target)[:300]  # display copy only; identity is the full ``target``
    now = int(time.time())
    entry: Dict[str, Any] = {
        "ts": now,
        "started_at": int(started_at) if started_at else now,
        "target": tgt,
        "target_raw": tgt_raw,
        "kind": "url" if _is_url(tgt) else "file",
        "verdict": verdict.value,
        "hold_reasons": [str(r)[:200] for r in (data.get("holdReasons") or [])][:10],
        "evidence_dir": payload.get("evidence_dir"),
        "source": source,
        "workspace": str(_agent_cwd().resolve()),
    }
    if verdict is AuditOutcome.ERROR and payload.get("error"):
        entry["error"] = str(payload.get("error"))[:200]
    if entry["kind"] == "file":
        current = _file_sha256(Path(tgt))
        digest = expected_sha or current
        if digest:
            entry["target_sha256"] = digest
        if expected_sha and current != expected_sha and verdict is AuditOutcome.SHIP:
            entry["verdict"] = next_outcome(verdict, AuditOutcome.ERROR).value
            entry["error"] = "artifact changed during the audit"
        if served is not None:
            entry["served"] = dict(list(served.items())[:SERVED_MAX])
    path = _ledger_path()
    with _locked(path):
        try:
            ledger = _read_ledger()
        except LedgerUnreadable as exc:
            backup = path.with_name(f"{path.name}.corrupt-{now}")
            try:
                os.replace(path, backup)
            except OSError:
                pass
            logger.warning("tastecheck: verdict ledger was unreadable (%s); moved it to %s and started a new one",
                           exc, backup.name)
            ledger = []
        ledger.append(_sign_entry(entry))
        _save_json(path, _evict(ledger))
    if source != "roll-audit":
        _unlatch(tgt)
    return entry


def _evict(ledger: List[Any]) -> List[Any]:
    """Cap the ledger at LEDGER_MAX, evicting what the gate never reads first (malformed
    rows, roll-audit and ERROR verdicts), then the oldest gate verdicts."""
    extra = len(ledger) - LEDGER_MAX
    if extra <= 0:
        return ledger

    def inert(e: Any) -> bool:
        return (not isinstance(e, dict) or e.get("source") == "roll-audit"
                or e.get("verdict") not in GATE_VERDICTS)

    drop = set()
    for i, e in enumerate(ledger[:-1]):  # never evict the entry just appended
        if len(drop) >= extra:
            break
        if inert(e):
            drop.add(i)
    kept = [e for i, e in enumerate(ledger) if i not in drop]
    return kept[-LEDGER_MAX:]


# --- gate latch ---------------------------------------------------------------
# When a verdict cannot be written, the gate must not fall back to an older SHIP for
# the same target. The latch lives in memory (this process) AND on disk (best effort,
# for other processes), keyed by target with the workspace it was audited from.

_LATCH: Dict[str, str] = {}


def _latch_path() -> Path:
    return _data_dir() / "gate_latch.json"


def _latch(target: str) -> None:
    ws = str(_agent_cwd().resolve())
    _LATCH[target] = ws
    try:
        data = _load_json(_latch_path(), {})
        data = data if isinstance(data, dict) else {}
        data[target] = ws
        _save_json(_latch_path(), data)
    except Exception:
        logger.warning("tastecheck: could not persist the gate latch; it holds for this process only")


def _unlatch(target: str) -> None:
    _LATCH.pop(target, None)
    try:
        path = _latch_path()
        data = _load_json(path, {})
        if isinstance(data, dict) and target in data:
            data.pop(target, None)
            _save_json(path, data)
    except Exception:
        logger.debug("tastecheck: could not clear the gate latch", exc_info=True)


def _latched_targets(workspace: str) -> List[str]:
    merged: Dict[str, str] = {}
    disk = _load_json(_latch_path(), {})
    if isinstance(disk, dict):
        merged.update({str(k): str(v) for k, v in disk.items()})
    merged.update(_LATCH)
    return [t for t, ws in merged.items() if ws == workspace]


# --- hooks ------------------------------------------------------------------

_BRIEF = (
    "[Tastecheck ship gate] This message claims frontend/UI work is done or ready to ship. "
    "Verdict first, fail closed: run `tastecheck_audit` on the real rendered artifact "
    "(dev-server URL or built HTML) before agreeing. Lead with SHIP or HOLD, list each "
    "hold reason with its evidence (selector, measurement, console line), and treat any "
    "required probe that could not run as HOLD. Checkmarks are not execution evidence."
)


def _message_text(msg: Any) -> str:
    """Plain text of a user message: a string, or the text parts of a multimodal list."""
    if isinstance(msg, str):
        return msg
    if isinstance(msg, list):
        parts = []
        for part in msg:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "\n".join(parts)
    return ""


def _on_pre_llm(user_message: Any = "", **_: Any) -> Optional[Dict[str, str]]:
    """Advisory only: vocabulary may add a brief, it never blocks anything."""
    try:
        text = _message_text(user_message)[:20000]
        if (_cfg("inject_on_ship") and text
                and _SHIP_RE.search(text) and _UI_RE.search(text)):
            return {"context": _BRIEF}
    except Exception:
        logger.debug("tastecheck: pre_llm_call failed", exc_info=True)
    return None


# --- pre-completion gate -----------------------------------------------------

_COMPLETION_TOOLS = frozenset({"kanban_complete", "kanban_request_review"})

_GATE_MESSAGE = (
    "Tastecheck ship gate: this completion declares frontend work, but the tastecheck "
    "ledger holds no fresh SHIP verdict covering it. Run the tastecheck_audit tool (or "
    "/tastecheck audit) against the actual rendered artifact — dev-server URL or the HTML "
    "page in this workspace — read the verdict and its evidence, and complete only on "
    "that SHIP. An unrelated, superseded (newer HOLD), stale, changed-artifact, unsigned, "
    "missing or unreadable verdict counts as HOLD: fail closed."
)

_KANBAN_TASK_ID_RE = re.compile(r"^t_[a-z0-9]+$")
# Card opt-in: a skill named tastecheck / tastecheck-pass, or a body line "tastecheck: required".
_CARD_MARKER_RE = re.compile(r"^\s*tastecheck\s*:\s*(?:required|gate|on|yes|true)\s*$",
                             re.IGNORECASE | re.MULTILINE)
_CARD_MARKER_SKILLS = frozenset({"tastecheck", "tastecheck-pass", "tastecheck:tastecheck",
                                 "tastecheck-hermes:tastecheck"})
# Structured places a completion names its artifacts. Free text (summary/result) is
# never scanned, and dict KEYS are never scanned.
_ARG_TARGET_KEYS = ("target", "targets", "artifacts", "paths")
_META_TARGET_KEYS = ("target", "targets", "artifacts", "paths", "changed_files", "files")


def _env_task_is_ours() -> bool:
    """Would the kanban tool itself default to ``HERMES_KANBAN_TASK`` here? It does not in
    a delegated child or a cron run beside a worker; mirror that so the gate never
    blocks on a card this session does not own. Runtimes without those helpers keep
    the env default (the stricter, fail-closed reading)."""
    try:
        from tools import kanban_tools as kt  # type: ignore
    except Exception:
        return True
    try:
        child = getattr(kt, "_is_delegated_child_context", None)
        owned = getattr(kt, "_is_dispatcher_owned_worker", None)
        if callable(child) and child():
            return False
        if callable(owned) and not owned():
            return False
    except Exception:
        logger.debug("tastecheck: kanban ownership check failed; keeping env task", exc_info=True)
    return True


def _resolve_kanban_task_id(args: Optional[Dict[str, Any]], hook_kw: Optional[Dict[str, Any]]) -> str:
    """The CARD identity this completion closes — mirroring the completion tool's own
    resolution order: explicit ``args.task_id`` first, then the hook's ``task_id``, then
    the dispatched-worker default (``HERMES_KANBAN_TASK``). A runtime turn id (UUID) is
    not a card id and is skipped. Returns "" when no card identity can be resolved."""
    candidates: List[str] = []
    if isinstance(args, dict):
        a = args.get("task_id")
        if isinstance(a, str):
            candidates.append(a.strip())
    if isinstance(hook_kw, dict):
        h = hook_kw.get("task_id")
        if isinstance(h, str):
            candidates.append(h.strip())
    env = os.environ.get("HERMES_KANBAN_TASK")
    if env and _env_task_is_ours():
        candidates.append(env.strip())
    for c in candidates:
        if c and _KANBAN_TASK_ID_RE.match(c):
            return c
    return ""


def _strings(node: Any) -> List[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, list):
        return [s for v in node for s in _strings(v)]
    return []


def _declared_targets(args: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """(renderable, sources) the completion DECLARES in structured fields.

    renderable: http(s) URLs, .html/.htm/.xhtml files, directories with index.html —
                each needs its own fresh SHIP.
    sources:    .css/.scss/.tsx/.jsx/.vue/.svelte/.astro/... — cannot be audited
                directly; they must be covered by a SHIP of a page in this workspace.
    Anything else (README.md, server.py, ...) is not frontend and is ignored."""
    md = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    raw: List[str] = []
    for holder, keys in ((args, _ARG_TARGET_KEYS), (md, _META_TARGET_KEYS)):
        for k in keys:
            raw.extend(_strings(holder.get(k)))
    renderable: List[str] = []
    sources: List[str] = []
    for s in (x.strip() for x in raw):
        if not s:
            continue
        if _is_url(s):
            renderable.append(_norm_target(s))
            continue
        norm = _norm_target(s)
        if not norm:
            continue
        suffix = Path(norm).suffix.lower()
        if suffix in RENDER_SUFFIXES:
            renderable.append(norm)
        elif suffix in SOURCE_SUFFIXES:
            sources.append(norm)
    return list(dict.fromkeys(renderable)), list(dict.fromkeys(sources))


def _payload_flag(args: Dict[str, Any]) -> bool:
    md = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    for k in ("tastecheck", "frontend"):
        v = md.get(k)
        if v is True or (isinstance(v, str) and v.strip().lower() in {"required", "gate", "true", "yes", "on"}):
            return True
    return False


def _task_marker(task_id: str, board: Optional[str]) -> Optional[str]:
    """Card opt-in, read-only: the card carries the tastecheck skill or a
    ``tastecheck: required`` body line. Opens the board DB with ``mode=ro`` on the
    board the completion targets (``args.board``, else the current board)."""
    tid = str(task_id or "").strip()
    if not _KANBAN_TASK_ID_RE.match(tid):
        return None
    try:
        import sqlite3

        from hermes_cli import kanban_db
    except ImportError:
        return None  # no kanban in this runtime: nothing to read, nothing to veto
    try:
        db_path = Path(kanban_db.kanban_db_path(board or None)).resolve()
        if not db_path.is_file():
            return None
        conn = sqlite3.connect(f"{db_path.as_uri()}?mode=ro", uri=True, timeout=5)
        try:
            conn.row_factory = sqlite3.Row
            task = kanban_db.get_task(conn, tid)
        finally:
            conn.close()
    except Exception:
        # An unreadable board must not silently release a gated card: treat the
        # completion as frontend work, so it needs a fresh SHIP (fail closed).
        logger.debug("tastecheck: kanban card lookup failed", exc_info=True)
        return f"card {tid} could not be read from its board (fail closed)"
    if task is None:
        return None
    skills = getattr(task, "skills", None) or []
    if isinstance(skills, str):
        skills = [skills]
    if any(str(s).strip().lower() in _CARD_MARKER_SKILLS for s in skills):
        return f"card {tid} carries the tastecheck skill"
    if _CARD_MARKER_RE.search(str(getattr(task, "body", "") or "")):
        return f"card {tid} is marked 'tastecheck: required'"
    return None


def _frontend_claim_reason(args: Dict[str, Any], hook_kw: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Why this completion is gated, or None. Only DECLARED frontend work counts:
    structured artifact fields naming pages/frontend sources, an explicit
    ``metadata.tastecheck``/``metadata.frontend`` flag, or a card marker. Words in the
    summary, words in dict keys and words on the card never veto anything."""
    renderable, sources = _declared_targets(args)
    if renderable or sources:
        return "the completion declares frontend artifacts"
    if _payload_flag(args):
        return "the completion sets metadata.tastecheck/frontend"
    tid = _resolve_kanban_task_id(args, hook_kw)
    if tid:
        board = args.get("board") if isinstance(args.get("board"), str) else None
        return _task_marker(tid, board)
    return None


def _target_label(t: str) -> str:
    return t if len(t) <= 60 else "…" + t[-59:]


def _gate_entries() -> List[Dict[str, Any]]:
    """Signed, well-formed SHIP/HOLD entries usable by the completion gate. Roll-audit
    verdicts (Taste Roll columns in plugin-data) and ERROR outcomes never count.
    Raises LedgerUnreadable on a corrupt ledger (the gate then fails closed)."""
    ledger = _read_ledger()
    key = _ledger_key()
    out = []
    for e in ledger:
        if not (isinstance(e, dict) and isinstance(e.get("ts"), (int, float))):
            continue
        if e.get("source") == "roll-audit" or e.get("verdict") not in GATE_VERDICTS:
            continue
        if not _entry_signed(e, key):
            continue
        out.append(e)
    return out


def _ttl_for(entry: Dict[str, Any]) -> float:
    if _is_url(entry.get("target")):
        return float(_cfg("gate_url_ship_ttl_seconds"))
    return float(_cfg("gate_ship_ttl_seconds"))


def _is_fresh(entry: Dict[str, Any], now: float) -> bool:
    return float(entry["ts"]) >= now - _ttl_for(entry)


def _validate_ship(entry: Dict[str, Any]) -> Tuple[bool, str]:
    """Is this SHIP's evidence still true RIGHT NOW? URLs: identity is the binding
    (with workspace + short TTL). Files: the page digest and every served subresource
    must still match. Fail closed."""
    tgt = entry.get("target")
    if _is_url(tgt):
        return True, ""
    audited = entry.get("target_sha256")
    if not isinstance(audited, str) or not audited:
        return False, "the SHIP evidence lacks a content digest for its audited file (fail closed)"
    p = Path(str(tgt))
    current = _file_sha256(p) if p.is_file() else None
    if current is None:
        return False, f"the audited artifact {p.name} is missing or unreadable (fail closed)"
    if current != audited:
        return False, f"the audited artifact changed after its SHIP ({p.name})"
    served = entry.get("served")
    if isinstance(served, dict):
        for sp, sha in served.items():
            if _file_sha256(Path(sp)) != sha:
                return False, f"{Path(sp).name}, served during the SHIP audit of {p.name}, changed or is gone"
    return True, ""


def _latest_for(entries: List[Dict[str, Any]], target: str, workspace: str) -> Tuple[Optional[Dict[str, Any]], str]:
    """Latest fresh entry for one target identity, or (None, why)."""
    matching = [e for e in entries if _norm_target(e.get("target")) == target]
    if _is_url(target):
        matching = [e for e in matching if e.get("workspace") == workspace]
    if not matching:
        return None, "no ledger verdict is bound to this artifact"
    now = time.time()
    fresh = sorted((e for e in matching if _is_fresh(e, now)), key=lambda e: float(e["ts"]))
    if not fresh:
        return None, "the only matching verdict(s) are stale (older than the gate TTL)"
    return fresh[-1], ""


def _hold_text(entry: Dict[str, Any]) -> str:
    reasons = ", ".join(str(r) for r in (entry.get("hold_reasons") or [])[:3])
    return "the latest matching verdict is HOLD" + (f" — {reasons}" if reasons else "")


def _entry_for_target(entries: List[Dict[str, Any]], target: str, workspace: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    latest, why = _latest_for(entries, target, workspace)
    if latest is None:
        return False, why, None
    if latest.get("verdict") != AuditOutcome.SHIP.value:
        return False, _hold_text(latest), None
    ok, why = _validate_ship(latest)
    return ok, why, latest if ok else None


def _workspace_ships(entries: List[Dict[str, Any]], workspace: str) -> Tuple[List[Dict[str, Any]], str]:
    """Workspace fallback: per-target latest fresh verdicts recorded IN this workspace for
    workspace-local pages or loopback URLs. Any latest HOLD blocks; otherwise at least one
    valid SHIP is required. Returns (valid ships, why-not)."""
    ws = Path(workspace)
    scoped = []
    for e in entries:
        if e.get("workspace") != workspace:
            continue
        t = str(e.get("target") or "")
        if _is_url(t):
            if _is_loopback_url(t):
                scoped.append(e)
        elif _inside(Path(t), ws):
            scoped.append(e)
    if not scoped:
        return [], "no ledger verdict is bound to this workspace"
    now = time.time()
    latest: Dict[str, Dict[str, Any]] = {}
    for e in sorted(scoped, key=lambda e: float(e["ts"])):
        if _is_fresh(e, now):
            latest[str(e.get("target"))] = e
    if not latest:
        return [], "the only matching verdict(s) are stale (older than the gate TTL)"
    ships: List[Dict[str, Any]] = []
    first_invalid = ""
    for t, e in latest.items():
        if e.get("verdict") != AuditOutcome.SHIP.value:
            if _is_url(t) or Path(t).exists():
                return [], f"{_target_label(t)}: {_hold_text(e)}"
            continue  # HOLD on a page that no longer exists is moot
        ok, why = _validate_ship(e)
        if ok:
            ships.append(e)
        elif not first_invalid:
            first_invalid = f"{_target_label(t)}: {why}"
    if not ships:
        return [], first_invalid or "no valid SHIP is bound to this workspace"
    return ships, ""


def _sources_covered(sources: List[str], ships: List[Dict[str, Any]],
                     workspace: Optional[str] = None) -> Tuple[bool, str]:
    """Each declared frontend source must be covered by a valid SHIP: served during that
    audit with the same bytes, or (not served — e.g. compiled .tsx) last modified no
    later than the audit started. A source that is missing, or that lives outside the
    session workspace, is never covered (fail closed)."""
    ws = Path(workspace or str(_agent_cwd().resolve()))
    for s in sources:
        p = Path(s)
        if not p.is_file():
            return False, f"{_target_label(s)}: declared source is missing or not a file (fail closed)"
        if not _inside(p, ws):
            return False, f"{_target_label(s)}: declared source is outside this workspace (fail closed)"
        served_by = [e for e in ships if isinstance(e.get("served"), dict) and s in e["served"]]
        if served_by:
            current = _file_sha256(p)
            if not any(e["served"][s] == current for e in served_by):
                return False, f"{_target_label(s)}: changed after the SHIP audit that loaded it"
            continue
        if not ships:
            return False, f"{_target_label(s)}: no fresh SHIP in this workspace covers it"
        try:
            mtime = p.stat().st_mtime
        except OSError:
            return False, f"{_target_label(s)}: unreadable (fail closed)"
        newest_audit = max(float(e.get("started_at") or e["ts"]) for e in ships)
        if mtime > newest_audit + 1:
            return False, f"{_target_label(s)}: edited after the latest SHIP audit"
    return True, ""


def _eligible_ship(args: Dict[str, Any], _ttl: Any = None) -> Tuple[bool, str]:
    """Release only when every declared surface is covered. Fail closed."""
    workspace = str(_agent_cwd().resolve())
    latched = _latched_targets(workspace)
    if latched:
        return False, (f"{_target_label(latched[0])}: an audit verdict could not be written to the "
                       "ledger; re-run the audit so it records (fail closed)")
    try:
        entries = _gate_entries()
    except LedgerUnreadable:
        return False, "the verdict ledger is unreadable (fail closed)"
    renderable, sources = _declared_targets(args)
    if renderable:
        ships = []
        for t in renderable:
            ok, why, entry = _entry_for_target(entries, t, workspace)
            if not ok:
                return False, f"{_target_label(t)}: {why}"
            ships.append(entry)
        return _sources_covered(sources, [e for e in ships if e is not None], workspace)
    ships, why = _workspace_ships(entries, workspace)
    if sources:
        if not ships:
            return False, why or "no fresh SHIP in this workspace covers the declared sources"
        return _sources_covered(sources, ships, workspace)
    if not ships:
        return False, why
    return True, ""


def _on_pre_tool(tool_name: str = "", args: Optional[Dict[str, Any]] = None,
                 **hook_kw: Any) -> Optional[Dict[str, str]]:
    """Hard pre-completion gate (Hermes ``pre_tool_call``; veto contract
    ``{"action": "block", "message"}`` — the message becomes the tool result).
    Fail closed: once the call is identified as declared frontend work, any gate error
    also blocks."""
    claim: Optional[str] = None
    try:
        if not _cfg("gate_completions") or tool_name not in _COMPLETION_TOOLS:
            return None
        if not isinstance(args, dict):
            return None
        claim = _frontend_claim_reason(args, hook_kw)
        if claim is None:
            return None
        eligible, why = _eligible_ship(args)
        if eligible:
            return None
        return {"action": "block", "message": f"{_GATE_MESSAGE} Gate reason: {why} (gated because {claim})."}
    except Exception:
        logger.debug("tastecheck: pre_tool_call gate failed", exc_info=True)
        if claim:
            return {"action": "block", "message": _GATE_MESSAGE + " (gate internal error)"}
        return None


# --- tools ------------------------------------------------------------------

AUDIT_SCHEMA = {
    "name": "tastecheck_audit",
    "description": (
        "Run the Tastecheck browser ship gate against a rendered page: an http(s) URL, or an "
        "HTML file/dir inside the session workspace (served read-only over loopback for the "
        "audit). Returns SHIP/HOLD, hold reasons and probe evidence, and records the verdict "
        "for the completion gate. Read `verdict`, not `ok`: ok:true means the audit ran and "
        "comes with HOLD as often as SHIP. Needs Node >=22 and Chrome/Chromium."
    ),
    "parameters": {
        "type": "object",
        "properties": {"target": {"type": "string", "description": "URL, or workspace HTML file/dir"}},
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


def _shrink(obj: Any, str_max: int, list_max: int) -> Any:
    if isinstance(obj, str):
        return obj if len(obj) <= str_max else obj[:str_max] + f"…[+{len(obj) - str_max} chars]"
    if isinstance(obj, list):
        items = [_shrink(v, str_max, list_max) for v in obj[:list_max]]
        if len(obj) > list_max:
            items.append(f"…[+{len(obj) - list_max} items]")
        return items
    if isinstance(obj, dict):
        keys = list(obj)
        out = {k: _shrink(obj[k], str_max, list_max) for k in keys[:list_max * 5]}
        if len(keys) > list_max * 5:
            out["…"] = f"[+{len(keys) - list_max * 5} keys]"
        return out
    return obj


_CORE_KEYS = ("ok", "exit", "verdict", "outcome", "error", "evidence_dir")


def _bounded_json(res: Any, limit: int = TOOL_RESULT_MAX) -> str:
    """Serialize *res* to at most *limit* chars of valid JSON. Oversized results keep the
    verdict, hold reasons, error and evidence identity; the full result goes to a file."""
    text = json.dumps(res, ensure_ascii=False)
    if len(text) <= limit or not isinstance(res, dict):
        return text if len(text) <= limit else json.dumps({"ok": False, "error": "result too large"})
    full_path = None
    try:
        out_root = _data_dir() / "results"
        out_root.mkdir(parents=True, exist_ok=True)
        fd, full_path = tempfile.mkstemp(prefix=time.strftime("%Y%m%d-%H%M%S") + "-", suffix=".json",
                                         dir=str(out_root))
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        _prune_files(out_root)
    except Exception:
        logger.debug("tastecheck: could not save full result", exc_info=True)
        full_path = None
    data = res.get("data") if isinstance(res.get("data"), dict) else None
    pinned_data = {k: data[k] for k in ("verdict", "target", "holdReasons") if data and k in data}
    marker = {"truncated": True, "full_result_path": full_path, "original_chars": len(text)}
    for str_max, list_max in ((2000, 50), (500, 20), (200, 10), (80, 5), (40, 2)):
        slim = _shrink(res, str_max, list_max)
        if data is not None:
            slim["data"] = {**slim["data"], **_shrink(pinned_data, 500, 20)}
        out = json.dumps({**slim, **marker}, ensure_ascii=False)
        if len(out) <= limit:
            return out
    core = {k: res[k] for k in _CORE_KEYS if k in res}
    if pinned_data:
        core["data"] = _shrink(pinned_data, 200, 10)
    # Fixed key set with bounded values: always far below TOOL_RESULT_MAX, always valid JSON.
    return json.dumps(_shrink({**core, **marker}, 500, 10), ensure_ascii=False)


def _prune_files(root: Path) -> None:
    """Delete the oldest full-result files beyond AUDITS_KEEP — only among files older
    than the retention grace, so a just-written result (whose path is about to be
    returned to the caller) always survives."""
    try:
        cutoff = time.time() - _retention_grace()
        files = sorted(
            [f for f in root.iterdir() if f.is_file() and not f.name.startswith(".") and f.stat().st_mtime < cutoff],
            key=lambda f: f.name,
        )
        for f in files[:-AUDITS_KEEP]:
            f.unlink(missing_ok=True)
    except Exception:
        logger.debug("tastecheck: prune failed", exc_info=True)


def _wrap(fn):
    def handler(args: Optional[Dict[str, Any]] = None, **_: Any) -> str:
        try:
            return _bounded_json(fn(args or {}))
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


def _display_path(p: Any, redact: bool) -> Any:
    """On messaging surfaces never echo absolute local paths: show the last component."""
    if not redact or not isinstance(p, str) or not p or _is_url(p):
        return p
    return "…/" + Path(p).name


# An absolute POSIX or Windows path (not the path part of a URL): keep the last component.
_ABS_PATH_RE = re.compile(r"(?<![\w:/.~-])(?:/|[A-Za-z]:[\\/])(?:[^\s'\"`<>|/\\]+[/\\])+([^\s'\"`<>|/\\]*)")


def _redact_text(text: Any) -> str:
    """Scrub local identity from text bound for a messaging surface: the user's home,
    HERMES_HOME, the session workspace and any other absolute path."""
    s = str(text)
    roots = set()
    for r in (os.environ.get("HERMES_HOME"), str(Path.home())):
        if r:
            roots.add(r)
    try:
        roots.add(str(_agent_cwd().resolve()))
    except Exception:
        pass
    for r in sorted((r.rstrip("/\\") for r in roots if len(r.rstrip("/\\")) > 1), key=len, reverse=True):
        s = s.replace(r, "…")
    return _ABS_PATH_RE.sub(lambda m: "…/" + m.group(1), s)


def _redactor(redact: bool):
    return _redact_text if redact else str


def _fmt(res: Dict[str, Any], redact: bool = False) -> str:
    r = _redactor(redact)
    if res.get("verdict"):
        data = res.get("data") if isinstance(res.get("data"), dict) else {}
        reasons = data.get("holdReasons") or []
        lines = [str(res["verdict"])] + [f"- {r(x)}" for x in reasons[:10]]
        probes = data.get("probes") if isinstance(data.get("probes"), dict) else {}
        failed = [(n, p) for n, p in probes.items()
                  if isinstance(p, dict) and p.get("status") in {"fail", "not_run"}]
        for name, probe in failed[:8]:
            lines.append(f"  {name} ({probe.get('status')}): {r(str(probe.get('evidence') or '')[:240])}")
        if res.get("error"):
            lines.append(f"- Tastecheck failed: {r(res['error'])}")
        if res.get("ledger_error"):
            lines.append(f"- Verdict NOT recorded in the ledger ({r(res['ledger_error'])}); the completion gate stays "
                         "closed for this target until an audit records")
        lines.append(f"evidence: {_display_path(res.get('evidence_dir'), redact)}")
        return "\n".join(lines)
    if res.get("error") and "data" not in res:
        return f"Tastecheck failed: {r(res['error'])}"
    if "data" in res:
        return r(json.dumps(res["data"], indent=2, ensure_ascii=False)[:3500])
    return r(str(res.get("text", ""))[:3500])


def _status(redact: bool) -> str:
    try:
        ledger = _read_ledger()
    except LedgerUnreadable:
        return "The verdict ledger is unreadable; the next audit moves it aside and starts a new one."
    rows = []
    for e in ledger[-10:]:
        if not isinstance(e, dict):
            continue
        rows.append({
            "ts": e.get("ts"), "verdict": e.get("verdict"), "source": e.get("source"),
            "target": _display_path(e.get("target"), redact),
            "workspace": _display_path(e.get("workspace"), redact),
            "evidence_dir": _display_path(e.get("evidence_dir"), redact),
            "hold_reasons": [_redact_text(x) if redact else x for x in (e.get("hold_reasons") or [])],
            **({"error": _redact_text(e["error"]) if redact else e["error"]} if e.get("error") else {}),
        })
    return json.dumps(rows, indent=2, ensure_ascii=False)


class _ArgError(ValueError):
    pass


def _one_arg(rest: str) -> Optional[str]:
    """At most ONE argument. Backslashes are literal (Windows paths survive); a path with
    spaces must be wrapped in matching quotes. Anything else is an error, never ignored."""
    rest = rest.strip()
    if not rest:
        return None
    q = rest[0]
    if q in "\"'":
        if len(rest) >= 2 and rest.endswith(q) and q not in rest[1:-1]:
            return rest[1:-1]
        raise _ArgError("unbalanced quotes")
    if re.search(r"\s", rest):
        raise _ArgError('one argument only; quote a path with spaces, e.g. /tastecheck audit "site/my page.html"')
    return rest


def _messaging(platform: Any = None, source: Any = None) -> bool:
    """Is this slash call on a human messaging surface? The dispatcher's own platform /
    source kwargs win; otherwise the session identity decides (default-deny)."""
    given = [str(v).strip().lower() for v in (platform, source) if isinstance(v, str) and v.strip()]
    if given:
        return any(v not in _NON_MESSAGING for v in given)
    return _on_gateway()


def _slash(raw_args: str = "", platform: Any = None, source: Any = None, **_: Any) -> str:
    try:
        gateway = _messaging(platform, source)
    except Exception:
        gateway = True
    try:
        return _slash_inner(raw_args, gateway)
    except Exception as exc:
        logger.debug("tastecheck slash failed", exc_info=True)
        return f"Tastecheck hit an unexpected {type(exc).__name__}; see the Hermes log."


def _slash_inner(raw_args: str, gateway: bool) -> str:
    head = re.split(r"\s+", str(raw_args or "").strip(), maxsplit=1)
    cmd = head[0].lower() if head and head[0] else "help"
    rest = head[1] if len(head) > 1 else ""
    if cmd in {"help", "-h", "--help"}:
        return _HELP
    if cmd not in _SAFE_SLASH:
        return f"Unknown or blocked subcommand `{cmd[:40]}`. Allowed: {', '.join(sorted(_SAFE_SLASH))}."
    if cmd == "audit" and gateway and not _cfg("allow_audit_slash_on_gateway"):
        return ("/tastecheck audit is disabled on gateway platforms (opens local files/URLs). "
                "Ask the agent to use the tool instead, or set allow_audit_slash_on_gateway: true.")
    try:
        if cmd in {"status", "version"} and rest.strip():
            raise _ArgError(f"/tastecheck {cmd} takes no arguments")
        if cmd == "status":
            return _status(redact=gateway)
        if cmd == "version":
            return _fmt(version(), redact=gateway)
        if cmd == "profile":
            return _fmt(profile(_one_arg(rest) or "show"), redact=gateway)
        if cmd == "audit":
            target = _one_arg(rest)
            if not target:
                return 'Usage: /tastecheck audit <url-or-path>  (quote paths with spaces: "site/my page.html")'
            return _fmt(audit(target, source="slash"), redact=gateway)
    except _ArgError as exc:
        return f"Could not parse arguments ({exc}).\n\n{_HELP}"
    except ValueError as exc:
        msg = _redact_text(exc) if gateway else str(exc)
        return f"{msg}\n\n{_HELP}"
    return _HELP


# --- register ---------------------------------------------------------------

def register(ctx) -> None:
    global _ctx
    _ctx = ctx
    ctx.register_hook("pre_llm_call", _on_pre_llm)
    ctx.register_hook("pre_tool_call", _on_pre_tool)
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
