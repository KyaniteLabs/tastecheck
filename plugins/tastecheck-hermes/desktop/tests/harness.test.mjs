/**
 * Clean-room harness for desktop/plugin.js — runs the REAL plugin module in
 * node with stubbed '@hermes/plugin-sdk' and 'react' (the same two specifiers
 * the Desktop loader allowlists and rewrites). This exercises the plugin's
 * own logic end to end: registration, folder grant flow, deterministic HTML
 * discovery (never tasteroll.html), roll column accumulation, the workspace
 * pane contract (stable id), and the preview-frame sandbox attributes.
 *
 * It is NOT a live Desktop integration claim: the real renderer, registry and
 * pane host are stubbed. In-app click-through remains a desktop-side step.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PLUGIN = resolve(import.meta.dirname, '..', 'plugin.js')

function freshGlobals(overrides = {}) {
  globalThis.__tc = {
    cwd: '',
    notifies: [],
    errors: [],
    workspaces: [],
    ...overrides
  }
}

/* A per-test in-memory ctx.files implementing the PluginFiles result shape. */
function makeFiles(root, extra = {}) {
  const list = async (folderId, rel) => {
    if (folderId !== 'f1') return { ok: false, error: 'unavailable', message: 'bad folder' }
    const dir = rel ? join(root, rel) : root
    const entries = listing(dir, rel)
    return { ok: true, entries, truncated: false }
  }
  return {
    folders: async () => extra.folders ?? [{ id: 'f1', name: 'proj', path: root }],
    requestFolder: async () => (typeof extra.requestFolder === 'function'
      ? extra.requestFolder()
      : { ok: true, folder: { id: 'f1', name: 'proj', path: root } }),
    list,
    stat: async (folderId, rel) => {
      try {
        readFileSync(join(root, rel))
        return { ok: true, exists: true, isDirectory: false }
      } catch {
        return { ok: true, exists: false }
      }
    },
    readText: async (folderId, rel) => {
      if (folderId !== 'f1') return { ok: false, error: 'unavailable', message: 'bad folder' }
      try {
        const text = readFileSync(join(root, rel), 'utf8')
        return { ok: true, mtimeMs: 1, size: text.length, text }
      } catch {
        return { ok: false, error: 'not-found', message: 'no such file' }
      }
    }
  }
}

function listing(dir, rel) {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: rel ? `${rel}/${e.name}` : e.name
    }))
  } catch {
    return []
  }
}

function makeCtx(files, storageInit = {}) {
  const store = { ...storageInit }
  return {
    files,
    storage: {
      get: (k, fb) => (k in store ? JSON.parse(JSON.stringify(store[k])) : fb),
      set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)) },
      remove: (k) => { delete store[k] }
    },
    _store: store,
    registered: [],
    register(c) { this.registered.push(c); return () => {} }
  }
}

async function importFresh() {
  const url = `file://${PLUGIN}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`
  return import(url)
}

/* The real React onClick is fire-and-forget; the plugin's runRoll is async.
 * Drain the queue so every stubbed await settles before we assert. */
const click = async (btn) => {
  btn.props.onClick({ preventDefault: () => {} })
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r))
}

function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-'))
  writeFileSync(join(root, 'tasteroll.html'), '<html><body>canned demo — never this</body></html>')
  writeFileSync(join(root, 'notes.md'), '# notes')
  writeFileSync(join(root, 'app.html'),
    '<html lang="en"><head><title>My App</title></head><body><main><h1>My own work</h1><p>Real project content.</p></main></body></html>')
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs', 'deep.html'), '<html><body>deeper page</body></html>')
  return root
}

function paneColumns(rendered) {
  const strip = rendered.children.find((c) => c.type === 'div' && c.props.style && c.props.style.overflowX === 'auto')
  assert.ok(strip, 'pane has a horizontal column strip')
  return strip.children
}

test('register contributes a Taste Roll composer action', async () => {
  freshGlobals({ cwd: '/x' })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles('/x'))
  mod.default.register(ctx)
  const action = ctx.registered.find((c) => c.area === 'composer.actions' && c.id === 'taste-roll')
  assert.ok(action, 'composer action registered')
  const btn = action.render()
  assert.equal(btn.type, 'button')
  assert.match(btn.children.join(' '), /Taste Roll/)
  assert.equal(typeof btn.props.onClick, 'function')
  assert.equal(mod.default.id, 'tastecheck')
})

