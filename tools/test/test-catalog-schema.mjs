// Catalog integrity: schema validation + manifest cross-check + version-marker drift.
// Added in 1.5.0 after the catalog schema had silently never run against the data.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const root = new URL('../..', import.meta.url).pathname;
const load = (p) => JSON.parse(readFileSync(`${root}${p}`, 'utf8'));
const catalog = load('skills/tastecheck-pass/assets/check-catalog.json');
const schema = load('skills/tastecheck-pass/assets/check-catalog.schema.json');
const manifest = load('skills/tastecheck-pass/assets/video-subject-manifest.json');

let failed = 0;
const fail = (msg) => { failed++; console.error(`FAIL ${msg}`); };

const rows = Array.isArray(catalog) ? catalog : (catalog.checks ?? catalog.rows ?? []);

// 1) schema validation — compile once against the declared shape
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const ok = validate(Array.isArray(catalog) ? rows : catalog);
if (!ok) for (const e of validate.errors) fail(`schema: ${e.instancePath} ${e.message}`);

// 2) manifest cross-check: video rows reference a known subject; negative control declared
const subjectIds = new Set(manifest.subjects.map((s) => s.id));
const subjectMedia = new Set(manifest.subjects.map((s) => s.medium));
for (const row of rows.filter((r) => r.medium === 'video')) {
  const subj = row.applicability?.subject;
  // applicability.subject may name a specific subject id or the subject class (its medium)
  const known = !subj || subjectIds.has(subj) || subjectMedia.has(subj)
    || [...subjectIds].some((id) => id.startsWith(`${subj}:`));
  if (!known) fail(`video row ${row.id} references unknown subject "${subj}"`);
}
const neg = manifest.subjects.find((s) => Array.isArray(s.expected_fail));
if (!neg) fail('manifest lacks a negative-control subject (expected_fail)');
else for (const rowId of neg.expected_fail) {
  if (!rows.some((r) => r.id === rowId)) fail(`negative control references unknown row ${rowId}`);
}

// 3) version-marker drift: package.json == latest CHANGELOG heading
const pkg = load('package.json');
const m = readFileSync(`${root}CHANGELOG.md`, 'utf8').match(/## \[(\d+\.\d+\.\d+)\]/);
if (!m) fail('CHANGELOG has no version heading');
else if (m[1] !== pkg.version) fail(`version drift: package.json ${pkg.version} vs CHANGELOG [${m[1]}]`);

console.log(`catalog integrity: ${rows.length} rows, ${manifest.subjects.length} subjects, version ${pkg.version}`);
if (failed) { console.error(`${failed} failure(s)`); process.exit(1); }
console.log('catalog integrity: PASS');
