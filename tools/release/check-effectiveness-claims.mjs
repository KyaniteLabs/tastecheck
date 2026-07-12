#!/usr/bin/env node
/** Fail closed on unsupported public claims of demonstrated effectiveness. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ROOT_FILES = ["README.md", "CHANGELOG.md", "llms.txt"];
const ROOT_DIRECTORIES = ["site", "docs", "skills"];
const TEXT_EXTENSIONS = /\.(?:html?|json|md|mdx|txt)$/i;
const EVIDENCE = String.raw`(?:validated|proven|measured|demonstrated|verified)`;
const OUTCOME = String.raw`(?:effectiveness|effective|improvements?|improved|lift|outperformance|better\s+outcomes?)`;
const CLAIMS = [
  new RegExp(String.raw`\b${EVIDENCE}\b[^.!?;\n]{0,120}\b${OUTCOME}\b|\b${OUTCOME}\b[^.!?;\n]{0,120}\b${EVIDENCE}\b`, "i"),
  /\b(?:tastecheck|the\s+(?:pack|toolkit|workflow)|this\s+(?:pack|toolkit|workflow)|these\s+skills?)\s+(?:is|are)\s+(?:the\s+)?(?:fix|solution|answer)\b/i,
  /\b(?:beats?|outperforms?|surpasses?)\s+(?:the\s+|an?\s+)?(?:AI\s+)?(?:baseline|average|alternatives?|competition|competitors?|other\s+(?:tools?|systems?|approaches?))\b/i,
  /\b(?:delivers?|produces?|creates?|drives?|yields?|ensures?|guarantees?)\b[^.!?;\n]{0,60}\b(?:better|superior|higher-quality|improved)\s+(?:outcomes?|results?|quality|designs?|websites?|interfaces?|output)\b/i,
];
const QUALIFIER = /\b(?:blocked|unsupported|unsubstantiated)\b|\bhistorical\s+failed\s+evidence\b|\bnot\s+(?:validated|proven|measured|demonstrated|verified)\b|\bdoes\s+not\s+(?:claim|show|demonstrate|establish|prove|validate)\b|\bcannot\s+(?:claim|show|demonstrate|establish|prove|validate)\b/i;

function collectFiles(root) {
  const files = ROOT_FILES.map((name) => join(root, name)).filter(existsSync);
  const visit = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && TEXT_EXTENSIONS.test(entry.name)) files.push(path);
    }
  };
  for (const name of ROOT_DIRECTORIES) visit(join(root, name));
  return files;
}

export function scanUnsupportedEffectivenessClaims(root = DEFAULT_ROOT) {
  const findings = [];
  for (const path of collectFiles(root)) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const clause of line.split(/[.!?;]+/)) {
        if (!CLAIMS.some((claim) => claim.test(clause)) || QUALIFIER.test(clause)) continue;
        findings.push({ path: relative(root, path).replaceAll("\\", "/"), line: index + 1, text: clause.trim() });
      }
    });
  }
  return findings;
}

function main() {
  const root = resolve(process.argv[2] ?? DEFAULT_ROOT);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`effectiveness claim scan blocked: repository root not found: ${root}`);
    process.exit(1);
  }
  const findings = scanUnsupportedEffectivenessClaims(root);
  if (findings.length) {
    console.error("effectiveness claim scan blocked");
    for (const finding of findings) {
      console.error(`- ${finding.path}:${finding.line}: unsupported effectiveness claim: ${finding.text}`);
    }
    process.exit(1);
  }
  console.log("effectiveness claim scan passed");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
