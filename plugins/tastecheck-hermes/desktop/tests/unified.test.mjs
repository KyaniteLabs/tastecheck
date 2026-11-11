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
export const Button = 'Button', Tip = 'Tip', ListRow = 'ListRow', ToggleRow = 'ToggleRow'
export const Select = 'Select', SelectContent = 'SelectContent', SelectItem = 'SelectItem', SelectTrigger = 'SelectTrigger', SelectValue = 'SelectValue'
/* Like Desktop: a switch only lands on a theme that resolves (built-ins plus
 * whatever is registered right now), and the switched-to name is what useTheme
 * reports. Starts on a non-Resonant-Field built-in so "back to Indigo" can't
 * pass for "back to where you were". */
export const BUILTINS = ['nous', 'everforest']
export const requested = []
export const desk = { resolves: () => false, theme: 'everforest' }
export const requestTheme = n => { if (!BUILTINS.includes(n) && !desk.resolves(n)) return false; requested.push(n); desk.theme = n; return true }
export const useTheme = () => ({ themeName: desk.theme, resolvedMode: 'dark' })
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
/* The same SDK with one export missing, as an older Desktop would have it. */
async function loadWithout(name) {
  const sdkHref = pathToFileURL(sdk).href
  const sdkLess = join(dir, `sdk-without-${name}-${++n}.mjs`)
  writeFileSync(sdkLess, Object.keys(mock).filter((k) => k !== name).map((k) => `export { ${k} } from ${JSON.stringify(sdkHref)}`).join('\n'))
  const file = join(dir, `plugin-${++n}.mjs`)
  writeFileSync(file, src.replaceAll(JSON.stringify(sdkHref), JSON.stringify(pathToFileURL(sdkLess).href)))
  return import(pathToFileURL(file).href)
}

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
    /* Like Desktop's registry: an (area, id) pair is one slot, re-registering
     * replaces it, and a disposer removes whatever holds that slot now. */
    register(c) { const key = c.id ? `${c.area}:${c.id}` : ++seq; live.set(key, c); return () => live.delete(key) },
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

async function boot(store, startTheme = 'everforest') {
  globalThis.__tc = { cwd: '', notifies: [], errors: [], workspaces: [] }
  mock.requested.length = 0
  mock.desk.theme = startTheme
  const mod = await load()
  const ctx = fakeCtx(store)
  const themes = () => [...ctx.live.values()].filter((c) => c.area === 'themes').map((c) => c.data)
  mock.desk.resolves = (n) => themes().some((x) => x.name === n)
  mod.default.register(ctx)
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
  /* RF 8700512: clicking the theme you are already on is no choice, so a second
   * vote for Walnut has to come after a switch away. */
  t.button('Walnut').props.onClick()
  assert.equal(t.taste().themeN, 1, 're-clicking the active preset is not a vote')
  t.button('Verdant').props.onClick()
  t.button('Walnut').props.onClick()
  const mine = t.themes().find((x) => x.name === 'resonant-field-taste')
  assert.ok(mine, 'two picks lean the taste: the theme is offered')
  assert.equal(mine.label, 'Resonant Field · Your taste')
  assert.match(mine.description, /leaning Walnut/)
  const walnut = t.themes().find((x) => x.name === 'resonant-field-walnut')
  assert.deepEqual(mine.darkColors, walnut.darkColors, 'built by the same buildTheme, so the same floors')
  assert.deepEqual(mock.requested, ['resonant-field-walnut', 'resonant-field-walnut', 'resonant-field-verdant', 'resonant-field-walnut'], 'only the user\'s own picks switch themes, never the learner')
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const rolledTheme = (t) => t.themes().find((x) => x.name === 'resonant-field-rolled')

test('rolling the look re-skins Desktop; Pass returns to the theme the user was on, not a default', async () => {
  const t = await boot()
  lookBar(t) // the composer render records what is on screen: everforest
  click(lookBar(t))
  assert.ok(rolledTheme(t), 'a rolled theme is registered')
  assert.equal(mock.desk.theme, 'resonant-field-rolled', 'and switched to (it resolved, so it was registered first)')
  const bar = lookBar(t)
  assert.ok(btnByLabel(bar, /Keep this look/) && btnByLabel(bar, /Pass on this look/), 'Keep and Pass appear')
  const field = t.taste().lastLook.split('/')[0]
  click(btnByLabel(bar, /Pass on this look/))
  assert.equal(mock.desk.theme, 'everforest', 'Pass restores what was on screen')
  assert.deepEqual(t.taste().post.field[field], [1, 1.5], 'and is half a vote against that field')
  assert.equal(t.taste().lookLog.length, 1)
  assert.equal(btnByLabel(lookBar(t), /Keep this look/), undefined)
  await wait(700)
  assert.equal(rolledTheme(t), undefined, 'the rolled theme leaves the list after rating')
})

test('a roll left unrated survives a reload: same look, Keep/Pass still on offer, Pass still goes home', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  const before = rolledTheme(t)
  /* Desktop persisted the rolled name; the next load must resolve it. */
  const again = await boot(t.ctx.store, 'resonant-field-rolled')
  const after = rolledTheme(again)
  assert.ok(after, 'the rolled theme is registered again on load, so Desktop does not fall back to its default')
  assert.deepEqual(after.darkColors, before.darkColors, 'it is the same look')
  click(btnByLabel(lookBar(again), /Pass on this look/))
  assert.equal(mock.desk.theme, 'everforest', 'Pass still returns to the theme from before the roll')
  assert.equal(again.taste().lookLog.length, 1)
  assert.equal(again.ctx.store.pendingLook, undefined, 'nothing pending once rated')
})

