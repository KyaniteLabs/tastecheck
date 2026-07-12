#!/usr/bin/env node
/**
 * tools/evals/context-budget.mjs — context and portability budget checker.
 *
 * Measures byte/line/estimated-token budgets for each skill against the frozen baseline.
 * Fails if any skill exceeds absolute caps or grows by more than the relative cap.
 *
 * Budget limits (from test spec):
 *   - SKILL.md: <=5,000 estimated tokens; <=15% growth per skill vs baseline
 *   - Resources per task: <=6,000 additional tokens, <=3 files
 *   - Full pipeline: <=40,000 cumulative tokens; <=20% over baseline
 *   - Generated contract block: <=250 tokens per skill
 *
 * Token estimation: 1 token ≈ 4 bytes (rough heuristic, no tokenizer dependency)
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

const SKILL_MD_MAX_TOKENS = 5000;
const SKILL_MD_GROWTH_LIMIT = 0.15;
const CONTRACT_BLOCK_MAX_TOKENS = 250;
const BYTES_PER_TOKEN = 4;

function estimateTokens(bytes) {
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

const baselineManifestPath = join(root, ".omx/evidence/tastecheck-v1/baseline/v0.1.0/manifest.json");
const baselineExists = existsSync(baselineManifestPath);
let baselineEntries = new Map();

if (baselineExists) {
  const manifest = JSON.parse(readFileSync(baselineManifestPath, "utf8"));
  for (const entry of manifest.entries) {
    baselineEntries.set(entry.path, { size: entry.size });
  }
}

const skillDirs = readdirSync(join(root, "skills"))
  .filter((name) => statSync(join(root, "skills", name)).isDirectory())
  .sort();

const findings = [];
const report = { schema_version: 1, skills: [], overall_pass: true };

const START_MARKER = "<!-- contract:v1:start -->";
const END_MARKER = "<!-- contract:v1:end -->";

for (const skill of skillDirs) {
  const skillMdPath = join(root, "skills", skill, "SKILL.md");
  const relPath = `skills/${skill}/SKILL.md`;
  const body = readFileSync(skillMdPath, "utf8");
  const currentBytes = Buffer.byteLength(body, "utf8");
  const currentTokens = estimateTokens(currentBytes);

  const baselineEntry = baselineEntries.get(relPath);
  const baselineTokens = baselineEntry ? estimateTokens(baselineEntry.size) : null;

  const contractStartIdx = body.indexOf(START_MARKER);
  const contractEndIdx = body.indexOf(END_MARKER);
  let contractTokens = 0;
  if (contractStartIdx !== -1 && contractEndIdx !== -1) {
    const block = body.slice(contractStartIdx, contractEndIdx + END_MARKER.length);
    contractTokens = estimateTokens(Buffer.byteLength(block, "utf8"));
  }

  const skillReport = {
    skill,
    skill_md_bytes: currentBytes,
    skill_md_tokens: currentTokens,
    baseline_tokens: baselineTokens,
    contract_block_tokens: contractTokens,
    checks: {},
  };

  // Absolute cap
  skillReport.checks.within_absolute_cap = currentTokens <= SKILL_MD_MAX_TOKENS;
  if (!skillReport.checks.within_absolute_cap) {
    findings.push(`FAIL: ${skill}/SKILL.md: ${currentTokens} tokens exceeds ${SKILL_MD_MAX_TOKENS} cap`);
  }

  // Growth check vs baseline
  if (baselineTokens !== null) {
    const growthRatio = (currentTokens - baselineTokens) / Math.max(baselineTokens, 1);
    skillReport.growth_ratio = parseFloat(growthRatio.toFixed(3));
    skillReport.checks.within_growth_cap = growthRatio <= SKILL_MD_GROWTH_LIMIT
      || currentTokens <= baselineTokens; // growing below baseline is always fine
    if (!skillReport.checks.within_growth_cap) {
      findings.push(`FAIL: ${skill}/SKILL.md: grew ${Math.round(growthRatio * 100)}% (limit ${Math.round(SKILL_MD_GROWTH_LIMIT * 100)}%)`);
    }
  }

  // Contract block cap
  if (contractTokens > 0) {
    skillReport.checks.contract_block_within_cap = contractTokens <= CONTRACT_BLOCK_MAX_TOKENS;
    if (!skillReport.checks.contract_block_within_cap) {
      findings.push(`FAIL: ${skill}/SKILL.md: contract block ${contractTokens} tokens exceeds ${CONTRACT_BLOCK_MAX_TOKENS} cap`);
    }
  }

  const skillPass = Object.values(skillReport.checks).every(Boolean);
  skillReport.pass = skillPass;
  if (!skillPass) report.overall_pass = false;
  report.skills.push(skillReport);
}

const receiptsDir = join(root, "evals/receipts/v1");
mkdirSync(receiptsDir, { recursive: true });
writeFileSync(join(receiptsDir, "context-budget.json"), JSON.stringify(report, null, 2));

for (const f of findings) console.error(f);
if (findings.length === 0) {
  console.log(`context-budget: ${skillDirs.length} skills, all within caps`);
} else {
  console.error(`context-budget: ${findings.length} violations`);
  process.exit(1);
}
