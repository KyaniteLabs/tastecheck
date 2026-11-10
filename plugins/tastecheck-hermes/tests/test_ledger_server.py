"""Ledger integrity, target confinement, the loopback server, end-to-end local audits,
corrupt-ledger handling, slash/status hygiene, config and the dashboard roll audit."""

from __future__ import annotations

import http.client
import importlib.util
import json
import os
import sys
import types
from pathlib import Path

import pytest

from conftest import PLUGIN_DIR, FakeCtx, fetching_cli, page, put_entry


def _done(**kw):
    base = {"task_id": "t_ledger", "summary": "done"}
    base.update(kw)
    return base


def _gate(plugin, args):
    return plugin._on_pre_tool("kanban_complete", args, task_id="t_ledger")


def _ledger(plugin):
    return json.loads(plugin._ledger_path().read_text(encoding="utf-8"))


# --- P1-2: the ledger is signed; forged / roll-audit / ERROR entries never release --

def test_forged_unsigned_ship_is_ignored(plugin, ws):
    p = page(ws)
    put_entry(plugin, p)  # a real signed SHIP...
    ledger = _ledger(plugin)
    forged = dict(ledger[-1])
    forged.pop("sig")
    plugin._save_json(plugin._ledger_path(), [forged])  # ...replaced by an unsigned copy
    assert _gate(plugin, _done(artifacts=[str(p)]))["action"] == "block"


def test_hold_flipped_to_ship_breaks_the_signature(plugin, ws):
    p = page(ws)
    put_entry(plugin, p, verdict="HOLD")
    ledger = _ledger(plugin)
    ledger[-1]["verdict"] = "SHIP"  # edit without the key
    plugin._save_json(plugin._ledger_path(), ledger)
    assert _gate(plugin, _done(artifacts=[str(p)]))["action"] == "block"


def test_ledger_key_is_private(plugin):
    plugin._ledger_key()
    assert (plugin._key_path().stat().st_mode & 0o777) == 0o600


def test_roll_audit_ship_never_releases_the_gate(plugin, ws):
    """P1-3: Taste Roll column verdicts share the ledger but not the gate."""
    p = page(ws)
    put_entry(plugin, p, source="roll-audit")
    assert _gate(plugin, _done(artifacts=[str(p)]))["action"] == "block"
    assert _gate(plugin, _done(metadata={"tastecheck": True}))["action"] == "block"


def test_error_outcome_does_not_supersede_a_ship(plugin, ws):
    p = page(ws)
    put_entry(plugin, p)
    plugin.record_verdict(str(p), {"verdict": "HOLD", "outcome": "ERROR", "error": "browser died"})
    assert _ledger(plugin)[-1]["verdict"] == "ERROR"
    assert _gate(plugin, _done(artifacts=[str(p)])) is None


# --- P2-12 / P1-5: target confinement; a typo records nothing -----------------

def test_typo_path_raises_and_records_nothing(plugin, ws):
    with pytest.raises(ValueError):
        plugin.audit("indx.html")
    assert not plugin._ledger_path().exists()
    out = json.loads(plugin._tool_audit({"target": "indx.html"}))
    assert out["ok"] is False and "does not exist" in out["error"]
    assert not plugin._ledger_path().exists()


@pytest.mark.parametrize("case", ["outside", "hidden", "not-html", "symlink-out", "scheme", "empty-dir"])
def test_local_targets_are_confined_to_the_workspace(plugin, ws, tmp_path, case):
    if case == "outside":
        t = page(tmp_path / "elsewhere")
    elif case == "hidden":
        t = page(ws, ".git/report.html")
    elif case == "not-html":
        t = page(ws, "notes.txt", "plain")
    elif case == "symlink-out":
        real = page(tmp_path / "secret")
        t = ws / "link.html"
        t.symlink_to(real)
    elif case == "scheme":
        t = "file:///etc/passwd"
    else:
        t = ws / "empty"
        t.mkdir()
    with pytest.raises(ValueError):
        plugin._resolve_target(str(t))


def test_directory_target_means_its_index(plugin, ws):
    p = page(ws, "site/index.html")
    assert plugin._resolve_target("site") == str(p.resolve())


# --- P1-5: the loopback server ------------------------------------------------

