#!/usr/bin/env node
// Parity test: install.sh (bash) vs bin/install.mjs (Node) must produce identical trees and exit codes.
import { spawnSync } from "node:child_process";
import {
  cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync, existsSync,
} from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runInstall, COPY_MARKER } from "../../bin/install.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url)).replace(/[\\/]$/, "");
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const temps = [];
const tmp = (p = "tastecheck-inst-") => { const d = mkdtempSync(join(tmpdir(), p)); temps.push(d); return d; };
const hasBash = process.platform !== "win32" && spawnSync("bash", ["--version"]).status === 0;

function makeHome(agentDirs = [".claude", ".codex"]) {
  const h = tmp();
  for (const d of agentDirs) mkdirSync(join(h, d), { recursive: true });
  return h;
}

function snapshot(home, repo) {
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n);
      const rel = relative(home, p).split("\\").join("/").replace(/\.backup\.\d{14}/, ".backup.TS");
      const st = lstatSync(p);
      if (st.isSymbolicLink()) out.push(`L ${rel} -> ${relative(repo, readlinkSync(p)).split("\\").join("/")}`);
      else if (st.isDirectory()) { out.push(`D ${rel}`); walk(p); }
      else out.push(`F ${rel} ${readFileSync(p, "utf8").length}`);
    }
  };
  walk(home);
  return out;
}

async function nodeRun(args, home, repo, stdinText = "") {
  let so = "", se = "";
  const { Readable } = await import("node:stream");
  const code = await runInstall(args, {
    home, repoRoot: repo,
    stdin: Readable.from(stdinText ? [stdinText] : []),
    stdout: { write: (s) => { so += s; } }, stderr: { write: (s) => { se += s; } },
  });
  return { code, so, se };
}
function bashRun(args, home, repo) {
  const r = spawnSync("bash", [join(repo, "install.sh"), ...args], {
    env: { ...process.env, HOME: home }, encoding: "utf8", input: "",
  });
  return { code: r.status, so: r.stdout, se: r.stderr };
}

// scenario: { name, agentDirs?, steps: [args...], setup?(home), repo? }
const realDirSetup = (home) => {
  mkdirSync(join(home, ".agents/skills/color-system"), { recursive: true });
  writeFileSync(join(home, ".agents/skills/color-system/mine.txt"), "mine");
};
const scenarios = [
  { name: "fresh --yes", steps: [["--yes"]] },
  { name: "idempotent re-run", steps: [["--yes"], ["--yes"]] },
  { name: "--no-commands", steps: [["--no-commands"]] },
  { name: "no agent homes", agentDirs: [], steps: [["--yes"]] },
  { name: "default (non-tty, empty stdin) skips commands", steps: [[]] },
  { name: "real dir without --force", setup: realDirSetup, steps: [["--yes"]] },
  { name: "real dir with --force", setup: realDirSetup, steps: [["--yes", "--force"]] },
  { name: "uninstall after install", steps: [["--yes"], ["--uninstall"]] },
  { name: "unknown flag", steps: [["--bogus"]] },
  { name: "help", steps: [["--help"]] },
  { name: "corrupted payload", corrupt: true, steps: [["--yes"]] },
];

function corruptedRepo() {
  const r = tmp("tastecheck-repo-");
  for (const e of ["skills", "commands", "tools/contracts", "skills.json", "install.sh"]) {
    mkdirSync(join(r, e, ".."), { recursive: true });
    cpSync(join(root, e), join(r, e), { recursive: true });
  }
  const f = join(r, "skills", readdirSync(join(r, "skills")).sort()[0], "SKILL.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(/^name:.*$/m, "name: wrong-name"));
  return r;
}

try {
  for (const sc of scenarios) {
    const repoNode = sc.corrupt ? corruptedRepo() : root;
    const hn = makeHome(sc.agentDirs);
    sc.setup?.(hn);
    const nodeCodes = [];
    for (const step of sc.steps) nodeCodes.push((await nodeRun(step, hn, repoNode)).code);
    const nodeTree = snapshot(hn, repoNode);

    if (sc.name === "fresh --yes") {
      check(nodeTree.some((l) => l.startsWith("L .agents/skills/")), "node: canonical skills not linked");
      check(nodeTree.some((l) => l.startsWith("L .codex/skills/")), "node: .codex not mirrored");
      check(!nodeTree.some((l) => l.startsWith(".gemini") || l.includes(" .gemini")), "node: absent .gemini was created");
      check(nodeTree.some((l) => l.startsWith("L .claude/commands/")), "node: commands not linked");
    }
    if (sc.name === "real dir without --force") {
      check(nodeCodes[0] !== 0, "node: real dir without --force should fail");
      check(readFileSync(join(hn, ".agents/skills/color-system/mine.txt"), "utf8") === "mine", "node: real dir was modified");
    }
    if (sc.name === "real dir with --force") {
      check(nodeTree.some((l) => l.includes("color-system.backup.TS")), "node: --force made no backup");
    }
    if (sc.name === "uninstall after install") {
      check(!nodeTree.some((l) => l.startsWith("L ")), "node: links remain after uninstall");
    }
    if (sc.name === "unknown flag") check(nodeCodes[0] === 2, `node: unknown flag exited ${nodeCodes[0]}`);
    if (sc.corrupt) {
      check(nodeCodes[0] !== 0, "node: corrupt payload should fail");
      check(!nodeTree.some((l) => /skills|commands/.test(l)), "node: corrupt payload had side effects");
    }

    if (!hasBash) continue;
    const repoBash = sc.corrupt ? repoNode : root;
    const hb = makeHome(sc.agentDirs);
    sc.setup?.(hb);
    const bashCodes = sc.steps.map((step) => bashRun(step, hb, repoBash).code);
    const bashTree = snapshot(hb, repoBash);
    check(JSON.stringify(bashCodes) === JSON.stringify(nodeCodes), `[${sc.name}] exit codes differ: bash ${bashCodes} vs node ${nodeCodes}`);
    check(JSON.stringify(bashTree) === JSON.stringify(nodeTree), `[${sc.name}] trees differ (bash ${bashTree.length} entries, node ${nodeTree.length})`);
  }

  // Node-only: copy fallback is marked and uninstall removes only own copies.
  {
    const h = makeHome();
    const r1 = await nodeRun(["--yes"], h, root);
    check(r1.code === 0, "copy-fallback: baseline install failed");
    await nodeRun(["--uninstall"], h, root);
    let so = "";
    const code = await runInstall(["--yes"], {
      home: h, repoRoot: root, stdin: null, forceCopy: true,
      stdout: { write: (s) => { so += s; } }, stderr: { write: () => {} },
    });
    check(code === 0, "copy-fallback: install failed");
    const cmdFile = join(h, ".claude/commands", readdirSync(join(root, "commands")).filter((f) => f.endsWith(".md")).sort()[0]);
    check(!lstatSync(cmdFile).isSymbolicLink() && readFileSync(cmdFile, "utf8").startsWith(COPY_MARKER), "copy-fallback: copy not marked");
    writeFileSync(join(h, ".claude/commands/user-own.md"), "user file");
    const un = await nodeRun(["--uninstall"], h, root);
    check(un.code === 0 && !existsSync(cmdFile), "copy-fallback: marked copy not removed on uninstall");
    check(existsSync(join(h, ".claude/commands/user-own.md")), "copy-fallback: uninstall removed a user's own file");
  }
} catch (e) {
  failures.push(`unexpected error: ${e.stack || e}`);
} finally {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`test-node-installer FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`test-node-installer ok (${scenarios.length} scenarios${hasBash ? ", bash parity" : ", bash unavailable: parity skipped"})`);
