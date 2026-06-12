#!/usr/bin/env node
// Skill lint — checks the CONTENT of the skill pack for the failure modes that
// static link checks miss: dead skill cross-references, tokens outside the canonical
// glossary, and frontmatter drift. Complements tools/verify.mjs (structure/links).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const findings = []; // {level: "fail"|"warn", file, message}

const skillNames = readdirSync(join(root, "skills"))
  .filter((name) => statSync(join(root, "skills", name)).isDirectory())
  .sort();

// External skills the pack may mention as OPTIONAL integrations.
const EXTERNAL_OK = new Set(["assess-graphical-excellence", "render-tufte-chart", "orchestrate-tufte-vdqi"]);
// Known-stale names that must never reappear.
const KNOWN_STALE = new Set(["idiomatic-translation", "web-design-guidelines"]);

// The canonical token glossary (design-system-interview/references/tokens.md).
const CANONICAL = [
  /^color-(bg|surface-[123]|text|text-muted|border|primary|primary-ink|primary-hover|accent|accent-ink|focus|success|error|warning|info)$/,
  /^(brand|neutral|accent)-\d{2,3}$/,
  /^font-(display|body|mono)$/,
  /^step--?\d$/,
  /^measure$/,
  /^space-(\d|section)$/,
  /^radius-(control|card|pill)$/,
  /^shadow-(card|float)$/,
  /^dur-(fast|base|slow)$/,
  /^ease-(out|in|in-out)$/,
  /^series-[1-6]$/,
  /^chart-(grid|label)$/,
  // structural/example-local tokens that are not part of the cross-skill contract
  /^btn-[a-z-]+$/,            // component tier (allowed third tier)
  /^brand-hue$/,              // parameterized example in starters
  /^density$|^elevation-style$/, // interview emit block descriptors
  /^stack-gap$/,              // layout pattern-local
];

function files(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, exts, out);
    else if (exts.some((e) => path.endsWith(e))) out.push(path);
  }
  return out;
}

function rel(p) { return relative(root, p); }

// 1. Frontmatter sanity (name matches dir, folded description).
for (const name of skillNames) {
  const path = join(root, "skills", name, "SKILL.md");
  const text = readFileSync(path, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  if (fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() !== name) {
    findings.push({ level: "fail", file: rel(path), message: `frontmatter name does not match directory "${name}"` });
  }
  if (!/^description:\s*>-/m.test(fm)) {
    findings.push({ level: "fail", file: rel(path), message: "missing folded description (>-)" });
  }
}

// 2. Skill cross-references: backticked kebab-case tokens that name skills must exist.
const kebab = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g;
for (const path of files(join(root, "skills"), [".md"])) {
  const text = readFileSync(path, "utf8");
  for (const [, token] of text.matchAll(kebab)) {
    if (KNOWN_STALE.has(token)) {
      findings.push({ level: "fail", file: rel(path), message: `stale skill reference \`${token}\`` });
      continue;
    }
    // Only treat as a skill ref if it matches a real/external skill name or LOOKS like
    // one we'd expect (avoid flagging CSS terms like `focus-visible`).
    if (skillNames.includes(token) || EXTERNAL_OK.has(token)) continue;
  }
}

// 3. Token glossary: every CSS custom property used in skills/ must be canonical.
const tokenRe = /--([a-z][a-z0-9-]*)/g;
const offenders = new Map();
for (const path of files(join(root, "skills"), [".md", ".css", ".html", ".js"])) {
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(tokenRe)) {
    let token = match[1];
    const next = text[match.index + match[0].length] ?? "";
    // Prose wildcards/ellipses ("--space-*", "--step-1…--step-5") aren't tokens.
    if (next === "*" || next === "…" || token.endsWith("-")) continue;
    if (CANONICAL.some((re) => re.test(token))) continue;
    if (!offenders.has(token)) offenders.set(token, new Set());
    offenders.get(token).add(rel(path));
  }
}
for (const [token, where] of [...offenders.entries()].sort()) {
  findings.push({
    level: "fail",
    file: [...where].join(", "),
    message: `token --${token} is not in the canonical glossary (design-system-interview/references/tokens.md) — rename it or extend the contract + this lint`,
  });
}

// Report.
const fails = findings.filter((f) => f.level === "fail");
const warns = findings.filter((f) => f.level === "warn");
for (const f of fails) console.error(`✗ ${f.message}\n    ${f.file}`);
for (const f of warns) console.warn(`⚠ ${f.message}\n    ${f.file}`);
console.log(`skill lint: ${skillNames.length} skills, ${fails.length} failures, ${warns.length} warnings`);
if (fails.length) process.exit(1);
