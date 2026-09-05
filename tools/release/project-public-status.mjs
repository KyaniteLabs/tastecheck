#!/usr/bin/env node
/** Project public release status from exact, source-bound receipts. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { computeSourceTreeSha256 } from "./engineering-receipt.mjs";

const DEFAULT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const PUBLIC_STATUS_PATH = "evals/receipts/v1/public-release-status.json";
const MANIFEST_PATH = "contracts/v1/release-receipts.json";
const SHA256 = /^[a-f0-9]{64}$/;
const ZERO_SHA256 = "0".repeat(64);
const SAFE_RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/;
const ENGINEERING_IDS = ["context-budget", "browser", "e2e", "mechanical", "security", "clean-clone"];
const EFFECTIVENESS_IDS = ["w1-effectiveness", "terminal-v5-effectiveness"];
const STATUS_START = "<!-- release-status:v1:start -->";
const STATUS_END = "<!-- release-status:v1:end -->";
const GATE_START = "<!-- release-status-gate:v1:start -->";
const GATE_END = "<!-- release-status-gate:v1:end -->";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;

function readText(root, path) {
  return readFileSync(join(root, path), "utf8");
}

function repoFile(root, path) {
  if (typeof path !== "string" || !SAFE_RELATIVE.test(path)) return null;
  const absolute = join(root, path);
  if (!absolute.startsWith(`${root}/`)) return null;
  try {
    const stat = lstatSync(absolute);
    return stat.isFile() && !stat.isSymbolicLink() ? absolute : null;
  } catch {
    return null;
  }
}

function evidence(id, path, sha256) {
  return { id, path, sha256 };
}

function statusWord(status) {
  return status.toUpperCase();
}

function statusMessage(status) {
  if (status === "pass") return "current source-bound release receipts cover the asserted browser and accessibility checks.";
  if (status === "hold") return "a required release receipt failed; the public result is held.";
  return "a required source-bound release receipt is missing, stale, or malformed.";
}

function markerValue(status) {
  const word = statusWord(status.overall_status);
  const className = status.overall_status === "pass" ? "ok" : "pend";
  return {
    readme: [
      STATUS_START,
      `[![Release status: ${word}](https://img.shields.io/badge/release-${word.toLowerCase()}-c47b44.svg)](docs/VERIFICATION.md)`,
      `> **Release status:** ${word} — ${statusMessage(status.overall_status)}`,
      "> **Effectiveness status:** BLOCKED — historical evidence did not clear its release threshold.",
      STATUS_END,
    ].join("\n"),
    landing: [
      STATUS_START,
      `<span><span class="d ${className}" aria-hidden="true"></span> release evidence: ${word}</span>`,
      `<span><span class="d pend" aria-hidden="true"></span> effectiveness: BLOCKED</span>`,
      STATUS_END,
    ].join("\n"),
    gate: [
      GATE_START,
      `<span class="aa">Gate: ${word}${status.overall_status === "pass" ? " ✓" : ""}</span>`,
      GATE_END,
    ].join(""),
  };
}

function replaceMarker(text, start, end, replacement, label) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`${label} has a missing or malformed generated marker`);
  }
  return `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex + end.length)}`;
}

function sourceTreeHash(root, override) {
  if (override) return override;
  try {
    return computeSourceTreeSha256(root);
  } catch (error) {
    return { value: ZERO_SHA256, error: `source tree digest unavailable: ${error.message}` };
  }
}

function requiredBrowserIds(root) {
  const surfaces = ["landing", "gallery"];
  const samples = join(root, "samples");
  if (existsSync(samples)) {
    for (const entry of readdirSync(samples).sort()) {
      const path = join(samples, entry);
      if (statSync(path).isDirectory() && existsSync(join(path, "index.html"))) surfaces.push(`sample-${entry}`);
    }
  }
  const demos = join(root, "demos");
  if (existsSync(demos)) {
    for (const entry of readdirSync(demos).sort()) if (entry.endsWith(".html")) surfaces.push(`demo-${entry.replace(/\.html$/, "")}`);
  }
  const suffixes = ["http", "title", "main", "no-overflow", "meaningful-content", "images", "reduced-motion", "gate-audit", "a11y-audit", "keyboard-focus", "no-console-errors"];
  return [...new Set(surfaces)].sort().flatMap((surface) => [390, 768, 1280].flatMap((width) => suffixes.map((suffix) => `${surface}-${width}-${suffix}`)));
}

function receiptShape(receipt, kind) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  if (kind === "context-budget") return receipt.overall_pass === true && SHA256.test(receipt.source_tree_sha256 ?? "");
  return receipt.kind === kind
    && receipt.producer_id === `tastecheck.release.${kind === "browser" || kind === "e2e" ? "live-execution" : kind}.v1`
    && SHA256.test(receipt.source_tree_sha256 ?? "")
    && typeof receipt.status === "string"
    && Array.isArray(receipt.checks)
    && receipt.checks.length > 0;
}

function artifactEvidence(root, receipt) {
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) return false;
  return receipt.artifacts.every((artifact) => {
    if (!SAFE_RELATIVE.test(artifact?.path ?? "") || !SHA256.test(artifact?.sha256 ?? "") || !Number.isInteger(artifact?.bytes) || artifact.bytes < 1) return false;
    const absolute = repoFile(root, artifact.path);
    if (!absolute) return false;
    const bytes = readFileSync(absolute);
    return bytes.length === artifact.bytes && hash(bytes) === artifact.sha256;
  });
}

export function deriveReceiptStatus({ kind, receipt, currentSource, pinnedHashMatches = true, artifactIntegrity = true, requiredCheckIds = [] }) {
  if (!pinnedHashMatches || !receipt) return { status: "unverified", reasons: ["receipt bytes are missing or do not match the manifest SHA-256"] };
  if (!receiptShape(receipt, kind)) return { status: "unverified", reasons: ["receipt shape or producer identity is invalid"] };
  if (receipt.source_tree_sha256 !== currentSource) return { status: "unverified", reasons: ["receipt is stale for the current source revision"] };
  const live = kind === "browser" || kind === "e2e";
  if (live && receipt.executed !== true) return { status: "unverified", reasons: ["receipt does not record executed evidence"] };
  if (kind !== "context-budget") {
    const ids = new Set(receipt.checks.map((check) => check?.id));
    const missing = requiredCheckIds.filter((id) => !ids.has(id));
    if (missing.length) return { status: "unverified", reasons: [`receipt omits ${missing.length} required coverage checks`] };
    if (receipt.status === "fail" || receipt.checks.some((check) => check?.passed !== true)) return { status: "hold", reasons: ["a required receipt check failed"] };
    if (receipt.status !== "pass") return { status: "unverified", reasons: ["receipt has an unknown status"] };
    if (receipt.reproducible !== true) return { status: "unverified", reasons: ["receipt is not reproducible"] };
    if (live && !artifactIntegrity) return { status: "unverified", reasons: ["receipt artifact bytes or hashes are invalid"] };
  } else if (receipt.overall_pass !== true) {
    return { status: "hold", reasons: ["context-budget receipt did not pass"] };
  }
  return { status: "pass", reasons: [] };
}

function inspectEngineering(root, manifest, currentSource) {
  const cells = manifest?.engineering_readiness?.required_cells;
  const byId = new Map(Array.isArray(cells) ? cells.map((cell) => [cell?.id, cell]) : []);
  const claims = [];
  const allEvidence = [];
  const allReasons = [];
  for (const id of ENGINEERING_IDS) {
    const cell = byId.get(id);
    const path = cell?.path;
    const ref = path && SAFE_RELATIVE.test(path) && SHA256.test(cell?.sha256 ?? "") ? evidence(id, path, cell.sha256) : null;
    if (ref) allEvidence.push(ref);
    let receipt = null;
    let hashMatches = false;
    if (path && repoFile(root, path)) {
      const text = readText(root, path);
      hashMatches = ref ? hash(text) === ref.sha256 : false;
      try { receipt = JSON.parse(text); } catch { receipt = null; }
    }
    const required = id === "browser" ? requiredBrowserIds(root) : [];
    const result = deriveReceiptStatus({
      kind: id,
      receipt,
      currentSource,
      pinnedHashMatches: hashMatches,
      artifactIntegrity: receipt ? artifactEvidence(root, receipt) : false,
      requiredCheckIds: required,
    });
    claims.push({ id, status: result.status, reasons: result.reasons });
    allReasons.push(...result.reasons.map((reason) => `${id}: ${reason}`));
  }
  const status = claims.some((claim) => claim.status === "hold")
    ? "hold"
    : claims.some((claim) => claim.status !== "pass") ? "unverified" : "pass";
  return { status, claims, evidence: allEvidence, reasons: allReasons };
}

function inspectEffectiveness(root, manifest) {
  const sources = manifest?.effectiveness_claim?.sources;
  const byId = new Map(Array.isArray(sources) ? sources.map((source) => [source?.id, source]) : []);
  const evidenceItems = [];
  const reasons = [];
  let invalid = false;
  let forged = false;
  for (const id of EFFECTIVENESS_IDS) {
    const source = byId.get(id);
    if (source?.path && SAFE_RELATIVE.test(source.path) && SHA256.test(source.sha256 ?? "")) evidenceItems.push(evidence(id, source.path, source.sha256));
    if (!source?.path || !repoFile(root, source.path) || !SHA256.test(source.sha256 ?? "")) {
      invalid = true;
      reasons.push(`${id}: immutable source is missing or malformed`);
      continue;
    }
    const text = readText(root, source.path);
    if (hash(text) !== source.sha256) {
      invalid = true;
      reasons.push(`${id}: immutable source bytes do not match the manifest SHA-256`);
      continue;
    }
    let value;
    try { value = JSON.parse(text); } catch { value = null; }
    const expectedKind = id === "w1-effectiveness" ? "immutable-w1-effectiveness-projection" : "immutable-terminal-v5-effectiveness-projection";
    if (!value || value.kind !== expectedKind || value.immutable_stop_rule !== true) {
      invalid = true;
      reasons.push(`${id}: immutable projection identity is invalid`);
    }
    if (value?.effectiveness_status !== "blocked" || (id === "terminal-v5-effectiveness" && value?.release_eligible !== false)) forged = true;
  }
  if (manifest?.effectiveness_claim?.claimed_status !== "blocked") forged = true;
  if (forged) {
    reasons.push("effectiveness evidence attempts to promote a blocked historical result");
    return { status: "hold", evidence: evidenceItems, reasons };
  }
  if (invalid) return { status: "unverified", evidence: evidenceItems, reasons };
  reasons.push("historical effectiveness evidence remains blocked and is not a positive product claim");
  return { status: "blocked", evidence: evidenceItems, reasons };
}

export function derivePublicStatus(root = DEFAULT_ROOT, options = {}) {
  const manifestText = existsSync(join(root, MANIFEST_PATH)) ? readText(root, MANIFEST_PATH) : "";
  let manifest = null;
  try { manifest = JSON.parse(manifestText); } catch { manifest = null; }
  const sourceResult = sourceTreeHash(root, options.sourceTreeSha256);
  const currentSource = typeof sourceResult === "string" ? sourceResult : sourceResult.value;
  const engineering = inspectEngineering(root, manifest, currentSource);
  const browser = engineering.claims.find((claim) => claim.id === "browser") ?? { status: "unverified", reasons: ["browser receipt cell is missing"] };
  const accessibility = browser.status === "pass"
    ? { status: "pass", reasons: [] }
    : { status: browser.status === "hold" ? "hold" : "unverified", reasons: browser.reasons.map((reason) => `browser coverage: ${reason}`) };
  const effectiveness = inspectEffectiveness(root, manifest);
  const fallbackEvidence = evidence("release-manifest", MANIFEST_PATH, manifestText ? hash(manifestText) : ZERO_SHA256);
  const engineeringEvidence = engineering.evidence.length ? engineering.evidence : [fallbackEvidence];
  const browserEvidence = engineering.evidence.filter((item) => item.id === "browser");
  const effectivenessEvidence = effectiveness.evidence.length ? effectiveness.evidence : [fallbackEvidence];
  const releaseClaims = [
    { id: "engineering", status: engineering.status, evidence: engineeringEvidence, reasons: engineering.reasons },
    { id: "browser", status: browser.status, evidence: browserEvidence.length ? browserEvidence : [fallbackEvidence], reasons: browser.reasons },
    { id: "accessibility", status: accessibility.status, evidence: browserEvidence.length ? browserEvidence : [fallbackEvidence], reasons: accessibility.reasons },
    { id: "effectiveness", status: effectiveness.status, evidence: effectivenessEvidence, reasons: effectiveness.reasons },
  ];
  const releaseStatuses = releaseClaims.slice(0, 3).map((claim) => claim.status);
  const overallStatus = releaseStatuses.includes("hold") ? "hold" : releaseStatuses.includes("unverified") ? "unverified" : "pass";
  const result = {
    schema_version: 1,
    kind: "tastecheck-public-release-status",
    target_release: manifest?.target_release ?? "unknown",
    source_tree_sha256: currentSource,
    manifest: fallbackEvidence,
    claims: releaseClaims,
    overall_status: overallStatus,
  };
  if (typeof sourceResult === "object" && sourceResult.error) result.claims[0].reasons.unshift(sourceResult.error);
  return result;
}

export function renderPublicSurfaces(status) {
  return markerValue(status);
}

export function checkPublicStatus(root = DEFAULT_ROOT, options = {}) {
  const errors = [];
  const expected = derivePublicStatus(root, options);
  const statusPath = join(root, PUBLIC_STATUS_PATH);
  if (!existsSync(statusPath)) errors.push(`missing public status projection ${PUBLIC_STATUS_PATH}`);
  else {
    let actual;
    try { actual = JSON.parse(readText(root, PUBLIC_STATUS_PATH)); } catch { actual = null; }
    if (!actual) errors.push(`public status projection is not valid JSON: ${PUBLIC_STATUS_PATH}`);
    else if (canonical(actual) !== canonical(expected)) errors.push(`${PUBLIC_STATUS_PATH} is stale relative to current receipt bytes and source revision`);
  }
  const surfaces = renderPublicSurfaces(expected);
  for (const [path, start, end, replacement, label] of [
    ["README.md", STATUS_START, STATUS_END, surfaces.readme, "README.md release status"],
    ["index.html", STATUS_START, STATUS_END, surfaces.landing, "index.html release status"],
    ["index.html", GATE_START, GATE_END, surfaces.gate, "index.html gate status"],
  ]) {
    if (!existsSync(join(root, path))) { errors.push(`${label}: file is missing`); continue; }
    try {
      const actual = readText(root, path);
      if (replaceMarker(actual, start, end, replacement, label) !== actual) errors.push(`${label} marker is stale`);
    } catch (error) { errors.push(error.message); }
  }
  return errors;
}

export function projectPublicStatus(root = DEFAULT_ROOT) {
  let status = derivePublicStatus(root);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const surfaces = renderPublicSurfaces(status);
    const readme = replaceMarker(readText(root, "README.md"), STATUS_START, STATUS_END, surfaces.readme, "README.md release status");
    const landing = replaceMarker(readText(root, "index.html"), STATUS_START, STATUS_END, surfaces.landing, "index.html release status");
    const gate = replaceMarker(landing, GATE_START, GATE_END, surfaces.gate, "index.html gate status");
    writeFileSync(join(root, "README.md"), readme);
    writeFileSync(join(root, "index.html"), gate);
    const next = derivePublicStatus(root);
    if (next.source_tree_sha256 === status.source_tree_sha256 && next.overall_status === status.overall_status) {
      status = next;
      break;
    }
    status = next;
  }
  mkdirSync(join(root, "evals/receipts/v1"), { recursive: true });
  writeFileSync(join(root, PUBLIC_STATUS_PATH), canonical(status));
  return status;
}

function main() {
  const rootArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const root = resolve(rootArg ?? DEFAULT_ROOT);
  if (process.argv.includes("--write")) {
    const status = projectPublicStatus(root);
    console.log(`projected public release status: ${status.overall_status.toUpperCase()} (${PUBLIC_STATUS_PATH})`);
    return;
  }
  const errors = checkPublicStatus(root);
  if (errors.length) {
    console.error("public release status projection blocked");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`public release status projection passed: ${derivePublicStatus(root).overall_status.toUpperCase()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
