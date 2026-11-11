"""The README discloses exactly the private Hermes imports the plugin makes."""

from __future__ import annotations

import re
from conftest import PLUGIN_DIR

PRIVATE = ("hermes_cli.kanban_db", "tools.kanban_tools")


def test_readme_names_both_private_imports():
    line = next(l for l in (PLUGIN_DIR / "README.md").read_text().splitlines() if l.startswith("- **Hermes imports:**"))
    assert "Two private imports" in line and "One private import" not in line
    for mod in PRIVATE:
        assert f"`{mod}`" in line, mod


def test_readme_matches_the_code():
    src = (PLUGIN_DIR / "__init__.py").read_text()
    assert re.search(r"from hermes_cli import kanban_db", src)
    assert re.search(r"from tools import kanban_tools", src)
