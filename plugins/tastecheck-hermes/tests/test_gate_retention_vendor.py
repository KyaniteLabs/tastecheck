"""Regressions for the second Kai review round (fail-closed verdicts, retention grace,
the pre_tool_call completion gate, the vendored pinned CLI runner and env passthrough)."""

from __future__ import annotations

import io
import json
import os
import shutil
import tarfile
import textwrap
import time
from pathlib import Path

import pytest


# --- P1: fail-closed verdict boundary ----------------------------------------

def test_exit0_without_evidence_is_hold(plugin, fake_cli):
    fake_cli("print('all checks passed'); sys.exit(0)")
    res = plugin.audit("http://none.test")
    assert res["ok"] is False
    assert res["verdict"] == "HOLD"
    assert "fail closed" in res["error"]
    assert plugin._fmt(res).startswith("HOLD")


def test_exit0_ship_without_target_identity_is_hold(plugin, fake_cli):
    fake_cli("print(json.dumps({'verdict':'SHIP','holdReasons':[]})); sys.exit(0)")
    res = plugin.audit("http://anon.test")
    assert res["verdict"] == "HOLD"
    assert res["ok"] is False
    assert res.get("data") in (None, {})


def test_exit0_matching_ship_still_ships(plugin, fake_cli):
    fake_cli("print(json.dumps({'verdict':'SHIP','holdReasons':[],'target':sys.argv[2]})); sys.exit(0)")
    res = plugin.audit("http://good.test")
    assert res["verdict"] == "SHIP"
    assert res["ok"] is True


def test_evidence_file_without_target_identity_is_hold(plugin, fake_cli):
    body = (
        "import json, os, sys\n"
        "out = sys.argv[3]\n"
        "with open(os.path.join(out, 'evidence.json'), 'w') as f:\n"
        "    json.dump({'verdict': 'SHIP', 'holdReasons': []}, f)\n"
        "sys.exit(0)\n"
    )
    fake_cli(body)
    res = plugin.audit("http://anon2.test")
    assert res["verdict"] == "HOLD"
    assert res["ok"] is False


# --- P2: retention grace protects in-flight and just-created artifacts -------

def _age(path: Path, seconds: float) -> None:
    stamp = time.time() - seconds
    os.utime(path, (stamp, stamp))


def test_prune_audits_never_touches_fresh_dirs(plugin, tmp_path):
    root = tmp_path / "audits"
    root.mkdir()
    for i in range(25):
        d = root / f"20260101-0000{i:02d}-x"
        d.mkdir()
        _age(d, 7200)
    in_progress = root / "20260101-000000-inflight"
    in_progress.mkdir()  # fresh mtime: an audit another process is running right now

    plugin._prune_audits(root)

    assert in_progress.exists()
    survivors = sorted(d.name for d in root.iterdir())
    old_kept = [d for d in root.iterdir() if d.name != in_progress.name]
    assert len(old_kept) == plugin.AUDITS_KEEP
    # 25 aged dirs, keep the 20 newest by name: the 5 oldest are deleted.
    assert "20260101-000000-x" not in survivors
    assert "20260101-000004-x" not in survivors
    assert "20260101-000005-x" in survivors  # newest of the aged set kept
    assert "20260101-000024-x" in survivors


def test_prune_files_keeps_just_written_result(plugin, tmp_path):
    root = tmp_path / "results"
    root.mkdir()
    for i in range(25):
        f = root / f"20260101-0000{i:02d}-x.json"
        f.write_text("{}", encoding="utf-8")
        _age(f, 7200)
    fresh = root / "20260101-235959-justwritten.json"
    fresh.write_text("{}", encoding="utf-8")

    plugin._prune_files(root)

    assert fresh.exists()
    old_kept = [f for f in root.iterdir() if f.name != fresh.name]
    assert len(old_kept) == plugin.AUDITS_KEEP


def test_retention_grace_scales_with_timeout(plugin):
    plugin._ctx.config["timeout_seconds"] = 240
    assert plugin._retention_grace() == 600.0
    plugin._ctx.config["timeout_seconds"] = 600
    assert plugin._retention_grace() == 1200.0


