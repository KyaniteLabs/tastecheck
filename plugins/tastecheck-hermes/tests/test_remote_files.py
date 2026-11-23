"""Read-only workspace files for a remote Desktop: shapes and confinement."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[1] / "dashboard" / "plugin_api.py"


@pytest.fixture
def api(monkeypatch, tmp_path):
    pytest.importorskip("fastapi")
    pytest.importorskip("pydantic")
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    name = "tastecheck_dashboard_files_test"
    spec = importlib.util.spec_from_file_location(name, API)
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    mod.HOME = home
    return mod


def _ws(api):
    ws = api.HOME / "work" / "site"
    (ws / "src").mkdir(parents=True)
    (ws / "node_modules").mkdir()
    (ws / "index.html").write_text("<h1>hi</h1>", encoding="utf-8")
    (ws / "src" / "app.css").write_text("h1{color:red}", encoding="utf-8")
    (ws / "secret.env").write_text("TOKEN=x", encoding="utf-8")
    return ws


def call(api, op, cwd, path=""):
    fn = {"root": api.files_root, "list": api.files_list, "stat": api.files_stat, "read": api.files_read}[op]
    return fn(api.FilesRequest(cwd=str(cwd), path=path))


def test_list_stat_read_match_ctx_files_shapes(api):
    ws = _ws(api)
    assert call(api, "root", ws) == {"ok": True, "path": str(ws.resolve())}
    listed = call(api, "list", ws)
    assert listed["ok"] and not listed["truncated"]
    names = {e["name"]: e["isDirectory"] for e in listed["entries"]}
    assert names == {"index.html": False, "node_modules": True, "src": True}
    st = call(api, "stat", ws, "index.html")
    assert st["ok"] and st["exists"] and st["mtimeMs"] > 0 and st["size"] == 11
    assert call(api, "stat", ws, "gone.html") == {"ok": True, "exists": False}
    rd = call(api, "read", ws, "src/app.css")
    assert rd["ok"] and rd["text"] == "h1{color:red}"


@pytest.mark.parametrize("path", ["../outside.html", "/etc/passwd", "src/../../x.html", "a\\b.html"])
def test_escapes_are_refused(api, path):
    ws = _ws(api)
    (ws.parent / "outside.html").write_text("no", encoding="utf-8")
    res = call(api, "read", ws, path)
    assert res["ok"] is False and res["error"] in ("bad-path", "outside-workspace")


def test_symlink_out_of_workspace_is_refused(api):
    ws = _ws(api)
    secret = api.HOME / "private.html"
    secret.write_text("private", encoding="utf-8")
    os.symlink(secret, ws / "link.html")
    res = call(api, "read", ws, "link.html")
    assert res == {"ok": False, "error": "outside-workspace", "message": res["message"]}


def test_only_html_and_css_are_readable(api):
    ws = _ws(api)
    assert call(api, "read", ws, "secret.env")["error"] == "refused"
    assert call(api, "stat", ws, "secret.env")["error"] == "refused"


@pytest.mark.parametrize("cwd", ["relative/dir", "/", "/etc"])
def test_root_must_be_under_home(api, cwd):
    res = call(api, "list", cwd)
    assert res["ok"] is False and res["error"] in ("bad-path", "outside-home")


def test_home_itself_and_hermes_data_are_refused(api):
    (api.HOME / ".hermes-org" / "x").mkdir(parents=True)
    assert call(api, "list", api.HOME)["error"] == "outside-home"
    assert call(api, "list", api.HOME / ".hermes-org" / "x")["error"] == "protected"


def test_large_file_is_refused(api):
    ws = _ws(api)
    (ws / "big.html").write_bytes(b"x" * (api._MAX_READ + 1))
    assert call(api, "read", ws, "big.html")["error"] == "too-large"
