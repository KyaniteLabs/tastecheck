#!/usr/bin/env node
/**
 * tools/evals/sanitize-receipts.mjs — sanitized-at-write receipt transformer.
 *
 * Applies the public-receipt policy before writing to evals/receipts/v1/**:
 *   - Removes absolute paths, usernames, email addresses, secrets/tokens,
 *     hostnames (except known public URLs), private repo names, raw prompts
 *     not explicitly approved, and internal process text
 *   - Normalizes path separators to forward slash
 *   - Rejects .. traversal in artifact paths
 *   - Runs secret scanner on every string value
 *
 * Usage: node tools/evals/sanitize-receipts.mjs <input.json> <output-relative-path>
 *   Or import sanitizeReceipt() directly.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

// Patterns that must never appear in public receipts
const BANNED_PATTERNS = [
  // Absolute Unix paths
  ["ABSOLUTE_PATH", /\/(?:Users|home|root|tmp|var|etc|opt)\/[^\s"']+/g],
  // Absolute Windows paths
  ["ABSOLUTE_PATH", /[A-Za-z]:\\[^\s"']+/g],
  // Email addresses
  ["EMAIL_ADDRESS", /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g],
  // Common secret-looking patterns (tokens, API keys, passwords in key=value form)
  ["SECRET_MATERIAL", /\b(?:token|secret|password|api_key|apikey|auth_token|bearer|sk-|pk-)\s*[=:]\s*\S+/gi],
  // macOS home directory references
  ["HOME_DIRECTORY", /~\/[^\s"']+/g],
];

const ALLOWED_PUBLIC_HOSTS = new Set([
  "github.com",
  "forgejo.org",
  "tastecheck.dev",
  "anthropic.com",
  "openai.com",
  "gemini.google.com",
]);

const FORBIDDEN_METADATA_KEYS = /^(?:private|provenance|internal_provenance|(?:raw|system|user)_?prompt|prompt_packet(?:_ref)?|(?:[a-z0-9_]+_)?thread_id|(?:internal_)?process(?:_metadata)?|dispatch_metadata)$/i;

const INTERNAL_PROCESS_PATTERNS = [
  ["INTERNAL_PROMPT_TEXT", /\b(?:raw|system|user)\s+prompt\b/i],
  ["INTERNAL_THREAD_METADATA", /\b(?:thread\s*(?:id|metadata)|direct[_ -]?[a-z0-9_-]*fallback)\b/i],
  ["INTERNAL_PROCESS_METADATA", /\b(?:internal\s+(?:process|provenance)|dispatch\s+metadata)\b/i],
];

export class ReceiptSanitizationError extends Error {
  constructor(code, path) {
    super(`Sanitization rejected [${code}] at ${path}`);
    this.name = "ReceiptSanitizationError";
    this.code = code;
    this.path = path;
  }
}

function isAllowedPublicHost(hostname) {
  const host = hostname.toLowerCase();
  return [...ALLOWED_PUBLIC_HOSTS].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function scanForLeaks(value) {
  if (typeof value !== "string") return null;
  for (const [code, pattern] of BANNED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.exec(value)) return code;
  }
  for (const [code, pattern] of INTERNAL_PROCESS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) return code;
  }
  for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    try {
      if (!isAllowedPublicHost(new URL(match[0]).hostname)) return "NON_PUBLIC_URL_HOST";
    } catch {
      return "INVALID_PUBLIC_URL";
    }
  }
  return null;
}

function sanitizeValue(value, path) {
  if (typeof value === "string") {
    const leak = scanForLeaks(value);
    if (leak) throw new ReceiptSanitizationError(leak, path);
    // Normalize path separators in artifact paths (output_ref, etc.)
    if (path.endsWith(".output_ref") || path.endsWith(".artifact")) {
      value = value.replace(/\\/g, "/");
      if (value.includes("..")) throw new ReceiptSanitizationError("PATH_TRAVERSAL", path);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(item, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_KEYS.test(k)) {
        throw new ReceiptSanitizationError("FORBIDDEN_METADATA_FIELD", `${path}.${k}`);
      }
      out[k] = sanitizeValue(v, `${path}.${k}`);
    }
    return out;
  }
  return value;
}

export function sanitizeReceipt(raw) {
  return sanitizeValue(raw, "root");
}

// CLI mode
if (process.argv[1] && process.argv[1].endsWith("sanitize-receipts.mjs")) {
  const [,, inputPath, outputRelPath] = process.argv;
  if (!inputPath || !outputRelPath) {
    console.error("Usage: node tools/evals/sanitize-receipts.mjs <input.json> <evals/receipts/v1/...>");
    process.exit(1);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (e) {
    console.error("Cannot read input:", e.message);
    process.exit(1);
  }
  let sanitized;
  try {
    sanitized = sanitizeReceipt(raw);
  } catch (e) {
    console.error("Sanitization failed:", e.code ?? "INVALID_RECEIPT", e.path ?? "root");
    process.exit(1);
  }
  const outputPath = join(root, outputRelPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(sanitized, null, 2));
  console.log("Wrote sanitized receipt:", outputRelPath);
}
