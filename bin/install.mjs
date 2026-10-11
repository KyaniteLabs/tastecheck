#!/usr/bin/env node
// tastecheck installer (Node port of install.sh). Dependency-free; works on macOS, Linux
// and Windows. Links skills into ~/.agents/skills and mirrors into existing agent homes.
import {
  lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync,
  symlinkSync, copyFileSync, writeFileSync, statSync, existsSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOMES = [".claude", ".codex", ".gemini", ".cursor", ".kilocode", ".kimi"];
export const COPY_MARKER = "<!-- tastecheck:installed-copy -->";

const USAGE = `Usage: tastecheck install [--force] [--yes|--no-commands] [--uninstall]

  --force        Move pre-existing real skill dirs/files aside before linking.
  --yes          Link Claude Code slash commands without prompting.
  --no-commands  Do not link Claude Code slash commands.
  --uninstall    Remove every symlink this installer created (links that point
                 into this repo) from all agent homes, then exit.

Notes on agent homes: skills are always linked into the canonical ~/.agents/skills/.
They are also mirrored into ~/.claude, ~/.codex, ~/.gemini, ~/.cursor, ~/.kilocode and
~/.kimi when those directories already exist — but whether an agent AUTO-LOADS from
its directory varies by agent and version. If yours doesn't, point it at the SKILL.md
files in ~/.agents/skills/ directly.
`;

const lstat = (p) => { try { return lstatSync(p); } catch { return null; } };
const exists = (p) => { try { statSync(p); return true; } catch { return false; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

// Normalise a link target for comparison (Windows junctions come back with \\?\ and a trailing slash).
function norm(p) {
  let s = String(p).replace(/^\\\\\?\\/, "");
  s = s.replace(/[\\/]+$/, "");
  return process.platform === "win32" ? s.replace(/\//g, "\\").toLowerCase() : s;
}
const samePath = (a, b) => norm(a) === norm(b);
const under = (target, dir) => {
  const t = norm(target), d = norm(dir);
  return t.startsWith(d + (process.platform === "win32" ? "\\" : "/"));
};

function readLinkSafe(p) { try { return readlinkSync(p); } catch { return null; } }
function isOurCopy(p) {
  const st = lstat(p);
  if (!st || !st.isFile()) return false;
  try { return readFileSync(p, "utf8").startsWith(COPY_MARKER); } catch { return false; }
}

function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

function readLine(stdin) {
  return new Promise((res) => {
    if (!stdin) return res(null);
    let buf = "";
    const done = (v) => { stdin.off("data", onData); stdin.off("end", onEnd); stdin.off("error", onEnd); stdin.pause?.(); res(v); };
    const onData = (c) => { buf += c; const i = buf.indexOf("\n"); if (i >= 0) done(buf.slice(0, i)); };
    const onEnd = () => done(buf.length ? buf : null);
    stdin.setEncoding?.("utf8");
    stdin.on("data", onData); stdin.on("end", onEnd); stdin.on("error", onEnd);
    stdin.resume?.();
  });
}

export function defaultHome() {
  if (process.env.HOME) return process.env.HOME;
  if (process.platform === "win32" && process.env.USERPROFILE) return process.env.USERPROFILE;
  return homedir();
}

export async function runInstall(argv = [], opts = {}) {
  const repo = resolve(opts.repoRoot ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
  const home = opts.home ?? defaultHome();
  const stdin = "stdin" in opts ? opts.stdin : process.stdin;
  const out = opts.stdout ?? process.stdout;
  const err = opts.stderr ?? process.stderr;
  const forceCopy = Boolean(opts.forceCopy); // test hook: behave as if file symlinks are denied
  const log = (s = "") => out.write(`${s}\n`);
  const elog = (s = "") => err.write(`${s}\n`);
  const skillsSrc = join(repo, "skills");
  const win = process.platform === "win32";

  let force = false, commands = "ask", uninstall = false;
  for (const a of argv) {
    if (a === "--force") force = true;
    else if (a === "--yes") commands = "yes";
    else if (a === "--no-commands") commands = "no";
    else if (a === "--uninstall") uninstall = true;
    else if (a === "-h" || a === "--help") { out.write(USAGE); return 0; }
    else { elog(`ERROR: unknown option: ${a}`); err.write(USAGE); return 2; }
  }

  // ---- uninstall ----
  if (uninstall) {
    let removed = 0;
    for (const h of [".agents", ...HOMES]) {
      const sk = join(home, h, "skills");
      if (!isDir(sk)) continue;
      for (const name of readdirSync(sk).sort()) {
        const p = join(sk, name);
        const st = lstat(p);
        if (!st || !st.isSymbolicLink()) continue;
        const t = readLinkSafe(p);
        if (t !== null && under(t, skillsSrc)) { rmSync(p, { force: true }); removed++; }
      }
    }
    const cmds = join(home, ".claude", "commands");
    if (isDir(cmds)) {
      for (const name of readdirSync(cmds).sort()) {
        if (!name.endsWith(".md")) continue;
        const p = join(cmds, name);
        const st = lstat(p);
        if (!st) continue;
        if (st.isSymbolicLink()) {
          const t = readLinkSafe(p);
          if (t !== null && under(t, join(repo, "commands"))) { rmSync(p, { force: true }); removed++; }
        } else if (isOurCopy(p)) { rmSync(p, { force: true }); removed++; }
      }
    }
    log(`Removed ${removed} tastecheck symlinks.`);
    return 0;
  }

  // ---- preflight ----
  let skills = [];
  try {
    skills = readdirSync(skillsSrc, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch { /* handled below */ }

  async function validateSkill(name, ctx) {
    const dir = join(skillsSrc, name);
    const skillFile = join(dir, "SKILL.md");
    const contractFile = join(dir, "contract.json");
    let ok = true;
    let text = "";
    const size = (p) => { try { return statSync(p).size; } catch { return 0; } };
    if (!isFile(skillFile) || size(skillFile) === 0) {
      elog(`ERROR: ${name} is missing a non-empty SKILL.md`); ok = false;
    } else {
      text = readFileSync(skillFile, "utf8");
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^name:[ \\t\\r\\f\\v]*${esc}[ \\t\\r\\f\\v]*$`, "m").test(text)) {
        elog(`ERROR: ${name} SKILL.md frontmatter name does not match the directory`); ok = false;
      }
    }
    if (!isFile(contractFile) || size(contractFile) === 0) {
      elog(`ERROR: ${name} is missing a non-empty contract.json`); ok = false;
    } else {
      let good = false;
      try {
        const contract = JSON.parse(readFileSync(contractFile, "utf8"));
        const errors = ctx.validate(contract, { knownSkills: ctx.known });
        good = contract.skill === name && errors.length === 0;
      } catch { good = false; }
      if (!good) { elog(`ERROR: ${name} contract.json is invalid, incomplete, or names a different skill`); ok = false; }
    }
    const refs = [...new Set((text.match(/(?:assets|references)\/[A-Za-z0-9._/-]+/g) || []))].sort();
    for (const ref of refs) {
      if (!isFile(join(dir, ref))) { elog(`ERROR: ${name} SKILL.md references missing ${ref}`); ok = false; }
    }
    return ok;
  }

  if (skills.length === 0) {
    elog(`ERROR: no skill directories found under ${skillsSrc}`);
    return 1;
  }
  const ctx = { validate: null, known: new Set() };
  try {
    const mod = await import(pathToFileURL(join(repo, "tools", "contracts", "validate.mjs")).href);
    ctx.validate = mod.validateSkillContract;
    const manifest = JSON.parse(readFileSync(join(repo, "skills.json"), "utf8"));
    ctx.known = new Set(manifest.skills.map(({ name }) => name));
  } catch { ctx.validate = () => ["validator unavailable"]; }
  let failures = false;
  for (const s of skills) if (!(await validateSkill(s, ctx))) failures = true;
  if (failures) {
    elog("ERROR: source preflight failed; no skill links were changed");
    return 1;
  }

  log("tastecheck installer");
  log(`repo: ${repo}`);
  log();

  // ---- linking ----
  class LinkError extends Error {}

  function makeLink(src, dest, isDirectory) {
    if (!isDirectory && forceCopy) return copyFallback(src, dest);
    try {
      if (win && isDirectory) symlinkSync(src, dest, "junction");
      else symlinkSync(src, dest, isDirectory ? "dir" : "file");
    } catch (e) {
      if (!isDirectory && win && (e.code === "EPERM" || e.code === "EACCES")) return copyFallback(src, dest);
      throw new LinkError(`ERROR: failed to link ${dest} -> ${src} (${e.code || e.message})`);
    }
    const st = lstat(dest);
    const t = st && st.isSymbolicLink() ? readLinkSafe(dest) : null;
    if (t === null || !samePath(t, src)) throw new LinkError(`ERROR: failed to link ${dest} -> ${src}`);
  }

  function copyFallback(src, dest) {
    const body = readFileSync(src, "utf8");
    writeFileSync(dest, `${COPY_MARKER}\n${body}`);
  }

  function linkSkill(src, dest, isDirectory = true) {
    let st = lstat(dest);
    if (st && !st.isSymbolicLink() && isOurCopy(dest)) { rmSync(dest, { force: true }); st = null; }
    if (st && !st.isSymbolicLink() && exists(dest)) {
      if (force) {
        const backup = `${dest}.backup.${stamp()}`;
        renameSync(dest, backup);
        log(`    moved existing ${basename(dest)} to ${backup}`);
      } else {
        throw new LinkError(`ERROR: ${dest} already exists and is not a symlink.\n       Move it aside, or rerun with --force to create a timestamped backup.`);
      }
    } else if (st && !st.isSymbolicLink()) {
      // non-symlink that stat() can't see (should not happen); treat as real file
      throw new LinkError(`ERROR: ${dest} already exists and is not a symlink.\n       Move it aside, or rerun with --force to create a timestamped backup.`);
    }
    st = lstat(dest);
    if (st && st.isSymbolicLink()) {
      const t = readLinkSafe(dest);
      if (t !== null && samePath(t, src) && exists(dest)) return; // already correct
      rmSync(dest, { force: true });
    }
    makeLink(src, dest, isDirectory);
  }

  function installHome(h) {
    const sk = join(home, h, "skills");
    mkdirSync(sk, { recursive: true });
    for (const s of skills) linkSkill(join(skillsSrc, s), join(sk, s), true);
    log(`  linked ${skills.length} skills into ~/${h}/skills/`);
  }

  try {
    installHome(".agents");
    let detected = false;
    for (const h of HOMES) {
      if (!isDir(join(home, h))) continue;
      installHome(h);
      detected = true;
    }
    if (!detected) {
      log("  No detected agent-specific home found (.claude/.codex/.gemini/.cursor/.kilocode/.kimi).");
      log("  Canonical skills are available at ~/.agents/skills/.");
    }

    if (isDir(join(home, ".claude"))) {
      if (commands === "ask") {
        if (stdin && stdin.isTTY) err.write("\nLink slash commands into ~/.claude/commands/ (Claude Code)? [y/N] ");
        const ans = await readLine(stdin);
        commands = ans !== null && /^[Yy]$/.test(ans) ? "yes" : "no";
      }
      if (commands === "yes") {
        const cdir = join(home, ".claude", "commands");
        mkdirSync(cdir, { recursive: true });
        const srcDir = join(repo, "commands");
        const files = readdirSync(srcDir).filter((f) => f.endsWith(".md")).sort();
        for (const f of files) linkSkill(join(srcDir, f), join(cdir, f), false);
        log(`  linked ${files.length} Claude Code slash commands into ~/.claude/commands/ (git pull updates them)`);
      }
    }
  } catch (e) {
    if (e instanceof LinkError) { elog(e.message); return 1; }
    elog(`ERROR: ${e.message}`);
    return 1;
  }

  log();
  log("Done. Canonical skills: ~/.agents/skills/");
  log("Verify: test -L ~/.agents/skills/theming && test -L ~/.agents/skills/web-typography");
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runInstall(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
