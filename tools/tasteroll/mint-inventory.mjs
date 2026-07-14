#!/usr/bin/env node
/**
 * Mint tasteroll live-demo inventory: roll results only.
 * Prefer real Chance CLI for shuffle order; fallback to seeded Fisher–Yates.
 *
 * Usage:
 *   node tools/tasteroll/mint-inventory.mjs
 *   node tools/tasteroll/mint-inventory.mjs --out skills/tasteroll/assets/tasteroll-inventory.json
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cartesianRolls } from './faces.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function parseArgs(argv) {
  let out = resolve(root, 'skills/tasteroll/assets/tasteroll-inventory.json');
  let seed = 'tasteroll-live-demo-v1';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) out = resolve(argv[++i]);
    else if (argv[i] === '--seed' && argv[i + 1]) seed = argv[++i];
  }
  return { out, seed };
}

function chanceShuffleIndices(n, seed) {
  const indices = Array.from({ length: n }, (_, i) => String(i));
  const r = spawnSync(
    'chance',
    ['--seed', seed, 'shuffle', ...indices],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  if (r.error || r.status !== 0) {
    return { ok: false, reason: r.error?.message || r.stderr || `exit ${r.status}` };
  }
  const lines = r.stdout
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length !== n) {
    return { ok: false, reason: `chance returned ${lines.length} lines, expected ${n}` };
  }
  const order = lines.map((s) => Number(s));
  if (order.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) {
    return { ok: false, reason: 'chance output had invalid indices' };
  }
  const seen = new Set(order);
  if (seen.size !== n) {
    return { ok: false, reason: 'chance output was not a permutation' };
  }
  return { ok: true, order, source: 'chance' };
}

/** Deterministic fallback when Chance CLI is unavailable. */
function fallbackShuffleIndices(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  let h = createHash('sha256').update(String(seed)).digest();
  let hi = 0;
  const nextU32 = () => {
    if (hi + 4 > h.length) {
      h = createHash('sha256').update(h).digest();
      hi = 0;
    }
    const v = h.readUInt32BE(hi);
    hi += 4;
    return v;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = nextU32() % (i + 1);
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  return { ok: true, order, source: 'fallback-seeded' };
}

function mint({ out, seed }) {
  const base = cartesianRolls();
  const n = base.length;
  let shuffle = chanceShuffleIndices(n, seed);
  if (!shuffle.ok) {
    console.warn(`[mint] Chance shuffle failed (${shuffle.reason}); using seeded fallback`);
    shuffle = fallbackShuffleIndices(n, seed);
  }

  const rolls = shuffle.order.map((idx, i) => {
    const row = base[idx];
    const id = `r${String(i + 1).padStart(4, '0')}`;
    return { id, ...row };
  });

  const doc = {
    schema_version: 1,
    kind: 'tasteroll-live-demo-inventory',
    description:
      'Roll results only (ref×vibe×mode×sig). Minted for tasteroll.html whole-page apply. Soft taste bans void.',
    minted_with: shuffle.source,
    seed,
    face_product: n,
    count: rolls.length,
    faces: {
      ref: [...new Set(base.map((r) => r.ref))],
      vibe: [...new Set(base.map((r) => r.vibe))],
      mode: [...new Set(base.map((r) => r.mode))],
      sig: [...new Set(base.map((r) => r.sig))],
    },
    rolls,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`[mint] wrote ${rolls.length} rolls → ${out} (${shuffle.source})`);
  return doc;
}

const args = parseArgs(process.argv);
mint(args);
