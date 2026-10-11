#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" });
const files = JSON.parse(out)[0].files.map((f) => f.path);
const set = new Set(files);
const failures = [];

const forbiddenName = [/\.bak/, /\.key$/, /\.pem$/, /(^|\/)\.env/, /\.tmp$/, /(^|\/)\.DS_Store$/];
const forbiddenDir = [".checkyourself/", "reports-tmp/", ".scratch/", "evals/", "docs/superpowers"];
for (const f of files) {
  if (forbiddenName.some((re) => re.test(f))) failures.push(`forbidden file in tarball: ${f}`);
  if (forbiddenDir.some((d) => f.startsWith(d))) failures.push(`forbidden path in tarball: ${f}`);
}

const required = ["bin/tastecheck.mjs", "bin/install.mjs", "install.sh", "skills/tastecheck-pass/assets/cdp-qa.mjs", "skills/tastecheck-pass/assets/gate-audit.js"];
const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
if (manifest.skills.length !== 20) failures.push(`skills.json lists ${manifest.skills.length} skills, expected 20`);
for (const s of manifest.skills) required.push(`skills/${s.name}/SKILL.md`);
for (const r of required) if (!set.has(r)) failures.push(`missing from tarball: ${r}`);

if (failures.length) {
  console.error("test-package-contents FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`test-package-contents: ok (${files.length} files)`);
