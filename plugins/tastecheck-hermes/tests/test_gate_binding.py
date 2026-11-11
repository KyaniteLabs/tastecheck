"""Completion-gate binding: the gate releases a completion only when every frontend
surface it DECLARES has a fresh, signed, identity-valid SHIP — latest-wins per
artifact, fail closed. All controls go through the registered hook callback
``_on_pre_tool`` (the pre_tool_call entry), not private helpers."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import sys
import time
import types

from conftest import page, put_entry


def _done(**kw):
    base = {"task_id": "t_gatectl", "summary": "Finished and verified all acceptance criteria"}
    base.update(kw)
    return base


def _gate(plugin, args, hook_task="t_gatectl", tool="kanban_complete"):
    return plugin._on_pre_tool(tool, args, task_id=hook_task)


def _blocked(res, *needles):
    assert res and res["action"] == "block", res
    for n in needles:
        assert n in res["message"], (n, res["message"])
    return res


# --- what counts as a frontend claim ------------------------------------------

def test_ui_vocabulary_alone_never_vetoes(plugin):
    """P1-1: words in the summary are advisory only. 'Updated the dashboard design
    docs' on a backend card must not be blocked (it was, via _UI_RE)."""
    for summary in ("Landing page redesign done, ready to ship",
                    "Updated the dashboard design docs", "Fixed the page cache"):
        assert _gate(plugin, _done(summary=summary)) is None


def test_json_keys_never_trigger_the_gate(plugin):
    """P1-1: the old check scanned json.dumps(args) — including KEYS such as
    'layout' or 'component'. Keys are never inspected now."""
    args = _done(metadata={"layout": "n/a", "component": "billing", "design_doc": "ADR-12"})
    assert _gate(plugin, args) is None


def test_non_frontend_artifacts_are_ignored(plugin, ws):
    args = _done(metadata={"changed_files": [str(ws / "server.py"), "README.md", "docs/page.md"]})
    assert _gate(plugin, args) is None


def test_declared_html_artifact_triggers_gate(plugin, ws):
    p = page(ws)
    _blocked(_gate(plugin, _done(metadata={"changed_files": [str(p)]})), "no ledger verdict is bound")


def test_explicit_flag_triggers_gate(plugin):
    _blocked(_gate(plugin, _done(metadata={"tastecheck": True})), "metadata.tastecheck")
    _blocked(_gate(plugin, _done(metadata={"frontend": True})))
    assert _gate(plugin, _done(metadata={"tastecheck": False})) is None


def test_request_review_is_gated_too(plugin):
    _blocked(_gate(plugin, _done(metadata={"tastecheck": True}), tool="kanban_request_review"))


def test_other_tools_are_never_gated(plugin, ws):
    p = page(ws)
    assert plugin._on_pre_tool("terminal", {"command": "open the landing page", "target": str(p)}) is None
    assert plugin._on_pre_tool("write_file", {"path": str(p)}) is None


# --- card marker (read-only kanban lookup) -------------------------------------

def _fake_board(monkeypatch, tmp_path, tasks, seen=None):
    """A REAL sqlite board file per board name; get_task is faked but receives the
    actual connection so the test can check it is read-only."""
    db_mod = types.ModuleType("hermes_cli.kanban_db")

    def path_for(board=None):
        p = tmp_path / f"kanban-{board or 'default'}.db"
        if not p.exists():
            sqlite3.connect(p).close()
        return p

    def get_task(conn, task_id):
        if seen is not None:
            try:
                conn.execute("CREATE TABLE probe (x)")
                seen.append("writable")
            except sqlite3.OperationalError:
                seen.append("read-only")
            seen.append(conn.execute("PRAGMA database_list").fetchone()[2])
        return tasks.get(task_id)

    db_mod.kanban_db_path = path_for
    db_mod.get_task = get_task
    pkg = types.ModuleType("hermes_cli")
    pkg.kanban_db = db_mod
    monkeypatch.setitem(sys.modules, "hermes_cli", pkg)
    monkeypatch.setitem(sys.modules, "hermes_cli.kanban_db", db_mod)


