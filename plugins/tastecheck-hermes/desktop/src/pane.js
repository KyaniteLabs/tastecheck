/**
 * Tastecheck — desktop half: Taste Roll comparison workspace.
 *
 * The user clicks "Taste Roll" (composer button or command palette). We read
 * THEIR project's HTML inside the session workspace (via the SDK folder grant —
 * never the canned demo page), open a workspace pane (stable id
 * `tastecheck:tasteroll`) and show their unchanged page as the left column.
 * Every later click appends one more restyled column to the right; previous
 * columns stay. Each column is an iframe sandboxed exactly like the built-in
 * preview frame: sandbox="allow-forms allow-scripts", allow="fullscreen",
 * referrerPolicy="no-referrer" — opaque origin, no same-origin access.
 *
 * Each rolled column is also GATED: its exact srcdoc is POSTed to this plugin's
 * own backend namespace (`ctx.rest('/roll-audit')` → the agent half's audit on
 * an installed browser) and the column header is stamped SHIP or HOLD with its
 * reasons. Fail closed — a missing REST surface, a busy gate or any error is a
 * visible HOLD, never a silent pass, and a HOLD column stays visible.
 *
 * The roll system is the one merged on KyaniteLabs/tastecheck main (PR #35
 * head c41683068357258a7dae582de1a41191ae2153fe, incl. the #37–#39 QA
 * refinements): the verbatim seeded xoshiro128++ engine from
 * skills/tasteroll/assets/tasteroll-engine.js and the data-ref / data-vibe /
 * data-mode / data-sig token system from tasteroll.html, applied to the user's
 * own markup through valid attributes on their real <html> element.
 *
 * Surface resolution (R3): the first choice is a SUPPORTED active-surface
 * seam when the host exposes one (host.state.activeFile atom or an async
 * host.activeFile()). Audited 2026-11-08 against the Desktop SDK: NO build
 * exposes either yet — host.state carries cwd/sessions/model/viewport only,
 * PluginContext offers files/storage/rest/os/preview/runAction, and no
 * contribution area hands a file identity. That missing seam is recorded as
 * an unmet host prerequisite on the plugin's card. Without it the first click
 * still opens automatically and rolls the newest-edited HTML/CSS→nearest-HTML
 * in the session workspace, NAMES the pick honestly in the strip ("no
 * active-file API in this Desktop build"), and offers an explicit handoff:
 * tap any workspace HTML file in the strip to roll THAT surface instead.
 * mtime is a fallback pick, never a claim about the file you are on. Nothing
 * outside the session workspace is ever read, tasteroll.html is never
 * eligible, and a workspace with no HTML gets an honest strip that says so.
 *
 * No network, no telemetry, no raw bridge. Sensitive doors used: the folder
 * grant (ctx.files), host.openWorkspace (feature-detected BEFORE any side
 * effect) and ctx.rest to this plugin's own namespace.
 */

import { COMPOSER_AREAS, GHOST_ICON_BTN, PALETTE_AREA, host } from '@hermes/plugin-sdk'
/* Namespace import for OPTIONAL members (Tip): the loader's shim only exports
 * names the running build has, so a named import of a newer member would fail
 * to link on an older Desktop. Read them off the namespace and feature-detect. */
import * as SDK from '@hermes/plugin-sdk'
import { createElement as h } from 'react'

/* @@RESONANT_FIELD@@ */

/* The Resonant Field theme is this plugin's face: its presets are the colour
 * fields Taste Roll paints columns with, and its choices teach the same learner
 * Keep/Pass does. It loads only where Desktop has the themes area. */
const RF_ON = typeof SDK.THEMES_AREA === 'string' && typeof SDK.atom === 'function'
const FIELD_PREFIX = 'resonant-field-'
const fieldPreset = (v) => RF.PRESETS.find((p) => p.id === FIELD_PREFIX + v) || null
const fieldLabel = (v) => { const p = fieldPreset(v); return p ? p.label.replace('Resonant Field · ', '') : String(v) }
/* A custom tune counts toward the preset it sits nearest: surface hue, accent
 * hue, tint strength and texture, each on a 0–1 scale. */
const hueGap = (a, b) => { const d = Math.abs((((a || 0) - (b || 0)) % 360 + 360) % 360); return Math.min(d, 360 - d) / 180 }
function nearestField(prefs) {
  if (!prefs || typeof prefs !== 'object') return null
  let best = null, bd = Infinity
  for (const v of FACES.field) {
    const q = fieldPreset(v).prefs
    const d = hueGap(prefs.hue, q.hue) + hueGap(prefs.accent, q.accent) +
      Math.abs((prefs.strength || 0) - (q.strength || 0)) / 30 + ((prefs.plate || null) === (q.plate || null) ? 0 : 0.3)
    if (d < bd) { bd = d; best = v }
  }
  return best
}
function fieldOfTasteEvent(ev) {
  if (!ev || typeof ev !== 'object') return null
  if (ev.kind === 'preset' && typeof ev.id === 'string' && ev.id.startsWith(FIELD_PREFIX)) {
    const v = ev.id.slice(FIELD_PREFIX.length)
    return FACES.field.includes(v) ? v : null
  }
  if (ev.kind === 'tune') return nearestField(ev.prefs)
  return null
}

/* tasteroll — seeded PRNG engine with lock/reroll support (xoshiro128++)
   Verbatim from skills/tasteroll/assets/tasteroll-engine.js @ 5168f89
   (KyaniteLabs/tastecheck main). Zero-dependency, deterministic:
   same seed → same roll, always. */
function tasteroll(seed) {
  var currentSeed = seed >>> 0 || 1;

  function makeRng(s) {
    s = s >>> 0 || 1;
    var st = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) {
      s = (s + 0x9E3779B9) >>> 0;
      var z = s;
      z = (z ^ (z >>> 16)) * 0x85EBCA6B >>> 0;
      z = (z ^ (z >>> 13)) * 0xC2B2AE35 >>> 0;
      st[i] = z ^ (z >>> 16);
    }
    function rotl(x, k) { return (x << k) | (x >>> (32 - k)); }
    return function () {
      var result = (rotl((st[0] + st[3]) >>> 0, 7) + st[0]) >>> 0;
      var t = (st[1] << 9) >>> 0;
      st[2] = (st[2] ^ st[0]) >>> 0;
      st[3] = (st[3] ^ st[1]) >>> 0;
      st[1] = (st[1] ^ st[2]) >>> 0;
      st[0] = (st[0] ^ st[3]) >>> 0;
      st[2] = (st[2] ^ t) >>> 0;
      st[3] = (rotl(st[3], 21)) >>> 0;
      return result / 0x100000000;
    };
  }

  var state = {
    seed: currentSeed,
    locked: {},
    rollHistory: [],
    excludedDirections: []
  };

  function rollDimension(rng, candidates) {
    var filtered = candidates.filter(function (c) {
      return state.excludedDirections.indexOf(c) === -1;
    });
    if (!filtered.length) filtered = candidates;
    return filtered[Math.floor(rng() * filtered.length)];
  }

  function rollAll(dimensions) {
    var rng = makeRng(state.seed);
    var result = {};
    for (var dim in dimensions) {
      if (state.locked[dim]) {
        result[dim] = state.locked[dim];
      } else {
        result[dim] = rollDimension(rng, dimensions[dim]);
      }
    }
    state.rollHistory.push({ seed: state.seed, result: Object.assign({}, result) });
    return result;
  }

  return {
    get seed() { return state.seed; },
    roll: rollAll
  };
}

/* Faces from tools/tasteroll/faces.mjs @ 5168f89 (the live-demo dimension set). */
const FACES = {
  ref: ['mineral', 'Swiss', 'brutalist', 'folio', 'shipping', 'clinical', 'humanist', 'maximalist'],
  vibe: ['warm', 'serious', 'playful', 'refined', 'stark', 'editorial', 'operational', 'decorative'],
  mode: ['light', 'dark', 'dual'],
  sig: ['needle', 'rule', 'display-word', 'color-block', 'bento', 'timeline', 'annotation', 'sixling'],
  /* Colour field: a Resonant Field preset. Last, so every seed keeps the
   * ref/vibe/mode/sig it rolled before this dimension existed. */
  field: ['indigo', 'verdant', 'daylight', 'graphite', 'rosi', 'walnut']
}

/* ---- taste learner --------------------------------------------------------
 * Every column takes one tap of feedback: Keep (+) or Pass (−), with an
 * optional one-tap reason (Colour / Type / Layout / Mood) that aims the signal
 * at the dimensions it names. The gate's own HOLD adds a weak negative.
 *
 * Model: one Beta(a, b) posterior per face value. Before each update every
 * posterior decays toward the Beta(1, 1) prior, so old taste fades. Rolls are
 * chosen by Thompson sampling: draw a preference for every face value, then
 * pick the seed (of SEARCH candidates) whose roll scores highest. The seeded
 * engine above is untouched, so every column stays replayable from its seed.
 *
 * Honesty checks, like a trading desk's out-of-sample book:
 *  - EXPLORE of learned rolls are plain random seeds, so taste can't collapse.
 *  - Every HOLDOUT-th roll is random and its ratings are scored separately;
 *    the pane shows learned vs random keep rates side by side.
 *  - Every SNAP_EVERY ratings the posterior is snapshotted. If learned rolls
 *    are kept clearly less often than random ones (≥ MIN_N each, gap ≥ GAP),
 *    the learner rolls back to the previous snapshot and says so.
 * Nothing here touches contrast floors or the gate: it only picks seeds. */
const TASTE = { DECAY: 0.97, EXPLORE: 0.15, HOLDOUT: 10, SEARCH: 192, SNAP_EVERY: 10, MIN_N: 5, GAP: 0.2, WINDOW: 20, LOG_CAP: 400 }
const REASONS = [
  { id: 'colour', label: 'Colour', dims: ['ref', 'mode', 'field'] },
  { id: 'type', label: 'Type', dims: ['ref'] },
  { id: 'layout', label: 'Layout', dims: ['sig'] },
  { id: 'mood', label: 'Mood', dims: ['vibe'] }
]

/* The whole-look roll: Taste Roll's second button re-skins Desktop itself in a
 * variation of a Resonant Field preset. The field comes from the same field
 * posterior the page rolls use, so a kept look, a kept column and a theme pick
 * all teach one taste. The other dimensions are small, curated moves around the
 * preset, never free colour: tint depth, a ±20° hue nudge, the texture plate
 * and how strongly that texture shows. Contrast floors come from buildTheme. */
const LOOK = {
  tint: ['soft', 'base', 'deep'],
  shift: ['minus', 'base', 'plus'],
  texture: ['own', 'bare', 'alt'],
  presence: ['low', 'mid', 'high']
}
function freshLook() {
  const p = {}
  for (const dim of Object.keys(LOOK)) {
    p[dim] = {}
    for (const v of LOOK[dim]) p[dim][v] = [1, 1]
  }
  return p
}
function lookKey(l) { return [l.field, ...Object.keys(LOOK).map((d) => l[d])].join('/') }
const goodAB = (ab) => Array.isArray(ab) && ab.length === 2 && ab.every((x) => Number.isFinite(x) && x > 0 && x < 1e6)

function freshPosterior() {
  const p = {}
  for (const dim of Object.keys(FACES)) {
    p[dim] = {}
    for (const v of FACES[dim]) p[dim][v] = [1, 1]
  }
  return p
}