test('Keep saves the look as a theme that survives a reload', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  click(btnByLabel(lookBar(t), /Keep this look/))
  assert.equal(mock.desk.theme, 'resonant-field-kept')
  const kept = t.themes().find((x) => x.name === 'resonant-field-kept')
  assert.equal(kept.label, 'Resonant Field · Kept')
  const again = await boot(t.ctx.store, 'resonant-field-kept')
  assert.ok(again.themes().find((x) => x.name === 'resonant-field-kept'), 'kept look is back after reload')
  assert.equal(again.taste().lookLog.length, 1, 'look ratings persist')
  assert.equal(rolledTheme(again), undefined, 'no stale rolled theme after a rated roll')
})

test('rolling twice before rating repaints in place and still returns to the starting theme', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  const first = rolledTheme(t).darkColors
  click(btnByLabel(lookBar(t), /Roll another look/))
  assert.equal(t.themes().filter((x) => x.label === 'Resonant Field · Rolled').length, 1, 'only one rolled theme at a time')
  assert.equal(mock.desk.theme, 'resonant-field-rolled')
  assert.notDeepEqual(rolledTheme(t).darkColors, first, 'the second look paints differently')
  palette(t, 'taste-look-pass').run()
  assert.equal(mock.desk.theme, 'everforest')
  assert.equal(t.taste().lookLog.length, 1, 'the unrated first roll carried no signal')
})

test('"put my theme back" undoes a roll with no vote at all', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  const post = JSON.stringify(t.taste().post)
  palette(t, 'taste-look-back').run()
  assert.equal(mock.desk.theme, 'everforest')
  assert.equal(JSON.stringify(t.taste().post), post, 'no posterior moved')
  assert.equal(t.taste().lookLog.length, 0)
  assert.equal(btnByLabel(lookBar(t), /Keep this look/), undefined)
})

