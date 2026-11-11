"""Regressions for the 2026-11-10 Opus + Sol roast: every path here used to fail OPEN."""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pytest
from conftest import page, put_entry


def _gate(plugin, args, tool="kanban_complete"):
    return plugin._on_pre_tool(tool, args, task_id="t_roast")


def _blocked(res, *needles):
    assert res and res["action"] == "block", res
    for n in needles:
        assert n in res["message"], (n, res["message"])


def _board(monkeypatch, get_task, path_for=None):
    db_mod = types.ModuleType("hermes_cli.kanban_db")
    db_mod.kanban_db_path = path_for
    db_mod.get_task = get_task
    pkg = types.ModuleType("hermes_cli")
    pkg.kanban_db = db_mod
    monkeypatch.setitem(sys.modules, "hermes_cli", pkg)
    monkeypatch.setitem(sys.modules, "hermes_cli.kanban_db", db_mod)


def test_real_skill_namespace_marks_the_card(plugin, tmp_path, monkeypatch):
    import sqlite3
    db = tmp_path / "k.db"
    sqlite3.connect(db).close()
    _board(monkeypatch, lambda conn, tid: types.SimpleNamespace(
        body="", skills=["tastecheck-hermes:tastecheck"]), lambda board=None: db)
    _blocked(_gate(plugin, {"task_id": "t_roast"}), "carries the tastecheck skill")


def test_unreadable_board_vetoes_instead_of_releasing(plugin, tmp_path, monkeypatch):
    import sqlite3
    db = tmp_path / "k.db"
    sqlite3.connect(db).close()

    def boom(conn, tid):
        raise sqlite3.DatabaseError("database disk image is malformed")

    _board(monkeypatch, boom, lambda board=None: db)
    _blocked(_gate(plugin, {"task_id": "t_roast"}), "could not be read from its board")


def test_missing_source_is_never_covered(plugin, ws):
    p = page(ws)
    put_entry(plugin, p)
    ghost = ws / "src" / "Gone.tsx"
    _blocked(_gate(plugin, {"metadata": {"target": str(p), "changed_files": [str(ghost)]}}),
             "missing or not a file")


def test_source_outside_workspace_is_never_covered(plugin, ws, tmp_path):
    p = page(ws)
    put_entry(plugin, p)
    outside = tmp_path / "elsewhere" / "theme.css"
    outside.parent.mkdir()
    outside.write_text("body{}")
    import os
    import time
    old = time.time() - 3600
    os.utime(outside, (old, old))
    _blocked(_gate(plugin, {"metadata": {"target": str(p), "changed_files": [str(outside)]}}),
             "outside this workspace")


def test_record_keeps_first_digest_and_flags_conflict_and_overflow(plugin, ws, monkeypatch):
    srv = plugin._ConfinedServer(ws)
    try:
        a = ws / "a.css"
        srv.record(a, b"one")
        first = srv.served[str(a)]
        srv.record(a, b"two")
        assert srv.served[str(a)] == first and srv.conflict
        monkeypatch.setattr(plugin, "SERVED_MAX", 1)
        srv.record(ws / "b.css", b"x")
        assert srv.overflow and str(ws / "b.css") not in srv.served
    finally:
        srv.httpd.server_close()


def test_lost_verdict_latches_a_veto_until_the_next_recorded_audit(plugin, ws, monkeypatch):
    p = page(ws)
    put_entry(plugin, p)  # an older SHIP
    assert _gate(plugin, {"metadata": {"target": str(p)}}) is None

    def fail(*a, **k):
        raise OSError("disk full")

    monkeypatch.setattr(plugin, "run_tastecheck", lambda args, timeout=None: {
        "ok": True, "exit": 1, "data": {"verdict": "HOLD", "target": args[1], "holdReasons": ["contrast"]}})
    real = plugin.record_verdict
    monkeypatch.setattr(plugin, "record_verdict", fail)
    res = plugin.audit(str(p))
    assert res["verdict"] == "HOLD" and "ledger_error" in res
    assert "ledger" in plugin._fmt(res)
    _blocked(_gate(plugin, {"metadata": {"target": str(p)}}), "could not be written")
    plugin._LATCH.clear()  # a fresh process still sees the on-disk latch
    _blocked(_gate(plugin, {"metadata": {"target": str(p)}}), "could not be written")
    monkeypatch.setattr(plugin, "record_verdict", real)
    put_entry(plugin, p)
    assert _gate(plugin, {"metadata": {"target": str(p)}}) is None


