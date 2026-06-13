#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const failures = [];

function fail(message) {
  failures.push(message);
}

function files(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === ".omx") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) files(path, exts, out);
    else if (exts.some((ext) => path.endsWith(ext))) out.push(path);
  }
  return out;
}

function rel(path) {
  return relative(root, path);
}

function assertSkillStructure() {
  const skillDirs = readdirSync(join(root, "skills"))
    .map((name) => join(root, "skills", name))
    .filter((path) => statSync(path).isDirectory())
    .sort();

  for (const dir of skillDirs) {
    const name = dir.split("/").pop();
    const skillPath = join(dir, "SKILL.md");
    const text = readFileSync(skillPath, "utf8");
    const frontmatterName = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = text.match(/^description:\s*>-\n([\s\S]*?)\n---/m)?.[1]
      ?.replace(/\n\s*/g, " ")
      ?.trim() ?? "";
    if (frontmatterName !== name) fail(`${rel(skillPath)} frontmatter name is ${frontmatterName}, expected ${name}`);
    if (!/^description:\s*>-/m.test(text)) fail(`${rel(skillPath)} missing folded description`);
    const words = description.split(/\s+/).filter(Boolean).length;
    if (words > 60) fail(`${rel(skillPath)} description is ${words} words; keep routing metadata <=60 words`);

    for (const match of text.matchAll(/(?:references|assets)\/[A-Za-z0-9._/-]+/g)) {
      const target = join(dir, match[0]);
      try {
        statSync(target);
      } catch {
        fail(`${rel(skillPath)} references missing ${match[0]}`);
      }
    }
  }

  const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
  const manifestNames = new Set(manifest.skills.map((s) => s.name));
  const dirNames = new Set(skillDirs.map((dir) => dir.split("/").pop()));
  for (const name of manifestNames) {
    if (!dirNames.has(name)) fail(`skills.json lists ${name} but skills/${name}/ does not exist`);
  }
  for (const name of dirNames) {
    if (!manifestNames.has(name)) fail(`skills/${name}/ exists but is not listed in skills.json`);
  }
}