def _task(title="", body="", skills=None):
    return types.SimpleNamespace(title=title, body=body, skills=skills)


def test_card_marker_body_line_gates(plugin, tmp_path, monkeypatch):
    _fake_board(monkeypatch, tmp_path, {"t_gatectl": _task(body="Build it.\ntastecheck: required\n")})
    _blocked(_gate(plugin, _done()), "tastecheck: required")


def test_card_skill_marker_gates(plugin, tmp_path, monkeypatch):
    _fake_board(monkeypatch, tmp_path, {"t_gatectl": _task(skills=["tastecheck-pass"])})
    _blocked(_gate(plugin, _done()), "carries the tastecheck skill")


def test_frontend_words_on_card_without_marker_do_not_gate(plugin, tmp_path, monkeypatch):
    """P1-1: a card titled 'Redesign the marketing landing page' is not a declaration."""
    _fake_board(monkeypatch, tmp_path,
                {"t_gatectl": _task(title="Redesign the marketing landing page", body="Ship the hero.")})
    assert _gate(plugin, _done()) is None


def test_card_lookup_is_read_only_and_uses_args_board(plugin, tmp_path, monkeypatch):
    """P3-13: the lookup opens the DB mode=ro and on the board the call targets."""
    seen = []
    _fake_board(monkeypatch, tmp_path, {"t_gatectl": _task(body="tastecheck: required")}, seen)
    _blocked(_gate(plugin, _done(board="design")))
    assert seen[0] == "read-only"
    assert seen[1].endswith("kanban-design.db")


def test_uuid_hook_id_never_overrides_explicit_card_id(plugin, tmp_path, monkeypatch):
    _fake_board(monkeypatch, tmp_path, {"t_gatectl": _task(body="tastecheck: required")})
    _blocked(_gate(plugin, _done(), hook_task="123e4567-e89b-12d3-a456-426614174000"))


def test_env_default_resolves_card_when_args_omit_task_id(plugin, tmp_path, monkeypatch):
    _fake_board(monkeypatch, tmp_path, {"t_gatectl": _task(body="tastecheck: required")})
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_gatectl")
    args = {"summary": "Finished"}
    _blocked(plugin._on_pre_tool("kanban_complete", args, task_id="123e4567-e89b-12d3-a456-426614174000"))


def test_unknown_task_is_not_gated(plugin, tmp_path, monkeypatch):
    _fake_board(monkeypatch, tmp_path, {})
    assert _gate(plugin, _done(task_id="t_nope1234"), hook_task="t_nope1234") is None


# --- per-artifact binding --------------------------------------------------------

def test_gate_blocks_ship_for_a_different_artifact(plugin, ws):
    a = page(ws, "project-a/index.html", "<html><body>A</body></html>")
    b = page(ws, "project-b/index.html", "<html><body>B</body></html>")
    put_entry(plugin, a)
    _blocked(_gate(plugin, _done(metadata={"target": str(b)})), "no ledger verdict is bound")


def test_directory_target_binds_its_index_html(plugin, ws):
    """P1-4: a directory artifact means its index.html and gets the digest check."""
    a = page(ws, "site/index.html")
    put_entry(plugin, a)
    assert _gate(plugin, _done(metadata={"target": str(ws / "site")})) is None
    a.write_text("<html><body>edited</body></html>", encoding="utf-8")
    _blocked(_gate(plugin, _done(metadata={"target": str(ws / "site")})), "changed after its SHIP")


def test_gate_blocks_when_newer_hold_supersedes_ship(plugin, ws):
    b = page(ws)
    put_entry(plugin, b, "SHIP", age=100)
    put_entry(plugin, b, "HOLD", hold_reasons=["focus ring invisible on buttons"])
    _blocked(_gate(plugin, _done(metadata={"target": str(b)})), "latest matching verdict is HOLD", "focus ring")


def test_gate_allows_matching_fresh_ship(plugin, ws):
    b = page(ws)
    put_entry(plugin, b)
    assert _gate(plugin, _done(metadata={"target": str(b)})) is None