function cleanTaste(raw) {
  const t = { v: 1, post: freshPosterior(), rolls: 0, log: [], snaps: [], since: 0, themeN: 0, lastTune: null, look: freshLook(), lookRolls: 0, lookLog: [], lastLook: null }
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return t
  for (const dim of Object.keys(FACES)) {
    for (const v of FACES[dim]) {
      const ab = raw.post && raw.post[dim] && raw.post[dim][v]
      if (goodAB(ab)) t.post[dim][v] = [ab[0], ab[1]]
    }
  }
  /* Look state arrived after v1 shipped: older saves simply have none. */
  for (const dim of Object.keys(LOOK)) {
    for (const v of LOOK[dim]) {
      const ab = raw.look && raw.look[dim] && raw.look[dim][v]
      if (goodAB(ab)) t.look[dim][v] = [ab[0], ab[1]]
    }
  }
  t.lookRolls = Number.isInteger(raw.lookRolls) && raw.lookRolls >= 0 ? raw.lookRolls : 0
  t.lookLog = Array.isArray(raw.lookLog) ? raw.lookLog.filter((e) => e && (e.src === 'learned' || e.src === 'random') && (e.y === 0 || e.y === 1)).slice(-TASTE.LOG_CAP) : []
  t.lastLook = typeof raw.lastLook === 'string' && raw.lastLook.length < 80 ? raw.lastLook : null
  t.rolls = Number.isInteger(raw.rolls) && raw.rolls >= 0 ? raw.rolls : 0
  t.since = Number.isInteger(raw.since) && raw.since >= 0 ? raw.since : 0
  t.themeN = Number.isInteger(raw.themeN) && raw.themeN >= 0 ? raw.themeN : 0
  t.lastTune = FACES.field.includes(raw.lastTune) ? raw.lastTune : null
  t.log = Array.isArray(raw.log) ? raw.log.filter((e) => e && (e.src === 'learned' || e.src === 'random') && (e.y === 0 || e.y === 1)).slice(-TASTE.LOG_CAP) : []
  t.snaps = Array.isArray(raw.snaps) ? raw.snaps.slice(-3).map((s) => cleanTaste({ v: 1, post: s }).post) : []
  return t
}

/* Gamma(k, 1) for k ≥ 1 (Marsaglia–Tsang), k < 1 boosted; Beta from two Gammas. */
function gammaSample(k, rng) {
  if (k < 1) return gammaSample(k + 1, rng) * Math.pow(rng() || 1e-12, 1 / k)
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x, v
    do {
      const u1 = rng() || 1e-12
      const u2 = rng()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng() || 1e-12
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v
  }
}
function betaSample(a, b, rng) {
  const x = gammaSample(a, rng)
  return x / (x + gammaSample(b, rng))
}

/** Pure learner over a storage-like { get, set } (or none). onChange runs
 *  after every save, so the Your-taste theme can follow. */
export function createTaste(store, rng = Math.random, onChange = null) {
  let t = cleanTaste(store ? store.get('taste', null) : null)
  const save = () => { if (store) store.set('taste', t); if (onChange) { try { onChange() } catch {} } }

  const decay = () => {
    for (const dim of Object.keys(t.post)) {
      for (const v of Object.keys(t.post[dim])) {
        const ab = t.post[dim][v]
        ab[0] = 1 + (ab[0] - 1) * TASTE.DECAY
        ab[1] = 1 + (ab[1] - 1) * TASTE.DECAY
      }
    }
  }
  const credit = (roll, y, weight, dims) => {
    decay()
    for (const dim of Object.keys(FACES)) {
      const ab = t.post[dim][roll[dim]]
      if (!ab) continue
      const w = dims && dims.indexOf(dim) === -1 ? weight * 0.25 : weight
      if (y) ab[0] += w
      else ab[1] += w
    }
  }
  const rate = (src) => {
    const recent = t.log.filter((e) => e.src === src).slice(-TASTE.WINDOW)
    return { n: recent.length, kept: recent.filter((e) => e.y === 1).length }
  }
  const checkRollback = () => {
    const L = rate('learned')
    const R = rate('random')
    if (L.n < TASTE.MIN_N || R.n < TASTE.MIN_N || !t.snaps.length) return null
    if (L.kept / L.n + TASTE.GAP > R.kept / R.n) return null
    t.post = JSON.parse(JSON.stringify(t.snaps.pop()))
    /* Forget the learned window that triggered it so one bad run can't loop. */
    t.log = t.log.filter((e) => e.src !== 'learned')
    return `Taste Roll rolled its taste back: learned rolls were kept ${L.kept}/${L.n}, random ones ${R.kept}/${R.n}.`
  }

  const lookRate = (src) => {
    const recent = t.lookLog.filter((e) => e.src === src).slice(-TASTE.WINDOW)
    return { n: recent.length, kept: recent.filter((e) => e.y === 1).length }
  }
  /* The look roll's out-of-sample check: if learned looks are kept clearly
   * less often than plain random ones, the look posteriors were learning
   * noise. Forget them (the shared field posterior stays: theme picks and
   * page rolls feed it too) and the learned window that triggered it. */
  const checkLookRollback = () => {
    const L = lookRate('learned')
    const R = lookRate('random')
    if (L.n < TASTE.MIN_N || R.n < TASTE.MIN_N) return null
    if (L.kept / L.n + TASTE.GAP > R.kept / R.n) return null
    t.look = freshLook()
    t.lookLog = t.lookLog.filter((e) => e.src !== 'learned')
    return `Taste Roll reset its look learning: learned looks were kept ${L.kept}/${L.n}, random ones ${R.kept}/${R.n}.`
  }

  return {
    /** → { seed, roll, src } */
    choose(baseSeed) {
      t.rolls += 1
      const holdout = t.rolls % TASTE.HOLDOUT === 0
      const explore = !holdout && rng() < TASTE.EXPLORE
      let seed = baseSeed >>> 0 || 1
      /* Nothing rated yet: there is no taste to lean on, so roll plainly. */
      let src = holdout || explore || !t.log.length ? 'random' : 'learned'
      if (src === 'learned') {
        /* A dimension nobody has rated yet carries no taste, only noise: leave
         * it out of the score (it still rolls, plainly, from the seed). */
        const theta = {}
        const dims = Object.keys(FACES).filter((dim) => FACES[dim].some((v) => t.post[dim][v][0] + t.post[dim][v][1] - 2 >= 0.5))
        for (const dim of dims) {
          theta[dim] = {}
          for (const v of FACES[dim]) theta[dim][v] = betaSample(t.post[dim][v][0], t.post[dim][v][1], rng)
        }
        let best = -1
        for (let i = 0; i < TASTE.SEARCH; i++) {
          const s = (seed + Math.imul(i, 0x9E3779B1)) >>> 0 || 1
          const r = tasteroll(s).roll(FACES)
          let score = 0
          for (const dim of dims) score += theta[dim][r[dim]]
          if (score > best) { best = score; seed = s }
        }
      }
      save()
      return { seed, roll: tasteroll(seed).roll(FACES), src }
    },
    /** y: 1 keep, 0 pass. Returns a rollback message or null. */
    rate(roll, src, y) {
      credit(roll, y, 1, null)
      t.log.push({ src: src === 'learned' ? 'learned' : 'random', y: y ? 1 : 0 })
      t.log = t.log.slice(-TASTE.LOG_CAP)
      t.since += 1
      if (t.since >= TASTE.SNAP_EVERY) {
        t.snaps.push(JSON.parse(JSON.stringify(t.post)))
        t.snaps = t.snaps.slice(-3)
        t.since = 0
      }
      const msg = checkRollback()
      save()
      return msg
    },
    /** A one-tap reason aims extra signal at the dimensions it names. */
    aim(roll, y, reasonId) {
      const reason = REASONS.find((r) => r.id === reasonId)
      if (!reason) return
      credit(roll, y, 1, reason.dims)
      save()
    },
    /** Undo a rating's direction (user changed their mind): opposite credit. */
    unrate(roll, y) { credit(roll, y ? 0 : 1, 1, null); t.log.pop(); save() },
    /** A theme choice: picking a preset is a clear vote for that colour field
     *  (0.5); a settled custom tune is a lighter one (0.3) for the preset it
     *  sits nearest, counted once per move to a new field so a long drag can't
     *  pile up. Theme votes only touch the field dimension, never decay the
     *  page ratings, and stay out of the learned-vs-random check. */
    observeTheme(ev) {
      const v = fieldOfTasteEvent(ev)
      if (!v) return false
      if (ev.kind === 'tune' && t.lastTune === v) return false
      t.lastTune = ev.kind === 'tune' ? v : null
      t.post.field[v][0] += ev.kind === 'preset' ? 0.5 : 0.3
      t.themeN += 1
      save()
      return true
    },
    /** → { look, src }: a whole-Desktop variation. Thompson sampling per
     *  dimension; a dimension with no evidence yet rolls plainly. Every
     *  HOLDOUT-th look and EXPLORE of the rest are plain random, and their
     *  keep rate is compared with the learned looks' (see rateLook). Looks are
     *  canonical: two settings that paint the same theme are one look, so the
     *  learner credits what was on screen and never shows the same paint twice
     *  running. */
    chooseLook() {
      t.lookRolls += 1
      const plain = t.lookRolls % TASTE.HOLDOUT === 0 || rng() < TASTE.EXPLORE
      const pick = (vals, post) => {
        const seen = vals.some((v) => post[v][0] + post[v][1] - 2 >= 0.5)
        if (plain || !seen) return [vals[Math.floor(rng() * vals.length) % vals.length], false]
        let bv = vals[0], bs = -1
        for (const v of vals) { const x = betaSample(post[v][0], post[v][1], rng); if (x > bs) { bs = x; bv = v } }
        return [bv, true]
      }
      let look = {}
      let leaned = false
      const fieldPick = pick(FACES.field, t.post.field)
      look.field = fieldPick[0]; leaned = leaned || fieldPick[1]
      for (const dim of Object.keys(LOOK)) { const r = pick(LOOK[dim], t.look[dim]); look[dim] = r[0]; leaned = leaned || r[1] }
      look = canonLook(look)
      const dims = Object.keys(LOOK)
      for (let i = 0; i < 24 && lookKey(look) === t.lastLook; i++) {
        const dim = dims[Math.floor(rng() * dims.length) % dims.length]
        const others = LOOK[dim].filter((v) => v !== look[dim])
        look = canonLook({ ...look, [dim]: others[Math.floor(rng() * others.length) % others.length] })
      }
      t.lastLook = lookKey(look)
      save()
      return { look, src: leaned ? 'learned' : 'random' }
    },
    /** y: 1 keep, 0 pass on a whole look. Decays only the look and field
     *  posteriors; logged apart from page ratings so neither honesty check
     *  is polluted by the other. A pass is half a vote against the colour
     *  field: it is also how people say "put my theme back", and one of those
     *  must not cancel two explicit preset picks. Returns a rollback message
     *  or null. */
    rateLook(raw, src, y) {
      if (!raw || !FACES.field.includes(raw.field)) return null
      const look = canonLook(raw)
      const fade = (post) => { for (const v of Object.keys(post)) { const ab = post[v]; ab[0] = 1 + (ab[0] - 1) * TASTE.DECAY; ab[1] = 1 + (ab[1] - 1) * TASTE.DECAY } }
      fade(t.post.field)
      for (const dim of Object.keys(LOOK)) fade(t.look[dim])
      const bump = (ab, w) => { if (ab) { if (y) ab[0] += w; else ab[1] += w } }
      bump(t.post.field[look.field], y ? 1 : 0.5)
      for (const dim of Object.keys(LOOK)) bump(t.look[dim][look[dim]], 1)
      t.lookLog.push({ src: src === 'learned' ? 'learned' : 'random', y: y ? 1 : 0 })
      t.lookLog = t.lookLog.slice(-TASTE.LOG_CAP)
      const msg = checkLookRollback()
      save()
      return msg
    },
    /** The gate held this column: a weak, non-logged negative. */
    gateHold(roll) { credit(roll, 0, 0.2, null); save() },
    stats() {
      const L = rate('learned')
      const R = rate('random')
      const top = {}
      for (const dim of Object.keys(FACES)) {
        let bv = null, bm = -1
        for (const v of FACES[dim]) {
          const [a, b] = t.post[dim][v]
          const n = a + b - 2
          const m = a / (a + b)
          if (n >= (dim === 'field' ? 1 : 1.5) && m > bm) { bm = m; bv = v }
        }
        top[dim] = bv
      }
      const lk = t.lookLog.slice(-TASTE.WINDOW)
      return { ratings: t.log.length, theme: t.themeN, looks: t.lookLog.length, lookKept: lk.filter((e) => e.y === 1).length, lookWindow: lk.length, lookLearned: lookRate('learned'), lookRandom: lookRate('random'), learned: L, random: R, top }
    },
    reset() { t = cleanTaste(null); save() },
    _state: () => t
  }
}

