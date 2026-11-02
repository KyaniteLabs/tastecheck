#!/usr/bin/env node
/**
 * External validator for the tasteroll live-demo roll-result inventory.
 *
 * Standalone — no page UI, no private helpers beyond the shared face module:
 *
 *   node tools/tasteroll/test-inventory.mjs
 *   node tools/tasteroll/test-inventory.mjs --artifact /tmp/other-mint.json
 *
 * Checks (exit 1 on the first failure):
 *   - root-object envelope with a CLOSED key set: unknown top-level keys
 *     (e.g. a `pages`/`html`/`css` payload) fail; metadata is typed
 *     (description string when present, legal_fingerprint 64-hex sha256)
 *   - envelope schema: schema_version, kind, minted_with, seed, faces,
 *     face_product, count, legal_fingerprint
 *   - staleness: legal_fingerprint matches the current faces/recipes sources
 *     (a stale artifact fails until `npm run mint:tasteroll` re-mints it)
 *   - every row uses known faces only
 *   - ids are unique, zero-padded r####, and follow mint order (r0001…)
 *   - rows are roll-result-only: exactly {id, ref, vibe, mode, sig}
 *   - the complete legal cover: no missing combo (no soft-ban pruning),
 *     no duplicate or extra combo (no vanity padding)
 *   - cardinality is exactly the legal cover and never exceeds 1536
 *
 * This validator never mints. If the artifact is missing or stale, it fails
 * and tells you to run the mint; CI relies on that to block stale artifacts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACES, legalRolls, legalFingerprint } from './faces.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

let inventoryPath = resolve(root, 'skills/tasteroll/assets/tasteroll-inventory.json');
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--artifact' && process.argv[i + 1]) {
    inventoryPath = resolve(process.argv[++i]);
  } else {
    console.error(`test-inventory: unknown argument ${process.argv[i]}`);
    process.exit(2);
  }
}

const MAX_LEGAL = 8 * 8 * 3 * 8; // hard ceiling on the legal cover

function fail(message) {
  console.error(`test-inventory: FAIL — ${message}`);
  process.exit(1);
}

if (!existsSync(inventoryPath)) {
  fail(`inventory not found at ${inventoryPath} — run: npm run mint:tasteroll`);
}

let doc;
try {
  doc = JSON.parse(readFileSync(inventoryPath, 'utf8'));
} catch (error) {
  fail(`inventory is not valid JSON (${inventoryPath}): ${error.message}`);
}

// --- root-object envelope with a closed key set ----------------------------
// Roll results live ONLY in rolls[] rows. The envelope is a closed schema:
// any other top-level key (a `pages`/`html`/`css` payload, or anything else)
// fails here, so page payloads cannot ride in beside the data.
const ALLOWED_ENVELOPE_KEYS = new Set([
  'schema_version',
  'kind',
  'description',
  'minted_with',
  'seed',
  'legal_fingerprint',
  'face_product',
  'count',
  'faces',
  'rolls',
]);
if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
  const shape = doc === null ? 'null' : Array.isArray(doc) ? 'an array' : typeof doc;
  fail(`root must be a JSON object (the inventory envelope), got ${shape}`);
}
const unknownKeys = Object.keys(doc).filter((k) => !ALLOWED_ENVELOPE_KEYS.has(k));
if (unknownKeys.length > 0) {
  fail(
    `unknown envelope key${unknownKeys.length > 1 ? 's' : ''} ` +
      `${unknownKeys.map((k) => JSON.stringify(k)).join(', ')} — the envelope is a closed set ` +
      `(roll results live only in rolls[] rows; no page/HTML/CSS payloads)`
  );
}
for (const key of ALLOWED_ENVELOPE_KEYS) {
  if (key === 'description') continue; // the only optional envelope field
  if (!(key in doc)) fail(`missing required envelope key "${key}"`);
}
if ('description' in doc && typeof doc.description !== 'string') {
  const shape = Array.isArray(doc.description) ? 'an array' : typeof doc.description;
  fail(`description must be a string when present, got ${shape}`);
}
if (typeof doc.faces !== 'object' || doc.faces === null || Array.isArray(doc.faces)) {
  const shape = Array.isArray(doc.faces) ? 'an array' : typeof doc.faces;
  fail(`faces must be an object of face-dimension arrays, got ${shape}`);
}

// --- envelope schema -------------------------------------------------------
if (doc.schema_version !== 1) fail(`schema_version must be 1, got ${doc.schema_version}`);
if (doc.kind !== 'tasteroll-live-demo-inventory') fail(`unexpected kind ${JSON.stringify(doc.kind)}`);
if (doc.minted_with !== 'chance' && doc.minted_with !== 'fallback-seeded') {
  fail(`minted_with must be "chance" or "fallback-seeded", got ${JSON.stringify(doc.minted_with)}`);
}
if (typeof doc.seed !== 'string' || doc.seed.length === 0) fail('seed must be a non-empty string');
if (!Array.isArray(doc.rolls)) fail('rolls must be an array');
if (doc.count !== doc.rolls.length) fail(`count ${doc.count} != rolls.length ${doc.rolls.length}`);
if (doc.rolls.length > MAX_LEGAL) fail(`cardinality ${doc.rolls.length} exceeds the legal ceiling ${MAX_LEGAL}`);

const expectedFaces = JSON.stringify(FACES);
const actualFaces = JSON.stringify(doc.faces);
if (actualFaces !== expectedFaces) {
  fail(`faces block differs from tools/tasteroll/faces.mjs (artifact: ${actualFaces.slice(0, 120)}…)`);
}

// --- staleness: faces/recipes fingerprint ----------------------------------
const expectedFingerprint = legalFingerprint();
if (typeof doc.legal_fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(doc.legal_fingerprint)) {
  fail(
    'legal_fingerprint missing or malformed (must be a 64-char lowercase hex sha256) — ' +
      'the artifact predates fingerprinting; re-run: npm run mint:tasteroll'
  );
}
if (doc.legal_fingerprint !== expectedFingerprint) {
  fail(
    `stale inventory: legal set changed since mint ` +
      `(artifact ${doc.legal_fingerprint.slice(0, 12)}… != current ${expectedFingerprint.slice(0, 12)}…) — ` +
      `re-run: npm run mint:tasteroll`
  );
}

// --- legal cover: cardinality is exactly the legal set ---------------------
const legal = legalRolls();
if (doc.rolls.length !== legal.length) {
  fail(`rolls.length ${doc.rolls.length} != legal cover ${legal.length} — re-run: npm run mint:tasteroll`);
}
if (doc.face_product !== legal.length) {
  fail(`face_product ${doc.face_product} != legal cover ${legal.length}`);
}

// --- rows: schema, faces, ids, combo cover ---------------------------------
const expectedRowKeys = 'id,mode,ref,sig,vibe';
const legalKeys = new Set(legal.map((r) => `${r.ref}|${r.vibe}|${r.mode}|${r.sig}`));
const seenKeys = new Set();
const seenIds = new Set();

doc.rolls.forEach((row, i) => {
  const where = `rolls[${i}]`;
  const keys = Object.keys(row).sort().join(',');
  if (keys !== expectedRowKeys) {
    fail(`${where}: row keys "${keys}" — rows must be roll-result-only {id, ref, vibe, mode, sig}`);
  }
  for (const dim of Object.keys(FACES)) {
    if (!FACES[dim].includes(row[dim])) {
      fail(`${where}: unknown ${dim}=${JSON.stringify(row[dim])}`);
    }
  }
  const expectedId = `r${String(i + 1).padStart(4, '0')}`;
  if (typeof row.id !== 'string' || !/^r\d{4}$/.test(row.id)) {
    fail(`${where}: id ${JSON.stringify(row.id)} must be a zero-padded r#### id`);
  }
  if (row.id !== expectedId) {
    fail(`${where}: id ${row.id} breaks mint order (expected ${expectedId} at position ${i})`);
  }
  if (seenIds.has(row.id)) fail(`duplicate id ${row.id}`);
  seenIds.add(row.id);

  const combo = `${row.ref}|${row.vibe}|${row.mode}|${row.sig}`;
  if (!legalKeys.has(combo)) {
    fail(`${where}: combo ${combo} is outside the legal cover (vanity padding)`);
  }
  if (seenKeys.has(combo)) fail(`duplicate combo ${combo} (vanity padding)`);
  seenKeys.add(combo);
});

for (const key of legalKeys) {
  if (!seenKeys.has(key)) {
    fail(`legal combo ${key} missing from the inventory (pruning is not allowed — soft taste bans are void)`);
  }
}

console.log(
  `ok: inventory ${doc.rolls.length} rolls @ ${inventoryPath} ` +
    `(minted_with=${doc.minted_with}, seed=${doc.seed}, fingerprint=${doc.legal_fingerprint.slice(0, 12)}…)`
);
