#!/usr/bin/env node
/** Generate an enumerated companion for the closed release check catalog. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = "skills/tastecheck-pass/assets/check-catalog.json";
const OUTPUT_PATH = resolve(ROOT, "_retrofit-2026-09-04/GATE-CATALOG.md");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function outputPath() {
  const argument = process.argv.find((value) => value.startsWith("--out="));
  const path = argument ? argument.slice("--out=".length) : OUTPUT_PATH;
  const absolute = resolve(ROOT, path);
  if (absolute !== ROOT && !absolute.startsWith(`${ROOT}/`)) throw new Error("output must remain inside the repository");
  return absolute;
}

function buildDocument() {
  const sourceBytes = readFileSync(resolve(ROOT, SOURCE_PATH));
  const catalog = JSON.parse(sourceBytes);
  if (!Array.isArray(catalog.checks) || catalog.checks.length === 0) throw new Error("catalog has no checks");
  const ids = catalog.checks.map((check) => check.id);
  if (new Set(ids).size !== ids.length) throw new Error("catalog contains duplicate check IDs");
  const rows = catalog.checks.map((check, index) => {
    const applicability = check.applicability.kind === "always"
      ? "always"
      : `${check.applicability.kind}: ${check.applicability.subject}`;
    return `| ${index + 1} | \`${check.id}\` | ${check.label.replaceAll("|", "\\|")} | ${check.stage} | ${check.required ? "yes" : "no"} | ${applicability} | ${check.na_policy} | ${check.judgment} |`;
  });
  return [
    "# TasteCheck Pass closed check catalog",
    "",
    `Generated from \`${SOURCE_PATH}\` by \`_retrofit-2026-09-04/generate-gate-catalog.mjs\`.`,
    `Catalog ID: \`${catalog.catalog_id}\`; schema version: ${catalog.schema_version}; source SHA-256: \`${sha256(sourceBytes)}\`.`,
    "",
    `This is the complete enumeration: ${catalog.checks.length} check IDs, each listed exactly once. The JSON catalog remains authoritative; this document makes its closed contents reviewable without relying on prose references.`,
    "",
    "| # | Check ID | What it verifies | Stage | Required | Applicability | n/a policy | Judgment |",
    "| ---: | --- | --- | --- | :---: | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function main() {
  const document = buildDocument();
  if (process.argv.includes("--write")) {
    const destination = outputPath();
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, document);
    console.log(`wrote ${relative(ROOT, destination)}`);
  } else {
    process.stdout.write(document);
  }
}

main();
