"""R4 gate-binding regressions (review review round A): the completion gate must bind
eligibility to THIS completion's frontend artifact / workspace — latest-wins,
fail closed — and must catch plainly-worded summaries on frontend tasks via the
task's own body. All controls go through the registered hook callback
``_on_pre_tool`` (the pre_tool_call entry), not private helpers."""

from __future__ import annotations

import sys
import time
import types
from pathlib import Path


def _completion(summary, **kw):
    base = {"task_id": "t_gatectl", "summary": summary}
    base.update(kw)
    return base


def _ui(**kw):
    return _completion("Landing page redesign done, ready to ship", **kw)


def _write_ledger(plugin, entries):
    plugin._save_json(plugin._ledger_path(), entries)


def _entry(plugin, target, verdict="SHIP", age=0, source="tool", **extra):
    """Entry via the REAL recorder (workspace + sha256 binding), then patch ts/extras."""
    plugin.record_verdict(target, {"verdict": verdict}, source=source)
    ledger = plugin._load_json(plugin._ledger_path(), [])
    if not isinstance(ledger, list):
        ledger = []
    if not ledger:
        ledger.append({})
    ledger[-1].update(extra)
    if age:
        ledger[-1]["ts"] = int(time.time()) - age
    plugin._save_json(plugin._ledger_path(), ledger)
    return ledger[-1]


def _fresh_ledger(plugin):
    _write_ledger(plugin, [])


# --- unrelated / superseded / changed evidence must NOT release the gate -----

def test_gate_blocks_ship_for_a_different_artifact(plugin, tmp_path):
    """SHIP for project-a + completion targeting project-b: BLOCK (was allowed at 9a2abbf)."""
    _fresh_ledger(plugin)
    a = tmp_path / "project-a" / "index.html"
    a.parent.mkdir()
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    b = tmp_path / "project-b" / "index.html"
    b.parent.mkdir()
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    _entry(plugin, str(a))  # SHIP for A
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(b)}), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "no ledger verdict is bound" in blocked["message"]


def test_gate_blocks_when_newer_hold_supersedes_ship(plugin, tmp_path):
    """SHIP then newer HOLD for the SAME artifact: BLOCK (was allowed at 9a2abbf)."""
    _fresh_ledger(plugin)
    b = tmp_path / "project-b" / "index.html"
    b.parent.mkdir()
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    ledger = []
    _write_ledger(plugin, ledger)
    _entry(plugin, str(b), verdict="SHIP", age=100)
    _entry(plugin, str(b), verdict="HOLD", age=0, hold_reasons=["focus ring invisible on buttons"])
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(b)}), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "latest matching verdict is HOLD" in blocked["message"]


def test_gate_allows_matching_fresh_ship(plugin, tmp_path):
    _fresh_ledger(plugin)
    b = tmp_path / "project-b" / "index.html"
    b.parent.mkdir()
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    _entry(plugin, str(b))
    assert plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(b)}), task_id="t_gatectl") is None


def test_gate_blocks_when_artifact_changed_after_ship(plugin, tmp_path):
    """A SHIP for bytes the file no longer has is superseded: BLOCK."""
    _fresh_ledger(plugin)
    b = tmp_path / "project-b" / "index.html"
    b.parent.mkdir()
    b.write_text("<html><body>v1</body></html>", encoding="utf-8")
    _entry(plugin, str(b))  # recorder hashes v1
    b.write_text("<html><body>v2 — edited after the audit</body></html>", encoding="utf-8")
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(b)}), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "changed after its SHIP" in blocked["message"]


