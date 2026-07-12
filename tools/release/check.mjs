#!/usr/bin/env node
/** Deterministic release checks. Static checks never claim model/browser execution. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import Ajv from "ajv";
import { computeSourceTreeSha256 } from "./engineering-receipt.mjs";
import { buildContextBudgetReport } from "../evals/context-budget.mjs";
import { scanUnsupportedEffectivenessClaims } from "./check-effectiveness-claims.mjs";
import { checkEffectivenessProjections } from "./project-effectiveness-evidence.mjs";

export const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
export const TERMINAL_V5_SYNTHESIS = "evals/replays/remediation7-v5-spacing-final-2026-07-11/blind-judge/synthesis.json";
export const HISTORICAL_FULL19_PREFIX = "evals/replays/full19-v1rc-2026-07-11/";
export const ENGINEERING_PRODUCERS = Object.freeze({
  "context-budget": Object.freeze({ path: "evals/receipts/v1/context-budget.json", command: "npm run eval:context-budget", assertions: Object.freeze({ overall_pass: true }) }),
  browser: Object.freeze({ path: "evals/receipts/v1/browser.json", command: "npm run release:browser-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.live-execution.v1" }) }),
  e2e: Object.freeze({ path: "evals/receipts/v1/e2e.json", command: "npm run release:e2e-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.live-execution.v1" }) }),
  mechanical: Object.freeze({ path: "evals/receipts/v1/mechanical.json", command: "npm run release:mechanical-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.mechanical.v1" }) }),
  security: Object.freeze({ path: "evals/receipts/v1/security.json", command: "npm run release:security-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.security.v1" }) }),
  "clean-clone": Object.freeze({ path: "evals/receipts/v1/clean-clone.json", command: "npm run release:clean-clone-receipt", assertions: Object.freeze({ status: "pass", reproducible: true, producer_id: "tastecheck.release.clean-clone.v1" }) }),
});
export const EFFECTIVENESS_SOURCES = Object.freeze({
  "w1-effectiveness": Object.freeze({ path: "evals/receipts/v1/immutable/w1-effectiveness.json", source_evidence_sha256: "663b6a4729ff3b59636578ac5262ae7ae28aa673fbc214930b87803b34a8fce8" }),
  "terminal-v5-effectiveness": Object.freeze({ path: "evals/receipts/v1/immutable/terminal-v5-effectiveness.json", source_evidence_sha256: "6cb65b37b87bcf59cd4d851b7fc65038fb8de9c65cd19c30fbc612315989d218" }),
});
const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ?? "release";

function load(rel) { return JSON.parse(readFileSync(join(root, rel), "utf8")); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function at(value, path) { return path.split(".").reduce((current, key) => current?.[key], value); }

const defaultIo = Object.freeze({
  readText: (path) => readFileSync(join(root, path), "utf8"),
  readBytes: (path) => readFileSync(join(root, path)),
  hasFile: (path) => existsSync(join(root, path)),
  hasCommand: (command) => Boolean(load("package.json").scripts?.[command.replace(/^npm run /, "")]),
  sourceTreeSha256: () => computeSourceTreeSha256(root),
  contextBudgetReport: () => buildContextBudgetReport(root).report,
  requiredLiveCheckIds: (kind) => requiredLiveCheckIds(kind),
  requiredLiveArtifactIds: (kind) => requiredLiveArtifactIds(kind),
});
const SHA256 = /^[a-f0-9]{64}$/;
const LIVE_SCHEMA = JSON.parse(readFileSync(join(root, "contracts/v1/live-execution-receipt.schema.json"), "utf8"));
const validateLiveReceiptSchema = new Ajv({ allErrors: true, strict: false }).compile(LIVE_SCHEMA);
export const GENERIC_CHECKS = Object.freeze({
  mechanical: Object.freeze([
    ["test", "npm test"], ["contracts", "npm run test:contracts"], ["eval-schema", "npm run test:eval-schema"],
    ["release-eval-contracts", "npm run test:release-eval-contracts"], ["source-stability", "internal source digest comparison"],
  ]),
  security: Object.freeze([
    ["effectiveness-claims", "node tools/release/check-effectiveness-claims.mjs"],
    ["public-replay-surface", "node tools/evals/test-public-replay-surface.mjs"],
    ["receipt-sanitizer", "node tools/evals/test-sanitizer-fixtures.mjs"],
    ["source-stability", "internal source digest comparison"],
  ]),
  "clean-clone": Object.freeze([
    ["npm-ci", "npm ci --ignore-scripts"], ["test", "npm test"], ["contracts", "npm run test:contracts"],
    ["effectiveness-claims", "node tools/release/check-effectiveness-claims.mjs"],
    ["head-source-match", "internal HEAD source digest comparison"], ["source-stability", "internal source digest comparison"],
  ]),
});

function browserSurfaceIds() {
  const ids = ["landing", "gallery"];
  for (const entry of readdirSync(join(root, "samples"), { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(root, "samples", entry.name, "index.html"))) ids.push(`sample-${entry.name}`);
  }
  for (const name of readdirSync(join(root, "demos")).filter((entry) => entry.endsWith(".html"))) ids.push(`demo-${name.replace(/\.html$/, "")}`);
  return ids.sort();
}

function requiredLiveCheckIds(kind) {
  if (kind === "browser") {
    const suffixes = ["http", "title", "main", "no-overflow", "meaningful-content", "images", "reduced-motion", "gate-audit", "a11y-audit", "keyboard-focus", "no-console-errors"];
    return browserSurfaceIds().flatMap((surface) => [390, 768, 1280].flatMap((width) => suffixes.map((suffix) => `${surface}-${width}-${suffix}`)));
  }
  return [
    "install-command-completed", "install-canonical-skills", "install-operator-commands",
    "operator-desktop-http", "operator-skill-coverage", "operator-theme-paths", "operator-component-state",
    "operator-invalid-form", "operator-valid-form", "operator-empty-state", "operator-error-state", "operator-retry-state",
    "operator-desktop-no-overflow", "operator-desktop-no-console-errors", "operator-mobile-http",
    "operator-mobile-no-overflow", "operator-mobile-no-console-errors",
  ];
}

function requiredLiveArtifactIds(kind) {
  return kind === "browser"
    ? [...browserSurfaceIds().flatMap((surface) => [390, 768, 1280].map((width) => `${surface}-${width}`)), "browser-audit-results"]
    : ["operator-desktop", "operator-mobile"];
}

function strictKeys(value, allowed, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label} must be an object`); return; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${label}: unknown field ${key}`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function sameJson(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }

function readPinnedJson(entry, label, io, errors) {
  if (!entry || typeof entry !== "object") return null;
  if (!SHA256.test(entry.sha256 ?? "")) { errors.push(`${label}: sha256 must be a lowercase 64-character digest`); return null; }
  if (/^0{64}$/.test(entry.sha256)) { errors.push(`${label}: placeholder SHA-256 is not allowed in release mode`); return null; }
  if (!io.hasFile(entry.path)) { errors.push(`${label}: missing required receipt cell ${entry.path}`); return null; }
  let text;
  try { text = io.readText(entry.path); }
  catch (error) { errors.push(`${label}: cannot read ${entry.path}: ${error.message}`); return null; }
  if (sha256(text) !== entry.sha256) errors.push(`${label}: pinned SHA-256 does not match ${entry.path}`);
  try { return JSON.parse(text); }
  catch { errors.push(`${label}: receipt is not valid JSON`); return null; }
}

function validateEngineeringReceipt(id, value, io, errors) {
  if (id === "context-budget") {
    strictKeys(value, ["schema_version", "source_tree_sha256", "skills", "overall_pass"], "context-budget receipt", errors);
    const expected = io.contextBudgetReport();
    if (!sameJson(value, expected)) errors.push("context-budget: receipt does not exactly match recomputed current skill metrics and frozen baseline");
    if (value?.source_tree_sha256 !== io.sourceTreeSha256()) errors.push("context-budget: source_tree_sha256 is stale for the current tracked source");
    if (expected.overall_pass !== true) errors.push("context-budget: current skills exceed the frozen context budget");
    return;
  }
  const currentSource = io.sourceTreeSha256();
  if (value?.source_tree_sha256 !== currentSource) errors.push(`${id}: source_tree_sha256 is stale for the current tracked source`);
  if (id === "browser" || id === "e2e") {
    if (!validateLiveReceiptSchema(value)) {
      errors.push(`${id}: live receipt schema validation failed: ${validateLiveReceiptSchema.errors?.map((entry) => `${entry.instancePath || "/"} ${entry.message}`).join(", ")}`);
      return;
    }
    if (value.kind !== id) errors.push(`${id}: live receipt kind mismatch`);
    if (value.status !== "pass" || value.reproducible !== true || value.executed !== true || value.checks.some((check) => check.passed !== true)) {
      errors.push(`${id}: live receipt must derive from nonempty all-pass executed checks`);
    }
    const checkIds = value.checks.map((check) => check.id);
    if (!sameJson([...checkIds].sort(), [...io.requiredLiveCheckIds(id)].sort())) errors.push(`${id}: live check set does not match the registered coverage matrix`);
    const artifactIds = new Set();
    for (const artifact of value.artifacts) {
      if (artifactIds.has(artifact.id)) errors.push(`${id}: duplicate artifact id ${artifact.id}`);
      artifactIds.add(artifact.id);
      if (!io.hasFile(artifact.path)) { errors.push(`${id}: missing artifact ${artifact.path}`); continue; }
      const bytes = io.readBytes(artifact.path);
      if (bytes.length !== artifact.bytes) errors.push(`${id}: artifact byte count mismatch ${artifact.path}`);
      if (sha256(bytes) !== artifact.sha256) errors.push(`${id}: artifact SHA-256 mismatch ${artifact.path}`);
    }
    if (!sameJson([...artifactIds].sort(), [...io.requiredLiveArtifactIds(id)].sort())) errors.push(`${id}: live artifact set does not match the registered coverage matrix`);
    return;
  }
  strictKeys(value, ["schema_version", "kind", "producer_id", "source_tree_sha256", "nonce", "started_at", "finished_at", "checks", "status", "reproducible"], `${id} receipt`, errors);
  if (value?.schema_version !== 1 || value?.kind !== id || value?.producer_id !== `tastecheck.release.${id}.v1`) errors.push(`${id}: generic receipt identity mismatch`);
  if (!Array.isArray(value?.checks) || value.checks.length === 0) { errors.push(`${id}: checks must be nonempty`); return; }
  const registeredChecks = GENERIC_CHECKS[id];
  const ids = value.checks.map((check) => check?.id);
  if (!sameJson(ids, registeredChecks.map(([checkId]) => checkId))) errors.push(`${id}: check identities/order do not match the registered producer`);
  const validChecks = value.checks.every((check, index) => {
    strictKeys(check, ["id", "command", "passed", "exit_code", "output_sha256"], `${id} check ${check?.id ?? "<unnamed>"}`, errors);
    if (/^(?:\/|[A-Za-z]:\\)/.test(check?.command ?? "")) errors.push(`${id}: check command leaks an absolute executable path`);
    if (check?.command !== registeredChecks[index]?.[1]) errors.push(`${id}: check command does not match the registered producer for ${check?.id ?? "<unnamed>"}`);
    return check?.passed === true && check?.exit_code === 0 && SHA256.test(check?.output_sha256 ?? "");
  });
  if (!validChecks || value.status !== "pass" || value.reproducible !== true) errors.push(`${id}: generic receipt must derive from registered all-pass checks`);
}

export function checkEngineeringReadiness(manifest, ioOverrides = {}) {
  const io = { ...defaultIo, ...ioOverrides };
  const errors = [];
  const section = manifest?.engineering_readiness;
  strictKeys(section, ["required_cells"], "engineering_readiness", errors);
  if (!Array.isArray(section?.required_cells)) {
    errors.push("engineering_readiness.required_cells must be an array");
    return { status: "blocked", errors };
  }
  const seen = new Set();
  for (const cell of section.required_cells) {
    strictKeys(cell, ["id", "path", "sha256", "producer_id", "assertions"], `engineering cell ${cell?.id ?? "<unnamed>"}`, errors);
    if (seen.has(cell?.id)) errors.push(`${cell.id}: duplicate cell id`);
    seen.add(cell?.id);
    const producer = ENGINEERING_PRODUCERS[cell?.producer_id];
    if (!producer) { errors.push(`${cell?.id ?? "<unnamed>"}: unregistered producer ${cell?.producer_id ?? "<missing>"}`); continue; }
    if (!io.hasCommand(producer.command)) errors.push(`${cell.id}: registered producer command is unavailable: ${producer.command}`);
    if (cell.id !== cell.producer_id) errors.push(`${cell.id}: cell id must equal producer_id ${cell.producer_id}`);
    if (cell.path !== producer.path) { errors.push(`${cell.id}: path is not the registered path ${producer.path}`); continue; }
    if (!sameJson(cell.assertions, producer.assertions)) errors.push(`${cell.id}: assertions must equal the registered producer assertions`);
    const value = readPinnedJson(cell, cell.id, io, errors);
    if (value) {
      for (const [path, expected] of Object.entries(producer.assertions)) {
        if (at(value, path) !== expected) errors.push(`${cell.id}: ${path}=${JSON.stringify(at(value, path))}; expected ${JSON.stringify(expected)}`);
      }
      validateEngineeringReceipt(cell.id, value, io, errors);
    }
  }
  for (const id of Object.keys(ENGINEERING_PRODUCERS)) if (!seen.has(id)) errors.push(`${id}: missing registered producer cell`);
  if (seen.size !== Object.keys(ENGINEERING_PRODUCERS).length) errors.push("engineering_readiness must contain the complete six-cell producer registry");
  return { status: errors.length ? "blocked" : "ready", errors };
}

export function deriveEffectivenessClaim(manifest, ioOverrides = {}) {
  const io = { ...defaultIo, ...ioOverrides };
  const errors = [];
  const claim = manifest?.effectiveness_claim;
  strictKeys(claim, ["claimed_status", "sources"], "effectiveness_claim", errors);
  if (claim?.claimed_status !== "blocked") errors.push("effectiveness_claim.claimed_status must be blocked");
  if (!Array.isArray(claim?.sources)) {
    errors.push("effectiveness_claim.sources must be an array");
    return { status: "blocked", errors, reasons: ["invalid_effectiveness_contract"] };
  }
  const seen = new Set();
  const values = new Map();
  for (const source of claim.sources) {
    strictKeys(source, ["id", "path", "sha256"], `effectiveness source ${source?.id ?? "<unnamed>"}`, errors);
    if (seen.has(source?.id)) errors.push(`${source.id}: duplicate effectiveness source id`);
    seen.add(source?.id);
    const registered = EFFECTIVENESS_SOURCES[source?.id];
    if (!registered) { errors.push(`${source?.id ?? "<unnamed>"}: unregistered effectiveness source`); continue; }
    if (source.path !== registered.path) { errors.push(`${source.id}: path is not the registered immutable path ${registered.path}`); continue; }
    const value = readPinnedJson(source, source.id, io, errors);
    if (value) values.set(source.id, value);
  }
  for (const id of Object.keys(EFFECTIVENESS_SOURCES)) if (!seen.has(id)) errors.push(`${id}: missing immutable effectiveness source`);

  const w1 = values.get("w1-effectiveness");
  if (w1) {
    strictKeys(w1, ["schema_version", "kind", "source_evidence_sha256", "effectiveness_status", "jobs", "judgments", "paired", "diversity", "immutable_stop_rule"], "w1 effectiveness projection", errors);
    strictKeys(w1.jobs, ["complete", "required"], "w1 jobs projection", errors);
    strictKeys(w1.judgments, ["complete", "required"], "w1 judgments projection", errors);
    strictKeys(w1.paired, ["pass_count", "required_count"], "w1 paired projection", errors);
    strictKeys(w1.diversity, ["pass_count", "required_count"], "w1 diversity projection", errors);
    if (w1.schema_version !== 1 || w1.kind !== "immutable-w1-effectiveness-projection") errors.push("w1-effectiveness: projection identity mismatch");
    if (w1.source_evidence_sha256 !== EFFECTIVENESS_SOURCES["w1-effectiveness"].source_evidence_sha256) errors.push("w1-effectiveness: canonical source evidence hash mismatch");
    if (w1.effectiveness_status !== "blocked") errors.push("w1-effectiveness: effectiveness_status must remain blocked");
    if (w1.jobs?.complete !== 12 || w1.jobs?.required !== 12) errors.push("w1-effectiveness: completed jobs must remain 12/12");
    if (w1.judgments?.complete !== 27 || w1.judgments?.required !== 27) errors.push("w1-effectiveness: completed judgments must remain 27/27");
    if (w1.paired?.pass_count !== 0 || w1.paired?.required_count !== 3) errors.push("w1-effectiveness: immutable paired result must remain 0/3");
    if (w1.diversity?.pass_count !== 0 || w1.diversity?.required_count !== 3) errors.push("w1-effectiveness: immutable diversity result must remain 0/3");
    if (w1.immutable_stop_rule !== true) errors.push("w1-effectiveness: immutable stop rule is required");
  }
  const v5 = values.get("terminal-v5-effectiveness");
  if (v5) {
    strictKeys(v5, ["schema_version", "kind", "source_evidence_sha256", "effectiveness_status", "release_eligible", "mean_delta", "threshold", "preference", "immutable_stop_rule"], "terminal V5 effectiveness projection", errors);
    strictKeys(v5.preference, ["current", "total"], "terminal V5 preference projection", errors);
    if (v5.schema_version !== 1 || v5.kind !== "immutable-terminal-v5-effectiveness-projection") errors.push("terminal-v5-effectiveness: projection identity mismatch");
    if (v5.source_evidence_sha256 !== EFFECTIVENESS_SOURCES["terminal-v5-effectiveness"].source_evidence_sha256) errors.push("terminal-v5-effectiveness: canonical source evidence hash mismatch");
    if (v5.effectiveness_status !== "blocked") errors.push("terminal-v5-effectiveness: effectiveness_status must remain blocked");
    if (v5.release_eligible !== false) errors.push("terminal-v5-effectiveness: immutable release_eligible must remain false");
    if (v5.mean_delta !== 0.3 || v5.threshold !== 0.6) errors.push("terminal-v5-effectiveness: historical delta 0.3 and threshold 0.6 must be preserved");
    if (v5.preference?.current !== 11 || v5.preference?.total !== 12) errors.push("terminal-v5-effectiveness: historical preference 11/12 must be preserved");
    if (v5.immutable_stop_rule !== true) errors.push("terminal-v5-effectiveness: immutable stop rule is required");
  }
  const reasons = ["w1_paired_0_of_3", "w1_diversity_0_of_3", "terminal_v5_delta_0.3_below_0.6"];
  if (Object.keys(ioOverrides).length === 0) errors.push(...checkEffectivenessProjections(root));
  return { status: "blocked", errors, reasons };
}

export function checkReleaseManifest(manifest, io = {}) {
  const errors = [];
  strictKeys(manifest, ["schema_version", "target_release", "engineering_readiness", "effectiveness_claim"], "release manifest", errors);
  if (manifest?.schema_version !== 2) errors.push("release receipt manifest schema_version must be 2");
  if (manifest?.target_release !== "1.0.0") errors.push("release receipt manifest target_release must be 1.0.0");
  errors.push(...checkEngineeringReadiness(manifest, io).errors);
  errors.push(...deriveEffectivenessClaim(manifest, io).errors);
  return errors;
}

function runNode(script, args = []) {
  try { execFileSync(process.execPath, [join(root, script), ...args], { cwd: root, stdio: "inherit" }); return true; }
  catch { return false; }
}

function claims() {
  const errors = [];
  const pkg = load("package.json");
  const manifest = load("skills.json");
  const dirs = readdirSync(join(root, "skills")).filter((name) => statSync(join(root, "skills", name)).isDirectory());
  const commandCount = readdirSync(join(root, "commands")).filter((name) => name.endsWith(".md")).length;
  if (pkg.version !== "1.0.0") errors.push(`package.json version is ${pkg.version}; expected 1.0.0`);
  if (manifest.version !== "1.0.0") errors.push(`skills.json version is ${manifest.version}; expected 1.0.0`);
  const manifestNames = new Set(manifest.skills.map((skill) => skill.name));
  if (new Set(dirs).size !== 19 || dirs.some((name) => !manifestNames.has(name)) || manifestNames.size !== new Set(dirs).size) errors.push(`skill inventory is not an exact 19-entry manifest parity`);
  if (commandCount !== 20) errors.push(`command inventory is ${commandCount}; expected 20`);
  const index = readFileSync(join(root, "index.html"), "utf8");
  if (/set of 15|set of 14|set of 13/.test(index)) errors.push("index.html contains a stale skill-count claim");
  if (/19 commands/i.test(readFileSync(join(root, "README.md"), "utf8"))) errors.push("README.md claims 19 commands; release truth is 20 command files");
  return errors;
}

function checkE2E() {
  const path = process.env.TASTECHECK_E2E_RECEIPT ?? "evals/receipts/v1/e2e.json";
  if (!existsSync(join(root, path))) return [`missing live e2e receipt cell ${path}`];
  const receipt = load(path);
  if (receipt.executed !== true || receipt.status !== "pass") return [`e2e receipt is not an executed pass: ${path}`];
  return [];
}

function main() {
  const errors = [];
  let successDetail = "";
  if (mode === "browser") {
    const ok = ["tools/verify.mjs", "tools/verify-landing.mjs", "tools/verify-integration.mjs", "tools/verify-gate-audit.mjs"].every((script) => runNode(script));
    if (!ok) errors.push("static browser-contract checks failed");
    else console.log("browser-contract checks passed; no live browser execution claimed");
  } else if (mode === "interviews") {
    const ok = runNode("tools/contracts/test-contracts.mjs") && runNode("tools/contracts/project.mjs", ["--scope=interviews"]);
    if (!ok) errors.push("interview contract/projection checks failed");
    else console.log("interview schema/projection checks passed; no model interview execution claimed");
  } else if (mode === "routing") {
    if (!runNode("tools/contracts/test-scenarios.mjs")) errors.push("scenario routing checks failed");
    else console.log("routing contract checks passed; no semantic model routing execution claimed");
  } else if (mode === "e2e") {
    errors.push(...checkE2E());
  } else if (mode === "claims") {
    errors.push(...claims());
  } else if (mode === "engineering") {
    const engineering = checkEngineeringReadiness(load("contracts/v1/release-receipts.json"));
    errors.push(...engineering.errors);
    successDetail = "; engineering_ready=true";
  } else if (mode === "effectiveness") {
    const effectiveness = deriveEffectivenessClaim(load("contracts/v1/release-receipts.json"));
    errors.push(...effectiveness.errors);
    successDetail = `; effectiveness=${effectiveness.status}`;
  } else if (mode === "release") {
    const releaseManifest = load("contracts/v1/release-receipts.json");
    const effectiveness = deriveEffectivenessClaim(releaseManifest);
    const unsupportedClaims = scanUnsupportedEffectivenessClaims(root);
    errors.push(...claims(), ...checkReleaseManifest(releaseManifest), ...unsupportedClaims.map((finding) => `${finding.path}:${finding.line}: unsupported effectiveness claim: ${finding.text}`));
    successDetail = `; engineering_ready=true; effectiveness=${effectiveness.status}`;
  } else errors.push(`unknown release check mode: ${mode}`);
  if (errors.length) {
    console.error(`release check blocked (${mode})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`release check passed (${mode})${successDetail}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
