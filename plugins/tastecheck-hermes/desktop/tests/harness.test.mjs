/**
 * Clean-room harness for desktop/plugin.js — runs the REAL plugin module in
 * node with stubbed '@hermes/plugin-sdk' and 'react' (the same two specifiers
 * the Desktop loader allowlists and rewrites). This exercises the plugin's
 * own logic end to end: registration (composer button AND palette entry),
 * folder grant flow, workspace-scoped surface resolution (newest-edit HTML,
 * CSS→nearest-HTML, never a sibling project, never tasteroll.html), valid
 * roll-attribute surgery on the real <html> element (parsed-tag controls, not
 * substring checks), roll column accumulation, per-column SHIP/HOLD gate
 * stamps (fail closed through ctx.rest), the workspace pane contract (stable
 * id, feature-detected BEFORE side effects, no phantom persist on host
 * failure) and the preview-frame sandbox attributes.
 *
 * It is NOT a live Desktop integration claim: the real renderer, registry and
 * pane host are stubbed. In-app click-through is the desktop-side step
 * (demo evidence), and rendered computed-style proof comes from the real
 * browser audit (agent half), not from here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, utimesSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PLUGIN = resolve(import.meta.dirname, '..', 'plugin.js')

function freshGlobals(overrides = {}) {
  globalThis.__tc = {
    cwd: '',
    notifies: [],
    errors: [],
    workspaces: [],
    openWorkspaceBroken: false,
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
        const st = statSync(join(root, rel))
        return { ok: true, exists: true, isDirectory: st.isDirectory(), mtimeMs: st.mtimeMs, size: st.size }
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

function makeCtx(files, storageInit = {}, rest = null) {
  const store = { ...storageInit }
  return {
    files,
    rest,
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

/* A ctx.rest stand-in for the plugin's own backend namespace: queue verdicts. */
const okShip = { ok: true, verdict: 'SHIP', hold_reasons: [], evidence_dir: '/ev/1', target: '/t/column.html' }
const okHold = { ok: false, verdict: 'HOLD', hold_reasons: ['contrast 2.9:1 on body text', 'h1 clips at 320px'], evidence_dir: '/ev/2', target: '/t/column.html' }
function restQueue(...responses) {
  const queue = [...responses]
  const calls = []
  const fn = async (path, opts) => {
    calls.push({ path, opts })
    const r = queue.shift()
    if (r instanceof Error) throw r
    return r
  }
  fn.calls = calls
  return fn
}

async function importFresh() {
  const url = `file://${PLUGIN}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`
  return import(url)
}

/* The real React onClick is fire-and-forget; the plugin's runRoll + audit are
 * async. Drain the queue so every stubbed await settles before we assert. */
const click = async (btn) => {
  btn.props.onClick({ preventDefault: () => {} })
  for (let i = 0; i < 80; i++) await new Promise((r) => setImmediate(r))
}

/* Pin mtimes explicitly — surface resolution is newest-edit-wins. */
const T0 = 1770000000
const age = (root, rel, t) => utimesSync(join(root, rel), t, t)

function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-'))
  writeFileSync(join(root, 'tasteroll.html'), '<html><body>canned demo — never this</body></html>')
  writeFileSync(join(root, 'notes.md'), '# notes')
  writeFileSync(join(root, 'app.html'),
    '<!doctype html><html lang="en"><head><title>My App</title></head><body><main><h1>My own work</h1><p>Real project content.</p></main></body></html>')
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs', 'deep.html'), '<html><body>deeper page</body></html>')
  age(root, 'docs/deep.html', T0)
  age(root, 'tasteroll.html', T0 + 5)
  age(root, 'notes.md', T0 + 5)
  age(root, 'app.html', T0 + 30) /* newest HTML = the user's actual surface */
  return root
}

function paneColumns(rendered) {
  const strip = rendered.children.find((c) => c && c.type === 'div' && c.props.style && c.props.style.overflowX === 'auto')
  assert.ok(strip, 'pane has a horizontal column strip')
  return strip.children
}