def test_gate_workspace_fallback_never_accepts_foreign_workspace(plugin, tmp_path, monkeypatch):
    """UI-worded completion with no named artifact: only a SHIP recorded in THIS
    workspace releases it — never 'any SHIP anywhere in the profile' (R4)."""
    _fresh_ledger(plugin)
    _entry(plugin, "http://127.0.0.1:9999/other-project")
    ledger = plugin._load_json(plugin._ledger_path(), [])
    ledger[-1]["workspace"] = str(tmp_path / "somewhere-else")  # different workspace
    _write_ledger(plugin, ledger)
    blocked = plugin._on_pre_tool("kanban_complete", _ui(), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    # …and the same-shape entry recorded in the CURRENT workspace releases it:
    _entry(plugin, "http://127.0.0.1:5173")
    assert plugin._on_pre_tool("kanban_complete", _ui(), task_id="t_gatectl") is None


def test_gate_no_evidence_frontend_claim_blocks(plugin):
    _fresh_ledger(plugin)
    blocked = plugin._on_pre_tool("kanban_complete", _ui(), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "no ledger verdict is bound" in blocked["message"]


# --- plain summaries on frontend tasks are caught via the task body ----------

def _fake_hermes_cli(monkeypatch, tmp_path, *, title="", body=""):
    db_mod = types.ModuleType("hermes_cli.kanban_db")
    db_file = tmp_path / "kanban.db"
    db_file.write_bytes(b"")  # empty sqlite file: connect succeeds, get_task is faked

    class _Task:
        pass

    task = _Task()
    task.title = title
    task.body = body
    db_mod.kanban_db_path = lambda board=None: db_file
    db_mod.get_task = lambda conn, task_id: task
    pkg = types.ModuleType("hermes_cli")
    pkg.kanban_db = db_mod
    monkeypatch.setitem(sys.modules, "hermes_cli", pkg)
    monkeypatch.setitem(sys.modules, "hermes_cli.kanban_db", db_mod)


def test_gate_blocks_plain_summary_on_frontend_task(plugin, tmp_path, monkeypatch):
    """'Finished and verified all acceptance criteria' on a frontend task card:
    BLOCK via the task's own body (was allowed at 9a2abbf)."""
    _fresh_ledger(plugin)
    _fake_hermes_cli(monkeypatch, tmp_path,
                     title="Redesign the marketing landing page",
                     body="Ship the new hero section and pricing table.")
    plain = _completion("Finished and verified all acceptance criteria")
    blocked = plugin._on_pre_tool("kanban_complete", plain, task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "frontend/UI work" in blocked["message"]


def test_gate_allows_plain_summary_on_non_frontend_task(plugin, tmp_path, monkeypatch):
    _fresh_ledger(plugin)
    _fake_hermes_cli(monkeypatch, tmp_path, title="Fix billing rounding", body="ledger cents")
    plain = _completion("Finished and verified all acceptance criteria")
    assert plugin._on_pre_tool("kanban_complete", plain, task_id="t_gatectl") is None


def test_gate_ignores_unknown_task_and_non_frontend_payload(plugin):
    """No UI words, no frontend paths, task not found: non-frontend behavior unchanged."""
    _fresh_ledger(plugin)
    plain = _completion("Finished and verified all acceptance criteria", task_id="t_nope1234")
    assert plugin._on_pre_tool("kanban_complete", plain, task_id="t_nope1234") is None


# --- recorder binding fields --------------------------------------------------

def test_record_verdict_binds_workspace_and_sha256(plugin, tmp_path):
    f = tmp_path / "page.html"
    f.write_text("<html><body>stable bytes</body></html>", encoding="utf-8")
    plugin.record_verdict(str(f), {"verdict": "SHIP"}, source="roll-audit")
    (entry,) = plugin._load_json(plugin._ledger_path(), [])
    assert entry["workspace"] and entry["target_sha256"]
    import hashlib
    assert entry["target_sha256"] == hashlib.sha256(f.read_bytes()).hexdigest()
    assert entry["source"] == "roll-audit"


def test_record_verdict_http_target_skips_sha(plugin):
    plugin.record_verdict("http://127.0.0.1:5173/", {"verdict": "HOLD"})
    (entry,) = plugin._load_json(plugin._ledger_path(), [])
    assert entry["target"] == "http://127.0.0.1:5173/"
    assert "target_sha256" not in entry
