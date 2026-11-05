"""Regressions for Kai's CHANGES REQUIRED on KyaniteLabs/tastecheck#40 (review 5791756515).

Each test reproduces the case Kai described against the 271f510 plugin.
"""

from __future__ import annotations

import contextvars
import json
import os
import subprocess
import sys
import textwrap
import threading
import time
from pathlib import Path

import pytest


# --- P1 (1): gateway identity comes from Hermes ContextVars ------------------

def test_telegram_contextvar_session_refuses_slash_audit(plugin, runtime, monkeypatch):
    assert "HERMES_PLATFORM" not in os.environ
    assert "HERMES_SESSION_PLATFORM" not in os.environ
    called = []
    monkeypatch.setattr(plugin, "audit", lambda t: called.append(t) or {"verdict": "SHIP"})
    runtime.set_session_vars(platform="telegram", source="telegram")
    assert runtime.session_is_messaging_surface() is True

    out = plugin._slash("audit http://127.0.0.1:5173")

    assert "disabled on gateway" in out
    assert called == []


def test_local_contextvar_session_allows_slash_audit(plugin, runtime, monkeypatch):
    called = []
    monkeypatch.setattr(plugin, "audit", lambda t: called.append(t) or {"verdict": "SHIP", "evidence_dir": "x"})
    runtime.set_session_vars(platform="", source="desktop")
    plugin._slash("audit http://127.0.0.1:5173")
    assert called == ["http://127.0.0.1:5173"]


def test_telegram_opt_in_allows_slash_audit(plugin, runtime, monkeypatch):
    from conftest import FakeCtx

    plugin._ctx = FakeCtx({"allow_audit_slash_on_gateway": True})
    called = []
    monkeypatch.setattr(plugin, "audit", lambda t: called.append(t) or {"verdict": "SHIP", "evidence_dir": "x"})
    runtime.set_session_vars(platform="telegram", source="telegram")
    plugin._slash("audit http://127.0.0.1:5173")
    assert called == ["http://127.0.0.1:5173"]


# --- P1 (2): unique evidence per audit; failures never inherit SHIP ------------

_SHIP_THEN_FAIL = textwrap.dedent(
    """
    tgt, out = sys.argv[2], sys.argv[3]
    if "first" in tgt:
        ev = {"verdict": "SHIP", "holdReasons": [], "target": tgt}
        with open(os.path.join(out, "evidence.json"), "w") as f:
            json.dump(ev, f)
        print(json.dumps(ev))
        sys.exit(0)
    sys.stderr.write("browser unavailable\\n")
    sys.exit(2)
    """
)


def test_failed_audit_does_not_return_previous_ship(plugin, fake_cli, monkeypatch):
    fake_cli(_SHIP_THEN_FAIL)
    monkeypatch.setattr(plugin.time, "strftime", lambda *a, **k: "20261105-120000")

    a = plugin.audit("http://first.test")
    b = plugin.audit("http://second.test")

    assert a["verdict"] == "SHIP"
    assert a["evidence_dir"] != b["evidence_dir"]
    assert b["ok"] is False
    assert b["verdict"] == "HOLD"
    assert "data" not in b or b["data"].get("target") != "http://first.test"
    text = plugin._fmt(b)
    assert text.startswith("HOLD")
    assert "SHIP" not in text
    assert "browser unavailable" in text