/* Materialize one column's iframe props (function components invoked). */
function frameProps(col) {
  const cf = col.children[1]
  const rendered = typeof cf.type === 'function' ? cf.type(cf.props) : cf
  return rendered.props
}

/* All text under a React-ish tree (strings, children recursed, function
 * components invoked to their rendered element). */
function allText(node, out = []) {
  if (typeof node === 'string') out.push(node)
  else if (node && typeof node === 'object') {
    if (typeof node.type === 'function') {
      allText(node.type(node.props), out)
    } else if (typeof node.children !== 'undefined') {
      [].concat(node.children).forEach((c) => allText(c, out))
    }
  }
  return out
}

/* ---- R1 control: an INDEPENDENT lexical oracle ----------------
 * The old parseHtmlOpenTag regex shared the implementation's blind spot (it
 * matched `<html` inside comments). This oracle walks tokens — comments,
 * doctypes, raw-text elements — and reads attributes ONLY off the first REAL
 * open tag, so roll attributes landing inside a comment fail loudly. */
const ORACLE_RAW_TEXT = ['script', 'style', 'textarea', 'title', 'xmp']

function lexRealOpenTags(doc, want = 'html') {
  /* All REAL open tags named `want` (comment/raw-text aware): [{ attrs, tag }].
   * Also returns every comment's verbatim text for preservation asserts. */
  const out = []
  const comments = []
  let i = 0
  while (i < doc.length) {
    const lt = doc.indexOf('<', i)
    if (lt < 0) break
    if (doc.startsWith('<!--', lt)) {
      const e = doc.indexOf('-->', lt + 4)
      comments.push(doc.slice(lt, e < 0 ? doc.length : e + 3))
      i = e < 0 ? doc.length : e + 3
      continue
    }
    if (doc.startsWith('<!', lt) || doc.startsWith('</', lt)) {
      const gt = doc.indexOf('>', lt)
      i = gt < 0 ? doc.length : gt + 1
      continue
    }
    const nameM = /^<([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(doc.slice(lt, lt + 40))
    if (!nameM) { i = lt + 1; continue }
    const name = nameM[1].toLowerCase()
    let q = null
    let j = lt + 1 + nameM[1].length
    for (; j < doc.length; j++) {
      const c = doc[j]
      if (q) { if (c === q) q = null } else if (c === '"' || c === "'") q = c
      else if (c === '>') break
    }
    if (j >= doc.length) { i = lt + 1; continue }
    if (name === want) {
      const attrText = doc.slice(lt + 1 + nameM[1].length, j)
      const attrs = {}
      const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      let m
      while ((m = re.exec(attrText))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4]
      out.push({ attrs, tag: doc.slice(lt, j + 1) })
    }
    if (ORACLE_RAW_TEXT.includes(name)) {
      const closeRe = new RegExp('</\\s*' + name + '\\s*>', 'i')
      const cm = closeRe.exec(doc.slice(j + 1))
      i = cm ? j + 1 + cm.index + cm[0].length : doc.length
      continue
    }
    i = j + 1
  }
  return { tags: out, comments }
}

function parseHtmlOpenTag(doc) {
  const { tags } = lexRealOpenTags(doc, 'html')
  assert.ok(tags.length >= 1, 'doc has a real <html> open tag (not one inside a comment)')
  return { attrs: tags[0].attrs, tag: tags[0].tag, attrText: tags[0].tag, realOpens: tags.length }
}

function assertValidRolledDoc(srcDoc, original) {
  const { tags, comments } = lexRealOpenTags(srcDoc, 'html')
  assert.equal(tags.length, 1, 'exactly one REAL <html> open tag (comments do not count)')
  const { attrs, tag } = tags[0]
  assert.equal(attrs['data-taste-roll'], '1')
  assert.match(attrs['data-roll'] || '', /^s\d+$/)
  assert.ok(attrs['data-ref'] && attrs['data-vibe'] && attrs['data-mode'] && attrs['data-sig'])
  assert.ok(!tag.includes('>>'), 'no doubled >')
  assert.ok(!/>\s+data-/.test(tag), 'no attributes emitted after the tag close (R1 defect shape)')
  /* roll attributes must NEVER appear inside a comment (R1 defect) */
  for (const c of comments) {
    assert.ok(!/data-taste-roll|data-roll=|data-ref=|data-vibe=|data-sig=/.test(c),
      `roll attributes leaked into a comment: ${c}`)
  }
  assert.equal((srcDoc.match(/data-taste-roll="1"/g) || []).length, 1, 'roll marker exactly once')
  assert.ok(srcDoc.includes('tastecheck-roll'), 'roll stylesheet injected')
  if (original) {
    for (const keep of ['My own work', 'Real project content.']) assert.ok(srcDoc.includes(keep), `user content preserved: ${keep}`)
    assert.ok(!srcDoc.includes('canned demo'), 'never the canned page')
  }
  return attrs
}

/* ------------------------------------------------------------------ tests */

test('register contributes composer action AND palette entry; id matches backend namespace', async () => {
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
  const palette = ctx.registered.find((c) => c.area === 'palette')
  assert.ok(palette, 'palette contribution registered (R5)')
  assert.equal(palette.id, 'taste-roll')
  assert.equal(palette.data.label, 'Taste Roll: restyle my page')
  assert.equal(typeof palette.data.run, 'function')
  assert.equal(mod.default.id, 'tastecheck-hermes', 'id aligns with the package folder (ctx.rest namespace)')
})

test('palette run behaves like the button click (same lane)', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const rest = restQueue(okShip)
  const ctx = makeCtx(makeFiles(root), {}, rest)
  mod.default.register(ctx)
  const palette = ctx.registered.find((c) => c.area === 'palette')
  palette.data.run()
  for (let i = 0; i < 80; i++) await new Promise((r) => setImmediate(r))
  assert.ok(globalThis.__tc.workspaces.length >= 1, 'pane opened from palette run')
  assert.equal(rest.calls.length, 1, 'gate ran')
})

test('clicks accumulate GATED restyled columns of the user page; original stays unchanged', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const realNow = Date.now
  Date.now = () => 1770000000000
  try {
    const mod = await importFresh()
    const rest = restQueue(okShip, okHold, okShip)
    const ctx = makeCtx(makeFiles(root), {}, rest)
    mod.default.register(ctx)
    const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()

    await click(btn)
    await click(btn)
    await click(btn)

    const ws = globalThis.__tc.workspaces
    assert.ok(ws.length >= 3, 'openWorkspace called (per click, plus gate re-renders)')
    assert.ok(ws.every((w) => w.id === 'tastecheck:tasteroll'), 'stable pane id')

    const pane = ws[ws.length - 1].options.render()
    const cols = paneColumns(pane)
    assert.equal(cols.length, 4, 'original + three rolls — no column discarded')

    const [original, ...rolls] = cols.map(frameProps)
    assert.equal(original.srcDoc, readFileSync(join(root, 'app.html'), 'utf8'), 'left column is the user page UNCHANGED')
    assert.ok(!original.srcDoc.includes('data-taste-roll'))

    rolls.forEach((colProps) => {
      assert.equal(colProps.sandbox, 'allow-forms allow-scripts', 'preview-frame sandbox')
      assert.equal(colProps.allow, 'fullscreen')
      assert.equal(colProps.referrerPolicy, 'no-referrer')
      assertValidRolledDoc(colProps.srcDoc, readFileSync(join(root, 'app.html'), 'utf8'))
    })

    /* R2: per-column gate stamps — SHIP, HOLD and the hold reasons show, and
     * the HOLD column is still here (visible). */
    const texts = cols.map((c) => allText(c.children[0]).join(' '))
    assert.match(texts[1], /SHIP/)
    assert.match(texts[2], /HOLD/)
    assert.match(texts[2], /contrast/)
    assert.match(texts[3], /SHIP/)
    assert.ok(texts.slice(1).every((t) => /s\d+/.test(t)), 'roll id labeled per column')

    /* the gate audited the EXACT generated column srcdocs */
    assert.equal(rest.calls.length, 3)
    rest.calls.forEach((call, i) => {
      assert.equal(call.path, '/roll-audit')
      assert.equal(call.opts.method, 'POST')
      assert.equal(call.opts.body.html, rolls[i].srcDoc, 'gate input is that column\'s exact srcdoc')
      assert.match(call.opts.body.label, /s\d+ /, 'label carries the roll id')
    })

    const header = allText(pane.children[0]).join(' ')
    assert.ok(header.includes('app.html'), 'chosen file is named in the pane header')

    const saved = ctx._store.comparisons[`roll:${root}`]
    assert.ok(saved && saved.columns.length === 3, 'history persisted')
    assert.ok(saved.columns.every((c) => !('srcdoc' in c) && !('srcDoc' in c)), 'storage stays slim')
  } finally {
    Date.now = realNow
  }
})