def test_gate_blocks_when_artifact_changed_after_ship(plugin, ws):
    b = page(ws, body="<html><body>v1</body></html>")
    put_entry(plugin, b)
    b.write_text("<html><body>v2</body></html>", encoding="utf-8")
    _blocked(_gate(plugin, _done(metadata={"target": str(b)})), "changed after its SHIP")


def test_served_subresource_change_revokes_ship(plugin, ws):
    """P1-4: CSS served during the SHIP audit is bound by hash."""
    b = page(ws)
    css = page(ws, "app.css", "body{color:#111}")
    put_entry(plugin, b, served={str(b): hashlib.sha256(b.read_bytes()).hexdigest(),
                                 str(css): hashlib.sha256(css.read_bytes()).hexdigest()})
    assert _gate(plugin, _done(metadata={"target": str(b)})) is None
    css.write_text("body{color:red}", encoding="utf-8")
    _blocked(_gate(plugin, _done(metadata={"target": str(b)})), "app.css")


def test_every_named_artifact_needs_its_own_ship(plugin, ws):
    a = page(ws, "a.html")
    b = page(ws, "b.html")
    put_entry(plugin, a)
    _blocked(_gate(plugin, _done(artifacts=[str(a), str(b)])), "b.html")


def test_newer_ship_for_other_artifact_does_not_clear_older_hold(plugin, ws):
    a = page(ws, "a.html")
    b = page(ws, "b.html")
    put_entry(plugin, a, "HOLD", age=100, hold_reasons=["contrast 2.9:1"])
    put_entry(plugin, b)
    _blocked(_gate(plugin, _done(artifacts=[str(a), str(b)])), "latest matching verdict is HOLD")


def test_deleted_audited_artifact_fails_closed(plugin, ws):
    a = page(ws, "a.html")
    put_entry(plugin, a)
    a.unlink()
    _blocked(_gate(plugin, _done(metadata={"target": str(a)})), "missing or unreadable")


def test_missing_digest_fails_closed(plugin, ws):
    a = page(ws, "a.html")
    put_entry(plugin, a)
    import json
    ledger = json.loads(plugin._ledger_path().read_text())
    ledger[-1].pop("target_sha256")
    ledger[-1].pop("sig")
    plugin._sign_entry(ledger[-1])
    plugin._save_json(plugin._ledger_path(), ledger)
    _blocked(_gate(plugin, _done(metadata={"target": str(a)})), "lacks a content digest")


def test_relative_artifact_binds_absolute_twin(plugin, ws):
    f = page(ws, "page.html")
    plugin.record_verdict("page.html", {"outcome": "SHIP"})
    import json
    (entry,) = json.loads(plugin._ledger_path().read_text())
    assert entry["target"] == str(f)
    assert _gate(plugin, _done(metadata={"target": str(f)})) is None
    assert _gate(plugin, _done(metadata={"target": "page.html"})) is None


# --- frontend sources ------------------------------------------------------------

def test_one_page_ship_covers_its_served_sources(plugin, ws):
    """P1-4: three CSS files loaded by one audited page need ONE SHIP, not three."""
    b = page(ws)
    css = [page(ws, f"c{i}.css", f".c{i}{{}}") for i in range(3)]
    served = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in [b, *css]}
    put_entry(plugin, b, served=served)
    assert _gate(plugin, _done(metadata={"changed_files": [str(p) for p in css]})) is None
    css[1].write_text(".changed{}", encoding="utf-8")
    _blocked(_gate(plugin, _done(metadata={"changed_files": [str(p) for p in css]})), "c1.css")