def _get(srv, path, host=None):
    conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=5)
    conn.putrequest("GET", path, skip_host=True)
    conn.putheader("Host", host or f"127.0.0.1:{srv.port}")
    conn.endheaders()
    r = conn.getresponse()
    body = r.read()
    conn.close()
    return r.status, body


def test_confined_server_serves_only_web_files_inside_root(plugin, ws, tmp_path):
    page(ws, "index.html", "<html>ok</html>")
    page(ws, "style.css", "body{}")
    page(ws, ".env", "SECRET=1")
    page(ws, "app.py", "print(1)")
    page(ws, ".hidden/page.html", "<html>h</html>")
    secret = page(tmp_path, "outside.html", "<html>secret</html>")
    (ws / "escape.html").symlink_to(secret)
    with plugin._ConfinedServer(ws) as srv:
        assert _get(srv, "/index.html") == (200, b"<html>ok</html>")
        assert _get(srv, "/")[0] == 200
        assert _get(srv, "/style.css")[0] == 200
        assert _get(srv, "/.env")[0] == 404
        assert _get(srv, "/%2eenv")[0] == 404
        assert _get(srv, "/app.py")[0] == 404
        assert _get(srv, "/.hidden/page.html")[0] == 404
        assert _get(srv, "/../outside.html")[0] == 404
        assert _get(srv, "/%2e%2e/outside.html")[0] == 404
        assert _get(srv, "/escape.html")[0] == 404
        assert _get(srv, "/index.html", host="evil.test")[0] == 403
        served = dict(srv.served)
    assert set(served) == {str((ws / "index.html").resolve()), str((ws / "style.css").resolve())}


def test_cdp_qa_no_longer_allows_file_access(plugin):
    for root in (Path(__file__).resolve().parents[3], plugin.VENDOR_DIR):
        cdp = root / "skills" / "tastecheck-pass" / "assets" / "cdp-qa.mjs"
        if cdp.exists():
            assert "allow-file-access-from-files" not in cdp.read_text(encoding="utf-8")


# --- end-to-end local audit through the loopback server -----------------------

def test_local_audit_records_page_and_subresources(plugin, ws, fake_cli):
    p = page(ws, "index.html", '<html><link rel="stylesheet" href="style.css"><body>x</body></html>')
    css = page(ws, "style.css", "body{color:#111}")
    fake_cli(fetching_cli("SHIP"))
    res = plugin.audit("index.html")
    assert res["verdict"] == "SHIP", res
    e = _ledger(plugin)[-1]
    assert e["verdict"] == "SHIP" and e["source"] == "tool"
    assert e["target"] == str(p.resolve())
    assert str(css.resolve()) in e["served"] and str(p.resolve()) in e["served"]
    assert _gate(plugin, _done(artifacts=[str(p)])) is None
    css.write_text("body{color:red}", encoding="utf-8")
    assert _gate(plugin, _done(artifacts=[str(p)]))["action"] == "block"


def test_page_changed_during_audit_is_error(plugin, ws, fake_cli):
    p = page(ws, "index.html", "<html>v1</html>")
    fake_cli(fetching_cli("SHIP", extra=f"open({str(p)!r}, 'w').write('<html>v2</html>')"))
    res = plugin.audit("index.html")
    assert res["verdict"] == "HOLD" and "changed" in res["error"]
    e = _ledger(plugin)[-1]
    assert e["verdict"] == "ERROR"
    assert _gate(plugin, _done(artifacts=[str(p)]))["action"] == "block"


def test_digest_is_taken_before_the_audit(plugin, ws, fake_cli):
    """P2-12: the bound digest is the pre-launch one, not whatever exists afterwards."""
    p = page(ws, "index.html", "<html>v1</html>")
    fake_cli(fetching_cli("HOLD", extra=f"open({str(p)!r}, 'w').write('<html>v2</html>')"))
    plugin.audit("index.html")
    import hashlib
    assert _ledger(plugin)[-1]["target_sha256"] == hashlib.sha256(b"<html>v1</html>").hexdigest()


# --- P3-13: corrupt ledger is backed up loudly and blocks the gate ------------