let taste = null

/* Token system from tasteroll.html @ 5168f89 (values verbatim), plus a generic
   application layer so the tokens restyle ARBITRARY user markup. Applied only
   inside rolled columns, driven by the same html[data-ref][data-vibe][data-mode]
   [data-sig] attributes. */
const ROLL_CSS = `
html[data-taste-roll]{--bg:#fff;--s1:#fff;--s2:#f3f3f3;--line:#ddd;--line-strong:#999;--ink:#111;--muted:#555;--acc:#055;--on-acc:#fff}
html[data-taste-roll][data-mode="light"]{--bg:#f6f2ea;--s1:#fffdf8;--s2:#ece5d8;--line:#d8cfbd;--line-strong:#9c917e;--ink:#211b13;--muted:#574d3f}
html[data-taste-roll][data-mode="dark"]{--bg:#17120e;--s1:#211a14;--s2:#2b231b;--line:#413528;--line-strong:#7d6e5a;--ink:#f4ede2;--muted:#b6a690}
html[data-taste-roll][data-mode="dual"]{--bg:#14100c;--s1:#1e1811;--s2:#282019;--line:#3c3126;--line-strong:#7d6e5a;--ink:#f4ede2;--muted:#b6a690}
html[data-taste-roll][data-ref="mineral"]{--acc-l:#8a5c10;--acc-d:#e0a54c;--on-l:#fffaf0;--on-d:#241703;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="Swiss"]{--acc-l:#2057b6;--acc-d:#79acff;--on-l:#fffdf8;--on-d:#0a1428;--font:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--font-display:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}
html[data-taste-roll][data-ref="brutalist"]{--acc-l:#bd3d10;--acc-d:#ff7a45;--on-l:#fffdf8;--on-d:#200b02;--font:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--font-display:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
html[data-taste-roll][data-ref="folio"]{--acc-l:#97482a;--acc-d:#e5946c;--on-l:#fffaf2;--on-d:#26100a;--font:Georgia,"Times New Roman",serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="shipping"]{--acc-l:#0c6b52;--acc-d:#3ec89c;--on-l:#fffdf8;--on-d:#03201a;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:system-ui,-apple-system,"Segoe UI",sans-serif}
html[data-taste-roll][data-ref="clinical"]{--acc-l:#0d697f;--acc-d:#5fbcd6;--on-l:#fffdf8;--on-d:#041c22;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:system-ui,-apple-system,"Segoe UI",sans-serif}
html[data-taste-roll][data-ref="humanist"]{--acc-l:#3d6a33;--acc-d:#92cc86;--on-l:#fffdf8;--on-d:#0c1c0a;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="maximalist"]{--acc-l:#ae2262;--acc-d:#ff79ae;--on-l:#fffaf2;--on-d:#260512;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-mode="light"]{--acc:var(--acc-l);--on-acc:var(--on-l)}
html[data-taste-roll][data-mode="dark"]{--acc:var(--acc-d);--on-acc:var(--on-d)}
html[data-taste-roll][data-mode="dual"]{--acc:var(--acc-d);--on-acc:var(--on-d)}
html[data-taste-roll][data-vibe="warm"]{--radius:6px;--lh:1.7;--fw-h:700;--track:0;--density:1.05;--sp:1.05rem}
html[data-taste-roll][data-vibe="serious"]{--radius:2px;--lh:1.55;--fw-h:700;--track:-.012em;--density:.95;--sp:.85rem}
html[data-taste-roll][data-vibe="playful"]{--radius:6px;--lh:1.65;--fw-h:800;--track:.012em;--density:1.1;--sp:1.15rem}
html[data-taste-roll][data-vibe="refined"]{--radius:4px;--lh:1.65;--fw-h:600;--track:0;--density:1;--sp:.95rem}
html[data-taste-roll][data-vibe="stark"]{--radius:0px;--lh:1.5;--fw-h:700;--track:.022em;--density:.85;--sp:.8rem}
html[data-taste-roll][data-vibe="editorial"]{--radius:2px;--lh:1.7;--fw-h:600;--track:0;--density:1.05;--sp:1rem}
html[data-taste-roll][data-vibe="operational"]{--radius:3px;--lh:1.5;--fw-h:600;--track:0;--density:.9;--sp:.7rem}
html[data-taste-roll][data-vibe="decorative"]{--radius:8px;--lh:1.75;--fw-h:800;--track:.02em;--density:1.15;--sp:1.25rem}
html[data-taste-roll] body{margin:0;background:var(--bg);color:var(--ink);font:400 1.02rem/var(--lh,1.6) var(--font,system-ui,sans-serif);letter-spacing:var(--track,0)}
html[data-taste-roll] h1,html[data-taste-roll] h2,html[data-taste-roll] h3,html[data-taste-roll] h4{font-family:var(--font-display,var(--font,system-ui));font-weight:var(--fw-h,700);line-height:1.15;letter-spacing:calc(var(--track,0) * .5)}
html[data-taste-roll] h1{font-size:2.2em;margin:.65em 0 .35em}
html[data-taste-roll] h2{font-size:1.6em;margin:1em 0 .4em;border-bottom:1px solid var(--line);padding-bottom:.25em}
html[data-taste-roll] h3{font-size:1.25em;margin:1em 0 .35em}
html[data-taste-roll] a{color:var(--acc);text-decoration:underline;text-underline-offset:.18em}
html[data-taste-roll] a:hover{color:var(--ink)}
html[data-taste-roll] :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
html[data-taste-roll] button,html[data-taste-roll] input[type="button"],html[data-taste-roll] input[type="submit"]{background:var(--acc);color:var(--on-acc);border:0;border-radius:var(--radius,4px);padding:.55em 1.1em;font:inherit;font-weight:600;cursor:pointer}
html[data-taste-roll] button:hover{filter:brightness(1.08)}
html[data-taste-roll] input,html[data-taste-roll] select,html[data-taste-roll] textarea{background:var(--s1);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius,4px);padding:.5em .7em;font:inherit}
html[data-taste-roll] code,html[data-taste-roll] pre,html[data-taste-roll] kbd,html[data-taste-roll] samp{font:400 .92em/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--s2);border-radius:calc(var(--radius,4px) / 2)}
html[data-taste-roll] pre{padding:calc(var(--sp,1rem) * .8);overflow:auto;border:1px solid var(--line)}
html[data-taste-roll] code{padding:.12em .35em}
html[data-taste-roll] blockquote{margin:calc(var(--sp,1rem) * 1.4) 0;padding:.2em 0 .2em calc(var(--sp,1rem) * 1.2);border-left:3px solid var(--acc);color:var(--muted);font-style:italic}
html[data-taste-roll] hr{border:0;border-top:1px solid var(--line-strong);margin:calc(var(--sp,1rem) * 1.6) 0}
html[data-taste-roll] table{border-collapse:collapse;width:100%}
html[data-taste-roll] th{background:var(--s2);text-align:left;font-weight:var(--fw-h,700)}
html[data-taste-roll] th,html[data-taste-roll] td{border:1px solid var(--line);padding:calc(var(--sp,1rem) * .5) calc(var(--sp,1rem) * .7)}
html[data-taste-roll] img{max-width:100%;height:auto;border-radius:var(--radius,4px)}
html[data-taste-roll] section,html[data-taste-roll] article{margin:calc(var(--sp,1rem) * 1.2) 0;line-height:var(--lh,1.6)}
html[data-taste-roll] header,html[data-taste-roll] nav,html[data-taste-roll] main,html[data-taste-roll] footer{box-sizing:border-box}
html[data-taste-roll] main,html[data-taste-roll] body{padding:0}
html[data-taste-roll] main{max-width:72ch;margin:0 auto;padding:calc(var(--sp,1rem) * 1.5)}
html[data-taste-roll] ul,html[data-taste-roll] ol{padding-left:1.4em}
html[data-taste-roll] li{margin:.3em 0}
html[data-taste-roll][data-sig="needle"]{border-left:4px solid var(--acc)}
html[data-taste-roll][data-sig="needle"] body{padding-left:calc(var(--sp,1rem) * 1.1)}
html[data-taste-roll][data-sig="rule"] h2{border-bottom:2px solid var(--ink)}
html[data-taste-roll][data-sig="rule"] h1{border-bottom:4px double var(--ink);padding-bottom:.3em}
html[data-taste-roll][data-sig="display-word"] h1{font-size:3em;text-transform:uppercase;letter-spacing:.04em}
html[data-taste-roll][data-sig="display-word"] h2{font-size:1.9em}
html[data-taste-roll][data-sig="color-block"] h1{background:var(--acc);color:var(--on-acc);display:inline-block;padding:.25em .5em;border-radius:var(--radius,4px)}
html[data-taste-roll][data-sig="color-block"] header,html[data-taste-roll][data-sig="color-block"] nav{background:var(--acc);color:var(--on-acc);padding:calc(var(--sp,1rem) * .8) calc(var(--sp,1rem) * 1.1)}
html[data-taste-roll][data-sig="color-block"] header a,html[data-taste-roll][data-sig="color-block"] nav a{color:var(--on-acc)}
html[data-taste-roll][data-sig="bento"] body{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--sp,1rem);align-items:start}
html[data-taste-roll][data-sig="bento"]>*{margin:0;border:1px solid var(--line);border-radius:var(--radius,4px);padding:calc(var(--sp,1rem) * .9);background:var(--s1)}
html[data-taste-roll][data-sig="bento"] h1{grid-column:1/-1;font-size:1.8em}
html[data-taste-roll][data-sig="timeline"] body{position:relative;padding-left:calc(var(--sp,1rem) * 2.4)}
html[data-taste-roll][data-sig="timeline"] body::before{content:"";position:absolute;left:calc(var(--sp,1rem) * 1.1);top:0;bottom:0;width:2px;background:var(--acc)}
html[data-taste-roll][data-sig="timeline"] section,html[data-taste-roll][data-sig="timeline"] article{position:relative}
html[data-taste-roll][data-sig="timeline"] section::before,html[data-taste-roll][data-sig="timeline"] article::before{content:"";position:absolute;left:calc(var(--sp,1rem) * -1.55);top:.45em;width:.7em;height:.7em;border-radius:50%;background:var(--acc)}
html[data-taste-roll][data-sig="annotation"] blockquote{border:1px dashed var(--line-strong);border-left:3px solid var(--acc);background:var(--s2);border-radius:var(--radius,4px);padding:calc(var(--sp,1rem) * .8);font-style:italic}
html[data-taste-roll][data-sig="annotation"] h2::after{content:" *";color:var(--acc)}
html[data-taste-roll][data-sig="sixling"] body{column-count:2;column-gap:calc(var(--sp,1rem) * 2);column-rule:1px solid var(--line)}
html[data-taste-roll][data-sig="sixling"] h1{column-span:all}
`

/* ---- roll attribute surgery (R1) ----------------------------
 * A real lexical scan, not regexes: find the FIRST REAL open tag by name —
 * skipping HTML comments (a `<!-- … <html …> … -->` illustration is not an
 * element), doctype/bogus declarations, and raw-text element bodies
 * (script/style/…) — honoring quoted attribute values when locating the tag
 * end. Attributes are parsed with name/quote awareness so ONLY actual roll
 * attributes are replaced; unrelated attribute values (even ones containing
 * roll-like words or `>`/`<html` text) survive verbatim. One — and only one —
 * `>` is emitted. */
const ROLL_ATTR_NAMES = ['data-taste-roll', 'data-roll', 'data-ref', 'data-vibe', 'data-mode', 'data-sig', 'data-field']

/* A rolled column's colours come from its Resonant Field preset, through the
 * same palette() that builds the theme, so every pair keeps the theme's
 * contrast floors. ref keeps its fonts; dual reads as dark. Columns saved
 * before the field dimension have no field and keep the old token set. */
