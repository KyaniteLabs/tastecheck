#!/usr/bin/env node
/**
 * tools/contracts/check-generated.mjs — drift detector for generated contract blocks.
 *
 * Regenerates all contract projections in memory and fails if any diverge
 * from what is currently on disk. The Integration owner runs this to validate
 * that domain owners projected correctly; it never writes domain-owned files.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

try {
  const result = execFileSync("node", [
    join(root, "tools/contracts/project.mjs"),
    "--scope=all",
  ], { encoding: "utf8", cwd: root, stdio: "pipe" });
  console.log(result.trim());
  console.log("check-generated: no contract drift");
} catch (err) {
  console.error(err.stdout || "");
  console.error(err.stderr || "");
  console.error("check-generated: contract drift detected — domain owners must re-run project.mjs --write-owned");
  process.exit(1);
}
