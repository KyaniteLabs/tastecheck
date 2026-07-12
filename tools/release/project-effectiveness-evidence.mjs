#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
export const SOURCE_PATHS = Object.freeze({
  w1: "evals/evidence/v1/immutable/w1-source.json",
  terminalV5: "evals/evidence/v1/immutable/terminal-v5-source.json",
});
export const PROJECTION_PATHS = Object.freeze({
  w1: "evals/receipts/v1/immutable/w1-effectiveness.json",
  terminalV5: "evals/receipts/v1/immutable/terminal-v5-effectiveness.json",
});
const UPSTREAM_HASHES = Object.freeze({
  w1: "4740047dde16d93f1c07ed7be8dab4bb7aab0930b61d0e035caa64263963a6ce",
  terminalV5: "1bf66f612098df398163042e2450ed6eb6ee4b0a3b57d73e1aebbe76196b1d81",
});
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function loadSource(name, expectedKind, cwd) {
  const path = SOURCE_PATHS[name];
  const text = readFileSync(join(cwd, path), "utf8");
  const value = JSON.parse(text);
  if (value.schema_version !== 1 || value.kind !== expectedKind || value.upstream_evidence_sha256 !== UPSTREAM_HASHES[name] || value.immutable_stop_rule !== true) {
    throw new Error(`${name}: immutable source identity/provenance mismatch`);
  }
  return { value, sha256: sha256(text) };
}

export function deriveEffectivenessProjections(cwd = root) {
  const w1 = loadSource("w1", "immutable-w1-source-snapshot", cwd);
  const terminalV5 = loadSource("terminalV5", "immutable-terminal-v5-source-snapshot", cwd);
  if (w1.value.jobs?.complete !== 12 || w1.value.jobs?.required !== 12 || w1.value.judgments?.complete !== 27 || w1.value.judgments?.required !== 27
    || w1.value.paired?.pass_count !== 0 || w1.value.paired?.required_count !== 3 || w1.value.diversity?.pass_count !== 0 || w1.value.diversity?.required_count !== 3) {
    throw new Error("w1: immutable source facts mismatch");
  }
  if (terminalV5.value.release_eligible !== false || terminalV5.value.mean_delta !== 0.3 || terminalV5.value.threshold !== 0.6
    || terminalV5.value.preference?.current !== 11 || terminalV5.value.preference?.total !== 12) {
    throw new Error("terminalV5: immutable source facts mismatch");
  }
  return {
    w1: {
      schema_version: 1,
      kind: "immutable-w1-effectiveness-projection",
      source_evidence_sha256: w1.sha256,
      effectiveness_status: "blocked",
      jobs: w1.value.jobs,
      judgments: w1.value.judgments,
      paired: w1.value.paired,
      diversity: w1.value.diversity,
      immutable_stop_rule: true,
    },
    terminalV5: {
      schema_version: 1,
      kind: "immutable-terminal-v5-effectiveness-projection",
      source_evidence_sha256: terminalV5.sha256,
      effectiveness_status: "blocked",
      release_eligible: terminalV5.value.release_eligible,
      mean_delta: terminalV5.value.mean_delta,
      threshold: terminalV5.value.threshold,
      preference: terminalV5.value.preference,
      immutable_stop_rule: true,
    },
  };
}

export function checkEffectivenessProjections(cwd = root) {
  const derived = deriveEffectivenessProjections(cwd);
  const errors = [];
  for (const [name, value] of Object.entries(derived)) {
    const expected = canonical(value);
    const actual = readFileSync(join(cwd, PROJECTION_PATHS[name]), "utf8");
    if (actual !== expected) errors.push(`${PROJECTION_PATHS[name]} is stale relative to committed immutable source evidence`);
  }
  return errors;
}

function main() {
  const derived = deriveEffectivenessProjections(root);
  if (process.argv.includes("--write")) {
    for (const [name, value] of Object.entries(derived)) writeFileSync(join(root, PROJECTION_PATHS[name]), canonical(value));
    console.log("effectiveness projections updated from committed immutable sources");
    return;
  }
  const errors = checkEffectivenessProjections(root);
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("effectiveness projections match committed immutable sources");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
