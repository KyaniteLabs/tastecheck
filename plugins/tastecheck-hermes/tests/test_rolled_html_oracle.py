"""Cross-language oracle: node builds rolled columns through the REAL plugin module
(stubbed SDK/react loader, exactly like the desktop harness); Python's stdlib
``html.parser.HTMLParser`` — a parser from a different language and codebase than
the plugin's scanner — then verifies where the roll attributes actually landed and
that comments/unrelated attribute values survive byte-for-byte.

Skipped without node (CI's plugin job installs node 22, so this runs there).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path

import pytest

NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node required to build rolled docs through plugin.js")

DESKTOP = Path(__file__).resolve().parents[1] / "desktop"

_BUILDER = r"""
const { mkdtempSync, writeFileSync, utimesSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const T0 = 1770000000
const root = mkdtempSync(join(tmpdir(), 'tc-oracle-'))
writeFileSync(join(root, 'page.html'), process.env.TC_HTML)
utimesSync(join(root, 'page.html'), T0 + 9, T0 + 9)
globalThis.__tc = { cwd: root, notifies: [], errors: [], workspaces: [], openWorkspaceBroken: false }
const mod = await import('./plugin.js')
const files = {
  folders: async () => [{ id: 'f1', name: 'proj', path: root }],
  list: async (f, rel) => { const { readdirSync } = await import('node:fs'); return { ok: true, truncated: false, entries: readdirSync(root, { withFileTypes: true }).map(e => ({ name: e.name, isDirectory: e.isDirectory() })) } },
  stat: async (f, rel) => { const { statSync } = await import('node:fs'); const st = statSync(join(root, rel)); return { ok: true, exists: true, isDirectory: st.isDirectory(), mtimeMs: st.mtimeMs, size: st.size } },
  readText: async (f, rel) => { const { readFileSync } = await import('node:fs'); return { ok: true, mtimeMs: 1, size: 1, text: readFileSync(join(root, rel), 'utf8') } }
}
const store = {}
const ctx = { files, rest: async () => ({ ok: true, verdict: 'SHIP', hold_reasons: [] }), storage: { get: (k, fb) => (k in store ? store[k] : fb), set: (k, v) => { store[k] = v } }, register(c) { return () => {} } }
mod.default.register(ctx)
const btn = ctx.registered && mod.default
const reg = ctx
mod.default.register(ctx)
// click through the composer button contributed at register time
const contributed = []
ctx.register = (c) => { contributed.push(c); return () => {} }
mod.default.register(ctx)
const action = contributed.find((c) => c.area === 'composer.actions')
action.render().props.onClick({ preventDefault: () => {} })
// poll until the pane has rendered a column with its srcDoc (10 s budget) instead
// of spinning a fixed number of event-loop turns
function column() {
  const ws = globalThis.__tc.workspaces.at(-1)
  if (!ws) return null
  const pane = ws.options.render()
  const strip = pane && pane.children && pane.children.find((c) => c && c.type === 'div' && c.props.style && c.props.style.overflowX === 'auto')
  const col = strip && strip.children && strip.children[1]
  if (!col || !col.children || !col.children[1]) return null
  const frame = typeof col.children[1].type === 'function' ? col.children[1].type(col.children[1].props) : col.children[1]
  return frame && frame.props && frame.props.srcDoc ? frame : null
}
const deadline = Date.now() + 10000
let frame = null
while (!(frame = column())) {
  if (Date.now() > deadline) throw new Error('rolled column never rendered')
  await new Promise((r) => setTimeout(r, 5))
}
process.stdout.write(JSON.stringify({ srcDoc: frame.props.srcDoc }))
"""


class _Oracle(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.html_tags = []
        self.comments = []

    def handle_starttag(self, tag, attrs):
        if tag == "html":
            self.html_tags.append(dict(attrs))

    def handle_comment(self, data):
        self.comments.append(data)


def _rolled(src_html: str) -> str:
    import os

    env = {**os.environ, "TC_HTML": src_html}
    res = subprocess.run(
        [NODE, "--input-type=module", "--import", "./tests/register.mjs", "-e", _BUILDER],
        cwd=str(DESKTOP), env=env, capture_output=True, text=True, timeout=120,
    )
    assert res.returncode == 0, f"builder failed: {res.stderr[-2000:]}"
    return json.loads(res.stdout)["srcDoc"]


def _parse(doc: str) -> _Oracle:
    o = _Oracle()
    o.feed(doc)
    o.close()
    return o


def test_roll_attributes_on_the_real_html_element_not_the_comment():
    original = ('<!doctype html><!-- example: <html lang="demo"> -->'
                '<html lang="en"><head></head><body><main><h1>My own work</h1>'
                '<p>Real project content.</p></main></body></html>')
    doc = _rolled(original)
    o = _parse(doc)
    assert len(o.html_tags) == 1, "exactly one REAL html element (comment spelling is not one)"
    attrs = o.html_tags[0]
    assert attrs["data-taste-roll"] == "1"
    assert attrs["lang"] == "en"
    assert attrs["data-ref"] and attrs["data-vibe"] and attrs["data-mode"] and attrs["data-sig"]
    assert any("<html lang=\"demo\">" in c for c in o.comments), "illustrative comment preserved"
    for c in o.comments:
        assert "data-taste-roll" not in c and "data-ref=" not in c, f"roll attrs leaked into comment: {c!r}"


def test_quoted_attribute_value_with_roll_words_survives_verbatim():
    original = ('<!doctype html><html lang="en" title="literal data-ref=\'keep\' text">'
                '<head><title>Q</title></head><body><p>Real project content.</p></body></html>')
    doc = _rolled(original)
    o = _parse(doc)
    (attrs,) = o.html_tags
    assert attrs["title"] == "literal data-ref='keep' text", "unrelated attribute value preserved exactly"
    assert attrs["data-taste-roll"] == "1"


def test_ordinary_document_gets_exactly_one_rolled_html():
    original = ('<!doctype html><html lang="en"><head><title>My App</title></head>'
                '<body><main><h1>My own work</h1><p>Real project content.</p></main></body></html>')
    doc = _rolled(original)
    o = _parse(doc)
    (attrs,) = o.html_tags
    assert attrs["data-taste-roll"] == "1"
    assert attrs["lang"] == "en"
    assert doc.count('data-taste-roll="1"') == 1
