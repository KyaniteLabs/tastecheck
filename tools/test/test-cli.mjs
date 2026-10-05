#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const bin = join(root, "bin/tastecheck.mjs");
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

function cli(args, home) {
  return spawnSync(process.execPath, [bin, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: "utf8",
  });
}

const temps = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "tastecheck-cli-")); temps.push(d); return d; };

try {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  for (const a of [[], ["help"], ["-h"], ["--help"]]) {
    const home = tmp();
    const r = cli(a, home);
    check(r.status === 0, `tastecheck ${a.join(" ")} exited ${r.status}, expected 0`);
    check(/Usage:/.test(r.stdout) && /install/.test(r.stdout) && /audit/.test(r.stdout), `tastecheck ${a.join(" ")} did not print usage`);
    check(!existsSync(join(home, ".agents")), `tastecheck ${a.join(" ")} mutated HOME (.agents created)`);
  }

  const v = cli(["--version"], tmp());
  check(v.status === 0 && v.stdout.trim() === pkg.version, `--version printed "${v.stdout.trim()}", expected ${pkg.version}`);

  const a = cli(["audit"], tmp());
  check(a.status === 2, `audit with no target exited ${a.status}, expected 2`);
  check(/Usage: tastecheck audit/.test(a.stderr), "audit with no target did not print usage");

  const u = cli(["frobnicate"], tmp());
  check(u.status === 2, `unknown subcommand exited ${u.status}, expected 2`);
  check(/unknown command/.test(u.stderr) && /Usage:/.test(u.stderr), "unknown subcommand did not print error + usage");

  const home = tmp();
  const i = cli(["install", "--yes"], home);
  check(i.status === 0, `install --yes exited ${i.status}: ${i.stderr}`);
  try {
    check(lstatSync(join(home, ".agents/skills/theming")).isSymbolicLink(), "install --yes did not create ~/.agents/skills/theming symlink");
  } catch {
    check(false, "install --yes did not create ~/.agents/skills/theming");
  }

  const un = cli(["uninstall"], home);
  check(un.status === 0, `uninstall exited ${un.status}: ${un.stderr}`);
  check(!existsSync(join(home, ".agents/skills/theming")), "uninstall left ~/.agents/skills/theming behind");

  const legacyHome = tmp();
  const l = cli(["--no-commands"], legacyHome);
  check(l.status === 0 && /deprecated/.test(l.stderr), "legacy bare --no-commands should still install and warn on stderr");
} finally {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
}

if (failures.length) {
  console.error("test-cli FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("test-cli: ok");
