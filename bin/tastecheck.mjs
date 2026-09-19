#!/usr/bin/env node
/**
 * tastecheck npm bin — trampoline to the bundled install.sh installer.
 *
 * The npm package ships the skill pack (skills/, commands/, skills.json) plus the
 * installer's preflight validator. This command runs that installer from wherever
 * the package is installed, so `npx tastecheck` links the 20 skills into agent
 * skill homes exactly like a git checkout does. All arguments are forwarded
 * verbatim (--force, --yes, --no-commands, --uninstall, -h/--help).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (process.argv[2] === "--version" || process.argv[2] === "-v") {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}

const child = spawn("bash", [join(pkgRoot, "install.sh"), ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error("tastecheck: the installer requires bash (unix-like systems).");
    process.exit(1);
  }
  throw err;
});

child.on("close", (code, sig) => {
  if (sig) process.kill(process.pid, sig);
  else process.exitCode = code ?? 1;
});
