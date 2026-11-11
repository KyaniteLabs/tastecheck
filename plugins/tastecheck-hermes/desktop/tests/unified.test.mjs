/* The Resonant Field theme folded into Taste Roll: one taste, two inputs.
 * Loads the BUILT plugin.js against an SDK that HAS the themes area (the
 * clean-room stub deliberately doesn't, which proves older Desktops still load
 * Taste Roll alone), and drives the theme's own Appearance card. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const stubs = new URL('./stubs/', import.meta.url)
const dir = mkdtempSync(join(tmpdir(), 'tc-unified-'))
const sdk = join(dir, 'sdk.mjs')
writeFileSync(sdk, `export * from ${JSON.stringify(new URL('plugin-sdk.mjs', stubs).href)}
export const THEMES_AREA = 'themes'
export const APPEARANCE_AREAS = { extra: 'appearance.extra' }
export const Button = 'Button', ListRow = 'ListRow', ToggleRow = 'ToggleRow'
export const Select = 'Select', SelectContent = 'SelectContent', SelectItem = 'SelectItem', SelectTrigger = 'SelectTrigger', SelectValue = 'SelectValue'
export const requested = []
export const requestTheme = n => (requested.push(n), true)
export const useTheme = () => ({ themeName: 'resonant-field-indigo', resolvedMode: 'dark' })
export const atom = v => { let x = v; return { get: () => x, set: n => { x = n } } }
export const useValue = a => a.get()
`)
const src = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')
  .replaceAll("from '@hermes/plugin-sdk'", `from ${JSON.stringify(pathToFileURL(sdk).href)}`)
  .replaceAll("from 'react'", `from ${JSON.stringify(new URL('react.mjs', stubs).href)}`)
let n = 0
async function load() {
  const file = join(dir, `plugin-${++n}.mjs`)
  writeFileSync(file, src)
  return import(pathToFileURL(file).href)
}
const mock = await import(pathToFileURL(sdk).href)

function fakeCtx(store = {}) {
  const live = new Map()
  const timers = new Set()
  let seq = 0
  return {
    live,
    store,
    storage: {
      get: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
      set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)) },
      remove: (k) => { delete store[k] }
    },
    register(c) { const key = ++seq; live.set(key, c); return () => live.delete(key) },
    onDispose() {},
    setTimeout(fn) { timers.add(fn); return () => timers.delete(fn) },
    flush() { const due = [...timers]; timers.clear(); due.forEach((fn) => fn()) }
  }
}
const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((x) => walk(x, fn))
  fn(node)
  if (typeof node.type === 'function' && node.type.name === 'Swatches') walk(node.type(node.props), fn)
  walk(node.props?.children, fn)
  walk(node.children, fn)
}

async function boot(store) {
  globalThis.__tc = { cwd: '', notifies: [], errors: [], workspaces: [] }
  mock.requested.length = 0
  const mod = await load()
  const ctx = fakeCtx(store)
  mod.default.register(ctx)
  const themes = () => [...ctx.live.values()].filter((c) => c.area === 'themes').map((c) => c.data)
  const card = () => [...ctx.live.values()].find((c) => c.area === 'appearance.extra').render()
  const button = (label) => { let f; walk(card(), (x) => x.type === 'Button' && x.props.children === label && (f = x)); return f }
  const range = (label) => { let f; walk(card(), (x) => typeof x.type === 'function' && x.type.name === 'Range' && x.props.label === label && (f = x)); return f }
  return { mod, ctx, themes, button, range, taste: () => ctx.store.taste }
}

const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))

test('one plugin: Taste Roll plus the six Resonant Field themes, and no Your-taste theme without evidence', async () => {
  const t = await boot()
  assert.equal(t.mod.__theme.RF_ON, true)
  assert.deepEqual(t.themes().map((x) => x.name).sort(), [
    'resonant-field-daylight', 'resonant-field-graphite', 'resonant-field-indigo',
    'resonant-field-rosi', 'resonant-field-verdant', 'resonant-field-walnut'
  ])
  assert.ok([...t.ctx.live.values()].some((c) => c.id === 'taste-roll'), 'Taste Roll button is still there')
  assert.equal(globalThis.__tc.errors.length, 0)
})

test('theme choices move the colour-field posterior; a Your-taste theme appears and never switches the theme', async () => {
  const t = await boot()
  t.button('Walnut').props.onClick()
  assert.equal(t.taste().themeN, 1)
  assert.deepEqual(t.taste().post.field.walnut, [1.5, 1])
  assert.equal(t.themes().find((x) => x.name === 'resonant-field-taste'), undefined, 'one pick is not yet evidence')
  t.button('Walnut').props.onClick()
  const mine = t.themes().find((x) => x.name === 'resonant-field-taste')
  assert.ok(mine, 'two picks lean the taste: the theme is offered')
  assert.equal(mine.label, 'Resonant Field · Your taste')
  assert.match(mine.description, /leaning Walnut/)
  const walnut = t.themes().find((x) => x.name === 'resonant-field-walnut')
  assert.deepEqual(mine.darkColors, walnut.darkColors, 'built by the same buildTheme, so the same floors')
  assert.deepEqual(mock.requested, ['resonant-field-walnut', 'resonant-field-walnut'], 'only the user\'s own picks switch themes, never the learner')
})

test('a custom tune votes once for the nearest preset, not once per settle', async () => {
  const t = await boot()
  t.range('Surface hue').props.onChange(64)
  t.ctx.flush()
  const after1 = t.taste().themeN
  t.range('Surface hue').props.onChange(60)
  t.ctx.flush()
  assert.equal(t.taste().themeN, after1, 'still nearest the same preset: no second vote')
  assert.equal(after1, 1)
})

test('theme votes steer Taste Roll colours: learned rolls lean to the chosen field', async () => {
  const { mod } = await boot()
  let a = 7
  const rng = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const s = {}
  const store = { get: (k, d) => (k in s ? s[k] : d), set: (k, v) => { s[k] = JSON.parse(JSON.stringify(v)) } }
  const taste = mod.createTaste(store, rng)
  for (let i = 0; i < 6; i++) taste.observeTheme({ kind: 'preset', id: 'resonant-field-verdant' })
  taste.rate({ ref: 'Swiss', vibe: 'serious', mode: 'light', sig: 'rule', field: 'verdant' }, 'random', 1)
  let learned = 0, verdant = 0
  for (let i = 0; i < 200; i++) {
    const p = taste.choose(500 + i * 7919)
    if (p.src !== 'learned') continue
    learned++
    if (p.roll.field === 'verdant') verdant++
  }
  assert.ok(verdant / learned > 2 / 6, `verdant leans learned rolls past double chance (${verdant}/${learned}, chance is 1/6)`)
  assert.equal(taste.stats().learned.n + taste.stats().random.n, 1, 'theme votes stay out of the honesty check')
  taste.reset()
  assert.equal(taste.stats().theme, 0)
  assert.deepEqual(taste._state().post.field.verdant, [1, 1], 'Reset clears theme votes too')
})

test('every rolled column colour pair keeps a contrast floor, in every field and mode', async () => {
  const { mod } = await boot()
  const { FIELDS, fieldCss, contrast } = mod.__theme
  for (const field of FIELDS) {
    for (const mode of ['light', 'dark', 'dual']) {
      const c = tokens(fieldCss({ field, mode }))
      const at = (a, b) => contrast(c[a], c[b])
      for (const [fg, bg] of [['ink', 'bg'], ['ink', 's1'], ['ink', 's2'], ['muted', 'bg'], ['muted', 's1'], ['on-acc', 'acc'], ['acc', 'bg']]) {
        assert.ok(at(fg, bg) >= 4.5, `${field}/${mode}: ${fg} on ${bg} is ${at(fg, bg).toFixed(2)}:1`)
      }
      assert.ok(at('line-strong', 'bg') >= 3, `${field}/${mode}: control border ${at('line-strong', 'bg').toFixed(2)}:1`)
    }
  }
})

test('rolled columns carry data-field; columns saved before the field dimension render as before', async () => {
  const { mod } = await boot()
  const html = '<html lang="en"><head></head><body><h1>Hi</h1></body></html>'
  const roll = { ref: 'Swiss', vibe: 'serious', mode: 'dark', sig: 'rule' }
  const old = mod.__theme.buildRolledHtml(html, roll, 9)
  assert.doesNotMatch(old, /data-field/)
  assert.doesNotMatch(old, /\[data-field\]\[data-mode\]\{/)
  const rolled = mod.__theme.buildRolledHtml(html, { ...roll, field: 'rosi' }, 9)
  assert.match(rolled, /data-field="rosi"/)
  assert.match(rolled, /html\[data-taste-roll\]\[data-field\]\[data-mode\]\{--bg:#/)
  const hostile = mod.__theme.buildRolledHtml(html, { ...roll, field: '"><script>' }, 9)
  assert.doesNotMatch(hostile, /<script>/, 'an unknown field is never written into markup')
})

test('a seed rolls the same ref/vibe/mode/sig it did before the field dimension existed', async () => {
  const { mod } = await boot()
  const pick = mod.createTaste(null).choose(4242)
  assert.equal(pick.seed, 4242)
  /* Pinned from the pre-merge engine (main 2bce545) for seed 4242. */
  const { field, ...rest } = pick.roll
  assert.ok(mod.__theme.FIELDS.includes(field))
  assert.deepEqual(rest, PINNED_4242)
})
const PINNED_4242 = { ref: 'clinical', vibe: 'decorative', mode: 'dark', sig: 'annotation' }