test('R1: pre-rolled and oddly-quoted <html> attributes are replaced, not duplicated', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-quirks-'))
  /* existing roll attrs + single quotes + a quoted '>' inside an attr value */
  writeFileSync(join(root, 'index.html'),
    `<!doctype html><html lang='en' data-taste-roll="9" data-roll="s999" data-ref="old" data-x="a>b"><head><title>Q</title></head><body><h1>My own work</h1><p>Real project content.</p></body></html>`)
  age(root, 'index.html', T0 + 9)
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const rest = restQueue(okShip)
  const ctx = makeCtx(makeFiles(root), {}, rest)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const srcDoc = frameProps(paneColumns(globalThis.__tc.workspaces.at(-1).options.render())[1]).srcDoc
  const { attrs } = parseHtmlOpenTag(srcDoc)
  assert.equal(attrs['lang'], 'en', 'user attribute preserved')
  assert.equal(attrs['data-x'], 'a>b', 'quoted > inside an attribute survives')
  assert.equal(attrs['data-taste-roll'], '1', 'old marker replaced')
  assert.notEqual(attrs['data-ref'], 'old', 'stale roll attr replaced')
  assert.equal((srcDoc.match(/data-taste-roll=/g) || []).length, 1, 'marker exactly once')
  assert.equal((srcDoc.match(/data-roll=/g) || []).length, 1)
})

