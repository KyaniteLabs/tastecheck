#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function assertSortedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSortedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  assert.deepEqual(Object.keys(value), [...Object.keys(value)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)), `${label} keys must be stable and sorted`);
  for (const [key, child] of Object.entries(value)) assertSortedKeys(child, `${label}.${key}`);
}

function copyFixtureFile(sourceRoot, fixtureRoot, relativePath) {
  const destination = join(fixtureRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(sourceRoot, relativePath), destination);
}

function buildProjectFactsFixture(sourceRoot) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tastecheck-project-facts-"));
  for (const relativePath of [
    "tools/release/release-facts.json",
    "package.json",
    "skills.json",
    "contracts/v1/commands.json",
    "README.md",
    "llms.txt",
    "index.html",
    "docs/LAUNCH.md",
    "docs/VERIFICATION.md",
    "samples/index.html",
  ]) copyFixtureFile(sourceRoot, fixtureRoot, relativePath);

  mkdirSync(join(fixtureRoot, "skills"), { recursive: true });
  for (const entry of readdirSync(join(sourceRoot, "skills"), { withFileTypes: true })) {
    if (entry.isDirectory()) mkdirSync(join(fixtureRoot, "skills", entry.name));
  }
  cpSync(join(sourceRoot, "commands"), join(fixtureRoot, "commands"), { recursive: true });
  mkdirSync(join(fixtureRoot, "samples"), { recursive: true });
  for (const entry of readdirSync(join(sourceRoot, "samples"), { withFileTypes: true })) {
    if (!entry.isDirectory() || !existsSync(join(sourceRoot, "samples", entry.name, "index.html"))) continue;
    mkdirSync(join(fixtureRoot, "samples", entry.name));
    copyFileSync(join(sourceRoot, "samples", entry.name, "index.html"), join(fixtureRoot, "samples", entry.name, "index.html"));
  }
  return fixtureRoot;
}

function testProjectFactsByteStability() {
  const fixtureRoot = buildProjectFactsFixture(root);
  const generated = [
    "skills.json",
    "contracts/v1/commands.json",
    "README.md",
    "llms.txt",
    "index.html",
    "docs/LAUNCH.md",
    "docs/VERIFICATION.md",
    "samples/index.html",
  ];
  try {
    const commandsPath = join(fixtureRoot, "contracts/v1/commands.json");
    writeFileSync(commandsPath, `${JSON.stringify(JSON.parse(readFileSync(commandsPath, "utf8")))}\n`);
    const script = join(root, "tools/release/project-facts.mjs");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--write"], { env: { ...process.env, TZ: "UTC", TASTECHECK_PROJECT_FACTS_TEST: "first" } });
    const first = generated.map((path) => readFileSync(join(fixtureRoot, path)));
    assertSortedKeys(JSON.parse(first[0].toString("utf8")), "skills.json");
    assertSortedKeys(JSON.parse(first[1].toString("utf8")), "contracts/v1/commands.json");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--write"], { env: { ...process.env, TZ: "Pacific/Honolulu", TASTECHECK_PROJECT_FACTS_TEST: "second" } });
    const second = generated.map((path) => readFileSync(join(fixtureRoot, path)));
    assert.deepEqual(second, first, "two project-facts runs must produce identical bytes across environment changes");
    execFileSync(process.execPath, [script, "--root", fixtureRoot, "--check"], { env: { ...process.env, TZ: "America/Los_Angeles", TASTECHECK_PROJECT_FACTS_TEST: "check" } });
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

testProjectFactsByteStability();
console.log("project-facts two-run byte-stability test passed");
