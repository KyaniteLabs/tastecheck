#!/usr/bin/env node
// CLI adapter for the canonical content lint implementation. Keeping one
// implementation prevents the command and its fixture tests from disagreeing
// about unknown skill-like references.
import { resolve } from "node:path";
import { lintSkills } from "./lib/skill-lint.mjs";

const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
const root = resolve(rootArgument ? rootArgument.slice("--root=".length) : new URL("..", import.meta.url).pathname);
const { findings, skillCount } = lintSkills(root);
const fails = findings.filter((finding) => finding.level === "fail");
const warns = findings.filter((finding) => finding.level === "warn");

for (const finding of fails) console.error(`✗ ${finding.message}\n    ${finding.file}`);
for (const finding of warns) console.warn(`⚠ ${finding.message}\n    ${finding.file}`);
console.log(`skill lint: ${skillCount} skills, ${fails.length} failures, ${warns.length} warnings`);
if (fails.length) process.exit(1);
