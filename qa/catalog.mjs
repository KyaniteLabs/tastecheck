import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATH_FIELDS = new Set(["id", "surface", "operation", "action", "expected", "fixtures"]);
const TOP_FIELDS = new Set(["schema_version", "repository", "tested_merge_sha", "notes", "paths"]);
export const REQUIRED_PATH_IDS = Object.freeze([
  "I1", "I2", "I3", "I4", "I5", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
  "G1", "G2", "G3", "U1", "U2", "U3", "U4", "U5", "U6", "U7", "H1",
]);
const RUNNER_FIXTURES = new Set(["empty-home", "chromium", "static-server"]);

function scalar(raw, context) {
  if (raw === "") throw new Error(`${context}: empty YAML scalar`);
  if (raw.startsWith('"') || raw.startsWith("'") || raw.startsWith("[") || raw.startsWith("{")) {
    if (raw.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(raw)) throw new Error(`${context}: malformed quoted scalar`);
      return raw.slice(1, -1).replaceAll("''", "'");
    }
    try { return JSON.parse(raw); } catch (error) { throw new Error(`${context}: invalid JSON-compatible YAML scalar (${error.message})`); }
  }
  if (/^(?:true|false|null|-?(?:0|[1-9][0-9]*))$/.test(raw)) return JSON.parse(raw);
  if (!/^[A-Za-z0-9_./:-]+$/.test(raw)) throw new Error(`${context}: quote strings containing YAML punctuation`);
  return raw;
}

export function parseCatalog(source) {
  const document = {};
  const paths = [];
  let inPaths = false;
  let current = null;
  const lines = String(source).split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const lineNumber = index + 1;
    if (!inPaths) {
      const match = /^(schema_version|repository|tested_merge_sha|notes|paths):(?:\s*(.*))?$/.exec(line);
      if (!match) throw new Error(`line ${lineNumber}: unsupported top-level YAML syntax`);
      const [, key, value = ""] = match;
      if (Object.hasOwn(document, key)) throw new Error(`line ${lineNumber}: duplicate field ${key}`);
      if (key === "paths") {
        if (value) throw new Error(`line ${lineNumber}: paths must be a block sequence`);
        document.paths = paths;
        inPaths = true;
        continue;
      }
      document[key] = scalar(value, `line ${lineNumber}`);
      continue;
    }

    const item = /^  - ([a-z][a-z0-9_]*): (.+)$/.exec(line);
    if (item) {
      current = {};
      paths.push(current);
      const [, key, value] = item;
      current[key] = scalar(value, `line ${lineNumber}`);
      continue;
    }
    const property = /^    ([a-z][a-z0-9_]*): (.+)$/.exec(line);
    if (property && current) {
      const [, key, value] = property;
      if (Object.hasOwn(current, key)) throw new Error(`line ${lineNumber}: duplicate path field ${key}`);
      current[key] = scalar(value, `line ${lineNumber}`);
      continue;
    }
    throw new Error(`line ${lineNumber}: unsupported path YAML syntax`);
  }

  if (!inPaths) throw new Error("catalog must contain a paths block");
  return document;
}

export function validateCatalog(catalog, root = ROOT) {
  for (const key of Object.keys(catalog)) if (!TOP_FIELDS.has(key)) throw new Error(`unknown catalog field: ${key}`);
  if (catalog.schema_version !== 1) throw new Error("schema_version must be 1");
  if (catalog.repository !== "KyaniteLabs/tastecheck") throw new Error("repository must be KyaniteLabs/tastecheck");
  if (!/^[0-9a-f]{40}$/.test(catalog.tested_merge_sha || "")) throw new Error("tested_merge_sha must be a full git SHA");
  if (typeof catalog.notes !== "string" || !catalog.notes) throw new Error("notes must explain non-path surfaces and supplementary checks");
  if (!Array.isArray(catalog.paths) || catalog.paths.length === 0) throw new Error("paths must be a non-empty sequence");

  const ids = new Set();
  const operations = new Set();
  for (const path of catalog.paths) {
    for (const key of Object.keys(path)) if (!PATH_FIELDS.has(key)) throw new Error(`${path.id || "path"}: unknown field ${key}`);
    for (const key of PATH_FIELDS) if (!Object.hasOwn(path, key)) throw new Error(`${path.id || "path"}: missing ${key}`);
    for (const key of ["id", "surface", "operation", "action", "expected"]) {
      if (typeof path[key] !== "string" || !path[key].trim()) throw new Error(`${path.id || "path"}: ${key} must be a non-empty string`);
    }
    if (!/^[A-Z][0-9]+$/.test(path.id)) throw new Error(`invalid path id: ${path.id}`);
    if (ids.has(path.id)) throw new Error(`duplicate path id: ${path.id}`);
    if (operations.has(path.operation)) throw new Error(`duplicate operation: ${path.operation}`);
    ids.add(path.id);
    operations.add(path.operation);
    if (!Array.isArray(path.fixtures)) throw new Error(`${path.id}: fixtures must be an array`);
    for (const fixture of path.fixtures) {
      if (typeof fixture !== "string") throw new Error(`${path.id}: fixture identifiers must be strings`);
      if (fixture.startsWith("repo:")) {
        const relativePath = fixture.slice("repo:".length);
        const absolute = resolve(root, relativePath);
        const repoRoot = resolve(root);
        if (absolute !== repoRoot && !absolute.startsWith(`${repoRoot}${sep}`)) throw new Error(`${path.id}: fixture escapes repository root: ${fixture}`);
        try { readFileSync(absolute); } catch { throw new Error(`${path.id}: repository fixture is missing or unreadable: ${fixture}`); }
      } else if (fixture.startsWith("runner:")) {
        const name = fixture.slice("runner:".length);
        if (!RUNNER_FIXTURES.has(name)) throw new Error(`${path.id}: unknown runner fixture: ${fixture}`);
      } else {
        throw new Error(`${path.id}: fixture must start with repo: or runner: (${fixture})`);
      }
    }
  }
  for (const required of REQUIRED_PATH_IDS) if (!ids.has(required)) throw new Error(`catalog omits required v0 path ${required}`);
  return catalog;
}

export function loadCatalog(file = resolve(ROOT, "qa/operator-paths.yaml"), root = ROOT) {
  return validateCatalog(parseCatalog(readFileSync(file, "utf8")), root);
}