test('clicks accumulate restyled columns of the user page; tasteroll.html never used', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const realNow = Date.now
  Date.now = () => 1770000000000
  try {
    const mod = await importFresh()
    const ctx = makeCtx(makeFiles(root))
    mod.default.register(ctx)
    const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()

    await click(btn)
    await click(btn)
    await click(btn)

    const ws = globalThis.__tc.workspaces
    assert.ok(ws.length === 3, 'one openWorkspace per click')
    assert.ok(ws.every((w) => w.id === 'tastecheck:tasteroll'), 'stable pane id')

    const pane = ws[ws.length - 1].options.render()
    const cols = paneColumns(pane)
    assert.equal(cols.length, 4, 'original + three rolls')

    /* each column div: [header, ColumnFrame]; function components must be
     * invoked to materialize the iframe element (React does this at render). */
    const frameProps = (c) => {
      const cf = c.children[1]
      const rendered = typeof cf.type === 'function' ? cf.type(cf.props) : cf
      return rendered.props
    }
    const [original, ...rolls] = cols.map(frameProps)
    assert.equal(original.srcDoc, readFileSync(join(root, 'app.html'), 'utf8'), 'left column is the user page UNCHANGED')
    assert.ok(!original.srcDoc.includes('data-taste-roll'))

    for (const colProps of rolls) {
      assert.equal(colProps.sandbox, 'allow-forms allow-scripts', 'preview-frame sandbox')
      assert.equal(colProps.allow, 'fullscreen')
      assert.equal(colProps.referrerPolicy, 'no-referrer')
      assert.ok(colProps.srcDoc.includes('data-taste-roll="1"'), 'roll attrs applied')
      assert.match(colProps.srcDoc, /data-ref="[a-zA-Z]+"/)
      assert.match(colProps.srcDoc, /data-vibe="[a-z]+"/)
      assert.match(colProps.srcDoc, /data-mode="(light|dark|dual)"/)
      assert.match(colProps.srcDoc, /data-sig="[a-z-]+"/)
      assert.ok(colProps.srcDoc.includes('tastecheck-roll'), 'roll stylesheet injected')
      assert.ok(colProps.srcDoc.includes('My own work'), 'user content preserved')
      assert.ok(!colProps.srcDoc.includes('canned demo'), 'never the canned page')
    }

    const header = pane.children[0].children.map((c) => typeof c === 'string' ? c : (c.children || []).join('')).join(' ')
    assert.ok(header.includes('app.html'), 'chosen file is named in the pane header')

    const saved = ctx._store.comparisons[`roll:${root}`]
    assert.ok(saved && saved.columns.length === 3, 'history persisted')
    assert.ok(saved.columns.every((c) => !('srcdoc' in c) && !('srcDoc' in c)), 'storage stays slim')
  } finally {
    Date.now = realNow
  }
})

test('same frozen clock → same roll sequence (seeded engine determinism)', async () => {
  const root = fixtureProject()
  const realNow = Date.now
  Date.now = () => 1770000000000
  try {
    const rollLabels = async () => {
      freshGlobals({ cwd: root })
      const mod = await importFresh()
      const ctx = makeCtx(makeFiles(root))
      mod.default.register(ctx)
      const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
      await click(btn)
      await click(btn)
      const pane = globalThis.__tc.workspaces.at(-1).options.render()
      return paneColumns(pane).slice(1).map((c) => {
        const cf = c.children[1]
        const srcDoc = (typeof cf.type === 'function' ? cf.type(cf.props) : cf).props.srcDoc
        const m = srcDoc.match(/data-ref="(\w+)" data-vibe="(\w+)" data-mode="(\w+)" data-sig="([\w-]+)"/)
        return m && `${m[1]}/${m[2]}/${m[3]}/${m[4]}`
      })
    }
    assert.deepEqual(await rollLabels(), await rollLabels())
  } finally {
    Date.now = realNow
  }
})

test('no HTML besides tasteroll.html → honest error, no pane', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-empty-'))
  writeFileSync(join(root, 'tasteroll.html'), '<html><body>demo</body></html>')
  writeFileSync(join(root, 'main.py'), 'print(1)')
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.equal(globalThis.__tc.workspaces.length, 0, 'no pane opened')
  assert.ok(globalThis.__tc.errors.length === 1, 'exactly one error toast')
  assert.match(globalThis.__tc.errors[0], /no HTML/i)
  assert.match(globalThis.__tc.errors[0], /tasteroll\.html is never used/)
})

test('folder grant is requested when cwd is not covered', async () => {
  const root = fixtureProject()
  let asked = 0
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const files = makeFiles(root, {
    folders: [],
    requestFolder: async () => { asked += 1; return { ok: true, folder: { id: 'f1', name: 'proj', path: root } } }
  })
  const ctx = makeCtx(files)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.equal(asked, 1, 'picker shown once')
  assert.equal(globalThis.__tc.workspaces.length, 1)
})

test('cancelled grant → polite notify, no pane, no read', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const files = makeFiles(root, { folders: [], requestFolder: async () => ({ ok: true, folder: null }) })
  const ctx = makeCtx(files)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.equal(globalThis.__tc.workspaces.length, 0)
  assert.ok(globalThis.__tc.notifies.some((n) => /grant/i.test(n)))
})