test('R1: fragment and body-only documents become valid rolled documents', async () => {
  /* An earlier version clicked the sticky newer body.html twice and never
   * covered frag.html. Two FRESH plugin instances/workspaces — one fixture each. */
  for (const [name, file, content] of [
    ['frag', 'frag.html', '<h1>My own work</h1><p>Real project content.</p>'],
    ['body', 'body.html', '<body><h1>My own work</h1><p>Real project content.</p></body>']
  ]) {
    const root = mkdtempSync(join(tmpdir(), `tasteroll-${name}-`))
    writeFileSync(join(root, file), content)
    age(root, file, T0)
    freshGlobals({ cwd: root })
    const mod = await importFresh()
    const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
    mod.default.register(ctx)
    const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
    await click(btn)
    const cols = paneColumns(globalThis.__tc.workspaces.at(-1).options.render())
    assert.equal(cols.length, 2, `${name}: original + one roll`)
    assertValidRolledDoc(frameProps(cols[1]).srcDoc)
  }
})

test('R1: roll attributes land on the REAL html element, never inside a comment', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-comment-'))
  const original = '<!doctype html><!-- example: <html lang="demo"> --><html lang="en"><head></head><body><main><h1>My own work</h1><p>Real project content.</p></main></body></html>'
  writeFileSync(join(root, 'index.html'), original)
  age(root, 'index.html', T0 + 9)
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const srcDoc = frameProps(paneColumns(globalThis.__tc.workspaces.at(-1).options.render())[1]).srcDoc
  const attrs = assertValidRolledDoc(srcDoc, original)
  assert.equal(attrs.lang, 'en', 'real element keeps its own attributes')
  /* the illustrative comment survives byte-for-byte and takes NO attributes */
  assert.ok(srcDoc.includes('<!-- example: <html lang="demo"> -->'),
    'comment preserved verbatim (roll attrs must not land inside it)')
  assert.equal((srcDoc.match(/lang="demo"/g) || []).length, 1, 'the commented html is untouched')
  /* raw regex counting sees two <html spellings; only one is real — the point
   * of the R1 finding. */
  assert.equal((srcDoc.match(/<html[\s>]/gi) || []).length, 2, 'comment spelling still present as text')
})