function fieldCss(roll) {
  const preset = roll && fieldPreset(roll.field)
  if (!preset) return ''
  const p = RF.palette(preset.prefs, roll.mode === 'light' ? 'light' : 'dark')
  return `html[data-taste-roll][data-field][data-mode]{--bg:${p.background};--s1:${p.card};--s2:${p.secondary};--line:${p.border};--line-strong:${p.input};--ink:${p.foreground};--muted:${p.mutedForeground};--acc:${p.primary};--on-acc:${p.primaryForeground}}`
}
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'])

function scanOpenTag(html, wanted) {
  /* First real `<wanted …>` open tag: { start, nameEnd, end } (end = index of
   * the closing '>'), or null. Comment/doctype/raw-text aware. */
  const want = String(wanted || '').toLowerCase()
  const n = html.length
  let i = 0
  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt < 0) return null
    if (html.startsWith('<!--', lt)) {
      const ce = html.indexOf('-->', lt + 4)
      i = ce < 0 ? n : ce + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('</', lt)) {
      const gt = html.indexOf('>', lt)
      i = gt < 0 ? n : gt + 1
      continue
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(html.slice(lt, lt + 32))
    if (!m) { i = lt + 1; continue }
    const name = m[1].toLowerCase()
    const nameEnd = lt + 1 + m[1].length
    let quote = null
    let j = nameEnd
    while (j < n) {
      const c = html[j]
      if (quote) { if (c === quote) quote = null; j++; continue }
      if (c === '"' || c === "'") { quote = c; j++; continue }
      if (c === '>') break
      j++
    }
    if (j >= n) return null /* unterminated tag: no real tag end anywhere */
    if (name === want) return { start: lt, nameEnd, end: j }
    if (RAW_TEXT_TAGS.has(name)) {
      const close = new RegExp('</\\s*' + name + '\\s*>', 'i').exec(html.slice(j + 1))
      i = close ? j + 1 + close.index + close[0].length : n
      continue
    }
    i = j + 1
  }
  return null
}

function scanCloseTag(html, wanted) {
  /* First real `</wanted …>` close tag (same comment/raw-text discipline);
   * returns its closing '>' index or -1. */
  const want = String(wanted || '').toLowerCase()
  const n = html.length
  let i = 0
  const probe = '</' + want
  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt < 0) return -1
    if (html.startsWith('<!--', lt)) {
      const ce = html.indexOf('-->', lt + 4)
      i = ce < 0 ? n : ce + 3
      continue
    }
    if (html.startsWith('<!', lt)) {
      const gt = html.indexOf('>', lt)
      i = gt < 0 ? n : gt + 1
      continue
    }
    if (html.slice(lt, lt + probe.length).toLowerCase() === probe) {
      const gt = html.indexOf('>', lt)
      return gt < 0 ? -1 : gt
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(html.slice(lt, lt + 32))
    if (!m) { i = lt + 1; continue }
    const name = m[1].toLowerCase()
    let quote = null
    let j = lt + 1 + m[1].length
    while (j < n) {
      const c = html[j]
      if (quote) { if (c === quote) quote = null; j++; continue }
      if (c === '"' || c === "'") { quote = c; j++; continue }
      if (c === '>') break
      j++
    }
    if (j >= n) return -1
    if (RAW_TEXT_TAGS.has(name)) {
      const close = new RegExp('</\\s*' + name + '\\s*>', 'i').exec(html.slice(j + 1))
      i = close ? j + 1 + close.index + close[0].length : n
      continue
    }
    i = j + 1
  }
  return -1
}

function parseAttrs(html, s, e) {
  /* Parse the attribute region [s, e) of a real open tag into ordered attrs
   * with verbatim source slices: [{ name, start, end }]. A quoted value keeps
   * whatever bytes it contains (including '>' or roll-like words). */
  const attrs = []
  let i = s
  while (i < e) {
    while (i < e && /[\s/]/.test(html[i])) i++
    if (i >= e) break
    const nameStart = i
    while (i < e && !/[\s=/>]/.test(html[i])) i++
    if (i === nameStart) { i++; continue }
    const name = html.slice(nameStart, i).toLowerCase()
    let k = i
    while (k < e && /\s/.test(html[k])) k++
    if (k < e && html[k] === '=') {
      k++
      while (k < e && /\s/.test(html[k])) k++
      if (k < e && (html[k] === '"' || html[k] === "'")) {
        const q = html[k]
        let ve = html.indexOf(q, k + 1)
        if (ve < 0 || ve >= e) ve = e - 1 /* unterminated: value runs to tag end */
        i = ve + 1
      } else {
        while (k < e && !/[\s>]/.test(html[k])) k++
        i = k
      }
    }
    attrs.push({ name, start: nameStart, end: Math.min(i, e) })
  }
  return attrs
}

function rollAttrString(roll, seed) {
  const field = roll.field && FACES.field.includes(roll.field) ? ` data-field="${roll.field}"` : ''
  return ` data-taste-roll="1" data-roll="s${seed}" data-ref="${roll.ref}" data-vibe="${roll.vibe}" data-mode="${roll.mode}" data-sig="${roll.sig}"${field}`
}

function buildRolledHtml(html, roll, seed) {
  const attrs = rollAttrString(roll, seed)
  const style = `<style id="tastecheck-roll">${ROLL_CSS}${fieldCss(roll)}</style>`
  let out = String(html || '')
  const open = scanOpenTag(out, 'html')
  if (open) {
    const keep = parseAttrs(out, open.nameEnd, open.end)
      .filter((a) => !ROLL_ATTR_NAMES.includes(a.name))
      .map((a) => out.slice(a.start, a.end))
    out = `${out.slice(0, open.start)}<html${keep.length ? ' ' + keep.join(' ') : ''}${attrs}>${out.slice(open.end + 1)}`
  } else if (scanOpenTag(out, 'body')) {
    /* body without an html element: open one just before the REAL <body>,
     * close at EOF. (Comment-embedded `<body` spellings never match.) */
    const b = scanOpenTag(out, 'body')
    out = `${out.slice(0, b.start)}<html${attrs}>${out.slice(b.start)}`
    if (scanCloseTag(out, 'html') < 0) out += '</html>'
  } else {
    out = `<html${attrs}><head><meta charset="utf-8"></head><body>${out}</body></html>`
  }
  const headClose = scanCloseTag(out, 'head')
  if (headClose >= 0) {
    out = `${out.slice(0, headClose + 1)}${style}${out.slice(headClose + 1)}`
  } else {
    const b = scanOpenTag(out, 'body')
    if (b) {
      out = `${out.slice(0, b.end + 1)}${style}${out.slice(b.end + 1)}`
    } else {
      out = style + out
    }
  }
  return out
}

/* ---- column gate lifecycle -------------------------------------------------
 * The ONLY place a column's gate states are named. Session state only: storage
 * keeps { seed, roll } per column, never a gate, so a column read back from
 * storage has no gate until materialize() marks it RESTORED.
 *
 *   newColumn ──▶ PENDING ──stampGate(SHIP)──▶ SHIP
 *                         └─stampGate(HOLD)──▶ HOLD
 *   (from storage, no gate) ──markRestored──▶ RESTORED
 *
 * SHIP, HOLD and RESTORED are terminal: a stamped column is never re-stamped
 * and a restored column is never audited (a new click rolls a new column). */
const GATE = Object.freeze({ PENDING: 'PENDING', SHIP: 'SHIP', HOLD: 'HOLD', RESTORED: 'RESTORED' })
const GATE_MOVES = Object.freeze({
  [GATE.PENDING]: Object.freeze([GATE.SHIP, GATE.HOLD]),
  [GATE.SHIP]: Object.freeze([]),
  [GATE.HOLD]: Object.freeze([]),
  [GATE.RESTORED]: Object.freeze([])
})

function gateOf(col) {
  return col && Object.prototype.hasOwnProperty.call(GATE_MOVES, col.gate) ? col.gate : null
}

function moveGate(col, to) {
  const from = gateOf(col)
  if (from === null || !GATE_MOVES[from].includes(to)) {
    throw new Error(`Taste Roll column gate cannot move ${from || '(none)'} -> ${to}`)
  }
  col.gate = to
}

function newColumn(seed, roll, srcdoc) {
  return { seed, roll, srcdoc, gate: GATE.PENDING, reasons: [] }
}

/** PENDING -> SHIP | HOLD, with the reasons shown under the stamp. */
function stampGate(col, to, reasons) {
  if (to !== GATE.SHIP && to !== GATE.HOLD) throw new Error(`not a gate stamp: ${to}`)
  moveGate(col, to)
  col.reasons = Array.isArray(reasons) ? reasons : []
}

/** A column read back from storage (no gate yet) -> RESTORED. */
function markRestored(col) {
  if (gateOf(col) !== null) throw new Error(`Taste Roll column gate cannot move ${col.gate} -> ${GATE.RESTORED}`)
  col.gate = GATE.RESTORED
  col.reasons = []
}

/* ---- module state --------------------------------------------------------- */
let pluginCtx = null
/* comparison = { cwd, file, filePath, why,
 *                columns: [{ seed, roll, srcdoc, gate, reasons }],
 *                noHtml: { message } | undefined } */
let comparison = null
let inFlight = false

function storageKey(cwd) { return `roll:${cwd || '(detached)'}` }

function loadComparison(cwd) {
  if (!pluginCtx) return null
  const all = pluginCtx.storage.get('comparisons', {})
  const saved = all[storageKey(cwd)]
  if (!saved || !Array.isArray(saved.columns) || !saved.columns.length) return null
  /* Storage holds { seed, roll } per column and never a gate; read only those
   * so nothing stored (a stray verdict/gate field) can stamp a column that was
   * not audited this session. materialize() marks these columns RESTORED. */
  comparison = { ...saved, columns: saved.columns.map((c) => ({ seed: c && c.seed, roll: c && c.roll })) }
  return comparison
}

function persistComparison() {
  if (!pluginCtx || !comparison) return
  /* Slim copy: seeds + rolls + file identity only. The HTML text, built column
   * srcdocs and verdicts are session state; srcdocs rebuild from the file on
   * the next click and verdicts re-audit, keeping storage small. */
  const slim = {
    cwd: comparison.cwd,
    file: comparison.file,
    filePath: comparison.filePath,
    why: comparison.why,
    pinned: comparison.pinned === true,
    seamAbsent: comparison.seamAbsent === true,
    candidates: Array.isArray(comparison.candidates) ? comparison.candidates.slice(0, 10) : undefined,
    columns: (comparison.columns || []).map((c) => ({ seed: c.seed, roll: c.roll, src: c.src, rating: c.rating == null ? null : c.rating, reason: c.reason || null }))
  }
  const all = pluginCtx.storage.get('comparisons', {})
  all[storageKey(comparison.cwd)] = slim
  pluginCtx.storage.set('comparisons', all)
}

/* ---- surface resolution (R3) --------------------------------
 * The session workspace (host cwd) IS the boundary: candidates come from the
 * cwd subtree only — a folder grant wider than the cwd never leaks a sibling
 * project in. When the host exposes a supported active-surface seam, the
 * ACTIVE file binds the first click (HTML → itself; CSS/non-frontend → the
 * nearest HTML to it, named). Without a seam (every build today), the newest-
 * edited HTML/CSS→nearest-HTML is an honest FALLBACK pick, labeled as such in
 * the strip, with an explicit tap-a-file handoff. mtime never claims to be
 * the file you are on. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.hermes', '__pycache__', 'dist', 'build', '.next'])

function activeSurfaceFromHost() {
  /* Supported active-surface seams, in preference order. Feature-detected:
   * neither exists in any Hermes Desktop build today (SDK audit 2026-11-08).
   * Returns { path, via } | null | a Promise of the same. */
  try {
    const st = host.state || {}
    if (st.activeFile && typeof st.activeFile.get === 'function') {
      const v = st.activeFile.get()
      if (typeof v === 'string' && v) return { path: v, via: 'host.state.activeFile' }
      if (v && typeof v.path === 'string' && v.path) return { path: v.path, via: 'host.state.activeFile' }
    }
  } catch { /* next seam */ }
  if (typeof host.activeFile === 'function') {
    try {
      const v = host.activeFile()
      if (v && typeof v.then === 'function') {
        return v.then((r) => {
          if (typeof r === 'string' && r) return { path: r, via: 'host.activeFile()' }
          if (r && typeof r.path === 'string' && r.path) return { path: r.path, via: 'host.activeFile()' }
          return null
        }).catch(() => null)
      }
      if (typeof v === 'string' && v) return { path: v, via: 'host.activeFile()' }
      if (v && typeof v.path === 'string' && v.path) return { path: v.path, via: 'host.activeFile()' }
    } catch { /* no seam */ }
  }
  return null
}