function assertCommandTargets() {
  const skillNames = new Set(readdirSync(join(root, "skills")));
  for (const path of files(join(root, "commands"), [".md"])) {
    const text = readFileSync(path, "utf8");
    const target = text.match(/~\/\.agents\/skills\/([^/\s`]+)\/SKILL\.md/)?.[1];
    if (!target) fail(`${rel(path)} does not load a ~/.agents skill path`);
    else if (!skillNames.has(target)) fail(`${rel(path)} targets missing skill ${target}`);
  }
}

function assertInstallSmoke() {
  const home = mkdtempSync(join(tmpdir(), "tastecheck-home-"));
  try {
    execFileSync("mkdir", ["-p", join(home, ".claude")]);
    execFileSync(join(root, "install.sh"), ["--yes"], { env: { ...process.env, HOME: home }, stdio: "pipe" });

    for (const h of [".agents", ".claude"]) {
      for (const skill of ["theming", "web-typography", "data-viz", "improve-existing-website"]) {
        const dest = join(home, h, "skills", skill);
        try {
          const st = lstatSync(dest);
          if (!st.isSymbolicLink()) fail(`${h}/skills/${skill} is not a symlink`);
          if (readlinkSync(dest) !== join(root, "skills", skill)) fail(`${h}/skills/${skill} points to ${readlinkSync(dest)}`);
        } catch {
          fail(`${h}/skills/${skill} was not installed`);
        }
      }
    }

    try {
      statSync(join(home, ".claude", "commands", "improvesite.md"));
    } catch {
      fail("install.sh --yes did not copy improvesite.md into .claude/commands");
    }

    const noCommandHome = mkdtempSync(join(tmpdir(), "tastecheck-no-commands-"));
    execFileSync("mkdir", ["-p", join(noCommandHome, ".claude")]);
    execFileSync(join(root, "install.sh"), ["--no-commands"], { env: { ...process.env, HOME: noCommandHome }, stdio: "pipe" });
    const commandDir = join(noCommandHome, ".claude", "commands");
    if (existsSync(commandDir) && readdirSync(commandDir).some((name) => name.endsWith(".md"))) {
      fail("install.sh --no-commands still copied Claude command files");
    }
    rmSync(noCommandHome, { recursive: true, force: true });

    const forceHome = mkdtempSync(join(tmpdir(), "tastecheck-force-"));
    execFileSync("mkdir", ["-p", join(forceHome, ".agents", "skills", "theming")]);
    writeFileSync(join(forceHome, ".agents", "skills", "theming", "stale.txt"), "stale");
    execFileSync(join(root, "install.sh"), ["--force", "--no-commands"], { env: { ...process.env, HOME: forceHome }, stdio: "pipe" });
    const forcedDest = join(forceHome, ".agents", "skills", "theming");
    if (!lstatSync(forcedDest).isSymbolicLink() || readlinkSync(forcedDest) !== join(root, "skills", "theming")) {
      fail("install.sh --force did not replace stale theming directory with the correct symlink");
    }
    if (!readdirSync(join(forceHome, ".agents", "skills")).some((name) => /^theming\.backup\./.test(name))) {
      fail("install.sh --force did not keep a timestamped backup of the stale theming directory");
    }
    rmSync(forceHome, { recursive: true, force: true });

    const staleHome = mkdtempSync(join(tmpdir(), "tastecheck-stale-"));
    execFileSync("mkdir", ["-p", join(staleHome, ".codex", "skills", "deslop-ui")]);
    let failed = false;
    try {
      execFileSync(join(root, "install.sh"), ["--no-commands"], { env: { ...process.env, HOME: staleHome }, stdio: "pipe" });
    } catch {
      failed = true;
    }
    if (!failed) fail("install.sh did not fail on a pre-existing real skill directory");
    rmSync(staleHome, { recursive: true, force: true });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function assertNoBadClampMath() {
  const candidates = files(root, [".html", ".css", ".md"]);
  const bad = /clamp\([^)]*[^\s][+-][^\s][^)]*\)/g;
  for (const path of candidates) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(bad)) {
      fail(`${rel(path)} has unspaced clamp math: ${match[0].slice(0, 80)}`);
    }
  }
}

function assertLocalLinks() {
  const candidates = files(root, [".md", ".html"]);
  for (const path of candidates) {
    const text = readFileSync(path, "utf8");
    const dir = dirname(path);
    const links = [
      ...text.matchAll(/\[[^\]]+\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g),
      ...text.matchAll(/\b(?:href|src)=["'](?!https?:|mailto:|#|data:)([^"']+)["']/g)
    ];
    for (const [, href] of links) {
      if (href.startsWith("/")) continue;
      const target = join(dir, href.split("?")[0]);
      try {
        statSync(target);
      } catch {
        fail(`${rel(path)} links missing ${href}`);
      }
    }
  }
}

function assertLocalCssAssets() {
  const candidates = files(root, [".html", ".css", ".md"]);
  for (const path of candidates) {
    const text = readFileSync(path, "utf8");
    const dir = dirname(path);
    for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
      const href = match[2].trim();
      if (/^(?:https?:|data:|#)/i.test(href)) continue;
      if (href.startsWith("/")) continue;
      const target = join(dir, href.split(/[?#]/)[0]);
      try {
        statSync(target);
      } catch {
        fail(`${rel(path)} CSS url() missing ${href}`);
      }
    }
  }
}

function assertInlineHandlersParse() {
  const candidates = files(root, [".html"]);
  for (const path of candidates) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/\son[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      const handler = match[2];
      try {
        new Function("event", handler);
      } catch (error) {
        fail(`${rel(path)} has invalid inline handler syntax: ${error.message}`);
      }
    }
  }
}

function assertDemoInputsAreNamed() {
  for (const path of files(join(root, "demos"), [".html"])) {
    const text = readFileSync(path, "utf8");
    const labels = new Set([...text.matchAll(/<label[^>]*for=["']?([^"'\s>]+)["']?/gi)].map((m) => m[1]));
    for (const match of text.matchAll(/<input\b[^>]*>/gi)) {
      const tag = match[0];
      if (/type=["']?hidden/i.test(tag)) continue;
      const id = tag.match(/\bid=["']?([^"'\s>]+)/i)?.[1];
      const named = /\baria-label=|\baria-labelledby=/i.test(tag) || (id && labels.has(id));
      if (!named) fail(`${rel(path)} has unnamed input: ${tag}`);
    }
  }
}

function assertDataVizTablesCoverData() {
  const path = join(root, "skills", "data-viz", "assets", "chart-starter.html");
  const text = readFileSync(path, "utf8");
  const figureBlocks = [...text.matchAll(/<figure>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  figureBlocks.forEach((figure, index) => {
    const pointCount = [...figure.matchAll(/<polyline\b[^>]*points=["']([^"']+)["']/g)]
      .reduce((sum, [, points]) => sum + points.trim().split(/\s+/).filter(Boolean).length, 0);
    if (pointCount === 0) return;
    const rowCount = [...figure.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)]
      .reduce((sum, [tbody]) => sum + (tbody.match(/<tr\b/gi) || []).length, 0);
    if (rowCount < pointCount) fail(`${rel(path)} figure ${index + 1} has ${pointCount} plotted points but ${rowCount} table rows`);
  });
}

function assertNoStaleSkillAliases() {
  const candidates = files(join(root, "skills"), [".md"]);
  for (const path of candidates) {
    const text = readFileSync(path, "utf8");
    if (/(^|[^/])`dark-mode`|dark-mode\s*→|→\s*dark-mode/.test(text)) {
      fail(`${rel(path)} references stale dark-mode skill alias`);
    }
    if (/installed\s+assess-graphical-excellence|installed\s+\*\*`assess-graphical-excellence/.test(text)) {
      fail(`${rel(path)} assumes external data-viz skills are installed`);
    }
  }
}

function assertA11yAuditModernColorPath() {
  const path = join(root, "skills", "a11y-pass", "assets", "audit.js");
  const text = readFileSync(path, "utf8");
  try {
    new Function(text);
  } catch (error) {
    fail(`${rel(path)} has invalid JavaScript syntax: ${error.message}`);
  }
  if (/match\(\s*\/\\?\[\\?d/.test(text)) fail(`${rel(path)} still parses colors with numeric regex`);
  if (!/getImageData/.test(text)) fail(`${rel(path)} does not rasterize CSS colors before luminance`);
  if (/arguments\.callee/.test(text)) fail(`${rel(path)} still uses arguments.callee`);
}

function assertGateAuditParses() {
  const path = join(root, "skills", "tastecheck-pass", "assets", "gate-audit.js");
  const text = readFileSync(path, "utf8");
  try {
    new Function(text);
  } catch (error) {
    fail(`${rel(path)} has invalid JavaScript syntax: ${error.message}`);
  }
  if (!/getComputedStyle/.test(text)) fail(`${rel(path)} no longer audits computed style`);
  if (!/\[hidden\]/.test(text)) fail(`${rel(path)} lost the hidden-defeated-by-CSS check`);
  if (!/light DOM only/.test(text)) fail(`${rel(path)} lost the light-DOM scope caveat`);
}

assertSkillStructure();
assertCommandTargets();
assertInstallSmoke();
assertNoBadClampMath();
assertLocalLinks();
assertLocalCssAssets();
assertInlineHandlersParse();
assertDemoInputsAreNamed();
assertDataVizTablesCoverData();
assertNoStaleSkillAliases();
assertA11yAuditModernColorPath();
assertGateAuditParses();

if (failures.length) {
  console.error(`tastecheck verification failed (${failures.length})`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("tastecheck verification passed");
