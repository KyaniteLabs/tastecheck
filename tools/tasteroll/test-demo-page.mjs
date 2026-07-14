#!/usr/bin/env node
/**
 * External smoke for tasteroll live demo page (no browser).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const htmlPath = resolve(root, 'tasteroll.html');
const invPath = resolve(root, 'skills/tasteroll/assets/tasteroll-inventory.json');

assert.ok(existsSync(htmlPath), 'tasteroll.html must exist');
assert.ok(existsSync(invPath), 'inventory must exist');

const html = readFileSync(htmlPath, 'utf8');
const inv = JSON.parse(readFileSync(invPath, 'utf8'));

const need = [
  'id="hero"',
  'id="pass"',
  'id="findings"',
  'id="footer"',
  'id="diceBtn"',
  'id="rollId"',
  'id="phasePill"',
  'id="pipeline"',
  'class="chrome"',
  'id="main"',
  'class="skip"',
  'prefers-reduced-motion',
  ':focus-visible',
  'data-dim="ref"',
  'data-phase',
  'data-step="roll"',
  'data-step="pass"',
  'data-step="done"',
  'skills/tasteroll/assets/tasteroll-inventory.json',
  'TasteCheck',
  'Chance',
  'runSequence',
  'planFindings',
  "setPhase('raw')",
  "setPhase('passing')",
  "setPhase('settled')",
];
for (const s of need) {
  assert.ok(html.includes(s), `missing required marker: ${s}`);
}

// Sequence contract: raw phase intentionally includes banlist tells for the pack to fix
assert.ok(html.includes('data-phase="raw"') || html.includes("setPhase('raw')"), 'raw phase required');
assert.ok(/#6366f1|#a855f7|999px/.test(html), 'raw phase must include remediable slop tells');

// Settled / chrome must still have focus-visible and reduced-motion
assert.ok(html.includes(':focus-visible'));
assert.ok(html.includes('prefers-reduced-motion'));

assert.equal(inv.count, 1536);
assert.equal(inv.rolls.length, 1536);

console.log('ok: tasteroll demo page smoke (roll → TasteCheck pack → settle)');
