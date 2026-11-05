"""Load the plugin against the vendored Hermes v0.21.6 runtime (gateway / agent ContextVars)."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import pytest

PLUGIN_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DIR = Path(__file__).resolve().parent / "hermes_runtime"


class FakeCtx:
    def __init__(self, config=None):
        self.config = dict(config or {})

    def get_config(self, key, default=None):
        return self.config.get(key, default)


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
def plugin(hermes_home, runtime):
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
