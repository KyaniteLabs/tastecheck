/**
 * tools/lib/skill-lint.mjs — library backing tools/lint-skills.mjs CLI.
 *
 * Key fix for P0-2: unknown backticked kebab-case tokens that LOOK like skill
 * names (not just known-stale ones) must now fail, not silently pass.
 * A token "looks like a skill name" when it is not in the canonical glossary
 * AND is not a known CSS/HTML property or utility class.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// External skills the pack may mention as OPTIONAL integrations.
export const EXTERNAL_OK = new Set([
  "assess-graphical-excellence",
  "render-tufte-chart",
  "orchestrate-tufte-vdqi",
]);

// Known-stale names that must never reappear.
export const KNOWN_STALE = new Set([
  "idiomatic-translation",
  "web-design-guidelines",
]);

// CSS/HTML and utility tokens that share kebab-case syntax with skill names
// but are NOT skill references. Adding here prevents false positives.
// Include common CSS pseudo-classes, properties, and HTML attribute tokens.
export const CSS_LIKE_EXEMPT = new Set([
  "focus-visible", "focus-within", "hover-state", "active-state",
  "border-box", "inline-flex", "inline-block", "grid-template",
  "gap-x", "gap-y", "font-size", "font-weight", "line-height",
  "flex-wrap", "flex-grow", "align-items", "justify-content",
  "scroll-behavior", "scroll-snap", "aspect-ratio", "object-fit",
  "overflow-x", "overflow-y", "white-space", "word-break",
  "box-shadow", "text-shadow", "letter-spacing", "text-transform",
  "background-color", "background-image", "border-radius",
  "prefers-reduced-motion", "prefers-color-scheme", "forced-colors",
  "high-contrast", "light-mode", "dark-mode",
  "aria-label", "aria-live", "aria-hidden", "aria-expanded",
  "role-based", "tab-index", "auto-fill", "auto-flow",
  "min-content", "max-content", "fit-content",
]);

export const CANONICAL_TOKEN_PATTERNS = [
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
  /^btn-[a-z-]+$/,
  /^brand-hue$/,
  /^density$|^elevation-style$/,
  /^stack-gap$/,
];

/**
 * Walk directory tree, collect files with given extensions.
 */
export function collectFiles(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collectFiles(path, exts, out);
    else if (exts.some((e) => path.endsWith(e))) out.push(path);
  }
  return out;
}

/**
 * Primary lint function. Returns array of findings: { level, file, message }.
 *
 * @param {string} root - Repo root path
 * @param {{ fixtureMode?: boolean }} opts
 */
export function lintSkills(root, opts = {}) {
  const findings = [];
  const rel = (p) => relative(root, p);

  const skillNames = readdirSync(join(root, "skills"))
    .filter((name) => statSync(join(root, "skills", name)).isDirectory())
    .sort();
  const skillSet = new Set(skillNames);

  // 1. Frontmatter sanity
  for (const name of skillNames) {
    const path = join(root, "skills", name, "SKILL.md");
    let text;
    try { text = readFileSync(path, "utf8"); } catch { findings.push({ level: "fail", file: rel(path), message: `SKILL.md not readable` }); continue; }
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() !== name) {
      findings.push({ level: "fail", file: rel(path), message: `frontmatter name does not match directory "${name}"` });
    }
    if (!/^description:\s*>-/m.test(fm)) {
      findings.push({ level: "fail", file: rel(path), message: "missing folded description (>-)" });
    }
  }

  // 2. Skill cross-references: backticked kebab-case tokens
  const kebab = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g;
  for (const path of collectFiles(join(root, "skills"), [".md"])) {
    const text = readFileSync(path, "utf8");
    for (const [, token] of text.matchAll(kebab)) {
      if (KNOWN_STALE.has(token)) {
        findings.push({ level: "fail", file: rel(path), message: `stale skill reference \`${token}\`` });
        continue;
      }
      if (skillSet.has(token) || EXTERNAL_OK.has(token) || CSS_LIKE_EXEMPT.has(token)) continue;

      // P0-2 fix: unknown skill-like tokens must now fail.
      // A token is "skill-like" when it:
      //   - is not a canonical CSS token (not in canonical patterns)
      //   - is not in the CSS_LIKE_EXEMPT allowlist
      //   - does not match a known utility/framework class pattern
      const looksLikeSkillName = !CANONICAL_TOKEN_PATTERNS.some((re) => re.test(token))
        && token.length > 3
        && !token.startsWith("btn-")
        && !/^(flex|grid|gap|col|row|sm|md|lg|xl|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|w-|h-|z-|sr-)/.test(token);

      if (looksLikeSkillName) {
        findings.push({
          level: "fail",
          file: rel(path),
          message: `unknown skill-like reference \`${token}\` — if this is an external skill, add it to EXTERNAL_OK; if it is a CSS/utility token, add it to CSS_LIKE_EXEMPT; if it names a skill that should exist, create it or rename to a current skill`,
        });
      }
    }
  }

  // 3. CSS custom property token glossary
  const tokenRe = /--([a-z][a-z0-9-]*)/g;
  const offenders = new Map();
  for (const path of collectFiles(join(root, "skills"), [".md", ".css", ".html", ".js"])) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(tokenRe)) {
      let token = match[1];
      const next = text[match.index + match[0].length] ?? "";
      if (next === "*" || next === "…" || token.endsWith("-")) continue;
      if (CANONICAL_TOKEN_PATTERNS.some((re) => re.test(token))) continue;
      if (!offenders.has(token)) offenders.set(token, new Set());
      offenders.get(token).add(rel(path));
    }
  }
  for (const [token, where] of [...offenders.entries()].sort()) {
    findings.push({
      level: "fail",
      file: [...where].join(", "),
      message: `token --${token} is not in the canonical glossary — rename it or extend the contract + this lint`,
    });
  }

  return { findings, skillCount: skillNames.length };
}
