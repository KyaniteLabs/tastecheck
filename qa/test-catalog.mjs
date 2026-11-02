#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(root, "qa/operator-paths.yaml");
assert.ok(existsSync(catalogPath), "qa/operator-paths.yaml must exist");
const { loadCatalog, parseCatalog, validateCatalog } = await import("./catalog.mjs");
const catalog = loadCatalog(catalogPath);
const required = [
  "I1", "I2", "I3", "I4", "I5",
  "C1", "C2", "C3", "C4", "C5", "C6", "C7",
  "G1", "G2", "G3",
  "U1", "U2", "U3", "U4", "U5", "U6", "U7",
  "H1", "C8",
];
assert.equal(catalog.schema_version, 1);
assert.equal(catalog.repository, "KyaniteLabs/tastecheck");
assert.ok(Array.isArray(catalog.paths));
const ids = catalog.paths.map(({ id }) => id);
assert.equal(new Set(ids).size, ids.length, "path IDs must be unique");
for (const id of required) assert.ok(ids.includes(id), `missing required operator path ${id}`);
for (const path of catalog.paths) {
  assert.equal(typeof path.surface, "string", `${path.id} needs surface`);
  assert.equal(typeof path.operation, "string", `${path.id} needs operation`);
  assert.equal(typeof path.action, "string", `${path.id} needs action`);
  assert.equal(typeof path.expected, "string", `${path.id} needs expected result`);
  assert.ok(Array.isArray(path.fixtures), `${path.id} needs a fixtures array`);
  for (const fixture of path.fixtures) {
    if (fixture.startsWith("repo:")) {
      assert.ok(existsSync(resolve(root, fixture.slice("repo:".length))), `${path.id} repository fixture does not exist: ${fixture}`);
    }
    if (fixture.startsWith("runner:")) assert.ok(fixture.length > "runner:".length, `${path.id} runner fixture is empty`);
  }
}
const escapedFixture = structuredClone(catalog);
escapedFixture.paths[0].fixtures = ["repo:../package.json"];
assert.throws(() => validateCatalog(escapedFixture, root), /fixture escapes repository root/);
assert.throws(() => parseCatalog("schema_version: 1\nschema_version: 1\npaths:\n"), /duplicate field schema_version/);
console.log(`QA catalog valid: ${ids.length} paths (${required.length} required IDs covered)`);
