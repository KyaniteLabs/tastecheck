#!/usr/bin/env node
/**
 * tastecheck npm bin — trampoline to the bundled install.sh installer.
 *
 * The npm package ships the skill pack (skills/, commands/, skills.json) plus the
 * installer's preflight validator. This command runs that installer from wherever
 * the package is installed, so `npx tastecheck` links the 20 skills into agent
 * skill homes exactly like a git checkout does. All arguments are forwarded
 * verbatim (--force, --yes, --no-commands, --uninstall, -h/--help).
 *
 * Exception: `tastecheck calibrate` runs the labeled regression corpus against
 * the checker and emits measured FP/FN rates. The corpus and runner are
 * repository tooling (not shipped inside the npm tarball), so the subcommand
 * forwards to the repo checkout when present and explains the boundary
 * honestly when it is not.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (process.argv[2] === "--version" || process.argv[2] === "-v") {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}

if (process.argv[2] === "calibrate") {
  const runner = join(pkgRoot, "tools/calibrate/run-calibration.mjs");
  if (!existsSync(runner)) {
    console.error("tastecheck calibrate: the calibration corpus and runner are repository tooling,");
    console.error("not part of the npm package. Run `npm run calibrate` inside a tastecheck checkout");
    console.error("(see evals/corpus/CORPUS.md for the corpus law).");
    process.exit(1);
  }
  const child = spawn(process.execPath, [runner, ...process.argv.slice(3)], { stdio: "inherit" });
  child.on("close", (code, sig) => {
    if (sig) process.kill(process.pid, sig);
    else process.exitCode = code ?? 1;
  });
} else {
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
}
