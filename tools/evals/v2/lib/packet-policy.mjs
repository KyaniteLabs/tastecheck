// Task 5: Frozen reject-only packet artifact validator.
//
// The validator runs under a frozen protocol version + digest. It scans both
// arms' bytes (UTF-8 decoded) for a closed forbidden-cue allowlist. On any
// forbidden cue it rejects the WHOLE unit; on clean bytes it returns the
// ORIGINAL bytes byte-for-byte. No rewriting, normalization, or selective
// field removal is allowed.

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// Frozen at protocol-head; matches protocol.packet_validator_{version,sha256}.
export const FROZEN_VALIDATOR_VERSION = "effectiveness-v2-packet-policy-1";
export const FROZEN_VALIDATOR_DIGEST = "b".repeat(64);

// Closed forbidden-cue allowlist. Each entry is either a substring (matched
// case-insensitively after lowercasing both inputs) or a RegExp tested against
// the raw bytes. The authority is the frozen version + digest, never the
// scenario-local forbidden_cues list.
export const FORBIDDEN_CUES = Object.freeze([
  { cue: "baseline", token: "baseline" },
  { cue: "candidate", token: "candidate" },
  { cue: "0f99603a603b0243345e7320a52702df67a2194e", token: "revision" },
  { cue: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2", token: "revision" },
  { cue: "0f99603", token: "revision" },
  { cue: "0859121", token: "revision" },
  { cue: "1.0.0", token: "version" },
  { cue: "1.1.0", token: "version" },
  { cue: "tastecheck", token: "version" },
  { cue: "/worktree/", token: "path" },
  { cue: "package.json", token: "metadata" },
  { cue: "node_modules/", token: "path" },
  { cue: ".git/", token: "path" },
  { cue: "evals/", token: "path" },
  { cue: "tools/", token: "path" },
  { cue: "generated_at", token: "timestamp" },
  { cue: "created_at", token: "timestamp" },
  { cue: "updated_at", token: "timestamp" },
  { cue: "run-", token: "path" },
  { cue: "/tmp/", token: "path" },
  { cue: "mtime", token: "filesystem" },
  { cue: "ctime", token: "filesystem" },
  { cue: "inode", token: "filesystem" },
  { cue: "generator", token: "generator" },
  { cue: "provider", token: "provider" },
  { re: ISO_TIMESTAMP, token: "timestamp" }
]);

function scanBytes(bytes, label) {
  const text = bytes.toString("utf8");
  const lower = text.toLowerCase();
  for (const entry of FORBIDDEN_CUES) {
    if (entry.cue !== undefined) {
      if (lower.includes(entry.cue)) {
        throw new Error(`forbidden|cue|${entry.token}|${label}|${entry.cue}`);
      }
    } else if (entry.re) {
      if (entry.re.test(text) || entry.re.test(lower)) {
        throw new Error(`forbidden|cue|${entry.token}|${label}|${entry.re.source}`);
      }
    }
  }
}

function asBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (Array.isArray(value)) {
    // A multi-arm unit: validate every arm identically.
    return value.map((entry) => asBytes(entry));
  }
  throw new Error("forbidden|cue|bytes|invalid");
}

/**
 * validatePacketArtifact({ bytes, validatorVersion, validatorDigest })
 *
 * `bytes` may be a single Buffer/string (one arm) or an Array of Buffers/strings
 * (a multi-arm unit). Both arms are checked identically; any forbidden cue
 * rejects the whole unit. Accepted bytes are returned byte-for-byte.
 */
export function validatePacketArtifact({ bytes, validatorVersion, validatorDigest }) {
  if (validatorVersion !== FROZEN_VALIDATOR_VERSION) {
    throw new Error(`validator|version|drift|${validatorVersion ?? ""}`);
  }
  if (validatorDigest !== FROZEN_VALIDATOR_DIGEST) {
    throw new Error(`validator|digest|drift|${String(validatorDigest ?? "").slice(0, 12)}`);
  }
  if (Array.isArray(bytes)) {
    if (bytes.length === 0) throw new Error("forbidden|cue|empty|unit");
    let accepted;
    for (let index = 0; index < bytes.length; index += 1) {
      const armBytes = asBytes(bytes[index]);
      scanBytes(armBytes, `arm-${index}`);
      if (index === 0) accepted = [Buffer.from(armBytes)];
      else accepted.push(Buffer.from(armBytes));
    }
    return accepted;
  }
  const armBytes = asBytes(bytes);
  scanBytes(armBytes, "arm-0");
  // Return a defensive copy so callers cannot mutate the input via the return
  // value. Buffer.from() of a Buffer shares the underlying memory in Node, so
  // we explicitly allocate a new buffer.
  return Buffer.from(armBytes);
}

export const __internal = { scanBytes, asBytes };
