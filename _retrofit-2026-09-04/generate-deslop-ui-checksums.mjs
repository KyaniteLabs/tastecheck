#!/usr/bin/env node
/** Generate byte-exact evidence for the W1 deslop-ui artifact family. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..");
const VENDOR_REVISION = "b3cb1155e076feb6176ee210eb62f3b03363337a";
const VENDOR_LABEL = "local canonical W1-parent payload";
const OUTPUT_PATH = resolve(ROOT, "_retrofit-2026-09-04/W1-DESLOP-UI-CHECKSUMS.json");
const FILES = [
  "skills/deslop-ui/SKILL.md",
  "skills/deslop-ui/contract.json",
  "skills/deslop-ui/references/anti-patterns.md",
  "skills/deslop-ui/references/decision-records.md",
  "skills/deslop-ui/references/design-direction.md",
  "skills/deslop-ui/references/structural-tells.md",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function vendorBytes(path) {
  return execFileSync("git", ["show", `${VENDOR_REVISION}:${path}`], {
    cwd: ROOT,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function outputPath() {
  const argument = process.argv.find((value) => value.startsWith("--out="));
  const path = argument ? argument.slice("--out=".length) : OUTPUT_PATH;
  const absolute = resolve(ROOT, path);
  if (absolute !== ROOT && !absolute.startsWith(`${ROOT}/`)) throw new Error("output must remain inside the repository");
  return absolute;
}

function buildEvidence() {
  const files = FILES.map((path) => {
    const currentExists = existsSync(resolve(ROOT, path));
    const current = currentExists ? readFileSync(resolve(ROOT, path)) : null;
    let vendor;
    let vendorError = null;
    try {
      vendor = vendorBytes(path);
    } catch (error) {
      vendor = null;
      vendorError = error.message;
    }
    const currentSha256 = current ? sha256(current) : null;
    const vendorSha256 = vendor ? sha256(vendor) : null;
    return {
      path,
      bytes: current?.length ?? 0,
      current_sha256: currentSha256,
      vendor_sha256: vendorSha256,
      match: currentSha256 !== null && currentSha256 === vendorSha256,
      ...(vendorError ? { vendor_error: vendorError } : {}),
    };
  });
  const matches = files.filter((file) => file.match).length;
  return {
    schema_version: 1,
    kind: "deslop-ui-byte-exact-checksums",
    generated_by: "_retrofit-2026-09-04/generate-deslop-ui-checksums.mjs",
    source: {
      kind: "git-tree",
      label: VENDOR_LABEL,
      revision: VENDOR_REVISION,
    },
    files,
    summary: {
      total: files.length,
      matches,
      mismatches: files.length - matches,
      byte_exact: matches === files.length,
    },
  };
}

function main() {
  const evidence = buildEvidence();
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (process.argv.includes("--write")) {
    const destination = outputPath();
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, serialized);
    console.log(`wrote ${relative(ROOT, destination)}`);
  } else {
    process.stdout.write(serialized);
  }
  if (!evidence.summary.byte_exact) process.exitCode = 1;
}

main();
