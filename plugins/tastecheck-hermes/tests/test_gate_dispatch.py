"""review round B R4 dispatch-level regressions: through the INSTALLED Hermes
``hermes_cli.plugins._dispatch_pre_tool_call_hooks`` — the real pre-tool hook
dispatch that tool calls go through — with a reviewer-style isolated manager,
isolated HERMES_HOME/ledger/workspace and a faked kanban card lookup.

This is the lane the reviewer's ``gate-probe.py`` used (workspace
``review-b/``): nothing here calls ``_on_pre_tool`` directly. It requires an
installed Hermes runtime, so it SKIPS on hosts without one (CI has no Hermes
install — the hook-shape regressions in ``test_gate_binding.py`` run there;
this file runs on every hermes-equipped host and in review). No completion
tool is executed; no production board data is modified.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import time
import types
from pathlib import Path

try:
    import pytest
except ImportError:  # script lane: the launcher interpreter has no pytest
    pytest = None

try:
    from hermes_cli import plugins as runtime  # noqa: E402

    HAS_RUNTIME = True
    _RUNTIME_IMPORT_ERROR = None
except Exception as exc:  # pragma: no cover - environment-dependent
    runtime = None
    HAS_RUNTIME = False
    _RUNTIME_IMPORT_ERROR = exc

if pytest is not None:
    pytestmark = pytest.mark.skipif(
        not HAS_RUNTIME,
        reason=f"installed Hermes runtime required for dispatch-level regressions ({_RUNTIME_IMPORT_ERROR})",
    )
elif not HAS_RUNTIME:  # script lane without a runtime has nothing to run
    raise SystemExit(f"installed Hermes runtime required ({_RUNTIME_IMPORT_ERROR})")

PLUGIN_DIR = Path(__file__).resolve().parents[1]
UUID_HOOK = "123e4567-e89b-12d3-a456-426614174000"  # agent/turn_facade.py: task_id or uuid4()


def _setup_disp(tmp_path, monkeypatch):
    """Shared dispatch setup (used by the pytest fixture AND the __main__ lane
    that runs under the installed launcher interpreter, where pytest itself is
    unavailable — same technique as the reviewer's run-runtime-probe.py)."""
    home = tmp_path / "hermes-home"
    home.mkdir()
    data = tmp_path / "plugin-data"
    data.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)

    name = "tastecheck_hermes_dispatch"
    sys.modules.pop(name, None)
    spec = importlib.util.spec_from_file_location(name, PLUGIN_DIR / "__init__.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    mod._data_dir = lambda: data
    mod._agent_cwd = lambda: tmp_path

    manager = runtime.PluginManager(scope_key=str(home))
    manager._discovered = True
    manager._hooks["pre_tool_call"] = [mod._on_pre_tool]
    monkeypatch.setattr(runtime, "_delivery_manager", lambda: manager)

    def dispatch(args, hook_task=""):
        """Returns the RESOLVED BLOCK MESSAGE (str) from real dispatch — None
        means proceed; the hook's {"action","message"} dict never crosses this
        boundary, dispatch resolves it."""
        block, _modified = runtime._dispatch_pre_tool_call_hooks(
            "kanban_complete", args, task_id=hook_task)
        return block

    return mod, dispatch, home


def _teardown_disp():
    sys.modules.pop("tastecheck_hermes_dispatch", None)


if pytest is not None:
    @pytest.fixture
    def disp(tmp_path, monkeypatch):
        """(plugin, dispatch) with an isolated home/ledger/agent-cwd and the real
        dispatch function wired to a manager holding ONLY this plugin's hook."""
        mod, dispatch, _home = _setup_disp(tmp_path, monkeypatch)
        try:
            yield mod, dispatch
        finally:
            _teardown_disp()


def _fake_frontend_card(monkeypatch, tmp_path, tid="t_disp001"):
    """Frontend card in a faked hermes_cli.kanban_db (isolated from the real board)."""
    db_mod = types.ModuleType("hermes_cli.kanban_db")
    db_file = tmp_path / "kanban.db"
    db_file.write_bytes(b"")

    class _Task:
        pass

    task = _Task()
    task.title = "Redesign the marketing landing page"
    task.body = "Ship the new hero section and pricing table."
    db_mod.kanban_db_path = lambda board=None: db_file
    db_mod.get_task = lambda conn, task_id: task if task_id == tid else None
    real_pkg = sys.modules.get("hermes_cli")
    monkeypatch.setitem(sys.modules, "hermes_cli.kanban_db", db_mod)
    if real_pkg is not None:
        monkeypatch.setattr(real_pkg, "kanban_db", db_mod, raising=False)
    return tid


def _entry(mod, target, verdict="SHIP", **kw):
    """Entry via the REAL recorder (workspace + sha256 binding)."""
    mod.record_verdict(str(target), {"verdict": verdict}, source="tool")
    ledger = mod._load_json(mod._ledger_path(), [])
    ledger[-1].update(kw)
    mod._save_json(mod._ledger_path(), ledger)
    return ledger[-1]


def _allowed(block):
    return block is None


# --- controls that already held, re-proven through real dispatch --------------

def test_dispatch_blocks_no_evidence_frontend_claim(disp):
    mod, dispatch = disp
    mod._save_json(mod._ledger_path(), [])
    args = {"summary": "Frontend page finished", "task_id": "t_disp001"}
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block)