/* ---- the second button: roll the whole look ---------------------------- */

const lookBar = (t) => {
  const reg = [...t.ctx.live.values()].find((c) => c.id === 'taste-look')
  const el = reg.render()
  return el.type(el.props)
}
const btnByLabel = (node, re) => { let f; walk(node, (x) => x.type === 'button' && re.test(x.props['aria-label'] || '') && (f = x)); return f }
const click = (b) => b.props.onClick({ preventDefault() {} })
const palette = (t, id) => [...t.ctx.live.values()].find((c) => c.area === 'palette' && c.id === id).data

test('two buttons: the page roll and the look roll both sit in the composer', async () => {
  const t = await boot()
  assert.equal(t.mod.__look.LOOK_ON, true)
  const ids = [...t.ctx.live.values()].filter((c) => c.area === 'composer.actions').map((c) => c.id)
  assert.deepEqual(ids.sort(), ['taste-look', 'taste-roll'])
  const bar = lookBar(t)
  assert.match(bar.props['aria-label'], /Roll the look/)
  assert.equal(btnByLabel(bar, /Keep this look/), undefined, 'no Keep/Pass before a look is rolled')
})

test('rolling the look re-skins Desktop; Pass puts the previous theme back and teaches the field', async () => {
  const t = await boot()
  lookBar(t) // records the theme on screen (stub: Indigo)
  click(lookBar(t))
  const rolled = t.themes().find((x) => x.label === 'Resonant Field · Rolled')
  assert.ok(rolled, 'a rolled theme is registered')
  assert.equal(mock.requested.at(-1), rolled.name, 'and switched to')
  const bar = lookBar(t)
  assert.ok(btnByLabel(bar, /Keep this look/) && btnByLabel(bar, /Pass on this look/), 'Keep and Pass appear')
  const look = t.taste().lastLook.split('/')[0]
  click(btnByLabel(bar, /Pass on this look/))
  assert.equal(mock.requested.at(-1), 'resonant-field-indigo', 'Pass restores what was on screen')
  assert.deepEqual(t.taste().post.field[look], [1, 2], 'and is a vote against that field')
  assert.equal(t.taste().lookLog.length, 1)
  assert.equal(btnByLabel(lookBar(t), /Keep this look/), undefined)
})

