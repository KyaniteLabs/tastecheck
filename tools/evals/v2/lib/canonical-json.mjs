// Task 7A: Shared canonical JSON serialization and SHA-256 helpers.
//
// This module is the single source of truth for the canonical byte
// serialization used by every content-bound digest in the effectiveness-v2
// pipeline (packet_sha256, packet_set_sha256, executor digests, closure
// digest, evidence hashes). It is one of the five files in the closed packet
// validator dependency manifest, so any change to its bytes changes the
// packet_validator_sha256 bound into the tracked protocol.
//
// Canonical JSON: arrays preserve order; object keys are sorted by UTF-16
// code unit; strings use JSON.stringify. No whitespace, no trailing newline.

import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export const PACKET_POLICY_DEPENDENCY_FILES = Object.freeze([
  "contracts/v2/effectiveness/judgment.schema.json",
  "contracts/v2/effectiveness/packet.schema.json",
  "tools/evals/v2/lib/canonical-json.mjs",
  "tools/evals/v2/lib/packet-policy.mjs",
  "tools/evals/v2/validate-judges.mjs"
]);

/**
 * canonicalJson(value)
 *
 * Deterministic JSON serialization. Arrays keep their order; object properties
 * are emitted in sorted key order; primitives use JSON.stringify.
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * sha256(value)
 *
 * Canonical SHA-256 hex digest. Strings are hashed as UTF-8 bytes; non-strings
 * are canonicalized first.
 */
export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * lenPrefix(buf)
 *
 * 4-byte big-endian length prefix for HMAC tuple fields. Used by the
 * seed-keyed ID tuple contract so domain-separated fields cannot be reordered
 * or reinterpreted.
 */
export function lenPrefix(buf) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(buf.length, 0);
  return Buffer.concat([out, buf]);
}

export function computeDependencyManifestSha256(repoRoot) {
  if (!repoRoot || typeof repoRoot !== "string") {
    throw new Error("validator closure: repoRoot required");
  }
  const sortedPaths = [...PACKET_POLICY_DEPENDENCY_FILES].sort();
  if (new Set(sortedPaths).size !== 5 || sortedPaths.length !== 5 ||
      canonicalJson(sortedPaths) !== canonicalJson(PACKET_POLICY_DEPENDENCY_FILES)) {
    throw new Error("validator closure: dependency manifest must be exact closed sorted five-file set");
  }
  const resolvedRoot = resolve(repoRoot);
  const files = sortedPaths.map((rel) => {
    const abs = resolve(resolvedRoot, rel);
    if (relative(resolvedRoot, abs).startsWith("..")) {
      throw new Error(`validator closure: out-of-root dependency ${rel}`);
    }
    let stat;
    try { stat = lstatSync(abs); } catch {
      throw new Error(`validator closure: missing dependency file ${rel}`);
    }
    if (stat.isSymbolicLink()) throw new Error(`validator closure: symlink rejected ${rel}`);
    if (!stat.isFile()) throw new Error(`validator closure: nonregular dependency ${rel}`);
    const bytes = readFileSync(abs);
    return { path: rel, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  return { sha256: sha256(canonicalJson(files)), files: Object.freeze(files.map(Object.freeze)) };
}

export function computeValidatorClosure(repoRoot) {
  const manifest = computeDependencyManifestSha256(repoRoot);
  return Object.freeze({
    version: "effectiveness-v2-packet-policy-1",
    sha256: manifest.sha256,
    files: manifest.files
  });
}