def test_dispatch_allows_matching_fresh_ship(disp, tmp_path):
    mod, dispatch = disp
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    _entry(mod, a)
    args = {"summary": "Frontend page finished", "metadata": {"target": str(a)}}
    assert _allowed(dispatch(args, hook_task=UUID_HOOK))


def test_dispatch_allows_non_frontend_control(disp):
    mod, dispatch = disp
    mod._save_json(mod._ledger_path(), [])
    assert _allowed(dispatch({"summary": "Fixed billing rounding"}, hook_task="t_disp001"))


# --- review round B reproduced bypasses, now fixed through real dispatch ---------------

def test_dispatch_uuid_hook_cannot_override_card_identity(disp, tmp_path, monkeypatch):
    """Plain frontend-card summary; args carry the card id, hook carries the
    runtime UUID: BLOCK via the task body (allowed with an empty ledger at aa5d489)."""
    mod, dispatch = disp
    mod._save_json(mod._ledger_path(), [])
    tid = _fake_frontend_card(monkeypatch, tmp_path)
    plain = {"task_id": tid, "summary": "Finished and verified all acceptance criteria"}
    assert not _allowed(dispatch(plain, hook_task=UUID_HOOK))


def test_dispatch_env_default_binds_card_when_args_omit_task_id(disp, tmp_path, monkeypatch):
    """task_id omitted (kanban worker default = HERMES_KANBAN_TASK env) + UUID
    hook: BLOCK (allowed with an empty ledger at aa5d489)."""
    mod, dispatch = disp
    mod._save_json(mod._ledger_path(), [])
    tid = _fake_frontend_card(monkeypatch, tmp_path)
    monkeypatch.setenv("HERMES_KANBAN_TASK", tid)
    plain = {"summary": "Finished and verified all acceptance criteria"}
    assert not _allowed(dispatch(plain, hook_task=UUID_HOOK))


def test_dispatch_deleted_audited_artifact_fails_closed(disp, tmp_path):
    mod, dispatch = disp
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    _entry(mod, a)
    a.unlink()
    args = {"summary": "Frontend page finished", "metadata": {"target": str(tmp_path / "a.html")}}
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block)
    assert "missing or unreadable" in block


def test_dispatch_missing_identity_hash_fails_closed(disp, tmp_path):
    mod, dispatch = disp
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    _entry(mod, a)
    ledger = mod._load_json(mod._ledger_path(), [])
    ledger[-1].pop("target_sha256", None)
    mod._save_json(mod._ledger_path(), ledger)
    args = {"summary": "Frontend page finished", "metadata": {"target": str(a)}}
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block)
    assert "lacks a content digest" in block