test('Keep saves the look as a theme that survives a reload', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  click(btnByLabel(lookBar(t), /Keep this look/))
  assert.equal(mock.requested.at(-1), 'resonant-field-kept')
  const kept = t.themes().find((x) => x.name === 'resonant-field-kept')
  assert.equal(kept.label, 'Resonant Field · Kept')
  const again = await boot(t.ctx.store)
  assert.ok(again.themes().find((x) => x.name === 'resonant-field-kept'), 'kept look is back after reload')
  assert.equal(again.taste().lookLog.length, 1, 'look ratings persist')
})

test('rolling twice before rating alternates names and still returns to the starting theme', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  const first = mock.requested.at(-1)
  click(btnByLabel(lookBar(t), /Roll another look/))
  const second = mock.requested.at(-1)
  assert.notEqual(first, second)
  assert.equal(t.themes().filter((x) => x.label === 'Resonant Field · Rolled').length, 1, 'only one rolled theme at a time')
  palette(t, 'taste-look-pass').run()
  assert.equal(mock.requested.at(-1), 'resonant-field-indigo')
  assert.equal(t.taste().lookLog.length, 1, 'the unrated first roll carried no signal')
})

test('every possible look keeps the contrast floors in light and dark', async () => {
  const { mod } = await boot()
  const { LOOK, lookPrefs, buildTheme, PLATES } = mod.__look
  const { FIELDS, contrast } = mod.__theme
  let n = 0
  for (const field of FIELDS) for (const tint of LOOK.tint) for (const shift of LOOK.shift) for (const texture of LOOK.texture) for (const presence of LOOK.presence) {
    const th = buildTheme('x', 'x', 'x', lookPrefs({ field, tint, shift, texture, presence }), PLATES, null)
    for (const c of [th.colors, th.darkColors]) {
      for (const [fg, bg] of [['foreground', 'background'], ['foreground', 'card'], ['mutedForeground', 'background'], ['primaryForeground', 'primary']]) {
        const r = contrast(c[fg], c[bg])
        assert.ok(r >= 4.5, `${field}/${tint}/${shift}/${texture}/${presence}: ${fg} on ${bg} ${r.toFixed(2)}:1`)
      }
    }
    n++
  }
  assert.equal(n, 6 * 81)
})