test('R1: roll-like text inside a quoted attribute value survives verbatim', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-quoted-'))
  const original = `<!doctype html><html lang="en" title="literal data-ref='keep' text"><head><title>Q</title></head><body><h1>My own work</h1><p>Real project content.</p></body></html>`
  writeFileSync(join(root, 'index.html'), original)
  age(root, 'index.html', T0 + 9)
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const srcDoc = frameProps(paneColumns(globalThis.__tc.workspaces.at(-1).options.render())[1]).srcDoc
  const attrs = assertValidRolledDoc(srcDoc, original)
  assert.equal(attrs.title, "literal data-ref='keep' text",
    'unrelated attribute value with roll-like words preserved EXACTLY (was corrupted before)')
  assert.equal(attrs.lang, 'en')
  assert.ok(srcDoc.includes('title="literal data-ref=\'keep\' text"'), 'verbatim bytes kept')
})

test('R1: </head> inside a comment never takes the roll stylesheet', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-headcomment-'))
  const original = '<!doctype html><!-- </head> sketch --><html lang="en"><head><title>H</title></head><body><h1>My own work</h1><p>Real project content.</p></body></html>'
  writeFileSync(join(root, 'index.html'), original)
  age(root, 'index.html', T0 + 9)
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const srcDoc = frameProps(paneColumns(globalThis.__tc.workspaces.at(-1).options.render())[1]).srcDoc
  assertValidRolledDoc(srcDoc, original)
  /* the style lands after the REAL </head>, not inside the comment */
  const commentEnd = srcDoc.indexOf('<!-- </head> sketch -->') + '<!-- </head> sketch -->'.length
  const styleAt = srcDoc.indexOf('tastecheck-roll')
  assert.ok(styleAt > commentEnd, 'roll stylesheet injected after the real </head>, not in the comment')
  assert.ok(srcDoc.includes('<!-- </head> sketch -->'), 'comment preserved')
})

/* ---- R3: a supported active-file seam binds the surface --------------- */

test('R3: active non-frontend file → nearest HTML in ITS directory, not the newest anywhere', async () => {
  /* Reviewer boundary fixture: docs/notes.md is newest and "current",
   * docs/page.html is nearest, root index.html is a NEWER html elsewhere. */
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-seam-notes-'))
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'index.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'docs', 'page.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'docs', 'notes.md'), '# notes')
  age(root, 'index.html', T0 + 20)
  age(root, 'docs/page.html', T0)
  age(root, 'docs/notes.md', T0 + 50) /* the file they are actually on */
  freshGlobals({ cwd: root, activeFile: join(root, 'docs', 'notes.md') })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('docs/page.html'), 'nearest HTML to the ACTIVE file is chosen')
  assert.match(header, /notes\.md/, 'the active non-frontend file is named')
  assert.match(header, /active file/, 'the strip says the choice came from the active surface')
  assert.ok(!header.includes('no active-file API'), 'seam present — no fallback label')
})

test('R3: an OLDER active HTML beats a newer edit elsewhere', async () => {
  const root = fixtureProject() /* app.html newest… */
  writeFileSync(join(root, 'other.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  age(root, 'other.html', T0 + 90) /* newer than app.html */
  freshGlobals({ cwd: root, activeFile: join(root, 'app.html') }) /* but they are ON app.html */
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('app.html'), 'the ACTIVE html wins over a newer edit')
  assert.match(header, /your active file/)
})

test('R3: active CSS → nearest HTML to THAT CSS', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-seam-css-'))
  mkdirSync(join(root, 'styles'))
  writeFileSync(join(root, 'index.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'styles', 'deep.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'styles', 'main.css'), 'body{margin:0}')
  /* index.html is NEWER, but styles/deep.html is in the SAME directory as the
   * active CSS (hops 0 vs 1): the seam binds, mtime does not. */
  age(root, 'index.html', T0 + 30)
  age(root, 'styles/deep.html', T0)
  freshGlobals({ cwd: root, activeFile: join(root, 'styles', 'main.css') })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.match(header, /styles\/deep\.html/, 'nearest HTML to the active CSS (same dir), not the newer root page')
  assert.match(header, /main\.css/, 'the active CSS is named')
})

