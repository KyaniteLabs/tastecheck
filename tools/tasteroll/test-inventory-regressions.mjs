#!/usr/bin/env node
/**
 * Regression battery for the external inventory validator (I01).
 *
 * Security review (PR #36, P2): the validator used to check the values of
 * known envelope keys but silently accepted UNKNOWN root keys and untyped
 * metadata — a `pages: ["<html>…"]` or an object-valued `description` passed
 * the data-only/schema gate. This battery pins the closed-envelope contract:
 *
 *   - root must be a JSON object (the envelope), never an array or scalar
 *   - top-level keys are a closed set; any unknown key fails (so page/HTML/
 *     CSS payload keys like `pages`, `html`, `css` cannot smuggle content)
 *   - metadata is typed (`description` string when present, `legal_fingerprint`
 *     64-hex sha256, integer counts, …)
 *   - row-level extra keys / HTML keep failing (pre-existing behavior)
 *
 * It exercises the real CLI end to end (`node test-inventory.mjs --artifact
 * <fixture>`) — no imports of validator internals — plus two valid controls:
 * the committed artifact and a fresh fallback mint (chance stripped from PATH,
 * the documented CI path). Runs as part of `npm run test:tasteroll`, so it is
 * wired into npm test and the verify workflow.
 *
 *   node tools/tasteroll/test-inventory-regressions.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const validator = join(__dirname, 'test-inventory.mjs');
const mint = join(__dirname, 'mint-inventory.mjs');
const committed = join(root, 'skills/tasteroll/assets/tasteroll-inventory.json');

function runValidator(file) {
  const r = spawnSync(process.execPath, [validator, '--artifact', file], {
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}

const work = mkdtempSync(join(tmpdir(), 'tasteroll-regressions-'));
const results = [];
let failed = 0;

function check(name, expectFail, run) {
  const { code, out } = run();
  const rejected = code !== 0;
  const ok = expectFail ? rejected : code === 0;
  if (!ok) failed += 1;
  results.push({ name, expect: expectFail ? 'reject' : 'accept', code, ok, out });
  const verdict = ok ? (expectFail ? 'rejected' : 'accepted') : 'LEAK';
  console.log(`${ok ? 'ok ' : 'FAIL'}  ${name} — ${verdict} (exit ${code})`);
  if (!ok) console.log(`      validator said: ${out.split('\n')[0]}`);
}

try {
  // --- valid controls ------------------------------------------------------
  check('control: committed artifact validates', false, () => runValidator(committed));

  const fallbackOut = join(work, 'fallback-mint.json');
  const mintRun = spawnSync(process.execPath, [mint, '--out', fallbackOut], {
    encoding: 'utf8',
    env: { PATH: '', HOME: process.env.HOME }, // chance stripped -> documented CI fallback
  });
  if (mintRun.status !== 0) {
    console.error(`regressions: fallback control mint failed:\n${mintRun.stderr}`);
    process.exit(1);
  }
  check('control: fresh fallback mint validates', false, () => runValidator(fallbackOut));

  const committedDoc = JSON.parse(readFileSync(committed, 'utf8'));

  const noDescription = join(work, 'no-description.json');
  const { description: _omit, ...withoutDescription } = committedDoc;
  writeFileSync(noDescription, JSON.stringify(withoutDescription), 'utf8');
  check('control: envelope without optional description validates', false, () =>
    runValidator(noDescription)
  );

  // --- negative fixtures: closed envelope, typed metadata ------------------
  const poisoned = (name, mutate) => {
    const doc = JSON.parse(readFileSync(committed, 'utf8'));
    mutate(doc);
    const file = join(work, `${name}.json`);
    writeFileSync(file, JSON.stringify(doc), 'utf8');
    return file;
  };

  check('reject: root key "pages" carrying a full HTML page', true, () =>
    runValidator(
      poisoned('root-pages', (d) => {
        d.pages = ['<html><style>body{color:red}</style></html>'];
      })
    )
  );

  check('reject: root key "html" carrying markup', true, () =>
    runValidator(
      poisoned('root-html', (d) => {
        d.html = '<html><body><h1>tasteroll</h1></body></html>';
      })
    )
  );

  check('reject: root key "css" carrying stylesheet payload', true, () =>
    runValidator(
      poisoned('root-css', (d) => {
        d.css = 'body { color: red } .page { display: none }';
      })
    )
  );

  check('reject: root key "prebuilt" carrying page paths', true, () =>
    runValidator(
      poisoned('root-prebuilt', (d) => {
        d.prebuilt = ['r0001.html', 'r0002.html'];
      })
    )
  );

  check('reject: benign unknown root key "notes"', true, () =>
    runValidator(
      poisoned('root-notes', (d) => {
        d.notes = 'not part of the schema';
      })
    )
  );

  check('reject: description replaced by HTML-bearing object', true, () =>
    runValidator(
      poisoned('description-object', (d) => {
        d.description = { html: '<html></html>' };
      })
    )
  );

  check('reject: description as array', true, () =>
    runValidator(
      poisoned('description-array', (d) => {
        d.description = ['Roll results only.'];
      })
    )
  );

  check('reject: schema_version as string "1"', true, () =>
    runValidator(
      poisoned('schema-version-string', (d) => {
        d.schema_version = '1';
      })
    )
  );

  check('reject: count as string', true, () =>
    runValidator(
      poisoned('count-string', (d) => {
        d.count = String(d.count);
      })
    )
  );

  check('reject: legal_fingerprint not 64-hex sha256', true, () =>
    runValidator(
      poisoned('fingerprint-nonhex', (d) => {
        d.legal_fingerprint = `ZZ${d.legal_fingerprint.slice(2)}`;
      })
    )
  );

  check('reject: faces block with smuggled payload key', true, () =>
    runValidator(
      poisoned('faces-payload', (d) => {
        d.faces.pages = ['<html><style>body{color:red}</style></html>'];
      })
    )
  );

  check('reject: row-level extra key "html" (pre-existing gate)', true, () =>
    runValidator(
      poisoned('row-html', (d) => {
        d.rolls[0].html = '<html><style>body{color:red}</style></html>';
      })
    )
  );

  // root-shape fixtures (whole-file replacements)
  const rootArray = join(work, 'root-array.json');
  writeFileSync(rootArray, JSON.stringify(committedDoc.rolls), 'utf8');
  check('reject: root is an array of rows (no envelope)', true, () => runValidator(rootArray));

  const rootNull = join(work, 'root-null.json');
  writeFileSync(rootNull, 'null', 'utf8');
  check('reject: root is null', true, () => runValidator(rootNull));

  const rootString = join(work, 'root-string.json');
  writeFileSync(rootString, JSON.stringify('tasteroll-inventory'), 'utf8');
  check('reject: root is a string', true, () => runValidator(rootString));
} finally {
  rmSync(work, { recursive: true, force: true });
}

const total = results.length;
if (failed > 0) {
  console.error(
    `test-inventory-regressions: FAIL — ${failed}/${total} cases diverged from the closed-envelope contract`
  );
  process.exit(1);
}
console.log(
  `ok: inventory regressions ${total}/${total} cases hold ` +
    `(closed envelope, typed metadata, no page/HTML/CSS payloads)`
);
