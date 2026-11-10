"""Fail-closed verdicts, retention grace, registration, the vendored hash-verified CLI,
the child env allowlist and the cold-start retry deadline."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
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


# --- registration + manifest consistency --------------------------------------

def test_register_registers_gate_hook_and_manifest_matches(plugin):
    from conftest import FakeCtx

    ctx = FakeCtx()
    plugin.register(ctx)
    hook_names = {name for name, _cb in ctx.hooks}
    assert hook_names == {"pre_llm_call", "pre_tool_call"}
    assert "tastecheck" in ctx.commands
    assert sorted(ctx.tools) == ["tastecheck_audit", "tastecheck_profile", "tastecheck_version"]

    manifest = (Path(plugin.__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
    hooks_section = manifest.split("provides_hooks:", 1)[1].split("config_schema:", 1)[0]
    declared = {line.strip()[2:] for line in hooks_section.splitlines() if line.strip().startswith("- ")}
    assert declared == hook_names
    for key in plugin.DEFAULTS:
        assert f"\n  {key}:" in manifest, f"config_schema lacks {key}"


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


def test_scrubbed_env_never_passes_node_options(plugin, monkeypatch):
    """P2-10: NODE_OPTIONS can preload arbitrary code into the CLI."""
    monkeypatch.setenv("NODE_OPTIONS", "--require /tmp/evil.js")
    assert "NODE_OPTIONS" not in plugin._scrubbed_env()


# --- vendored, hash-verified CLI -------------------------------------------------

REPO = Path(__file__).resolve().parents[3]


def test_vendored_cli_matches_repository_source(plugin):
    """P1-6: the plugin ships the CLI; CI keeps it identical to the repo files."""
    manifest = json.loads(plugin.VENDOR_MANIFEST.read_text(encoding="utf-8"))
    assert "bin/tastecheck.mjs" in manifest["files"]
    for rel, sha in manifest["files"].items():
        assert hashlib.sha256((plugin.VENDOR_DIR / rel).read_bytes()).hexdigest() == sha, rel
        src = REPO / rel
        if src.exists():  # repository checkout (not an installed plugin)
            assert src.read_bytes() == (plugin.VENDOR_DIR / rel).read_bytes(), f"vendor drift: {rel}"


def test_no_network_fetch_code_left(plugin):
    src = Path(plugin.__file__).read_text(encoding="utf-8")
    for needle in ("codeload", "urlopen", "tarfile", "PINNED_SHA"):
        assert needle not in src


def _copy_vendor(plugin, tmp_path, monkeypatch):
    vroot = tmp_path / "vendor-copy"
    shutil.copytree(plugin.VENDOR_DIR.parent, vroot)
    monkeypatch.setattr(plugin, "VENDOR_DIR", vroot / "tastecheck")
    monkeypatch.setattr(plugin, "VENDOR_MANIFEST", vroot / "MANIFEST.json")
    return vroot


def test_verified_cli_accepts_pristine_vendor(plugin, tmp_path, monkeypatch):
    vroot = _copy_vendor(plugin, tmp_path, monkeypatch)
    cmd = plugin._verified_cli()
    assert cmd == ["node", str((vroot / "tastecheck" / "bin" / "tastecheck.mjs").resolve())]


def test_tampered_vendor_file_refuses_to_run(plugin, tmp_path, monkeypatch):
    vroot = _copy_vendor(plugin, tmp_path, monkeypatch)
    cdp = vroot / "tastecheck" / "skills" / "tastecheck-pass" / "assets" / "cdp-qa.mjs"
    cdp.write_text(cdp.read_text(encoding="utf-8") + "\n// injected\n", encoding="utf-8")
    res = plugin.run_tastecheck(["--version"])
    assert res["ok"] is False
    assert "does not match MANIFEST.json" in res["error"]


def test_missing_vendor_file_refuses_to_run(plugin, tmp_path, monkeypatch):
    vroot = _copy_vendor(plugin, tmp_path, monkeypatch)
    (vroot / "tastecheck" / "package.json").unlink()
    res = plugin.run_tastecheck(["--version"])
    assert res["ok"] is False and "missing" in res["error"]


def test_manifest_path_escape_refused(plugin, tmp_path, monkeypatch):
    vroot = _copy_vendor(plugin, tmp_path, monkeypatch)
    m = json.loads((vroot / "MANIFEST.json").read_text())
    m["files"]["../outside.mjs"] = "0" * 64
    (vroot / "MANIFEST.json").write_text(json.dumps(m))
    res = plugin.run_tastecheck(["--version"])
    assert res["ok"] is False and "escapes" in res["error"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node required")
def test_vendored_cli_runs_version(plugin):
    """The real vendored entry point runs (no browser needed for --version)."""
    res = plugin.version()
    assert res["ok"] is True, res
    pkg = json.loads((plugin.VENDOR_DIR / "package.json").read_text())
    assert str(res.get("data", res.get("text"))).strip() == pkg["version"]


def test_non_audit_commands_fail_on_exit_1(plugin, fake_cli):
    """P3-13: exit 1 is HOLD only for audit; for profile/version it is a failure."""
    fake_cli("print('{}'); sys.exit(1)")
    assert plugin.run_tastecheck(["profile", "show"])["ok"] is False
    assert plugin.run_tastecheck(["--version"])["ok"] is False
    assert plugin.run_tastecheck(["audit", "http://x.test", "/tmp/x", "--json"])["ok"] is True


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
    # browser before DevToolsActivePort appears.
    monkeypatch.setenv("TMPDIR", "/home/example/.hermes/profiles/sample/cache/scratch/tastecheck-audit/tmp")
    env = plugin._scrubbed_env()
    assert env["TMPDIR"] == "/tmp"
    monkeypatch.setenv("TMPDIR", "/tmp")
    assert plugin._scrubbed_env()["TMPDIR"] == "/tmp"
    monkeypatch.delenv("TMPDIR", raising=False)
    assert plugin._scrubbed_env().get("TMPDIR") in (None, "/tmp")


def test_cold_start_retry_shares_one_deadline(plugin, fake_cli, tmp_path):
    """P1-6: the retry runs inside the same overall timeout, and only if >= 20 s remain."""
    counter = tmp_path / "calls"
    counter.write_text("0", encoding="utf-8")
    body = textwrap.dedent(f"""
        import sys, time
        c = int(open({str(counter)!r}).read()) + 1
        open({str(counter)!r}, 'w').write(str(c))
        time.sleep(1.5)
        sys.stderr.write("DevToolsActivePort never appeared\\n")
        sys.exit(2)
    """)
    fake_cli(body, timeout_seconds=21)
    t0 = time.monotonic()
    res = plugin.audit("http://deadline.test")
    assert res["verdict"] == "HOLD"
    assert counter.read_text() == "1", "no retry once fewer than 20 s of the deadline remain"
    assert time.monotonic() - t0 < 21