test('R3: active file OUTSIDE the workspace cwd is ignored (fallback, honestly labeled)', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root, activeFile: '/somewhere/else/entirely/notes.md' })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('app.html'), 'fallback still rolls the newest HTML in the workspace')
  assert.match(header, /no active-file API/, 'the strip says the host gave no usable active file')
})

test('R3: no seam at all → honest label + explicit tap-a-file handoff in the strip', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root }) /* no activeFile at all */
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip, okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.match(header, /no active-file API/, 'honest fallback label (mtime is never claimed as the active surface)')
  /* the picker row exists with the workspace's HTML files */
  const picker = pane.children.find((c) => c && typeof c.type === 'function')
  assert.ok(picker, 'surface picker row present')
  const pickerEl = picker.type(picker.props)
  const pickerText = allText(pickerEl).join(' ')
  assert.ok(pickerText.includes('app.html') && pickerText.includes('docs/deep.html'),
    'both workspace HTML files offered')
  /* explicit handoff: tapping docs/deep.html rebinds the surface and rolls IT */
  const deepBtn = pickerEl.children.find((c) => c && c.type === 'button' && c.children[0] === 'docs/deep.html')
  assert.ok(deepBtn, 'deep.html offered as a button')
  await click(deepBtn)
  const pane2 = globalThis.__tc.workspaces.at(-1).options.render()
  const header2 = allText(pane2.children[0]).join(' ')
  assert.ok(header2.includes('docs/deep.html'), 'surface switched to the named file')
  assert.match(header2, /you picked this file/, 'the strip credits the explicit handoff')
  assert.ok(!header2.includes('no active-file API'), 'no fallback label once the user named the surface')
  const cols = paneColumns(pane2)
  assert.equal(cols.length, 2, 'fresh comparison: original + first roll of the picked surface')
  assert.ok(frameProps(cols[0]).srcDoc.includes('deeper page'), 'left column is the PICKED page')
})

test('R2: gate unreachable → visible fail-closed HOLD on every column', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const rest = restQueue(new Error('gateway down'), { ok: true, verdict: 'WEIRD' })
  const ctx = makeCtx(makeFiles(root), {}, rest)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  await click(btn)
  const cols = paneColumns(globalThis.__tc.workspaces.at(-1).options.render())
  assert.equal(cols.length, 3, 'both columns stay visible despite gate failures')
  const texts = cols.slice(1).map((c) => allText(c.children[0]).join(' '))
  assert.ok(texts.every((t) => /HOLD/.test(t)), 'fail-closed HOLD stamps')
  assert.match(texts[0], /gateway down/)
  assert.match(texts[1], /no valid verdict/)
})

test('R2: no ctx.rest at all → honest unavailable HOLD, column still shown', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, null)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const cols = paneColumns(globalThis.__tc.workspaces.at(-1).options.render())
  assert.equal(cols.length, 2)
  const text = allText(cols[1].children[0]).join(' ')
  assert.match(text, /HOLD/)
  assert.match(text, /gate unavailable/)
})

test('R3: newest-edited HTML wins over shallower/older files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-newest-'))
  writeFileSync(join(root, 'index.html'), '<html><body>shallow old</body></html>')
  mkdirSync(join(root, 'deep'))
  writeFileSync(join(root, 'deep', 'page.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  age(root, 'index.html', T0)
  age(root, 'deep/page.html', T0 + 50) /* newest — this is the surface they're on */
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('deep/page.html'), 'the newest HTML is chosen and NAMED')
  assert.ok(frameProps(paneColumns(pane)[0]).srcDoc.includes('My own work'))
})