async function listDir(files, folderId, rel) {
  try {
    const res = await files.list(folderId, rel || undefined)
    if (!res || res.ok !== true || !Array.isArray(res.entries)) return null
    return res.entries
  } catch {
    return null
  }
}

async function collectFrontend(files, folderId, rootRel) {
  const rows = [] /* { rel, isCss } */
  const walk = async (rel, depth) => {
    if (depth > 4 || rows.length > 400) return
    const entries = await listDir(files, folderId, rel)
    if (!entries) return
    for (const e of entries) {
      if (e.isDirectory) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(rel ? `${rel}/${e.name}` : e.name, depth + 1)
      } else {
        if (/\.html?$/i.test(e.name) && e.name.toLowerCase() !== 'tasteroll.html') {
          rows.push({ rel: rel ? `${rel}/${e.name}` : e.name, isCss: false })
        } else if (/\.css$/i.test(e.name)) {
          rows.push({ rel: rel ? `${rel}/${e.name}` : e.name, isCss: true })
        }
      }
    }
  }
  await walk(rootRel, 0)
  return rows
}

async function statMs(files, folderId, rel) {
  try {
    const st = await files.stat(folderId, rel)
    if (!st || st.ok !== true || !st.exists) return -1
    return typeof st.mtimeMs === 'number' ? st.mtimeMs : 0
  } catch {
    return -1
  }
}

function nearestHtml(toRel, htmls) {
  /* Nearest HTML by shared-directory depth, same directory first; ties broken
   * by newest mtime, then shallower, then name — deterministic. */
  const dirOf = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i) }
  const segs = (d) => (d ? d.split('/') : [])
  const cssDir = segs(dirOf(toRel))
  let best = null
  for (const row of htmls) {
    const htmlDir = segs(dirOf(row.rel))
    let shared = 0
    while (shared < cssDir.length && shared < htmlDir.length && cssDir[shared] === htmlDir[shared]) shared++
    const hops = (cssDir.length - shared) + (htmlDir.length - shared)
    const depth = row.rel.split('/').length
    const mtime = typeof row.mtime === 'number' ? row.mtime : -1
    if (!best
      || hops < best.hops
      || (hops === best.hops && mtime > best.mtime)
      || (hops === best.hops && mtime === best.mtime && depth < best.depth)) {
      best = { rel: row.rel, hops, depth, mtime }
    }
  }
  return best ? best.rel : null
}

async function resolveSurface(files, folderId, cwd, grantPath, activeRel) {
  /* cwd relative to the grant; when the grant IS the cwd the root is ''. A cwd
   * outside the grant cannot happen (grantFor only returns covering grants). */
  const base = String(grantPath || '').replace(/\/+$/, '')
  const cwdAbs = String(cwd || '').replace(/\/+$/, '')
  if (!cwdAbs.startsWith(base)) return null
  const rootRel = cwdAbs.slice(base.length).replace(/^\/+/, '')
  const rows = await collectFrontend(files, folderId, rootRel)
  if (!rows.length) return null
  const capped = rows.slice(0, 120)
  const stats = await Promise.all(capped.map(async (r) => ({ ...r, mtime: await statMs(files, folderId, r.rel) })))
  const mtimeByRel = new Map(stats.map((s) => [s.rel, s.mtime]))
  const htmls = rows.filter((r) => !r.isCss).map((r) => ({ rel: r.rel, mtime: mtimeByRel.has(r.rel) ? mtimeByRel.get(r.rel) : -1 }))
  /* A supported active-file seam binds the surface — this is the product
   * requirement; the fallback below never claims to be it. */
  if (activeRel) {
    const rel = String(activeRel)
    const inScope = !rootRel || rel === rootRel || rel.startsWith(rootRel + '/')
    if (inScope && !rel.split('/').includes('..')) {
      if (/\.html?$/i.test(rel) && rel.split('/').pop().toLowerCase() !== 'tasteroll.html') {
        return { rel, why: `your active file (${rel})`, viaSeam: true }
      }
      if (htmls.length) {
        const near = nearestHtml(rel, htmls)
        if (near) return { rel: near, why: `active file ${rel} isn't HTML — nearest HTML in this workspace`, viaSeam: true }
      }
      return null /* active surface known, no HTML in its workspace */
    }
  }
  /* NO seam in this build: honest fallback — newest edit, labeled as a pick,
   * plus the explicit tap-a-file handoff (candidates ride on the target). */
  stats.sort((a, b) => b.mtime - a.mtime)
  const newest = stats.find((s) => s.mtime >= 0)
  const candidates = htmls.slice().sort((a, b) => b.mtime - a.mtime || (a.rel < b.rel ? -1 : 1)).map((r) => r.rel)
  const seamNote = 'no active-file API in this Desktop build — picked newest edit'
  if (!newest) {
    if (!htmls.length) return null
    return { rel: candidates[0], why: `${seamNote}; tap a file below if this isn't yours`, viaSeam: false, candidates }
  }
  if (!newest.isCss) {
    return { rel: newest.rel, why: `${seamNote} (${newest.rel}); tap a file below if this isn't yours`, viaSeam: false, candidates }
  }
  if (!htmls.length) return null
  const rel = nearestHtml(newest.rel, htmls)
  return { rel, why: `${seamNote} ${newest.rel} (CSS) → its nearest HTML; tap a file below if this isn't yours`, viaSeam: false, candidates }
}

/** The grant-relative path of an absolute file, or null unless the file lies
 *  inside BOTH the session workspace (cwd) and the folder grant. A restored
 *  comparison saved under a narrower grant can never read a sibling project. */
function rebaseInWorkspace(absPath, grantPath, cwd) {
  const strip = (p) => String(p || '').replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  const abs = strip(absPath)
  const base = strip(grantPath)
  const ws = strip(cwd)
  if (!abs || !base || !ws) return null
  if (abs.split('/').some((seg) => seg === '..' || seg === '.')) return null
  if (!abs.startsWith(ws + '/') || !abs.startsWith(base + '/')) return null
  return abs.slice(base.length + 1)
}

async function grantFor(cwd) {
  const folders = await pluginCtx.files.folders()
  const granted = (folders || []).filter((f) => f && f.path && cwd && (cwd + '/').startsWith(f.path.replace(/\/+$/, '') + '/'))
  if (granted.length) return granted.sort((a, b) => b.path.length - a.path.length)[0]
  const asked = await pluginCtx.files.requestFolder()
  if (!asked || asked.ok !== true || !asked.folder) return null
  return asked.folder
}

/* ---- per-column gate (R2) --------------------------------------------------
 * The column's exact srcdoc goes to this plugin's own backend namespace; the
 * verdict comes back bound to evidence. Fail closed: missing REST, busy gate,
 * transport error or a malformed response all stamp a visible HOLD. */
async function auditColumn(col, fileLabel) {
  if (gateOf(col) !== GATE.PENDING) throw new Error(`auditColumn needs a PENDING column, got ${gateOf(col)}`)
  openPane() /* show the pending state immediately */
  const rest = pluginCtx && typeof pluginCtx.rest === 'function' ? pluginCtx.rest.bind(pluginCtx) : null
  if (!rest) {
    stampGate(col, GATE.HOLD, ['gate unavailable: plugin REST missing (install/enable the tastecheck-hermes agent half)'])
    openPane()
    return
  }
  let stamp
  try {
    const res = await rest('/roll-audit', {
      method: 'POST',
      body: { html: col.srcdoc, label: `s${col.seed} ${col.roll.ref}/${col.roll.vibe}/${col.roll.mode}/${col.roll.sig} — ${fileLabel}` },
      timeoutMs: 300000
    })
    stamp = gateStampFor(res)
    /* A real HOLD verdict (not a transport or fail-closed HOLD) is weak
     * negative taste signal for this roll's faces. */
    if (taste && res && res.verdict === GATE.HOLD) taste.gateHold(col.roll)
  } catch (err) {
    stamp = [GATE.HOLD, [`gate unreachable: ${(err && err.message) || err}`]]
  }
  stampGate(col, stamp[0], stamp[1])
  openPane() /* re-render with the stamp; the column stays visible either way */
}

/** Map one /roll-audit response to [stamp, reasons]. Fail closed: only an
 *  explicit SHIP with ok === true is SHIP; anything else is a HOLD. */
function gateStampFor(res) {
  const verdict = res && typeof res === 'object' ? String(res.verdict || '') : ''
  if (verdict === GATE.SHIP && res.ok === true) {
    return [GATE.SHIP, Array.isArray(res.hold_reasons) ? res.hold_reasons : []]
  }
  if (verdict === GATE.HOLD) {
    return [GATE.HOLD, Array.isArray(res.hold_reasons) && res.hold_reasons.length
      ? res.hold_reasons
      : [String((res && res.error) || 'audit did not produce evidence')]]
  }
  return [GATE.HOLD, ['gate returned no valid verdict (fail closed)']]
}

async function runRoll() {
  if (inFlight || !pluginCtx) return
  /* R5: feature-detect the host capability BEFORE any side effect — no file
   * read, no roll, no persisted state when the host cannot show the pane. */
  if (typeof host.openWorkspace !== 'function') {
    host.notifyError('This Hermes Desktop build has no plugin workspace panes (host.openWorkspace). Taste Roll needs it to show the comparison beside your work.')
    return
  }
  inFlight = true
  try {
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    const folder = await grantFor(cwd)
    if (!folder) {
      host.notify('Taste Roll needs your project folder — grant it to roll your own page.')
      return
    }
    let current = comparison && comparison.cwd === cwd ? comparison : loadComparison(cwd)
    /* Sticky target: an existing comparison keeps its named file while it still
     * exists, so consecutive rolls iterate the same surface. */
    let target = null
    if (current && current.file) {
      /* Stored identity is the ABSOLUTE path; rebase it onto today's grant and
       * re-check it sits inside this session's workspace before any read. */
      const rel = rebaseInWorkspace(current.filePath, folder.path, cwd)
      if (rel) {
        const stat = await pluginCtx.files.stat(folder.id, rel)
        if (stat && stat.ok === true && stat.exists) {
          target = { rel, why: current.why || 'same surface as your previous rolls' }
        }
      }
    }
    if (!target) {
      /* R3: a supported active-surface seam binds the FIRST click; the
       * newest-edit fallback (and its honest label) lives in resolveSurface. */
      const activeRaw = await activeSurfaceFromHost()
      let activeRel = null
      if (activeRaw && activeRaw.path) {
        const abs = String(activeRaw.path).replace(/\/+$/, '')
        const baseAbs = String(folder.path || '').replace(/\/+$/, '')
        const cwdAbs = String(cwd || '').replace(/\/+$/, '')
        if (cwdAbs && abs.startsWith(cwdAbs + '/') && (cwdAbs + '/').startsWith(baseAbs + '/')) {
          activeRel = abs.slice(baseAbs.length ? baseAbs.length + 1 : 0).replace(/^\/+/, '')
        }
      }
      target = await resolveSurface(pluginCtx.files, folder.id, cwd, folder.path, activeRel)
    }
    if (!target) {
      /* R5: no HTML in the workspace — say so IN the strip, not only a toast. */
      comparison = { cwd, noHtml: { message: `No HTML in ${cwd || 'this workspace'} — Taste Roll restyles HTML surfaces. (tasteroll.html is never used.)` }, columns: [] }
      openPane()
      host.notify(comparison.noHtml.message)
      return
    }
    const read = await pluginCtx.files.readText(folder.id, target.rel)
    if (!read || read.ok !== true) {
      host.notifyError(`Taste Roll could not read ${target.rel}.`)
      return
    }
    const html = read.text
    const baseSeed = (((Date.now() / 1000) >>> 0) ^ ((current ? current.columns.length : 0) + 1) * 2654435761) >>> 0
    const pick = taste ? taste.choose(baseSeed) : { seed: baseSeed, roll: tasteroll(baseSeed).roll(FACES), src: 'random' }
    const seed = pick.seed
    const roll = pick.roll
    if (!current) {
      current = { cwd, file: target.rel, filePath: `${folder.path}/${target.rel}`, why: target.why, columns: [] }
    } else {
      current.noHtml = undefined
      current.file = target.rel
      current.filePath = `${folder.path}/${target.rel}`
      current.why = target.why
    }
    if (target.viaSeam === false) {
      current.seamAbsent = true
      current.candidates = Array.isArray(target.candidates) ? target.candidates.slice(0, 10) : []
    } else if (target.viaSeam === true) {
      current.seamAbsent = false
      current.candidates = undefined
    }
    current.originalHtml = html
    const col = newColumn(seed, roll, buildRolledHtml(html, roll, seed))
    Object.assign(col, { src: pick.src, rating: null, reason: null })
    current.columns.push(col)
    comparison = current
    try {
      openPane() /* the pane opens with the new column in PENDING state */
    } catch (openErr) {
      /* R5: the host refused — roll the column back; nothing persists. */
      current.columns.pop()
      comparison = current.columns.length || current.noHtml ? current : null
      host.notifyError(`Taste Roll could not open the comparison pane: ${(openErr && openErr.message) || openErr}`)
      return
    }
    persistComparison()
    host.notify(`Taste Roll ${roll.ref} / ${roll.vibe} / ${roll.mode} / ${roll.sig} (s${seed}) — column ${current.columns.length}, gate running…`)
    void auditColumn(col, target.rel)
  } catch (err) {
    host.notifyError(`Taste Roll failed: ${(err && err.message) || err}`)
  } finally {
    inFlight = false
  }
}