def test_dispatch_multi_artifact_needs_every_surface(disp, tmp_path):
    mod, dispatch = disp
    a = tmp_path / "a.html"
    b = tmp_path / "b.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    b.write_text("<html><body>B</body></html>", encoding="utf-8")
    _entry(mod, a)
    args = {"summary": "Frontend done", "artifacts": [str(a), str(b)]}
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block) and "b.html" in block
    # …and an older HOLD on A is not cleared by B's newer SHIP:
    mod._save_json(mod._ledger_path(), [])
    _entry(mod, a, verdict="HOLD", ts=int(time.time()) - 10)
    _entry(mod, b)
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block)


def test_dispatch_explicit_url_identity_no_workspace_substitution(disp, tmp_path):
    mod, dispatch = disp
    _entry(mod, "http://127.0.0.1:5173/project-a")  # SHIP recorded in THIS workspace
    args = {"summary": "Frontend done", "metadata": {"target": "http://127.0.0.1:5173/project-b"}}
    block = dispatch(args, hook_task="t_disp001")
    assert not _allowed(block)
    assert "no ledger verdict is bound" in block


def test_dispatch_relative_audit_binds_absolute_completion(disp, tmp_path):
    """record_verdict('a.html') with agent cwd = tmp_path; completion names the
    absolute twin: allowed (misbound HOLD at aa5d489)."""
    mod, dispatch = disp
    a = tmp_path / "a.html"
    a.write_text("<html><body>A</body></html>", encoding="utf-8")
    mod.record_verdict("a.html", {"verdict": "SHIP"}, source="tool")
    (entry,) = mod._load_json(mod._ledger_path(), [])
    assert entry["target"] == str(a)
    assert entry["target_sha256"] == hashlib.sha256(a.read_bytes()).hexdigest()
    args = {"summary": "Frontend page finished", "metadata": {"target": str(a)}}
    assert _allowed(dispatch(args, hook_task=UUID_HOOK))


# --- script lane: same cases without pytest, for the installed runtime --------
# The launcher interpreter (hermes --print-runtime-command) has the hermes_cli
# runtime but no pytest; this lane executes the IDENTICAL test functions with a
# minimal monkeypatch shim, so dispatch-level regressions run on any
# hermes-equipped host exactly the way the reviewer's probe did.

if __name__ == "__main__":  # pragma: no cover - script lane
    import os
    import tempfile
    import traceback

    class _MiniMP:
        def __init__(self):
            self._undo = []

        def setenv(self, k, v):
            self._undo.append(("env", k, os.environ.get(k)))
            os.environ[k] = v

        def delenv(self, k, raising=True):
            self._undo.append(("env", k, os.environ.get(k)))
            os.environ.pop(k, None)

        def setattr(self, obj, name, value, **kwargs):
            self._undo.append(("attr", obj, name, getattr(obj, name, None)))
            setattr(obj, name, value)

        def setitem(self, dic, key, value):
            self._undo.append(("item", dic, key, dic.get(key)))
            dic[key] = value

        def undo(self):
            for u in reversed(self._undo):
                if u[0] == "env":
                    if u[2] is None:
                        os.environ.pop(u[1], None)
                    else:
                        os.environ[u[1]] = u[2]
                elif u[0] == "attr":
                    setattr(u[1], u[2], u[3])
                elif u[0] == "item":
                    if u[3] is None:
                        u[1].pop(u[2], None)
                    else:
                        u[1][u[2]] = u[3]

    import inspect

    failed = []
    ran = 0
    for fname, fn in sorted(globals().items()):
        if not fname.startswith("test_") or not inspect.isfunction(fn):
            continue
        params = list(inspect.signature(fn).parameters)
        mp = _MiniMP()
        tmp = tempfile.mkdtemp(prefix="tc-dispatch-")
        tmp_path = Path(tmp)
        kwargs = {}
        for p in params:
            if p == "disp":
                kwargs[p] = _setup_disp(tmp_path, mp)[:2]
            elif p == "tmp_path":
                kwargs[p] = tmp_path
            elif p == "monkeypatch":
                kwargs[p] = mp
        ran += 1
        try:
            fn(**kwargs)
            print(f"PASS {fname}")
        except Exception:
            failed.append(fname)
            print(f"FAIL {fname}")
            traceback.print_exc()
        finally:
            mp.undo()
            _teardown_disp()
    print(f"\n{ran - len(failed)}/{ran} dispatch tests passed")
    raise SystemExit(1 if failed else 0)
