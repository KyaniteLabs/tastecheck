/**
 * The Taste Roll column gate machine (GATE in plugin.js): state table, every
 * legal move, every illegal move refused, legacy/stray stored values, and a
 * seeded random-sequence model test checking the invariants after every step.
 * Exhaustive over GATE: adding a state without a row here fails.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

globalThis.__tc = { cwd: '', notifies: [], errors: [], workspaces: [] }
const { __columnGate: G } = await import(resolve(import.meta.dirname, '..', 'plugin.js'))
const { GATE, GATE_MOVES, gateOf, newColumn, stampGate, markRestored, gateStampFor } = G

/* from -> legal to-states; null = a column read back from storage (no gate). */
const LEGAL = {
  null: ['RESTORED'],
  PENDING: ['SHIP', 'HOLD'],
  SHIP: [],
  HOLD: [],
  RESTORED: []
}
const ALL = Object.values(GATE)

function columnIn(state) {
  if (state === null) return { seed: 1, roll: {} }
  if (state === 'RESTORED') { const c = { seed: 1, roll: {} }; markRestored(c); return c }
  const c = newColumn(1, {}, '<html></html>')
  if (state !== 'PENDING') stampGate(c, state, ['r'])
  return c
}

function apply(col, to) {
  if (to === 'RESTORED') return markRestored(col)
  return stampGate(col, to, ['r'])
}

test('state table is exhaustive over GATE', () => {
  assert.deepEqual(ALL.slice().sort(), ['HOLD', 'PENDING', 'RESTORED', 'SHIP'])
  assert.deepEqual(Object.keys(GATE_MOVES).sort(), ALL.slice().sort())
  for (const s of ALL) assert.deepEqual([...GATE_MOVES[s]].sort(), LEGAL[s].filter((t) => t !== 'RESTORED').sort())
  assert.ok(Object.isFrozen(GATE) && Object.isFrozen(GATE_MOVES))
})

test('a new column starts PENDING with no reasons', () => {
  const c = newColumn(7, { ref: 'a' }, 'x')
  assert.equal(gateOf(c), GATE.PENDING)
  assert.deepEqual(c.reasons, [])
  assert.deepEqual(Object.keys(c).sort(), ['gate', 'reasons', 'roll', 'seed', 'srcdoc'], 'no dead fields')
})

test('every (from, to) move is either legal or refused without a partial write', () => {
  for (const from of [null, ...ALL]) {
    for (const to of ALL) {
      const col = columnIn(from)
      const before = JSON.stringify(col)
      if (LEGAL[from].includes(to)) {
        apply(col, to)
        assert.equal(gateOf(col), to, `${from} -> ${to}`)
      } else {
        assert.throws(() => apply(col, to), /cannot move|not a gate stamp/, `${from} -> ${to} must be refused`)
        assert.equal(JSON.stringify(col), before, `${from} -> ${to} left the column unchanged`)
      }
    }
  }
})

test('stray or legacy stored values read as "no gate" (then RESTORED), never SHIP', () => {
  for (const stray of [undefined, null, '', 'ship', 'WEIRD', 42, { v: 1 }]) {
    const col = { seed: 1, roll: {}, gate: stray }
    assert.equal(gateOf(col), null)
  }
  assert.equal(gateOf({ seed: 1, roll: {}, verdict: 'SHIP' }), null, 'the pre-machine `verdict` field is not a gate')
  assert.equal(gateOf(null), null)
})

test('gateStampFor: only an explicit SHIP with ok === true ships', () => {
  assert.deepEqual(gateStampFor({ ok: true, verdict: 'SHIP', hold_reasons: [] }), ['SHIP', []])
  assert.equal(gateStampFor({ ok: false, verdict: 'SHIP' })[0], 'HOLD')
  assert.equal(gateStampFor({ ok: 'true', verdict: 'SHIP' })[0], 'HOLD')
  assert.deepEqual(gateStampFor({ ok: false, verdict: 'HOLD', hold_reasons: ['a'] }), ['HOLD', ['a']])
  assert.deepEqual(gateStampFor({ ok: false, verdict: 'HOLD', error: 'boom' }), ['HOLD', ['boom']])
  for (const junk of [null, undefined, 'SHIP', {}, { verdict: 'PENDING' }, { verdict: 'RESTORED' }, { ok: true, verdict: 'WEIRD' }]) {
    assert.deepEqual(gateStampFor(junk), ['HOLD', ['gate returned no valid verdict (fail closed)']])
  }
})

/* Small deterministic PRNG (mulberry32) — a dependency-free stateful model test. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('model: random transition sequences keep the invariants after every step', () => {
  for (let run = 0; run < 400; run++) {
    const rand = rng(run + 1)
    const fromStorage = rand() < 0.4
    const col = fromStorage ? { seed: run, roll: {} } : newColumn(run, {}, 'x')
    let model = fromStorage ? null : 'PENDING'
    for (let step = 0; step < 8; step++) {
      const to = ALL[Math.floor(rand() * ALL.length)]
      if (LEGAL[model].includes(to)) {
        apply(col, to)
        model = to
      } else {
        assert.throws(() => apply(col, to))
      }
      assert.equal(gateOf(col), model, `run ${run} step ${step}`)
      assert.ok(Array.isArray(col.reasons) || model === null)
      if (model === 'RESTORED') assert.deepEqual(col.reasons, [], 'a restored column carries no reasons')
    }
  }
})