# --- pre_tool_call completion gate --------------------------------------------

def _ui_completion(summary: str) -> dict:
    return {"task_id": "t_x", "summary": summary}


def test_gate_blocks_frontend_completion_without_ship(plugin):
    blocked = plugin._on_pre_tool("kanban_complete", _ui_completion("Landing page redesign is done and ready to ship"))
    assert isinstance(blocked, dict)
    assert blocked["action"] == "block"
    assert "SHIP" in blocked["message"] and "tastecheck" in blocked["message"]


def test_gate_blocks_request_review_too(plugin):
    blocked = plugin._on_pre_tool("kanban_request_review", _ui_completion("UI polish finished, review please"))
    assert blocked and blocked["action"] == "block"


def test_gate_allows_non_frontend_completion(plugin):
    assert plugin._on_pre_tool("kanban_complete", _ui_completion("Fixed the billing rounding bug")) is None


def test_gate_ignores_other_tools_even_with_ui_words(plugin):
    assert plugin._on_pre_tool("terminal", {"command": "open the landing page"}) is None
    assert plugin._on_pre_tool("write_file", {"path": "ui/dashboard.py"}) is None


def _ship_entry(plugin, target="http://127.0.0.1:5173", verdict="SHIP", age=0, **extra):
    """A ledger entry written through the real recorder (carries workspace binding)."""
    plugin._save_json(plugin._ledger_path(), [])
    plugin.record_verdict(target, {"verdict": verdict, "data": {"holdReasons": extra.pop("holdReasons", [])}}, )
    ledger = plugin._load_json(plugin._ledger_path(), [])
    ledger[-1].update(extra)
    if age:
        ledger[-1]["ts"] = int(time.time()) - age
    plugin._save_json(plugin._ledger_path(), ledger)
    return ledger[-1]


def test_gate_allows_after_fresh_ship(plugin):
    _ship_entry(plugin)
    assert plugin._on_pre_tool("kanban_complete", _ui_completion("Frontend hero done, shipping")) is None


def test_gate_blocks_on_stale_ship(plugin):
    _ship_entry(plugin, age=int(plugin.DEFAULTS["gate_ship_ttl_seconds"]) + 60)
    blocked = plugin._on_pre_tool("kanban_complete", _ui_completion("Frontend hero done, shipping"))
    assert blocked and blocked["action"] == "block"
    assert "stale" in blocked["message"]


def test_gate_blocks_on_hold_only_ledger(plugin):
    _ship_entry(plugin, verdict="HOLD", holdReasons=["contrast 2.9:1 on body text"])
    blocked = plugin._on_pre_tool("kanban_complete", _ui_completion("Frontend hero done, shipping"))
    assert blocked and blocked["action"] == "block"
    assert "HOLD" in blocked["message"] and "contrast" in blocked["message"]


def test_gate_blocks_on_corrupt_ledger(plugin):
    plugin._ledger_path().write_text("{not json", encoding="utf-8")
    blocked = plugin._on_pre_tool("kanban_complete", _ui_completion("Frontend hero done, shipping"))
    assert blocked and blocked["action"] == "block"


def test_gate_disabled_by_config(plugin):
    plugin._ctx.config["gate_completions"] = False
    assert plugin._on_pre_tool("kanban_complete", _ui_completion("Landing page done")) is None


def test_gate_ignores_non_dict_args(plugin):
    assert plugin._on_pre_tool("kanban_complete", None) is None
    assert plugin._on_pre_tool("kanban_complete", "summary=done") is None


def test_gate_directive_matches_hermes_veto_contract(plugin):
    blocked = plugin._on_pre_tool("kanban_complete", _ui_completion("Site redesign done"))
    assert set(blocked) == {"action", "message"}
    assert isinstance(blocked["message"], str) and blocked["message"]


# --- registration + manifest consistency --------------------------------------