def test_long_targets_keep_full_identity(plugin, ws):
    deep = "d/" * 160 + "index.html"
    p = page(ws, deep)
    e = put_entry(plugin, p)
    assert e["target"] == str(p.resolve()) and len(e["target"]) > 300
    assert _gate(plugin, {"metadata": {"target": str(p)}}) is None


def test_outside_path_existence_is_not_revealed(plugin, ws, tmp_path):
    with pytest.raises(ValueError) as a:
        plugin._resolve_target(str(tmp_path / "nope.html"))
    with pytest.raises(ValueError) as b:
        plugin._resolve_target(str(tmp_path))
    assert str(a.value) == str(b.value)


def test_ledger_evicts_inert_rows_first(plugin, ws, monkeypatch):
    monkeypatch.setattr(plugin, "LEDGER_MAX", 3)
    p = page(ws)
    put_entry(plugin, p)                      # the gate verdict we must keep
    plugin.record_verdict("x", {"outcome": "SHIP"}, source="roll-audit")
    plugin.record_verdict("y", {"error": "boom"})  # ERROR
    plugin.record_verdict("z", {"outcome": "HOLD"})
    rows = json.loads(plugin._ledger_path().read_text())
    assert len(rows) == 3
    assert any(r["target"] == str(p.resolve()) and r["verdict"] == "SHIP" for r in rows)


def test_truncated_key_names_the_file(plugin):
    plugin._ledger_key()
    plugin._key_path().write_text("short")
    with pytest.raises(RuntimeError, match="ledger.key"):
        plugin._ledger_key()


# --- slash parsing and redaction ----------------------------------------------

def test_one_arg_keeps_windows_paths_and_quoted_spaces(plugin):
    assert plugin._one_arg(r"C:\site\index.html") == r"C:\site\index.html"
    assert plugin._one_arg('"site/my page.html"') == "site/my page.html"
    assert plugin._one_arg("") is None
    with pytest.raises(plugin._ArgError):
        plugin._one_arg("a.html b.html")
    with pytest.raises(plugin._ArgError):
        plugin._one_arg('"site/my page.html')


def test_slash_rejects_extra_args_instead_of_dropping_them(plugin):
    out = plugin._slash("audit a.html b.html", platform="cli")
    assert out.startswith("Could not parse arguments"), out
    assert plugin._slash("status now", platform="cli").startswith("Could not parse arguments")
    assert plugin._slash("version x", platform="cli").startswith("Could not parse arguments")


def test_slash_platform_kwarg_decides_gateway(plugin):
    assert "disabled on gateway platforms" in plugin._slash("audit index.html", platform="telegram")
    assert "Usage: /tastecheck audit" in plugin._slash("audit", platform="cli")


def test_redaction_scrubs_local_paths_but_not_urls(plugin, ws, monkeypatch):
    monkeypatch.setenv("HOME", str(ws.parent))
    s = plugin._redact_text(f"failed at {ws}/site/index.html and /etc/secret/key.pem; see https://example.com/a/b.css")
    assert str(ws) not in s and "/etc/secret" not in s
    assert "index.html" in s and "key.pem" in s
    assert "https://example.com/a/b.css" in s


def test_message_text_reads_multimodal_lists(plugin):
    msg = [{"type": "image_url", "image_url": {"url": "data:,"}}, {"type": "text", "text": "hello"}, "world"]
    assert plugin._message_text(msg) == "hello\nworld"
    assert plugin._message_text(None) == ""
    assert plugin._on_pre_llm(msg) is None or "context" in plugin._on_pre_llm(msg)


def test_child_tmpdir_is_owned_and_removed(plugin, fake_cli, tmp_path):
    marker = tmp_path / "tmpdir.txt"
    fake_cli(f"""
d = os.environ["TMPDIR"]
open(os.path.join(d, "chrome-profile-stray"), "w").write("x")
open({str(marker)!r}, "w").write(d)
print(json.dumps({{"version": "fake"}}))
""")
    plugin.run_tastecheck(["--version"])
    used = Path(marker.read_text())
    assert used.name.startswith("tc-")
    assert not used.exists(), "the child's TMPDIR must be removed after the run"


