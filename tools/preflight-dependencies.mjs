#!/usr/bin/env node
/** Read-only dependency and lockfile preflight for the verification lanes. */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const lane = process.argv.find((argument) => argument.startsWith("--lane="))?.slice("--lane=".length) ?? "all";
const failures = [];

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    return null;
  }
}

const packageJson = readJson(join(root, "package.json"), "package.json");
const lockPath = join(root, "package-lock.json");
const lockJson = existsSync(lockPath) ? readJson(lockPath, "package-lock.json") : null;

if (!lockJson) failures.push("package-lock.json: missing or unreadable");
if (packageJson && lockJson) {
  const packageDependencies = packageJson.devDependencies ?? {};
  const lockedDependencies = lockJson.packages?.[""]?.devDependencies ?? {};
  for (const [name, version] of Object.entries(packageDependencies)) {
    if (lockedDependencies[name] !== version) {
      failures.push(`package-lock.json: root devDependency ${name} is ${lockedDependencies[name] ?? "absent"}, expected ${version}`);
    }
  }
  for (const name of Object.keys(lockedDependencies)) {
    if (!(name in packageDependencies)) failures.push(`package-lock.json: root devDependency ${name} is not declared in package.json`);
  }
}

const dependencyPurpose = {
  ajv: "contract/schema tests",
  playwright: "Oracle/browser tests",
};
const required = lane === "structural"
  ? []
  : lane === "oracle" || lane === "browser"
    ? ["ajv", "playwright"]
    : ["ajv", "playwright"];

if (!["structural", "oracle", "browser", "all"].includes(lane)) {
  failures.push(`unknown verification lane ${lane}; expected structural, oracle, browser, or all`);
}

for (const name of required) {
  const packagePath = join(root, "node_modules", name, "package.json");
  if (!existsSync(packagePath)) {
    failures.push(`node_modules/${name}: missing for ${dependencyPurpose[name]}`);
    continue;
  }
  const installed = readJson(packagePath, `node_modules/${name}/package.json`);
  const expected = packageJson?.devDependencies?.[name];
  if (installed && expected && installed.version !== expected) {
    failures.push(`node_modules/${name}: installed ${installed.version}, expected ${expected}`);
  }
}

if (lane === "browser" || lane === "all") {
  const playwrightCli = join(root, "node_modules", "playwright", "cli.js");
  if (!existsSync(playwrightCli)) {
    failures.push("playwright: CLI is missing; install the locked dependency before browser verification");
  }
}

if (failures.length) {
  console.error(`dependency preflight failed (${failures.length} findings)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`dependency preflight passed (${lane} lane; no installation performed)`);