test('R3: newest edit is CSS → nearest HTML in the same workspace is rolled and named', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-css-'))
  mkdirSync(join(root, 'styles'))
  writeFileSync(join(root, 'about.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'index.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  writeFileSync(join(root, 'styles', 'main.css'), 'body{margin:0}')
  age(root, 'about.html', T0)
  age(root, 'index.html', T0 + 1)
  age(root, 'styles/main.css', T0 + 60) /* newest edit is CSS */
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('index.html'), 'nearest HTML chosen and named')
  assert.match(header, /main\.css/, 'the CSS edit that drove the choice is named')
})

test('R3: a sibling project under a wider grant is NEVER substituted', async () => {
  const wsRoot = mkdtempSync(join(tmpdir(), 'tasteroll-sib-'))
  mkdirSync(join(wsRoot, 'project'))
  writeFileSync(join(wsRoot, 'sibling.html'), '<html><body>sibling project — never this</body></html>')
  writeFileSync(join(wsRoot, 'project', 'notes.md'), 'no html here')
  const files = makeFiles(wsRoot) /* grant root = wsRoot (an ANCESTOR of cwd) */
  freshGlobals({ cwd: join(wsRoot, 'project') })
  const mod = await importFresh()
  const ctx = makeCtx(files, {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const text = allText(pane).join(' ')
  assert.match(text, /No HTML/, 'no-HTML state shown in the strip (R5), not a sibling substitution')
  assert.ok(!text.includes('sibling project'), 'sibling never read or shown')
})

test('R5: no HTML in workspace → strip says so in the pane (not only a toast)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tasteroll-empty-'))
  writeFileSync(join(root, 'tasteroll.html'), '<html><body>demo</body></html>')
  writeFileSync(join(root, 'main.py'), 'print(1)')
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.ok(globalThis.__tc.workspaces.length >= 1, 'pane opened with the no-HTML state')
  const text = allText(globalThis.__tc.workspaces.at(-1).options.render()).join(' ')
  assert.match(text, /No HTML/)
  assert.match(text, /tasteroll\.html is never used/)
  assert.ok(globalThis.__tc.notifies.some((n) => /No HTML/.test(n)), 'plus a toast')
  assert.ok(!ctx._store.comparisons, 'nothing persisted for the no-HTML state')
})

test('R5: host without openWorkspace → honest compatibility error, NO reads, NO persist', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const sdk = await import('./stubs/plugin-sdk.mjs')
  const files = makeFiles(root)
  const reads = []
  const origRead = files.readText
  files.readText = async (...a) => { reads.push(a[1]); return origRead(...a) }
  const ctx = makeCtx(files, {}, restQueue(okShip))
  const prev = sdk.host.openWorkspace
  sdk.host.openWorkspace = undefined
  try {
    mod.default.register(ctx)
    const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
    await click(btn)
    assert.equal(reads.length, 0, 'no user file read before the capability check')
    assert.equal(globalThis.__tc.workspaces.length, 0)
    assert.ok(!ctx._store.comparisons, 'no phantom rolled column persisted')
    assert.equal(globalThis.__tc.errors.length, 1, 'one honest compatibility error')
    assert.match(globalThis.__tc.errors[0], /openWorkspace/)
  } finally {
    sdk.host.openWorkspace = prev
  }
})

test('R5: openWorkspace throws mid-click → column rolled back, nothing persisted', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root, openWorkspaceBroken: true })
  const mod = await importFresh()
  const rest = restQueue(okShip)
  const ctx = makeCtx(makeFiles(root), {}, rest)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.ok(!ctx._store.comparisons, 'failed host open persists nothing')
  assert.equal(globalThis.__tc.errors.filter((e) => /comparison pane/.test(e)).length, 1, 'honest error about the pane')
  assert.equal(rest.calls.length, 0, 'gate never ran for a column the host refused')
})

test('sticky surface: later clicks keep rolling the same named file', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const rest = restQueue(okShip, okShip)
  const ctx = makeCtx(makeFiles(root), {}, rest)
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  /* a NEWER html appears after the first roll — the comparison stays on its surface */
  writeFileSync(join(root, 'other.html'), '<html><body><h1>My own work</h1><p>Real project content.</p></body></html>')
  age(root, 'other.html', T0 + 90)
  await click(btn)
  const pane = globalThis.__tc.workspaces.at(-1).options.render()
  const header = allText(pane.children[0]).join(' ')
  assert.ok(header.includes('app.html'), 'same surface kept while it exists')
  assert.ok(frameProps(paneColumns(pane)[0]).srcDoc.includes('My own work'))
})