/* Explicit supported surface handoff (R3): the strip offers the workspace's
 * HTML files; tapping one makes THAT the surface — the user names it, no
 * mtime guess. The comparison restarts on the named file with a fresh roll. */
async function switchSurface(rel) {
  if (inFlight || !pluginCtx || !comparison) return
  inFlight = true
  let switched = false
  try {
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    const folder = await grantFor(cwd)
    if (!folder) {
      host.notifyError('Taste Roll needs your project folder to switch surface.')
      return
    }
    const strip = (p) => String(p || '').replace(/\/+$/, '')
    if (!rebaseInWorkspace(`${strip(folder.path)}/${rel}`, folder.path, cwd)) {
      host.notifyError(`Taste Roll only rolls files inside this session's workspace; ${rel} is not.`)
      return
    }
    const stat = await pluginCtx.files.stat(folder.id, rel)
    if (!stat || stat.ok !== true || !stat.exists) {
      host.notifyError(`Taste Roll could not find ${rel}.`)
      return
    }
    comparison = {
      cwd,
      file: rel,
      filePath: `${folder.path}/${rel}`,
      why: 'you picked this file',
      columns: [],
      pinned: true,
      seamAbsent: false,
      candidates: undefined
    }
    persistComparison()
    openPane()
    switched = true
  } catch (err) {
    host.notifyError(`Taste Roll could not switch surface: ${(err && err.message) || err}`)
  } finally {
    inFlight = false
    /* Roll only after a successful switch: a failure must not re-open the
     * folder picker or roll the old surface. */
    if (switched) void runRoll()
  }
}

/* ---- the comparison pane (stable id; re-registering replaces + reveals) ---- */

const PANE_ID = 'tastecheck:tasteroll'

function ColumnFrame(props) {
  /* Sandbox mirrors the built-in preview frame exactly (preview-browser-frame.ts):
     allow-forms allow-scripts, allow="fullscreen", no-referrer — opaque origin. */
  return h('iframe', {
    srcDoc: props.srcdoc,
    sandbox: 'allow-forms allow-scripts',
    allow: 'fullscreen',
    referrerPolicy: 'no-referrer',
    title: props.label,
    style: { width: '100%', flex: '1 1 auto', border: 0, background: '#fff' }
  })
}

const STAMP_STYLE = {
  SHIP: { background: '#0c6b52', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em' },
  HOLD: { background: '#bd3d10', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em' },
  PENDING: { background: '#555', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 600, fontSize: '.72rem', letterSpacing: '.04em' }
}

/* ---- glyphs ---------------------------------------------------------------
 * The composer row is all 14px single-colour line icons (codicons). The Taste
 * Roll mark sits in that row as an equal: a fanned hand of three sheets (one
 * roll = a new variant dealt beside your page), drawn on the codicon 16-unit
 * grid in currentColor so it takes the row's own tertiary/hover colours. The
 * back sheets are masked, not filled, so no background colour is assumed.
 * A functional UI glyph, not the product mark (that goes through the eye-gate).
 * Mask ids are fixed: every instance has identical content, so a duplicate
 * id in the document resolves to the same shape. */
function RollGlyph() {
  /* A hand of three sheets fanned from one pivot; each overlaps the one on its
   * left, so the back two are masked by everything in front of them. */
  const card = { x: 5, y: 2, width: 6, height: 10, rx: 1.25 }
  const turn = (deg) => `rotate(${deg} 8 14.5)`
  const knock = (deg) => h('rect', { ...card, key: deg, transform: turn(deg), fill: '#000', stroke: '#000', strokeWidth: 2.4 })
  const mask = (id, degs) => h('mask', { id, key: id },
    h('rect', { width: 16, height: 16, fill: '#fff', stroke: 'none' }), ...degs.map(knock))
  return h('svg', {
    'aria-hidden': 'true', focusable: 'false', viewBox: '0 0 16 16', width: '0.875rem', height: '0.875rem',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinejoin: 'round',
    style: { display: 'block' }
  },
  h('defs', { key: 'd' }, mask('tastecheck-roll-a', [0, 24]), mask('tastecheck-roll-b', [24])),
  /* Masks sit on unrotated groups: a mask on the rotated rect itself would be
   * applied in that rect's rotated space and knock the wrong area out. */
  h('g', { key: 'l', mask: 'url(#tastecheck-roll-a)' }, h('rect', { ...card, transform: turn(-24) })),
  h('g', { key: 'm', mask: 'url(#tastecheck-roll-b)' }, h('rect', { ...card, transform: turn(0) })),
  h('rect', { ...card, key: 'r', transform: turn(24) }))
}

/* Keep/Pass use the host's own codicon font (thumbs; filled when pressed), so
 * they read like every other Desktop control. The text label stays: the icon is
 * decoration and the button never depends on the font loading. */
function Glyph(props) {
  return h('i', { 'aria-hidden': 'true', className: `codicon codicon-${props.name}`, style: { fontSize: '0.875rem', lineHeight: 1 } })
}

/* ---- feedback ------------------------------------------------------------- */

function rateColumn(col, y) {
  if (!taste || !col) return
  if (col.rating === y) {
    /* Tapping the pressed button again clears the rating. */
    taste.unrate(col.roll, y)
    col.rating = null
    col.reason = null
  } else {
    if (col.rating === 0 || col.rating === 1) taste.unrate(col.roll, col.rating)
    col.rating = y
    col.reason = null
    const rollback = taste.rate(col.roll, col.src, y)
    if (rollback) host.notify(rollback)
  }
  persistComparison()
  openPane()
}

function aimColumn(col, reasonId) {
  if (!taste || !col || (col.rating !== 0 && col.rating !== 1) || col.reason) return
  col.reason = reasonId
  taste.aim(col.roll, col.rating, reasonId)
  persistComparison()
  openPane()
}

function latestColumn() {
  const cols = comparison && Array.isArray(comparison.columns) ? comparison.columns : []
  return cols.length ? cols[cols.length - 1] : null
}

const FEEDBACK_BTN = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '.3rem',
  border: '1px solid var(--line-strong, #999)',
  background: 'transparent',
  color: 'inherit',
  borderRadius: '.4rem',
  padding: '.2rem .75rem',
  minHeight: '2.75rem',
  minWidth: '2.75rem',
  font: 'inherit',
  fontSize: '.8rem',
  fontWeight: 600,
  cursor: 'pointer'
}
/* Pressed reads by shape, not just a theme tint: a 2px current-colour border, bold label and a filled glyph. */
const PRESSED = { background: 'var(--s2, #e9e9e9)', border: '2px solid currentColor', fontWeight: 700 }
const CHIP = { ...FEEDBACK_BTN, fontWeight: 500, padding: '.1rem .7rem', minHeight: '2.75rem', fontSize: '.8rem', borderStyle: 'dashed' }

function FeedbackRow(props) {
  const { col, index } = props
  const kept = col.rating === 1
  const passed = col.rating === 0
  const kids = [
    h('button', {
      key: 'keep', type: 'button', 'aria-pressed': kept,
      'aria-label': `Keep roll ${index + 1}: more like this`,
      style: kept ? { ...FEEDBACK_BTN, ...PRESSED } : FEEDBACK_BTN,
      onClick: (e) => { e.preventDefault(); rateColumn(col, 1) }
    }, h(Glyph, { name: kept ? 'thumbsup-filled' : 'thumbsup' }), kept ? 'Kept' : 'Keep'),
    h('button', {
      key: 'pass', type: 'button', 'aria-pressed': passed,
      'aria-label': `Pass on roll ${index + 1}: less like this`,
      style: passed ? { ...FEEDBACK_BTN, ...PRESSED } : FEEDBACK_BTN,
      onClick: (e) => { e.preventDefault(); rateColumn(col, 0) }
    }, h(Glyph, { name: passed ? 'thumbsdown-filled' : 'thumbsdown' }), passed ? 'Passed' : 'Pass')
  ]
  if ((kept || passed) && !col.reason) {
    kids.push(h('span', { key: 'why', style: { fontSize: '.78rem' } }, kept ? 'What made it?' : 'What was off?'))
    REASONS.forEach((r) => kids.push(h('button', {
      key: `r-${r.id}`, type: 'button',
      'aria-label': `${kept ? 'Kept' : 'Passed'} mostly for the ${r.label.toLowerCase()}`,
      style: CHIP,
      onClick: (e) => { e.preventDefault(); aimColumn(col, r.id) }
    }, r.label)))
  } else if (col.reason) {
    const r = REASONS.find((x) => x.id === col.reason)
    kids.push(h('span', { key: 'why', role: 'status', style: { fontSize: '.78rem' } },
      `${kept ? 'Kept' : 'Passed'} for the ${r ? r.label.toLowerCase() : 'look'} — noted.`))
  }
  return h('div', { role: 'group', 'aria-label': `Feedback on roll ${index + 1}`, style: { display: 'flex', gap: '.35rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '.35rem' } }, kids)
}

function LearningStrip() {
  if (!taste) return null
  const st = taste.stats()
  const pct = (x) => (x.n ? `${Math.round((100 * x.kept) / x.n)}% of ${x.n}` : 'none yet')
  /* Don't claim a direction from a handful of taps. */
  const leaning = st.ratings + st.theme + st.looks >= 5
    ? Object.entries(st.top).filter(([, v]) => v).map(([dim, v]) => (dim === 'field' ? `${fieldLabel(v)} colours` : v))
    : []
  const themeNote = st.theme ? ` · ${st.theme} theme choice${st.theme === 1 ? '' : 's'}` : ''
  const lookCheck = st.lookLearned.n && st.lookRandom.n ? `; tuned looks ${pct(st.lookLearned)}, random looks ${pct(st.lookRandom)}` : ''
  const lookNote = st.looks ? ` · ${st.looks} rolled look${st.looks === 1 ? '' : 's'} (kept ${st.lookKept} of the last ${st.lookWindow}${lookCheck})` : ''
  const text = st.ratings || st.theme || st.looks
    ? `Learning from ${st.ratings} rating${st.ratings === 1 ? '' : 's'}${themeNote}${lookNote} · kept: tuned rolls ${pct(st.learned)}, random rolls ${pct(st.random)}${leaning.length ? ` · leaning ${leaning.join(' / ')}` : ''}`
    : 'Keep or pass each roll and the next ones lean your way. One roll in ten stays random to check it is working.'
  return h('div', { style: { display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '.3rem .8rem', fontSize: '.72rem', borderBottom: '1px solid var(--line, #ddd)' } },
    h('span', { role: 'status', style: {} }, text),
    st.ratings || st.theme || st.looks
      ? h('button', {
          type: 'button',
          style: { ...CHIP, marginLeft: 'auto', borderStyle: 'solid' },
          onClick: (e) => {
            e.preventDefault()
            taste.reset()
            if (comparison) comparison.columns.forEach((c) => { c.rating = null; c.reason = null })
            persistComparison()
            host.notify('Taste Roll forgot your taste. Rolls are random again until you rate some.')
            openPane()
          }
        }, 'Reset taste')
      : null)
}

function ColumnHeader(props) {
  const { col, index } = props
  const kids = [
    h('div', { key: 'title', style: { display: 'flex', gap: '.45rem', alignItems: 'baseline', flexWrap: 'wrap' } },
      h('span', null, `Roll ${index + 1} · s${col.seed}`),
      h('span', { style: {} }, `${col.roll.ref} · ${col.roll.vibe} · ${col.roll.mode} · ${col.roll.sig}${col.roll.field ? ` · ${fieldLabel(col.roll.field)} colours` : ''}`))
  ]
  const gate = gateOf(col)
  if (gate === GATE.SHIP) {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'center', marginTop: '.15rem' } },
      h('span', { style: STAMP_STYLE.SHIP }, 'SHIP'),
      h('span', { style: { fontSize: '.78rem' } }, 'gate passed')))
  } else if (gate === GATE.HOLD) {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'baseline', marginTop: '.15rem', flexWrap: 'wrap' } },
      h('span', { style: STAMP_STYLE.HOLD }, 'HOLD'),
      h('span', { style: { fontSize: '.78rem' } }, (col.reasons || []).slice(0, 2).join(' · ') || 'held')))
  } else if (gate === GATE.RESTORED) {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'center', marginTop: '.15rem' } },
      h('span', { style: STAMP_STYLE.PENDING }, 'GATE —'),
      h('span', { style: { fontSize: '.78rem' } }, 'not audited this session (click Taste Roll to re-roll + gate)')))
  } else {
    /* PENDING — and, fail closed, any unknown gate value: never a SHIP stamp. */
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'center', marginTop: '.15rem' } },
      h('span', { style: STAMP_STYLE.PENDING }, 'GATE…'),
      h('span', { style: { fontSize: '.78rem' } }, 'auditing this column')))
  }
  kids.push(h(FeedbackRow, { key: 'feedback', col, index }))
  return h('div', { style: { padding: '.45rem .7rem', fontSize: '.78rem', fontWeight: 600, borderBottom: '1px solid var(--line, #ddd)' } }, kids)
}

