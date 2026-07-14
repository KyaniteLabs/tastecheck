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

// sections / chrome
const need = [
  'id="hero"',
  'id="what"',
  'id="how"',
  'id="quality"',
  'id="install"',
  'id="sample"',
  'id="footer"',
  'id="diceBtn"',
  'id="rollId"',
  'class="chrome"',
  'id="main"',
  'class="skip"',
  'prefers-reduced-motion',
  ':focus-visible',
  'data-dim="ref"',
  'data-dim="vibe"',
  'data-dim="mode"',
  'data-dim="sig"',
  'skills/tasteroll/assets/tasteroll-inventory.json',
  'TasteCheck',
  'Chance',
];
for (const s of need) {
  assert.ok(html.includes(s), `missing required marker: ${s}`);
}

// no algorithm names in page text (strip script for crude check of visible-ish copy)
const withoutScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
assert.equal(/xoshiro/i.test(withoutScript), false, 'xoshiro must not appear outside scripts');
assert.equal(/xoshiro/i.test(html.match(/<body[\s\S]*$/)?.[0]?.replace(/<script[\s\S]*?<\/script>/gi, '') || ''), false);

// banlist: chrome must not use pill 999 or purple gradient as page chrome patterns
assert.equal(/border-radius:\s*999px/.test(html), false, 'no pill-999');
assert.equal(/#6366f1|#a855f7/.test(withoutScript), false, 'no indigo-magenta hex gradient tells in markup/styles');
assert.equal(/linear-gradient\([^)]*(6366f1|a855f7|indigo)/i.test(html), false, 'no banned gradient functions');

// inventory contract
assert.equal(inv.count, 1536);
assert.equal(inv.rolls.length, 1536);
assert.ok(inv.minted_with === 'chance' || inv.minted_with === 'fallback-seeded');

console.log('ok: tasteroll demo page smoke');