test('same frozen clock → same roll sequence (seeded engine determinism)', async () => {
  const root = fixtureProject()
  const realNow = Date.now
  Date.now = () => 1770000000000
  try {
    const rollLabels = async () => {
      freshGlobals({ cwd: root })
      const mod = await importFresh()
      const ctx = makeCtx(makeFiles(root), {}, restQueue(okShip, okShip))
      mod.default.register(ctx)
      const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
      await click(btn)
      await click(btn)
      const cols = paneColumns(globalThis.__tc.workspaces.at(-1).options.render())
      return cols.slice(1).map((c) => {
        const srcDoc = frameProps(c).srcDoc
        const m = srcDoc.match(/data-ref="(\w+)" data-vibe="(\w+)" data-mode="(\w+)" data-sig="([\w-]+)"/)
        return m && `${m[1]}/${m[2]}/${m[3]}/${m[4]}`
      })
    }
    assert.deepEqual(await rollLabels(), await rollLabels())
  } finally {
    Date.now = realNow
  }
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
  const ctx = makeCtx(files, {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.equal(asked, 1, 'picker shown once')
  assert.ok(globalThis.__tc.workspaces.length >= 1)
})

test('cancelled grant → polite notify, no pane, no read', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  const mod = await importFresh()
  const files = makeFiles(root, { folders: [], requestFolder: async () => ({ ok: true, folder: null }) })
  const reads = []
  const orig = files.readText
  files.readText = async (...a) => { reads.push(a[1]); return orig(...a) }
  const ctx = makeCtx(files, {}, restQueue(okShip))
  mod.default.register(ctx)
  const btn = ctx.registered.find((c) => c.id === 'taste-roll').render()
  await click(btn)
  assert.equal(globalThis.__tc.workspaces.length, 0)
  assert.equal(reads.length, 0)
  assert.ok(globalThis.__tc.notifies.some((n) => /grant/i.test(n)))
  assert.ok(!ctx._store.comparisons)
})

test('restored columns show "not audited this session"; a stray stored verdict never stamps SHIP', async () => {
  const root = fixtureProject()
  freshGlobals({ cwd: root })
  /* Session 1: one real, gated roll — storage keeps { seed, roll } only. */
  const first = makeCtx(makeFiles(root), {}, restQueue(okShip))
  ;(await importFresh()).default.register(first)
  await click(first.registered.find((c) => c.id === 'taste-roll').render())
  const stored = JSON.parse(JSON.stringify(first._store.comparisons))
  const key = `roll:${root}`
  assert.deepEqual(Object.keys(stored[key].columns[0]).sort(), ['roll', 'seed'], 'no gate is persisted')

  for (const stray of [{}, { verdict: 'SHIP' }, { gate: 'SHIP', reasons: [] }, { verdict: 'SHIP', restored: false }]) {
    freshGlobals({ cwd: root })
    const seeded = JSON.parse(JSON.stringify(stored))
    Object.assign(seeded[key].columns[0], stray)
    /* Session 2: the stored column comes back; the new click is HOLD. */
    const ctx = makeCtx(makeFiles(root), { comparisons: seeded }, restQueue(okHold))
    ;(await importFresh()).default.register(ctx)
    await click(ctx.registered.find((c) => c.id === 'taste-roll').render())
    const cols = paneColumns(globalThis.__tc.workspaces.at(-1).options.render())
    assert.equal(cols.length, 3, 'original + restored + new')
    const restored = allText(cols[1].children[0]).join(' ')
    assert.match(restored, /not audited this session/, `restored column with ${JSON.stringify(stray)}`)
    assert.doesNotMatch(restored, /SHIP|gate passed/, `stored ${JSON.stringify(stray)} must not stamp SHIP`)
    assert.match(allText(cols[2].children[0]).join(' '), /HOLD/)
  }
})
