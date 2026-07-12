#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanUnsupportedEffectivenessClaims } from "./check-effectiveness-claims.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scanner = join(here, "check-effectiveness-claims.mjs");
const fixtures = join(here, "fixtures/effectiveness-claims");

function run(name) {
  return spawnSync(process.execPath, [scanner, join(fixtures, name)], {
    encoding: "utf8",
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const unsupported = run("unsupported");
assert(unsupported.status === 1, `unsupported claims exited ${unsupported.status}; expected 1`);
assert(unsupported.stderr.includes("README.md:3"), "README claim was not reported with its line");
assert(unsupported.stderr.includes("llms.txt:1"), "llms.txt claim was not reported with its line");
assert(unsupported.stderr.includes("site/index.html:2"), "site claim was not reported with its line");
assert(unsupported.stderr.includes("index.html:2"), "root index claim was not reported with its line");
assert(unsupported.stderr.includes("docs/mixed.md:3"), "an unsupported claim after a qualified claim on the same line was missed");
assert(unsupported.stderr.includes("skills/example/SKILL.md:3"), "skill claim was not reported with its line");
assert(unsupported.stderr.includes("tastecheck is the fix"), "direct fix claim was not reported");
assert(unsupported.stderr.includes("beats the AI average"), "direct comparative claim was not reported");
assert(unsupported.stderr.includes("delivers better outcomes"), "direct outcome claim was not reported");
assert(unsupported.stderr.includes("unsupported effectiveness claim"), "diagnostic did not explain the policy failure");

const importedFindings = scanUnsupportedEffectivenessClaims(join(fixtures, "unsupported"));
assert(importedFindings.length >= 8, "imported scanner API did not return all unsupported fixture findings");

const contextualized = run("contextualized");
assert(contextualized.status === 0, `contextualized claims were rejected:\n${contextualized.stderr}`);
assert(contextualized.stdout.includes("effectiveness claim scan passed"), "passing scan did not report success");
assert(scanUnsupportedEffectivenessClaims(join(fixtures, "contextualized")).length === 0, "imported scanner API rejected contextualized or factual claims");

console.log("effectiveness claim scanner fixtures passed (unsupported + contextualized)");