def test_corrupt_ledger_blocks_gate_and_is_backed_up(plugin, ws, caplog):
    p = page(ws)
    path = plugin._ledger_path()
    path.write_text("{not json", encoding="utf-8")
    res = _gate(plugin, _done(artifacts=[str(p)]))
    assert res["action"] == "block" and "unreadable" in res["message"]
    assert "unreadable" in plugin._slash("status")
    plugin.record_verdict("http://x.test", {"verdict": "HOLD"})
    backups = list(path.parent.glob("verdict_ledger.json.corrupt-*"))
    assert len(backups) == 1 and backups[0].read_text() == "{not json"
    assert len(_ledger(plugin)) == 1
    assert any("unreadable" in r.getMessage() for r in caplog.records)


# --- P3-13: slash parsing and gateway redaction --------------------------------

def test_unbalanced_quotes_get_a_message_not_an_exception(plugin):
    out = plugin._slash('audit "unterminated')
    assert out.startswith("Could not parse arguments")


def test_status_redacts_local_paths_on_gateway(plugin, runtime, ws):
    p = page(ws)
    put_entry(plugin, p, verdict="HOLD")
    local = plugin._slash("status")
    assert str(ws.resolve()) in local
    runtime.set_session_vars(platform="telegram", source="telegram", cwd=str(ws))
    remote = plugin._slash("status")
    assert str(ws.resolve()) not in remote and str(ws.parent) not in remote
    assert "index.html" in remote


# --- P2-8: config without a PluginContext; legacy data migration ---------------

def test_config_is_read_from_hermes_config_without_ctx(plugin, monkeypatch):
    fake = types.ModuleType("hermes_cli.config")
    fake.load_config_readonly = lambda: {
        "plugins": {"entries": {"tastecheck-hermes": {"settings": {"timeout_seconds": 42}}}}}
    pkg = types.ModuleType("hermes_cli")
    pkg.config = fake
    monkeypatch.setitem(sys.modules, "hermes_cli", pkg)
    monkeypatch.setitem(sys.modules, "hermes_cli.config", fake)
    plugin._ctx = None
    plugin._SETTINGS_CACHE.update(at=0.0, value={})
    assert plugin._cfg("timeout_seconds") == 42
    assert plugin._cfg("gate_completions") == plugin.DEFAULTS["gate_completions"]


def test_legacy_profile_is_copied_not_moved(plugin, hermes_home):
    old = hermes_home / "plugin-data" / "tastecheck" / "profile.json"
    old.parent.mkdir(parents=True)
    old.write_text('{"version": 1}', encoding="utf-8")
    plugin._MIGRATED.clear()
    new_dir = plugin._data_dir()
    assert new_dir.name == "tastecheck-hermes"
    assert (new_dir / "profile.json").read_text() == '{"version": 1}'
    assert old.exists()


# --- P1-3 / P2-8: dashboard roll audit ----------------------------------------

def _dashboard(monkeypatch):
    pytest.importorskip("fastapi")
    pytest.importorskip("pydantic")
    name = "tastecheck_dashboard_api_test"
    spec = importlib.util.spec_from_file_location(name, PLUGIN_DIR / "dashboard" / "plugin_api.py")
    mod = importlib.util.module_from_spec(spec)
    # Hermes' dashboard loader registers the module while its body runs (pydantic
    # resolves postponed annotations through sys.modules); do the same.
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    return mod


def test_roll_audit_records_once_as_roll_audit_and_never_lifts_gate(plugin, ws, tmp_path, monkeypatch):
    api = _dashboard(monkeypatch)
    half = api._load_agent_half()
    script = tmp_path / "fake_roll_cli.py"
    script.write_text("import json, os, sys, time, subprocess\n" + fetching_cli("SHIP"), encoding="utf-8")
    half._ctx = FakeCtx({"tastecheck_command": f"{sys.executable} {script}"})
    res = api.roll_audit(api.RollAuditRequest(html="<html><body>column</body></html>", label="r1"))
    assert res.verdict == "SHIP", res
    assert res.target.endswith(os.path.join("page", "column.html"))
    ledger = _ledger(plugin)
    assert len(ledger) == 1 and ledger[0]["source"] == "roll-audit"
    assert _gate(plugin, _done(metadata={"tastecheck": True}))["action"] == "block"
    assert _gate(plugin, _done(artifacts=[res.target]))["action"] == "block"