function SurfacePicker(props) {
  /* R3 explicit handoff: shown only when the host has NO active-file seam and
   * the user hasn't named a surface — tap a file to roll THAT page. */
  const { files, current } = props
  const kids = [h('span', { key: 'lbl', style: {} }, 'Not your page? Roll a specific file instead:')]
  files.slice(0, 10).forEach((rel) => {
    kids.push(h('button', {
      key: rel,
      type: 'button',
      onClick: (e) => { e.preventDefault(); void switchSurface(rel) },
      style: {
        border: '1px solid var(--line, #ddd)',
        background: rel === current ? 'var(--s2, #eee)' : 'transparent',
        color: 'inherit',
        borderRadius: '.35rem',
        padding: '.05rem .4rem',
        font: 'inherit',
        fontSize: '.72rem',
        cursor: 'pointer'
      }
    }, rel))
  })
  return h('div', {
    style: {
      display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center',
      padding: '.25rem .8rem .35rem', fontSize: '.72rem',
      borderBottom: '1px solid var(--line, #ddd)'
    }
  }, kids)
}

function renderPane() {
  const cur = comparison
  if (!cur) {
    return h('div', { style: { padding: '1rem' } },
      'Taste Roll — click “Taste Roll” above the composer to restyle your own page.')
  }
  if (cur.noHtml) {
    return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div', { style: { padding: '.5rem .8rem', fontSize: '.8rem', borderBottom: '1px solid var(--line, #ddd)', display: 'flex', gap: '1rem', alignItems: 'baseline' } },
        h('strong', null, 'Taste Roll')),
      h('div', { style: { padding: '1rem', fontSize: '.85rem' } }, cur.noHtml.message))
  }
  if (!cur.columns.length) {
    return h('div', { style: { padding: '1rem' } },
      'Taste Roll — click “Taste Roll” above the composer to restyle your own page.')
  }
  const kids = []
  kids.push(h('div', {
    key: 'col-original',
    style: { display: 'flex', flexDirection: 'column', minWidth: '24rem', width: '24rem', borderRight: '1px solid var(--line, #ddd)' }
  },
    h('div', { style: { padding: '.45rem .7rem', fontSize: '.78rem', fontWeight: 600, borderBottom: '1px solid var(--line, #ddd)' } },
      `Your work — unchanged (${cur.file})`),
    h(ColumnFrame, { label: 'Your work', srcdoc: cur.originalHtml })))
  cur.columns.forEach((col, i) => {
    kids.push(h('div', {
      key: `col-${col.seed}-${i}`,
      style: { display: 'flex', flexDirection: 'column', minWidth: '24rem', width: '24rem', borderRight: '1px solid var(--line, #ddd)' }
    },
      h(ColumnHeader, { col, index: i }),
      h(ColumnFrame, { label: `Roll ${i + 1}`, srcdoc: col.srcdoc })))
  })
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    h('div', { style: { padding: '.5rem .8rem', fontSize: '.8rem', borderBottom: '1px solid var(--line, #ddd)', display: 'flex', gap: '1rem', alignItems: 'baseline' } },
      h('strong', null, 'Taste Roll'),
      h('span', { style: {} }, `${cur.file} — ${cur.why || 'your surface'}`),
      h('span', { style: { marginLeft: 'auto' } }, 'Each click adds a column; previous columns stay.')),
    cur.seamAbsent === true && cur.pinned !== true && Array.isArray(cur.candidates) && cur.candidates.length > 1
      ? h(SurfacePicker, { key: 'surface-picker', files: cur.candidates, current: cur.file })
      : null,
    h(LearningStrip, { key: 'learning' }),
    h('div', { style: { display: 'flex', flex: '1 1 auto', overflowX: 'auto', height: '100%' } }, kids))
}

/** The pane reads live module state; the original HTML + built column srcdocs
 *  are cached on the comparison object for this session. */
function materialize(cur) {
  if (!cur) return
  cur.originalHtml = cur.originalHtml || cur.sourceText || ''
  cur.columns.forEach((col) => {
    if (!col.srcdoc) {
      col.srcdoc = buildRolledHtml(cur.originalHtml, col.roll, col.seed)
      /* Restored from persistence without this-session verdicts: show an
       * honest "not audited this session" state, not a fake pending/SHIP. */
      if (gateOf(col) === null) markRestored(col)
    }
  })
}

let lastClose = null

function openPane() {
  if (comparison) materialize(comparison)
  /* Stable id: re-registering replaces the existing pane contribution and
   * re-reveals it — one workspace tab, columns accumulate inside it. */
  lastClose = host.openWorkspace(PANE_ID, {
    title: 'Taste Roll',
    minWidth: '24rem',
    render: renderPane
  })
}

/* ---- Your-taste theme -------------------------------------------------------
 * Once the learner leans toward a colour field (a kept roll or two preset
 * picks), it offers that preset as "Resonant Field · Your taste" in the theme
 * list. It never switches the theme: choosing it stays the user's move. Floors
 * come from buildTheme, the same as every Resonant Field theme. */
const TASTE_THEME_ID = 'resonant-field-taste'
function tasteThemeFollower(ctx) {
  let shown = null
  let dispose = null
  return () => {
    const field = taste ? taste.stats().top.field : null
    if (field === shown) return
    if (dispose) { dispose(); dispose = null }
    shown = field
    const preset = field && fieldPreset(field)
    if (!preset) return
    dispose = ctx.register({
      id: 'theme-taste',
      area: SDK.THEMES_AREA,
      data: RF.buildTheme(TASTE_THEME_ID, 'Resonant Field · Your taste',
        `Learned from your Taste Roll keeps and theme choices: leaning ${fieldLabel(field)}.`,
        preset.prefs, RF.PLATES, RF.FONT_URL)
    })
  }
}


/* ---- Roll the look ----------------------------------------------------------
 * The second button. Where Taste Roll restyles the user's page in a side
 * column, this one re-skins Desktop itself in a Resonant Field variation, live,
 * and asks Keep or Pass on what is on screen. Pass puts the previous theme
 * back; Keep saves the look as "Resonant Field · Kept" in the theme list.
 * Both teach the same taste the page rolls use.
 *
 * Desktop persists whatever theme is switched to, so an unrated roll is saved
 * too (the look, the theme to return to) and re-registered on the next load:
 * a quit or plugin reload mid-roll comes back to the same look with Keep and
 * Pass still on offer, never to the Hermes default. */
const LOOK_ON = RF_ON && typeof SDK.requestTheme === 'function' && typeof SDK.useTheme === 'function' && typeof SDK.useValue === 'function'
const ROLLED_ID = 'resonant-field-rolled'
const KEPT_ID = 'resonant-field-kept'
/* A second texture per field, chosen to sit in that field's own world. */
const ALT_PLATE = { indigo: 'night', verdant: 'canopy-up', daylight: 'cloud-canopy-v2', graphite: 'hammered-metal', rosi: 'tide-v2', walnut: 'leather-grain' }
const TINT = { soft: 0.5, base: 1, deep: 1.6 }
const GREY_TINT = { soft: 0, base: 5, deep: 10 }
const SHIFT = { minus: -20, base: 0, plus: 20 }
const PRESENCE = { low: 0.55, mid: 0.8, high: 1 }
const wrapHue = (x) => ((Math.round(x) % 360) + 360) % 360

function cleanLook(raw) {
  if (!raw || typeof raw !== 'object' || !FACES.field.includes(raw.field)) return null
  const look = { field: raw.field }
  for (const dim of Object.keys(LOOK)) {
    if (!LOOK[dim].includes(raw[dim])) return null
    look[dim] = raw[dim]
  }
  return look
}

/** A look → Resonant Field prefs: moves around the field's preset. */
function lookPrefs(look) {
  const q = fieldPreset(look.field).prefs
  const d = SHIFT[look.shift]
  const strength = q.strength ? Math.min(55, Math.round(q.strength * TINT[look.tint])) : GREY_TINT[look.tint]
  const own = q.plate || null
  const alt = RF.PLATES[ALT_PLATE[look.field]] ? ALT_PLATE[look.field] : own
  const plate = look.texture === 'bare' ? null : look.texture === 'alt' ? alt : own
  return { ...q, hue: wrapHue(q.hue + d), accent: wrapHue(q.accent + d), strength, plate, presence: PRESENCE[look.presence] }
}

/** The one spelling of a look that paints a given theme: a field with no
 *  texture of its own makes "own" the same as "bare", an alternate that
 *  resolves to the own plate is "own", and presence means nothing without a
 *  texture. The learner keys, repeats and credits on this, never on the raw
 *  pick, so keeping "Indigo, no texture" can't teach "show textures". */
function canonLook(look) {
  const c = { ...look }
  const q = fieldPreset(c.field)
  if (!q) return c
  const own = q.prefs.plate || null
  const alt = RF.PLATES[ALT_PLATE[c.field]] ? ALT_PLATE[c.field] : own
  if (c.texture === 'own' && !own) c.texture = 'bare'
  if (c.texture === 'alt' && alt === own) c.texture = own ? 'own' : 'bare'
  if (c.texture === 'bare') c.presence = 'mid'
  return c
}