# --- confined server: data files only from the page's own directory -------------

def test_data_files_serve_only_from_the_page_directory(plugin, ws):
    (ws / "config.json").write_text('{"token": "x"}', encoding="utf-8")
    (ws / "notes.txt").write_text("private", encoding="utf-8")
    site = ws / "site"
    page(ws, "site/index.html")
    (site / "data.json").write_text("{}", encoding="utf-8")
    (ws / "shared.css").write_text("body{}", encoding="utf-8")
    srv = plugin._ConfinedServer(ws, data_root=site)
    assert srv.lookup("/config.json") is None
    assert srv.lookup("/notes.txt") is None
    assert srv.lookup("/site/data.json") is not None
    assert srv.lookup("/shared.css") is not None, "web assets elsewhere in the workspace still serve"


# --- dashboard roll audit -----------------------------------------------------

def _api(monkeypatch):
    import importlib.util
    pytest.importorskip("fastapi")
    pytest.importorskip("pydantic")
    name = "tastecheck_dashboard_api_roast"
    spec = importlib.util.spec_from_file_location(
        name, Path(__file__).resolve().parents[1] / "dashboard" / "plugin_api.py")
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    return mod


def test_roll_audit_refuses_columns_with_relative_subresources(plugin, monkeypatch, hermes_home):
    api = _api(monkeypatch)
    res = api.roll_audit(api.RollAuditRequest(html='<img src="hero.png"><img src="data:image/png;base64,A,B">'))
    assert res.verdict == "HOLD" and "not self-contained" in res.error and "hero.png" in res.error
    assert not (hermes_home / "plugin-data" / "tastecheck-hermes" / "roll-audits").exists() or not any(
        (hermes_home / "plugin-data" / "tastecheck-hermes" / "roll-audits").iterdir())
    assert api._relative_subresources('<div data-src="x"><a href="x.html">') == []
    assert api._relative_subresources('<img srcset="a.png 1x, https://c/b.png 2x">') == ["a.png"]


def test_roll_audit_busy_returns_hold_fast(plugin, monkeypatch):
    api = _api(monkeypatch)
    monkeypatch.setattr(api, "_LOCK_WAIT_S", 0.05)
    assert api._audit_lock.acquire(timeout=1)
    try:
        res = api.roll_audit(api.RollAuditRequest(html="<html><body>x</body></html>"))
    finally:
        api._audit_lock.release()
    assert res.verdict == "HOLD" and "gate busy" in res.error


def test_health_never_raises(monkeypatch):
    api = _api(monkeypatch)
    monkeypatch.setattr(api, "_load_agent_half", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    out = api.health()
    assert out["ok"] is False and "RuntimeError" in out["error"]


def test_prune_keeps_the_active_dir(tmp_path, monkeypatch):
    api = _api(monkeypatch)
    root = tmp_path / "ra"
    dirs = [root / f"2026{i:04d}" for i in range(45)]
    for d in dirs:
        d.mkdir(parents=True)
    active = root / "00000000-oldest-name-but-active"
    active.mkdir()
    api._prune_roll_files(root, active=active)
    left = sorted(d.name for d in root.iterdir())
    assert active.name in left and len(left) == 40


def test_env_task_ignored_where_the_kanban_tool_ignores_it(plugin, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_abc123")
    kt = types.ModuleType("tools.kanban_tools")
    kt._is_delegated_child_context = lambda: True
    kt._is_dispatcher_owned_worker = lambda: True
    tools_pkg = types.ModuleType("tools")
    tools_pkg.kanban_tools = kt
    monkeypatch.setitem(sys.modules, "tools", tools_pkg)
    monkeypatch.setitem(sys.modules, "tools.kanban_tools", kt)
    assert plugin._resolve_kanban_task_id({}, {}) == ""
    kt._is_delegated_child_context = lambda: False
    kt._is_dispatcher_owned_worker = lambda: False  # cron beside a worker
    assert plugin._resolve_kanban_task_id({}, {}) == ""
    kt._is_dispatcher_owned_worker = lambda: True
    assert plugin._resolve_kanban_task_id({}, {}) == "t_abc123"
    assert plugin._resolve_kanban_task_id({"task_id": "t_explicit1"}, {}) == "t_explicit1"