def test_concurrent_same_second_audits_get_distinct_dirs(plugin, fake_cli, monkeypatch):
    fake_cli("time.sleep(0.2); print(json.dumps({'verdict':'HOLD','holdReasons':['x'],'target':sys.argv[2]})); sys.exit(1)")
    monkeypatch.setattr(plugin.time, "strftime", lambda *a, **k: "20261105-120000")
    results = []
    threads = [threading.Thread(target=lambda i=i: results.append(plugin.audit(f"http://t{i}.test"))) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len({r["evidence_dir"] for r in results}) == 4


def test_evidence_for_other_target_is_rejected(plugin, fake_cli):
    fake_cli("print(json.dumps({'verdict':'SHIP','holdReasons':[],'target':'http://other.test'})); sys.exit(0)")
    res = plugin.audit("http://mine.test")
    assert res["verdict"] == "HOLD"
    assert res["ok"] is False


def test_tool_error_with_ship_stdout_is_hold(plugin, fake_cli):
    fake_cli("print(json.dumps({'verdict':'SHIP','holdReasons':[],'target':sys.argv[2]})); sys.exit(2)")
    res = plugin.audit("http://mine.test")
    assert res["verdict"] == "HOLD"
    assert plugin._fmt(res).startswith("HOLD")


# --- P2 (3): local targets resolve against the session workspace -------------

def test_relative_target_resolves_per_session_cwd(plugin, runtime, tmp_path, monkeypatch):
    a, b, service = tmp_path / "proj-a", tmp_path / "proj-b", tmp_path / "service"
    for d in (a, b, service):
        d.mkdir()
        (d / "index.html").write_text(d.name)
    monkeypatch.chdir(service)

    def in_session(cwd):
        runtime.set_session_vars(platform="", source="desktop", cwd=str(cwd))
        return plugin._resolve_target("index.html")

    assert contextvars.copy_context().run(in_session, a) == str((a / "index.html").resolve())
    assert contextvars.copy_context().run(in_session, b) == str((b / "index.html").resolve())


def test_relative_target_only_in_session_cwd(plugin, runtime, tmp_path, monkeypatch):
    proj, service = tmp_path / "project", tmp_path / "service"
    proj.mkdir()
    service.mkdir()
    (proj / "index.html").write_text("hi")
    monkeypatch.chdir(service)
    runtime.set_session_vars(platform="", source="desktop", cwd=str(proj))
    assert plugin._resolve_target("index.html") == str((proj / "index.html").resolve())


# --- P2 (4): bound fields, never the serialized JSON --------------------------

def _big_profile():
    return {"version": 1, "entries": [
        {"id": f"tell-{i}", "scope": f"/projects/site-{i}", "decision": "accept", "reason": "r" * 500}
        for i in range(40)
    ]}


def test_large_profile_export_is_valid_bounded_json(plugin, fake_cli):
    profile = _big_profile()
    assert len(json.dumps(profile)) > 20000
    fake_cli(f"print(json.dumps({profile!r}))")

    out = plugin._tool_profile({"action": "export"})

    res = json.loads(out)
    assert len(out) <= 20000
    assert res["truncated"] is True
    full = json.loads(Path(res["full_result_path"]).read_text(encoding="utf-8"))
    assert full["data"] == profile


def test_large_audit_keeps_verdict_reasons_and_evidence(plugin, fake_cli):
    fake_cli(textwrap.dedent(
        """
        ev = {"verdict": "HOLD", "holdReasons": ["contrast 2.1:1 on .cta", "console error: boom"],
              "target": sys.argv[2], "probes": [{"name": f"p{i}", "evidence": "e" * 900} for i in range(60)]}
        print(json.dumps(ev))
        sys.exit(1)
        """
    ))
    out = plugin._tool_audit({"target": "http://big.test"})
    res = json.loads(out)
    assert len(out) <= 20000
    assert res["verdict"] == "HOLD"
    assert res["truncated"] is True
    assert res["data"]["holdReasons"] == ["contrast 2.1:1 on .cta", "console error: boom"]
    assert res["evidence_dir"]

    plugin._on_post_tool("tastecheck_audit", {"target": "http://big.test"}, out)
    entry = json.loads(plugin._ledger_path().read_text())[-1]
    assert entry["verdict"] == "HOLD"
    assert entry["hold_reasons"] == ["contrast 2.1:1 on .cta", "console error: boom"]
    assert entry["evidence_dir"] == res["evidence_dir"]


def test_small_result_untouched(plugin):
    out = plugin._wrap(lambda a: {"ok": True, "verdict": "SHIP"})({})
    assert json.loads(out) == {"ok": True, "verdict": "SHIP"}


# --- P2 (5): ledger append is atomic across concurrent callers ----------------

def test_overlapping_ledger_appends_keep_both(plugin, monkeypatch):
    barrier = threading.Barrier(2, timeout=1.0)
    real_load = plugin._load_json

    def racing_load(path, default):
        value = real_load(path, default)
        if Path(path).name == "verdict_ledger.json":
            try:
                barrier.wait()
            except threading.BrokenBarrierError:
                pass
        return value

    monkeypatch.setattr(plugin, "_load_json", racing_load)
    errors = []

    def complete(target):
        try:
            plugin._on_post_tool("tastecheck_audit", {"target": target}, {"verdict": "HOLD", "evidence_dir": target})
        except Exception as exc:  # pragma: no cover - observer swallows, but be explicit
            errors.append(exc)

    threads = [threading.Thread(target=complete, args=(t,)) for t in ("a", "b")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    targets = sorted(e["target"] for e in json.loads(plugin._ledger_path().read_text()))
    assert targets == ["a", "b"]
    assert errors == []


def test_cross_process_ledger_appends_are_not_lost(plugin, hermes_home, tmp_path):
    from conftest import PLUGIN_DIR

    worker = tmp_path / "worker.py"
    worker.write_text(textwrap.dedent(
        f"""
        import importlib.util, sys
        spec = importlib.util.spec_from_file_location("tc", {str(PLUGIN_DIR / "__init__.py")!r})
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        for i in range(25):
            mod._on_post_tool("tastecheck_audit", {{"target": sys.argv[1] + str(i)}}, {{"verdict": "HOLD"}})
        """
    ))
    env = {**os.environ, "HERMES_HOME": str(hermes_home)}
    procs = [subprocess.Popen([sys.executable, str(worker), p], env=env) for p in ("a", "b", "c")]
    assert [p.wait(timeout=60) for p in procs] == [0, 0, 0]
    ledger = json.loads(plugin._ledger_path().read_text())
    assert len(ledger) == 75
    assert not list(plugin._ledger_path().parent.glob("*.tmp"))


# --- P2 (6): timeout kills the whole process tree ----------------------------

def _tree_cli(marker: Path, detach: bool) -> str:
    child = (
        "import os, time\n"
        + ("os.setsid()\n" if detach else "")
        + f"time.sleep(2.0)\nopen({str(marker)!r}, 'w').write('alive')\n"
    )
    return f"subprocess.Popen([sys.executable, '-c', {child!r}])\ntime.sleep(30)\n"


@pytest.mark.skipif(os.name == "nt", reason="POSIX process groups")
@pytest.mark.parametrize("detach", [False, True], ids=["same-group", "setsid-grandchild"])
def test_timeout_kills_descendants(plugin, fake_cli, tmp_path, detach):
    marker = tmp_path / f"marker-{detach}"
    fake_cli(_tree_cli(marker, detach), timeout_seconds=1)

    t0 = time.monotonic()
    res = plugin.run_tastecheck(["audit", "http://slow.test"])
    elapsed = time.monotonic() - t0

    assert res["ok"] is False and "timed out" in res["error"]
    assert elapsed < 5
    time.sleep(2.5)
    assert not marker.exists(), "descendant kept running after timeout"
