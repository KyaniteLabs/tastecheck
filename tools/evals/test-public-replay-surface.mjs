#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const ignore = readFileSync(join(root, ".gitignore"), "utf8");
for (const rule of ["evals/replays/"]) {
  if (!ignore.split("\n").includes(rule)) throw new Error(`missing replay privacy ignore rule: ${rule}`);
}

const tracked = execFileSync("git", ["ls-files", "-z", "--", "evals/replays"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden = tracked.filter((path) => {
  if (/\/private\//.test(path) || /\/unmasked-results\.json$/.test(path)) return true;
  const text = readFileSync(join(root, path), "utf8");
  return /(?:[a-z0-9_]+_)?thread_id|(?:internal_)?provenance|(?:raw|system|user)_?prompt|dispatch_metadata/i.test(text);
});
if (forbidden.length) throw new Error(`tracked replay privacy material: ${forbidden.join(", ")}`);

console.log("replay public-surface policy passed");
