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
    # review round B R4: URL identity is normalized (trailing slash dropped) at record
    # AND consumption time, so both boundaries compare equal.
    assert entry["target"] == "http://127.0.0.1:5173"
    assert entry["target_raw"] == "http://127.0.0.1:5173/"
    assert "target_sha256" not in entry


# --- review round B R4: identity resolution, per-artifact evidence, fail-closed identity -

_UUID_HOOK = "123e4567-e89b-12d3-a456-426614174000"  # agent/turn_facade.py runtime turn id


def test_uuid_hook_id_never_overrides_explicit_card_id(plugin, tmp_path, monkeypatch):
    """Plain summary on a frontend card; args carry the card id, the hook carries
    a runtime UUID (the real tool_hook_ids shape): BLOCK via the task body
    (the UUID overriding args.task_id allowed this through at aa5d489)."""
    _fresh_ledger(plugin)
    _fake_hermes_cli(monkeypatch, tmp_path,
                     title="Redesign the marketing landing page",
                     body="Ship the new hero section and pricing table.")
    plain = {"task_id": "t_gatectl", "summary": "Finished and verified all acceptance criteria"}
    blocked = plugin._on_pre_tool("kanban_complete", plain, task_id=_UUID_HOOK)
    assert blocked and blocked["action"] == "block"
    assert "frontend/UI work" in blocked["message"]


def test_env_default_resolves_card_when_args_omit_task_id(plugin, tmp_path, monkeypatch):
    """task_id omitted (the kanban worker default: HERMES_KANBAN_TASK env) + UUID
    hook id: the card still binds and the plain summary is gated."""
    _fresh_ledger(plugin)
    _fake_hermes_cli(monkeypatch, tmp_path,
                     title="Redesign the marketing landing page",
                     body="Ship the hero.")
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_gatectl")
    plain = {"summary": "Finished and verified all acceptance criteria"}
    blocked = plugin._on_pre_tool("kanban_complete", plain, task_id=_UUID_HOOK)
    assert blocked and blocked["action"] == "block"
    assert "frontend/UI work" in blocked["message"]


def test_unresolvable_identity_ui_summary_still_gated_by_payload(plugin, monkeypatch):
    """No card id anywhere (no args id, UUID hook, no env) + UI-worded summary:
    the payload vocabulary claim gates on its own."""
    _fresh_ledger(plugin)
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    blocked = plugin._on_pre_tool(
        "kanban_complete", {"summary": "Landing page done, ready to ship"}, task_id=_UUID_HOOK)
    assert blocked and blocked["action"] == "block"


def test_every_named_artifact_needs_its_own_ship(plugin, tmp_path):
    """Two artifacts named, only A has SHIP: BLOCK — one unrelated file cannot
    clear another (was allowed at aa5d489)."""
    _fresh_ledger(plugin)
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    b = tmp_path / "b.html"
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    _entry(plugin, str(a))
    blocked = plugin._on_pre_tool(
        "kanban_complete", {"summary": "Frontend done", "artifacts": [str(a), str(b)]},
        task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "b.html" in blocked["message"]


def test_newer_ship_for_other_artifact_does_not_clear_older_hold(plugin, tmp_path):
    """A has HOLD, B has a newer SHIP, completion names both: BLOCK — per-artifact
    latest-wins, not one global latest (was allowed at aa5d489)."""
    _fresh_ledger(plugin)
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    b = tmp_path / "b.html"
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    _entry(plugin, str(a), verdict="HOLD", age=100, hold_reasons=["contrast 2.9:1 on body text"])
    _entry(plugin, str(b), age=0)
    blocked = plugin._on_pre_tool(
        "kanban_complete", {"summary": "Frontend done", "artifacts": [str(a), str(b)]},
        task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "latest matching verdict is HOLD" in blocked["message"]


def test_deleted_audited_artifact_fails_closed(plugin, tmp_path):
    """SHIP then the audited file is deleted: the evidence cannot be validated,
    so BLOCK (was allowed at aa5d489 — hash check was conditional on is_file)."""
    _fresh_ledger(plugin)
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    _entry(plugin, str(a))
    a.unlink()
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(a)}), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "missing or unreadable" in blocked["message"]


def test_missing_digest_fails_closed(plugin, tmp_path):
    """SHIP evidence without a content digest for a local file: BLOCK (was
    allowed at aa5d489)."""
    _fresh_ledger(plugin)
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    _entry(plugin, str(a))
    ledger = plugin._load_json(plugin._ledger_path(), [])
    ledger[-1].pop("target_sha256", None)
    plugin._save_json(plugin._ledger_path(), ledger)
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(a)}), task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "lacks a content digest" in blocked["message"]


def test_explicit_url_target_never_falls_back_to_workspace(plugin, tmp_path):
    """Completion explicitly binds http://…/project-b; only project-a has a SHIP
    recorded in this workspace: BLOCK — an explicit URL target binds by identity,
    with no suffix extraction and no workspace substitution (was allowed)."""
    _fresh_ledger(plugin)
    _entry(plugin, "http://127.0.0.1:5173/project-a")
    blocked = plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": "http://127.0.0.1:5173/project-b"}),
        task_id="t_gatectl")
    assert blocked and blocked["action"] == "block"
    assert "no ledger verdict is bound" in blocked["message"]


def test_relative_audit_binds_its_absolute_completion_twin(plugin, tmp_path, monkeypatch):
    """record_verdict('page.html') resolves against the AGENT cwd at record time;
    the completion names the same file absolutely — one identity (was a HOLD-only
    misbind at aa5d489)."""
    monkeypatch.setenv("TERMINAL_CWD", str(tmp_path))
    _fresh_ledger(plugin)
    f = tmp_path / "page.html"
    f.write_text("<html><body>P</body></html>", encoding="utf-8")
    plugin.record_verdict("page.html", {"verdict": "SHIP"})
    (entry,) = plugin._load_json(plugin._ledger_path(), [])
    assert entry["target"] == str(f), "relative target normalized to the agent-cwd absolute"
    assert plugin._on_pre_tool(
        "kanban_complete", _ui(metadata={"target": str(f)}), task_id="t_gatectl") is None