test('Pass falls back to Indigo only when the old theme is gone', async () => {
  const t = await boot()
  lookBar(t)
  click(lookBar(t))
  mock.BUILTINS.splice(mock.BUILTINS.indexOf('everforest'), 1)
  try {
    click(btnByLabel(lookBar(t), /Pass on this look/))
    assert.equal(mock.desk.theme, 'resonant-field-indigo')
    assert.match(globalThis.__tc.notifies.at(-1) ?? '', /Indigo/)
  } finally { mock.BUILTINS.push('everforest') }
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

const seeded = (a) => () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }

test('looks are canonical: a field with no texture of its own never teaches "show its texture"', async () => {
  const { mod } = await boot()
  const { canonLook } = mod.__look
  assert.deepEqual(canonLook({ field: 'indigo', tint: 'base', shift: 'base', texture: 'own', presence: 'high' }),
    { field: 'indigo', tint: 'base', shift: 'base', texture: 'bare', presence: 'mid' })
  assert.equal(canonLook({ field: 'verdant', tint: 'base', shift: 'base', texture: 'own', presence: 'high' }).texture, 'own')
  const taste = mod.createTaste(null, seeded(3))
  taste.rateLook({ field: 'indigo', tint: 'base', shift: 'base', texture: 'own', presence: 'high' }, 'random', 1)
  const st = taste._state().look
  assert.deepEqual(st.texture.own, [1, 1], 'nothing credited to a texture that was not on screen')
  assert.deepEqual(st.texture.bare, [2, 1])
  assert.deepEqual(st.presence.high, [1, 1])
})

test('every distinct look paints a distinct theme, and no two consecutive rolls paint the same', async () => {
  const { mod } = await boot()
  const { LOOK, lookPrefs, canonLook, buildTheme, PLATES } = mod.__look
  const paint = (l) => JSON.stringify(buildTheme('x', 'x', 'x', lookPrefs(l), PLATES, null))
  const byKey = new Map()
  for (const field of mod.__theme.FIELDS) for (const tint of LOOK.tint) for (const shift of LOOK.shift) for (const texture of LOOK.texture) for (const presence of LOOK.presence) {
    const c = canonLook({ field, tint, shift, texture, presence })
    byKey.set(JSON.stringify(c), paint(c))
  }
  const paints = new Set(byKey.values())
  assert.equal(paints.size, byKey.size, 'canonical looks and painted themes are one-to-one')
  const taste = mod.createTaste(null, seeded(5))
  for (let i = 0; i < 10; i++) taste.rateLook({ field: 'walnut', tint: 'deep', shift: 'plus', texture: 'own', presence: 'high' }, 'random', 1)
  let prev = null
  for (let i = 0; i < 400; i++) {
    const p = paint(taste.chooseLook().look)
    assert.notEqual(p, prev, `roll ${i} repainted the same theme`)
    prev = p
  }
  console.log(`# distinct looks: ${byKey.size}`)
})

test('every HOLDOUT-th look is plain random even with strong evidence', async () => {
  const { mod } = await boot()
  const taste = mod.createTaste(null, seeded(9))
  for (let i = 0; i < 6; i++) taste.rateLook({ field: 'rosi', tint: 'soft', shift: 'minus', texture: 'alt', presence: 'low' }, 'random', 1)
  for (let i = 1; i <= 50; i++) {
    const { src } = taste.chooseLook()
    if (i % 10 === 0) assert.equal(src, 'random', `look ${i} is a holdout`)
  }
})

test('look honesty check: if learned looks lose to random ones, the look learning resets and says so', async () => {
  const { mod } = await boot()
  const taste = mod.createTaste(null, seeded(13))
  const L = { field: 'daylight', tint: 'deep', shift: 'plus', texture: 'alt', presence: 'high' }
  let msg = null
  for (let i = 0; i < 5; i++) taste.rateLook(L, 'random', 1)
  for (let i = 0; i < 5 && !msg; i++) msg = taste.rateLook(L, 'learned', 0)
  assert.match(msg, /reset its look learning: learned looks were kept 0\/5, random ones 5\/5/)
  assert.deepEqual(taste._state().look.tint.deep, [1, 1], 'look posteriors forgotten')
  assert.ok(taste._state().post.field.daylight[0] > 1, 'the shared field posterior is kept')
  assert.equal(taste.stats().lookLearned.n, 0)
  assert.equal(taste.stats().lookRandom.n, 5)
})

test('older ratings fade: decay applies to look posteriors on each rating', async () => {
  const { mod } = await boot()
  const taste = mod.createTaste(null, seeded(17))
  const A = { field: 'graphite', tint: 'soft', shift: 'base', texture: 'alt', presence: 'low' }
  const B = { field: 'verdant', tint: 'deep', shift: 'plus', texture: 'own', presence: 'high' }
  taste.rateLook(A, 'random', 1)
  taste.rateLook(B, 'random', 1)
  const [a] = taste._state().look.tint.soft
  assert.ok(Math.abs(a - (1 + 0.97)) < 1e-9, `A's tint credit decayed once: ${a}`)
})

test('the theme needs every SDK piece it uses: an SDK missing any one leaves it off and Taste Roll alone', async () => {
  const needed = ['THEMES_AREA', 'APPEARANCE_AREAS', 'atom', 'requestTheme', 'useTheme', 'useValue', 'Tip', 'Button', 'ListRow', 'Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'ToggleRow']
  assert.equal((await loadWithout('nothing-missing')).__theme.RF_ON, true)
  for (const name of needed) {
    assert.equal((await loadWithout(name)).__theme.RF_ON, false, `${name} missing turns the theme off`)
  }
})

test('Reset and a custom tune that equals a preset are not votes', async () => {
  const { mod } = await boot()
  const s = {}
  const store = { get: (k, d) => (k in s ? s[k] : d), set: (k, v) => { s[k] = JSON.parse(JSON.stringify(v)) } }
  const taste = mod.createTaste(store, () => 0.5)
  for (const p of mod.__theme.PRESETS) {
    assert.equal(taste.observeTheme({ kind: 'tune', v: 1, prefs: { ...p.prefs } }), false, `${p.id} prefs as a tune`)
  }
  assert.equal(taste.stats().theme, 0)
  assert.equal(taste.observeTheme({ kind: 'tune', v: 1, prefs: { ...mod.__theme.PRESETS[0].prefs, hue: 64 } }), true, 'a real custom tune still counts')
})
