"""tastecheck_command is split into argv without eating Windows backslash paths (X-SHLEX)."""

from __future__ import annotations


def test_windows_paths_stay_intact(plugin):
    split = plugin._split_command
    assert split(r"C:\Program Files\nodejs\node.exe", windows=True) == [r"C:\Program", r"Files\nodejs\node.exe"]
    assert split(r'"C:\Program Files\nodejs\node.exe" C:\tools\tastecheck.mjs --flag', windows=True) == [
        r"C:\Program Files\nodejs\node.exe", r"C:\tools\tastecheck.mjs", "--flag"]
    assert split(r"node \\server\share\tc.mjs", windows=True) == ["node", r"\\server\share\tc.mjs"]


def test_posix_keeps_shell_quoting_and_escapes(plugin):
    split = plugin._split_command
    assert split("node '/opt/my tools/tc.mjs' --x", windows=False) == ["node", "/opt/my tools/tc.mjs", "--x"]
    assert split(r"node /opt/my\ tools/tc.mjs", windows=False) == ["node", "/opt/my tools/tc.mjs"]


def test_default_follows_the_platform(plugin):
    import os

    assert plugin._split_command("node 'a b.mjs'") == (["node", "a b.mjs"] if os.name != "nt" else ["node", "a b.mjs"])
    assert plugin._split_command(r"node a\ b.mjs", windows=False) == ["node", "a b.mjs"]