def test_unserved_source_needs_mtime_before_audit(plugin, ws):
    """Compiled sources (.tsx) are never served; they are covered when last edited
    before the newest SHIP audit started."""
    b = page(ws)
    tsx = page(ws, "src/App.tsx", "export default 1")
    old = time.time() - 600
    os.utime(tsx, (old, old))
    put_entry(plugin, b)
    assert _gate(plugin, _done(metadata={"changed_files": [str(tsx)]})) is None
    tsx.write_text("export default 2", encoding="utf-8")
    future = time.time() + 60
    os.utime(tsx, (future, future))
    _blocked(_gate(plugin, _done(metadata={"changed_files": [str(tsx)]})), "edited after the latest SHIP")


def test_source_without_any_ship_blocks(plugin, ws):
    tsx = page(ws, "src/App.tsx", "export default 1")
    _blocked(_gate(plugin, _done(metadata={"changed_files": [str(tsx)]})))


# --- URL targets --------------------------------------------------------------------

def test_explicit_url_target_binds_by_identity(plugin):
    put_entry(plugin, "http://127.0.0.1:5173/project-a")
    _blocked(_gate(plugin, _done(metadata={"target": "http://127.0.0.1:5173/project-b"})),
             "no ledger verdict is bound")
    assert _gate(plugin, _done(metadata={"target": "http://127.0.0.1:5173/project-a"})) is None
    # A trailing slash is a different URL (it can resolve to a different page): no carry-over.
    _blocked(_gate(plugin, _done(metadata={"target": "http://127.0.0.1:5173/project-a/"})),
             "no ledger verdict is bound")


def test_url_ship_has_short_ttl(plugin):
    """P2-12: a URL's content cannot be hashed, so its SHIP expires after 30 min."""
    put_entry(plugin, "http://127.0.0.1:5173", age=31 * 60)
    _blocked(_gate(plugin, _done(metadata={"target": "http://127.0.0.1:5173"})), "stale")


def test_url_ship_bound_to_its_workspace(plugin, tmp_path):
    put_entry(plugin, "http://127.0.0.1:5173", workspace=str(tmp_path / "elsewhere"))
    _blocked(_gate(plugin, _done(metadata={"target": "http://127.0.0.1:5173"})), "no ledger verdict is bound")


# --- flag/marker-only workspace fallback ---------------------------------------------

def test_flag_only_needs_a_ship_in_this_workspace(plugin, tmp_path):
    put_entry(plugin, "http://127.0.0.1:9999/other", workspace=str(tmp_path / "somewhere-else"))
    _blocked(_gate(plugin, _done(metadata={"tastecheck": True})))
    put_entry(plugin, "http://127.0.0.1:5173")
    assert _gate(plugin, _done(metadata={"tastecheck": True})) is None


def test_flag_only_blocks_on_any_latest_hold_in_workspace(plugin, ws):
    a = page(ws, "a.html")
    b = page(ws, "b.html")
    put_entry(plugin, a)
    put_entry(plugin, b, "HOLD", hold_reasons=["contrast"])
    _blocked(_gate(plugin, _done(metadata={"tastecheck": True})), "b.html", "HOLD")


def test_flag_only_ignores_remote_urls_for_fallback(plugin):
    """A SHIP of some public URL is not evidence about this workspace's frontend."""
    put_entry(plugin, "https://example.com/")
    _blocked(_gate(plugin, _done(metadata={"tastecheck": True})))


def test_stale_ship_blocks(plugin, ws):
    a = page(ws)
    put_entry(plugin, a, age=int(plugin.DEFAULTS["gate_ship_ttl_seconds"]) + 60)
    _blocked(_gate(plugin, _done(metadata={"target": str(a)})), "stale")


def test_gate_disabled_by_config(plugin):
    plugin._ctx.config["gate_completions"] = False
    assert _gate(plugin, _done(metadata={"tastecheck": True})) is None


def test_gate_ignores_non_dict_args(plugin):
    assert plugin._on_pre_tool("kanban_complete", None) is None
    assert plugin._on_pre_tool("kanban_complete", "summary=done") is None


def test_gate_directive_matches_hermes_veto_contract(plugin):
    blocked = _gate(plugin, _done(metadata={"tastecheck": True}))
    assert set(blocked) == {"action", "message"}
    assert isinstance(blocked["message"], str) and blocked["message"]
