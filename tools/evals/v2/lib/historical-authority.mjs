import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { normalize } from "./registry.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const normalizedHash = (bytes) => sha(normalize(bytes.toString("utf8")));

export function validateV2InputPath(path) {
  const normalized = path.replaceAll("\\", "/");
  if (/(^|\/)(evals\/)?(receipts|evidence)\/v1\//.test(normalized) || /(^|\/)v1\//.test(normalized)) throw new Error("historical V1 input prohibited");
  return true;
}

export function verifyHistoricalAuthority(root, manifest) {
  for (const entry of manifest.entries) {
    const path = join(root, entry.path);
    let bytes;
    try { bytes = readFileSync(path); } catch { throw new Error(`historical authority missing: ${entry.authority_id}`); }
    if (sha(bytes) !== entry.sha256 || normalizedHash(bytes) !== entry.normalized_sha256) throw new Error(`historical authority mismatch: ${entry.authority_id}`);
  }
  return true;
}

function representations(bytes) {
  const values = [bytes.toString("utf8")];
  try {
    const walk = (value) => {
      if (typeof value === "string") values.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") { values.push(JSON.stringify(value)); Object.values(value).forEach(walk); }
    };
    walk(JSON.parse(values[0]));
  } catch {}
  return values;
}

const tokens = (value) => new Set(normalize(value).split(" ").filter(Boolean));
const near = (left, right) => { const a = tokens(left), b = tokens(right), union = new Set([...a, ...b]); return union.size && [...a].filter((x) => b.has(x)).length / union.size >= 0.85; };
function resolveInput(input) {
  let current = realpathSync(input);
  for (let depth = 0; depth < 8; depth++) {
    let parsed; try { parsed = JSON.parse(readFileSync(current, "utf8")); } catch { return current; }
    const reference = parsed?.path ?? parsed?.source ?? parsed?.source_path ?? parsed?.reference;
    if (typeof reference !== "string") return current;
    current = realpathSync(isAbsolute(reference) ? reference : join(new URL(".", `file://${current}`).pathname, reference));
  }
  throw new Error("historical indirection depth exceeded");
}

export function verifyHistoricalSeparation(inputs, authority, root) {
  verifyHistoricalAuthority(root, authority);
  const exact = new Set(authority.entries.map((entry) => entry.sha256));
  const normalized = new Set(authority.entries.map((entry) => entry.normalized_sha256));
  const historicalText = authority.entries.map((entry) => readFileSync(join(root, entry.path), "utf8"));
  for (const input of inputs) {
    const resolved = resolveInput(input);
    if (!isAbsolute(resolved) || relative(root, resolved).startsWith("..")) { /* copied inputs remain hash checked */ }
    const bytes = readFileSync(resolved);
    if (exact.has(sha(bytes)) || representations(bytes).some((value) => normalized.has(sha(normalize(value))) || historicalText.some((old) => near(value, old)))) throw new Error("historical content overlap");
  }
  return true;
}
