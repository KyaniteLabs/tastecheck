"""Load the plugin against the vendored Hermes v0.21.6 runtime (gateway / agent ContextVars)."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import time
from pathlib import Path

import pytest

PLUGIN_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DIR = Path(__file__).resolve().parent / "hermes_runtime"


class FakeCtx:
    def __init__(self, config=None):
        self.config = dict(config or {})
        self.hooks = []
        self.commands = []
        self.tools = []
        self.skills = []

    def get_config(self, key, default=None):
        return self.config.get(key, default)

    def register_hook(self, name, callback):
        self.hooks.append((name, callback))

    def register_command(self, name, handler=None, **_):
        self.commands.append(name)

    def register_tool(self, name=None, **_):
        self.tools.append(name)

    def register_skill(self, name, path):
        self.skills.append(name)


@pytest.fixture
def hermes_home(tmp_path, monkeypatch):
    home = tmp_path / "hermes-home"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    for var in ("HERMES_PLATFORM", "HERMES_SESSION_PLATFORM", "HERMES_SESSION_SOURCE", "TERMINAL_CWD"):
        monkeypatch.delenv(var, raising=False)
    return home


@pytest.fixture
def runtime(monkeypatch):
    """Real Hermes session_context / runtime_cwd modules, reset per test."""
    monkeypatch.syspath_prepend(str(RUNTIME_DIR))
    for name in list(sys.modules):
        if name in {"gateway", "agent"} or name.startswith(("gateway.", "agent.")):
            monkeypatch.delitem(sys.modules, name)
    from gateway import session_context

    session_context.reset_session_vars()
    yield session_context
    session_context.reset_session_vars()


@pytest.fixture
def ws(tmp_path):
    """The session workspace (agent cwd) every plugin test runs in."""
    d = tmp_path / "ws"
    d.mkdir(exist_ok=True)
    return d


@pytest.fixture
def plugin(hermes_home, runtime, ws, monkeypatch):
    monkeypatch.setenv("TERMINAL_CWD", str(ws))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    name = "tastecheck_hermes_plugin"
    sys.modules.pop(name, None)
    spec = importlib.util.spec_from_file_location(name, PLUGIN_DIR / "__init__.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    mod._ctx = FakeCtx()
    yield mod
    sys.modules.pop(name, None)


@pytest.fixture
def fake_cli(plugin, tmp_path):
    """Point tastecheck_command at a python stand-in script; returns a writer."""

    def make(body: str, **config):
        script = tmp_path / f"fake_cli_{len(list(tmp_path.glob('fake_cli_*')))}.py"
        script.write_text("import json, os, sys, time, subprocess\n" + body, encoding="utf-8")
        plugin._ctx = FakeCtx({"tastecheck_command": f"{sys.executable} {script}", **config})
        return script

    return make


# A stand-in CLI that behaves like the real one over HTTP: fetches the target (and the
# href/src references in it) from the loopback server, then prints evidence for it.
FETCHING_CLI = """
import re, urllib.parse, urllib.request
tgt, out = sys.argv[2], sys.argv[3]
VERDICT = os.environ.get("FAKE_VERDICT", "{verdict}")
op = urllib.request.build_opener(urllib.request.ProxyHandler({{}}))
if tgt.startswith("http://127.0.0.1"):
    html = op.open(tgt, timeout=10).read().decode("utf-8", "replace")
    for ref in re.findall(r'(?:href|src)="([^"]+)"', html):
        try:
            op.open(urllib.parse.urljoin(tgt, ref), timeout=10).read()
        except Exception:
            pass
{extra}
print(json.dumps({{"verdict": VERDICT, "holdReasons": [] if VERDICT == "SHIP" else ["x"], "target": tgt}}))
sys.exit(0 if VERDICT == "SHIP" else 1)
"""


def fetching_cli(verdict="SHIP", extra=""):
    return FETCHING_CLI.format(verdict=verdict, extra=extra)


def put_entry(plugin, target, verdict="SHIP", age=0, source="tool", **extra):
    """A ledger entry written by the REAL recorder (signed, workspace + sha256 binding),
    then patched and RE-SIGNED the way only the plugin itself can."""
    plugin.record_verdict(str(target), {"outcome": verdict}, source=source)
    ledger = json.loads(plugin._ledger_path().read_text(encoding="utf-8"))
    e = ledger[-1]
    e.pop("sig", None)
    e.update(extra)
    if age:
        e["ts"] = int(time.time()) - age
        e["started_at"] = e["ts"]
    plugin._sign_entry(e)
    plugin._save_json(plugin._ledger_path(), ledger)
    return e


def page(ws, rel="index.html", body="<html><body>hi</body></html>"):
    p = ws / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")
    return p