def test_register_registers_gate_hook_and_manifest_matches(plugin):
    from conftest import FakeCtx

    ctx = FakeCtx()
    plugin.register(ctx)
    hook_names = {name for name, _cb in ctx.hooks}
    assert {"pre_llm_call", "pre_tool_call", "post_tool_call"} <= hook_names
    assert "tastecheck" in ctx.commands
    assert sorted(ctx.tools) == ["tastecheck_audit", "tastecheck_profile", "tastecheck_version"]

    manifest = (Path(plugin.__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
    hooks_section = manifest.split("provides_hooks:", 1)[1].split("config_schema:", 1)[0]
    for hook in sorted(hook_names):
        assert f"- {hook}" in hooks_section


# --- scrubbed env passthrough --------------------------------------------------

def test_scrubbed_env_passes_browser_paths_and_drops_secrets(plugin, monkeypatch):
    monkeypatch.setenv("CHROME_PATH", "/opt/google/chrome/chrome")
    monkeypatch.setenv("TASTECHECK_CHROME", "/usr/bin/chromium")
    monkeypatch.setenv("SUPER_SECRET_TOKEN", "s3cr3t")
    env = plugin._scrubbed_env()
    assert env["CHROME_PATH"] == "/opt/google/chrome/chrome"
    assert env["TASTECHECK_CHROME"] == "/usr/bin/chromium"
    assert "SUPER_SECRET_TOKEN" not in env
    assert env["TASTECHECK_PROFILE"].endswith("profile.json")
    assert env["NO_COLOR"] == "1"


# --- vendored pinned CLI -------------------------------------------------------

_TOP = "tastecheck-5168f89bdd2759b99b81545896c47638727cda14"


def _tar_bytes(files: dict, raw_members=()):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, data in files.items():
            ti = tarfile.TarInfo(f"{_TOP}/{name}")
            ti.size = len(data)
            tar.addfile(ti, io.BytesIO(data))
        for ti in raw_members:
            tar.addfile(ti)
    return buf.getvalue()


_GOOD_CLI = (
    "#!/usr/bin/env node\n"
    "console.log(JSON.stringify({verdict:'SHIP',holdReasons:[],target:process.argv[3]}));\n"
)


def test_vendored_cli_materializes_and_caches(plugin, monkeypatch):
    blob = _tar_bytes({"bin/tastecheck.mjs": _GOOD_CLI.encode(),
                       "package.json": b'{"name":"tastecheck","version":"1.7.0"}'})
    fetches = []
    monkeypatch.setattr(plugin, "_fetch_pinned_tarball", lambda: fetches.append(1) or blob)

    res = plugin.run_tastecheck(["audit", "http://vend.test", "/tmp/unused", "--json"])
    assert res["ok"] is True, res
    assert res["data"]["target"] == "http://vend.test"
    assert res["data"]["verdict"] == "SHIP"

    # second call is served from the vendor cache: no second fetch
    res2 = plugin.run_tastecheck(["audit", "http://vend2.test", "/tmp/unused", "--json"])
    assert res2["ok"] is True
    assert len(fetches) == 1

    stamp = json.loads((plugin._data_dir() / "vendor" / plugin.PINNED_SHA / "vendor-stamp.json")
                       .read_text(encoding="utf-8"))
    assert stamp["url"] == plugin.PINNED_TARBALL
    assert stamp["bytes"] == len(blob) and len(stamp["sha256"]) == 64


def test_vendor_tarball_missing_bin_refused(plugin, monkeypatch):
    blob = _tar_bytes({"package.json": b'{}'})
    monkeypatch.setattr(plugin, "_fetch_pinned_tarball", lambda: blob)
    res = plugin.run_tastecheck(["audit", "http://x.test", "/tmp/unused", "--json"])
    assert res["ok"] is False
    assert "bin/tastecheck.mjs" in res["error"]
    assert not plugin._vendor_bin().exists()


def test_vendor_tarball_traversal_refused(plugin, monkeypatch):
    evil = tarfile.TarInfo(f"{_TOP}/../evil.txt")
    evil.size = 4
    blob = _tar_bytes({"bin/tastecheck.mjs": _GOOD_CLI.encode()},
                      raw_members=[(evil, b"pwn\n")][0:1] and [evil] or [])
    # add the payload via a second pass (tarfile needs data bound at addfile time)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        ti = tarfile.TarInfo(f"{_TOP}/bin/tastecheck.mjs")
        ti.size = len(_GOOD_CLI)
        tar.addfile(ti, io.BytesIO(_GOOD_CLI.encode()))
        evil2 = tarfile.TarInfo(f"{_TOP}/../evil.txt")
        evil2.size = 4
        tar.addfile(evil2, io.BytesIO(b"pwn\n"))
    monkeypatch.setattr(plugin, "_fetch_pinned_tarball", lambda: buf.getvalue())

    res = plugin.run_tastecheck(["audit", "http://x.test", "/tmp/unused", "--json"])
    assert res["ok"] is False
    assert "unsafe archive" in res["error"]
    vendor_root = plugin._data_dir() / "vendor"
    assert not (vendor_root.parent / "evil.txt").exists()
    assert not (vendor_root / "evil.txt").exists()
    assert not plugin._vendor_bin().exists()


def test_vendor_tarball_symlink_refused(plugin, monkeypatch):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        link = tarfile.TarInfo(f"{_TOP}/bin/tastecheck.mjs")
        link.type = tarfile.SYMTYPE
        link.linkname = "/etc/passwd"
        tar.addfile(link)
    monkeypatch.setattr(plugin, "_fetch_pinned_tarball", lambda: buf.getvalue())

    res = plugin.run_tastecheck(["audit", "http://x.test", "/tmp/unused", "--json"])
    assert res["ok"] is False
    assert "unsafe archive" in res["error"]
    assert not plugin._vendor_bin().exists()


def test_command_override_still_wins(plugin, fake_cli):
    fake_cli("print(json.dumps({'verdict':'HOLD','holdReasons':['x'],'target':sys.argv[2]})); sys.exit(1)")
    res = plugin.audit("http://override.test")
    assert res["verdict"] == "HOLD"


# --- call-path robustness: Chrome cold-start retry -----------------------------

def test_cold_start_devtoolsactiveport_retried_once(plugin, fake_cli, tmp_path):
    counter = tmp_path / "calls"
    counter.write_text("0", encoding="utf-8")
    body = textwrap.dedent(f"""
        import os, sys, json
        c = int(open({str(counter)!r}).read()) + 1
        open({str(counter)!r}, 'w').write(str(c))
        if c == 1:
            sys.stderr.write("cdp-qa: browser started but DevToolsActivePort never appeared\\n")
            sys.exit(2)
        print(json.dumps({{'verdict': 'SHIP', 'holdReasons': [], 'target': sys.argv[2]}}))
        sys.exit(0)
    """)
    fake_cli(body)
    res = plugin.audit("http://coldstart.test")
    assert res["verdict"] == "SHIP", res
    assert counter.read_text() == "2"


def test_persistent_tool_error_is_hold_no_retry(plugin, fake_cli, tmp_path):
    counter = tmp_path / "calls"
    counter.write_text("0", encoding="utf-8")
    body = textwrap.dedent(f"""
        import os, sys
        c = int(open({str(counter)!r}).read()) + 1
        open({str(counter)!r}, 'w').write(str(c))
        sys.stderr.write("browser unavailable\\n")
        sys.exit(2)
    """)
    fake_cli(body)
    res = plugin.audit("http://dead.test")
    assert res["verdict"] == "HOLD"
    assert "browser unavailable" in res["error"]
    assert counter.read_text() == "1"


def test_scrubbed_env_pins_long_tmpdir_short(plugin, monkeypatch):
    # Chrome's SingletonSocket path caps at ~104 chars; a long TMPDIR kills the
    # browser before DevToolsActivePort appears (found live on nucbox 2026-11-08).
    monkeypatch.setenv("TMPDIR", "/home/simon/.hermes-org/profiles/security/cache/scratch/tc-audit/tmp")
    env = plugin._scrubbed_env()
    assert env["TMPDIR"] == "/tmp"
    monkeypatch.setenv("TMPDIR", "/tmp")
    assert plugin._scrubbed_env()["TMPDIR"] == "/tmp"
    monkeypatch.delenv("TMPDIR", raising=False)
    assert plugin._scrubbed_env().get("TMPDIR") in (None, "/tmp")
