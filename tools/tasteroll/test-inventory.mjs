#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { FACES, cartesianRolls, assertKnownFaces } from './faces.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const inventoryPath = resolve(root, 'skills/tasteroll/assets/tasteroll-inventory.json');

const expected = cartesianRolls().length;
assert.equal(expected, 8 * 8 * 3 * 8, 'face product must be 1536');

if (!existsSync(inventoryPath)) {
  const r = spawnSync(process.execPath, [resolve(__dirname, 'mint-inventory.mjs')], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
}

const doc = JSON.parse(readFileSync(inventoryPath, 'utf8'));
assert.equal(doc.schema_version, 1);
assert.equal(doc.kind, 'tasteroll-live-demo-inventory');
assert.equal(doc.count, doc.rolls.length);
assert.equal(doc.rolls.length, expected, 'inventory must cover full legal cartesian');

const ids = new Set();
for (const row of doc.rolls) {
  assert.ok(row.id && typeof row.id === 'string');
  assert.equal(ids.has(row.id), false, `duplicate id ${row.id}`);
  ids.add(row.id);
  assertKnownFaces(row);
  // roll-result only
  assert.equal(Object.keys(row).sort().join(','), 'id,mode,ref,sig,vibe');
}

for (const dim of Object.keys(FACES)) {
  for (const face of FACES[dim]) {
    assert.ok(
      doc.rolls.some((r) => r[dim] === face),
      `missing face ${dim}=${face}`
    );
  }
}

console.log(`ok: inventory ${doc.rolls.length} rolls @ ${inventoryPath}`);