function describeLook(look) {
  const bits = [fieldLabel(look.field)]
  if (look.tint !== 'base') bits.push(look.tint === 'soft' ? 'softer tint' : 'deeper tint')
  if (look.shift !== 'base') bits.push(look.shift === 'minus' ? 'hue nudged down' : 'hue nudged up')
  const plate = lookPrefs(look).plate
  bits.push(!plate ? 'no texture' : look.texture === 'alt' ? 'alternate texture' : 'its own texture')
  if (plate && look.presence !== 'mid') bits.push(look.presence === 'low' ? 'faint' : 'strong')
  return bits.join(', ')
}

let lookAtom = null
let shownTheme = null
let disposeRolled = null
let disposeKept = null

function registerKept(look) {
  if (disposeKept) { disposeKept(); disposeKept = null }
  disposeKept = pluginCtx.register({
    id: 'theme-kept',
    area: SDK.THEMES_AREA,
    data: RF.buildTheme(KEPT_ID, 'Resonant Field · Kept', `The look you kept from Taste Roll: ${describeLook(look)}.`, lookPrefs(look), RF.PLATES, RF.FONT_URL)
  })
}

/* One rolled theme, replaced in place by contribution id: rolling again never
 * removes the theme on screen first, so there is no frame of the default. */
function registerRolled(look) {
  disposeRolled = pluginCtx.register({
    id: 'theme-rolled',
    area: SDK.THEMES_AREA,
    data: RF.buildTheme(ROLLED_ID, 'Resonant Field · Rolled', `A rolled look: ${describeLook(look)}.`, lookPrefs(look), RF.PLATES, RF.FONT_URL)
  })
}

/* After a rating the rolled theme leaves the list, once Desktop has switched
 * away from it (the switch lands on the host's next render). */
function retireRolled() {
  const dispose = disposeRolled
  disposeRolled = null
  if (dispose) setTimeout(() => { if (!disposeRolled) dispose() }, 600)
}

function setPending(p) {
  lookAtom.set(p)
  if (p) pluginCtx.storage.set('pendingLook', { look: p.look, src: p.src, prev: p.prev })
  else if (pluginCtx.storage.remove) pluginCtx.storage.remove('pendingLook')
  else pluginCtx.storage.set('pendingLook', null)
}

function rollLook() {
  if (!LOOK_ON || !taste || !pluginCtx) return
  const pending = lookAtom.get()
  /* Rolling again before rating carries no signal, and keeps the theme the
   * user started from as the one Pass returns to. */
  const prev = pending ? pending.prev : (shownTheme && shownTheme !== ROLLED_ID ? shownTheme : null)
  const { look, src } = taste.chooseLook()
  registerRolled(look)
  if (!SDK.requestTheme(ROLLED_ID)) {
    host.notifyError('Could not switch to the rolled look. Reload desktop plugins (⌘K) and try again.')
    return
  }
  setPending({ look, src, prev })
  host.notify(`New look: ${describeLook(look)}. Keep it or pass.`)
}

/** Back to the theme the user started from. True if it was there to go to. */
function restorePrev(prev) {
  if (prev && prev !== ROLLED_ID && SDK.requestTheme(prev)) return true
  SDK.requestTheme(RF.PRESETS[0].id)
  return false
}

function rateLook(y) {
  const pending = lookAtom && lookAtom.get()
  if (!pending) { host.notify('No rolled look to rate yet. Roll the look first.'); return }
  const msg = taste.rateLook(pending.look, pending.src, y)
  setPending(null)
  if (y) {
    const replaced = !!cleanLook(pluginCtx.storage.get('keptLook', null))
    pluginCtx.storage.set('keptLook', pending.look)
    registerKept(pending.look)
    SDK.requestTheme(KEPT_ID)
    host.notify(`Kept${replaced ? ', in place of your earlier kept look' : ''}. It is in your theme list as Resonant Field · Kept, and the next looks lean this way.`)
  } else {
    const back = restorePrev(pending.prev)
    host.notify(back ? 'Passed. Your previous theme is back.' : 'Passed. Back to Resonant Field · Indigo.')
  }
  retireRolled()
  if (msg) host.notify(msg)
}

/** Put the starting theme back without a vote: "not now", not "not this". */
function abandonLook() {
  const pending = lookAtom && lookAtom.get()
  if (!pending) { host.notify('No rolled look is on screen.'); return }
  setPending(null)
  const back = restorePrev(pending.prev)
  retireRolled()
  host.notify(back ? 'Your previous theme is back. That look was not counted.' : 'Back to Resonant Field · Indigo. That look was not counted.')
}

/* A blend of three swatches: the glyph for a whole-app look, distinct from the
 * fanned sheets of the page roll. Functional UI glyph, not the product mark. */
function LookGlyph() {
  return h('svg', {
    'aria-hidden': 'true', focusable: 'false', viewBox: '0 0 16 16', width: '0.875rem', height: '0.875rem',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1, style: { display: 'block' }
  },
  h('circle', { key: 'a', cx: 6, cy: 6, r: 3.6 }),
  h('circle', { key: 'b', cx: 10, cy: 6, r: 3.6 }),
  h('circle', { key: 'c', cx: 8, cy: 9.6, r: 3.6 }))
}

function tipped(label, button) {
  return typeof SDK.Tip === 'function' ? h(SDK.Tip, { label, placement: 'control' }, button) : button
}
const iconBtn = (label, onClick, kid, extra) => tipped(label, h('button', {
  type: 'button',
  className: GHOST_ICON_BTN,
  'aria-label': label,
  style: { display: 'inline-grid', placeItems: 'center', padding: 0, ...extra },
  onClick: (e) => { e.preventDefault(); onClick() },
  title: typeof SDK.Tip === 'function' ? undefined : label
}, kid))

function LookControls() {
  const pending = SDK.useValue(lookAtom)
  const { themeName } = SDK.useTheme()
  shownTheme = themeName
  const roll = iconBtn(pending ? 'Roll another look' : 'Roll the look: re-skin Desktop in a Resonant Field variation', rollLook, h(LookGlyph))
  if (!pending) return roll
  return h('span', { role: 'group', 'aria-label': `Rolled look: ${describeLook(pending.look)}`, style: { display: 'inline-flex', gap: '.1rem', alignItems: 'center' } },
    roll,
    iconBtn('Keep this look: more like it', () => rateLook(1), h(Glyph, { name: 'thumbsup' })),
    iconBtn('Pass on this look: less like it, and put my theme back', () => rateLook(0), h(Glyph, { name: 'thumbsdown' })))
}

function registerLookRoll(ctx) {
  lookAtom = SDK.atom(null)
  const kept = cleanLook(ctx.storage.get('keptLook', null))
  if (kept) registerKept(kept)
  /* A roll left unrated by a quit or reload: put the same look back in the
   * theme list (Desktop saved its name) and offer Keep/Pass again. */
  const saved = ctx.storage.get('pendingLook', null)
  const look = saved && cleanLook(saved.look)
  if (look) {
    registerRolled(look)
    lookAtom.set({ look, src: saved.src === 'learned' ? 'learned' : 'random', prev: typeof saved.prev === 'string' && saved.prev.length < 120 ? saved.prev : null })
  }
  ctx.register({ area: COMPOSER_AREAS.actions, id: 'taste-look', title: 'Roll the look', render: () => h(LookControls) })
  if (!PALETTE_AREA) return
  for (const [id, label, run, words] of [
    ['taste-look-roll', 'Taste Roll: roll the whole look', rollLook, 'theme reskin look appearance colour'],
    ['taste-look-keep', 'Taste Roll: keep this look', () => rateLook(1), 'theme look keep like more'],
    ['taste-look-pass', 'Taste Roll: pass on this look', () => rateLook(0), 'theme look pass dislike less'],
    ['taste-look-back', 'Taste Roll: put my theme back (no vote)', abandonLook, 'theme look back undo revert restore']
  ]) ctx.register({ id, area: PALETTE_AREA, data: { id, label, keywords: words.split(' '), run } })
}

/* ---- registration --------------------------------------------------------- */

/* Test seam for the column gate machine (the host only reads the default export). */
export const __columnGate = Object.freeze({ GATE, GATE_MOVES, gateOf, newColumn, stampGate, markRestored, gateStampFor })
/* Test seam for the theme merge. */
export const __theme = Object.freeze({ RF_ON, FIELDS: FACES.field, fieldCss, nearestField, fieldOfTasteEvent, buildRolledHtml, contrast: RF.contrast })
/* Test seam for the look roll. */
export const __look = Object.freeze({ LOOK_ON, LOOK, lookPrefs, canonLook, describeLook, cleanLook, buildTheme: RF.buildTheme, PLATES: RF.PLATES, ALT_PLATE })

export default {
  /* MUST equal the package folder name (`plugins/tastecheck-hermes/`): the
   * desktop host namespaces contributions AND ctx.rest by the DECLARED id, and
   * the backend router mounts at /api/plugins/tastecheck-hermes/. */
  id: 'tastecheck-hermes',
  name: 'Tastecheck',
  description: 'Taste Roll: restyle your own page in gated comparison columns, painted in Resonant Field colours. Your keeps and your theme choices teach one taste. The frontend ship gate lives in the Hermes-side tastecheck plugin.',
  register(ctx) {
    pluginCtx = ctx
    let followTaste = () => {}
    taste = createTaste(ctx.storage, Math.random, () => followTaste())
    if (RF_ON) {
      /* A theme failure must never take Taste Roll down with it. */
      try {
        RF.plugin.register(ctx, { onTaste: (ev) => { if (taste) taste.observeTheme(ev) } })
        followTaste = tasteThemeFollower(ctx)
        followTaste()
        if (LOOK_ON) registerLookRoll(ctx)
      } catch (err) {
        host.notifyError(`Resonant Field themes did not load: ${err && err.message ? err.message : err}`)
      }
    }
    ctx.register({
      area: COMPOSER_AREAS.actions,
      id: 'taste-roll',
      title: 'Taste Roll',
      render: () => {
        const label = 'Taste Roll: restyle your page in a new comparison column'
        const button = h('button', {
          type: 'button',
          className: GHOST_ICON_BTN,
          'aria-label': label,
          style: { display: 'inline-grid', placeItems: 'center', padding: 0 },
          onClick: (e) => { e.preventDefault(); void runRoll() },
          /* Native tooltip only when the host has no Tip component. */
          title: typeof SDK.Tip === 'function' ? undefined : label
        }, h(RollGlyph))
        return typeof SDK.Tip === 'function' ? h(SDK.Tip, { label, placement: 'control' }, button) : button
      }
    })
    /* R5: the same behavior from the command palette (⌘K), not only the button. */
    if (PALETTE_AREA) {
      ctx.register({
        id: 'taste-roll',
        area: PALETTE_AREA,
        data: {
          id: 'taste-roll',
          label: 'Taste Roll: restyle my page',
          keywords: ['taste', 'roll', 'restyle', 'theme', 'design', 'ship gate'],
          detail: () => (comparison && comparison.file ? comparison.file : 'adds a gated restyle column'),
          detailVariant: 'state',
          run: () => { void runRoll() }
        }
      })
      for (const [cmd, y, label] of [['taste-roll-keep', 1, 'Taste Roll: keep the latest roll'], ['taste-roll-pass', 0, 'Taste Roll: pass on the latest roll']]) {
        ctx.register({
          id: cmd,
          area: PALETTE_AREA,
          data: {
            id: cmd,
            label,
            keywords: ['taste', 'roll', y ? 'keep like more' : 'pass dislike less', 'feedback'],
            run: () => { const col = latestColumn(); if (col) rateColumn(col, y); else host.notify('No Taste Roll column to rate yet.') }
          }
        })
      }
    }
    /* Restore the current workspace's roll history lazily: the next click
     * re-reads the file and rebuilds srcdocs (we never read user files
     * without an action). */
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    loadComparison(cwd)
  }
}
