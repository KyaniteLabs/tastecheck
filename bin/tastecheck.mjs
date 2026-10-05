#!/usr/bin/env node
/**
 * tastecheck npm bin.
 *
 * Subcommands:
 *   install [--force] [--yes|--no-commands]   link the skills into agent homes (runs install.sh)
 *   uninstall                                 remove links created by install
 *   audit <url-or-path> [out-dir] [--json]    run the browser ship gate (cdp-qa.mjs)
 *   calibrate                                 run the labeled regression corpus (repo checkout only)
 *   --version
 *
 * With no arguments this prints usage and changes nothing.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const cmd = args[0];

const USAGE = `tastecheck - frontend taste + ship-gate skill pack for AI coding agents

Usage:
  tastecheck install [--force] [--yes | --no-commands]
                              Link the skills into ~/.agents/skills (and any agent homes
                              that exist). --yes also links Claude Code slash commands;
                              --no-commands skips them. Needs bash (WSL or Git Bash on Windows).
  tastecheck uninstall        Remove every link the installer created.
  tastecheck audit <url-or-path> [out-dir] [--json]
                              Run the browser ship gate against a URL or local file/dir.
                              Exit codes: 0 SHIP, 1 HOLD, 2 tool error. Needs Node 22+
                              and a Chromium/Chrome install.
  tastecheck calibrate        Measure checker FP/FN rates (needs a repository checkout).
  tastecheck --version
  tastecheck help

Running tastecheck with no arguments only prints this help.
`;

const INSTALL_FLAGS = new Set(["--force", "--yes", "--no-commands", "--uninstall"]);

function run(command, argv) {
  const child = spawn(command, argv, { stdio: "inherit" });
  child.on("error", (err) => {
    if (err.code === "ENOENT" && command === "bash") {
      console.error("tastecheck: the installer requires bash. On Windows, run it from WSL or Git Bash.");
      process.exit(1);
    }
    console.error(`tastecheck: failed to start ${command}: ${err.message}`);
    process.exit(2);
  });
  child.on("close", (code, sig) => {
    if (sig) process.kill(process.pid, sig);
    else process.exitCode = code ?? 1;
  });
}

const installer = (extra) => run("bash", [join(pkgRoot, "install.sh"), ...extra]);

if (cmd === undefined || cmd === "help" || cmd === "-h" || cmd === "--help") {
  process.stdout.write(USAGE);
} else if (cmd === "--version" || cmd === "-v") {
  console.log(JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version);
} else if (cmd === "install") {
  installer(args.slice(1));
} else if (cmd === "uninstall") {
  installer(["--uninstall", ...args.slice(1)]);
} else if (INSTALL_FLAGS.has(cmd)) {
  console.error(`tastecheck: bare \`${cmd}\` is deprecated; use \`tastecheck install ...\` (or \`tastecheck uninstall\`).`);
  installer(args);
} else if (cmd === "audit") {
  const rest = args.slice(1);
  if (!rest.some((a) => !a.startsWith("--"))) {
    console.error("tastecheck audit: missing <url-or-path>.\n");
    console.error("Usage: tastecheck audit <url-or-path> [out-dir] [--json]");
    process.exit(2);
  }
  run(process.execPath, [join(pkgRoot, "skills/tastecheck-pass/assets/cdp-qa.mjs"), ...rest]);
} else if (cmd === "calibrate") {
  const runner = join(pkgRoot, "tools/calibrate/run-calibration.mjs");
  if (!existsSync(runner)) {
    console.error("tastecheck calibrate: the calibration corpus and runner are repository tooling,");
    console.error("not part of the npm package. Run `npm run calibrate` inside a tastecheck checkout");
    console.error("(see evals/corpus/CORPUS.md for the corpus law).");
    process.exit(1);
  }
  run(process.execPath, [runner, ...args.slice(1)]);
} else {
  console.error(`tastecheck: unknown command: ${cmd}\n`);
  console.error(USAGE);
  process.exit(2);
}
