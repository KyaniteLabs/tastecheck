"""conftest finds the Hermes source root (so `hermes_cli` imports without PYTHONPATH) or says why it did not."""

from __future__ import annotations

import sys

from conftest import hermes_source_root, use_hermes_source_root


def _fake_source(root):
    (root / "hermes_cli").mkdir(parents=True)
    (root / "hermes_cli" / "__init__.py").write_text("")
    return root


def test_env_override_wins(tmp_path):
    src = _fake_source(tmp_path / "src")
    assert hermes_source_root({"HERMES_AGENT_SOURCE": str(src)}) == src


def test_hermes_home_checkout_is_found(tmp_path):
    src = _fake_source(tmp_path / "home" / "hermes-agent")
    assert hermes_source_root({"HERMES_HOME": str(tmp_path / "home")}) == src


def test_missing_source_is_none_not_an_error(tmp_path):
    assert hermes_source_root({"HERMES_AGENT_SOURCE": str(tmp_path / "nope"), "HERMES_HOME": str(tmp_path / "empty")}) is None


def test_use_appends_so_vendored_runtime_still_wins(tmp_path, monkeypatch):
    src = _fake_source(tmp_path / "src")
    monkeypatch.setattr(sys, "path", list(sys.path))
    assert use_hermes_source_root({"HERMES_AGENT_SOURCE": str(src)}, importable=False) == str(src)
    assert sys.path[-1] == str(src)
    n = len(sys.path)
    assert use_hermes_source_root({"HERMES_AGENT_SOURCE": str(src)}, importable=True) is None
    assert len(sys.path) == n