test('look learning leans: kept verdant looks make verdant come up more; no immediate repeats', async () => {
  const { mod } = await boot()
  let a = 11
  const rng = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const taste = mod.createTaste(null, rng)
  for (let i = 0; i < 4; i++) taste.rateLook({ field: 'verdant', tint: 'deep', shift: 'base', texture: 'own', presence: 'high' }, 'random', 1)
  for (let i = 0; i < 4; i++) taste.rateLook({ field: 'graphite', tint: 'soft', shift: 'base', texture: 'bare', presence: 'low' }, 'random', 0)
  let verdant = 0, learned = 0, prev = null
  for (let i = 0; i < 200; i++) {
    const { look, src } = taste.chooseLook()
    const key = JSON.stringify(look)
    assert.notEqual(key, prev, 'never the same look twice running')
    prev = key
    if (src !== 'learned') continue
    learned++
    if (look.field === 'verdant') verdant++
  }
  assert.ok(verdant / learned > 2 / 6, `verdant leans learned looks past double chance (${verdant}/${learned}, chance is 1/6)`)
  assert.ok(learned > 100, 'most looks are learned once there is evidence')
  assert.equal(taste.stats().learned.n + taste.stats().random.n, 0, 'look ratings stay out of the page honesty check')
})

test('saved taste from before the look roll loads cleanly', async () => {
  const { mod } = await boot()
  const s = { taste: { v: 1, post: {}, rolls: 3, log: [{ src: 'random', y: 1 }], snaps: [], since: 1, themeN: 2, lastTune: null } }
  const store = { get: (k, d) => (k in s ? s[k] : d), set: (k, v) => { s[k] = v } }
  const taste = mod.createTaste(store, Math.random)
  assert.equal(taste.stats().looks, 0)
  assert.ok(taste.chooseLook().look.field)
  assert.equal(mod.__look.cleanLook({ field: 'verdant', tint: 'x' }), null, 'a corrupt kept look is ignored')
})
