#!/usr/bin/env node
/**
 * tools/contracts/check-generated.mjs — drift detector for generated contract blocks.
 *
 * Regenerates all contract projections in memory and fails if any diverge
 * from what is currently on disk. The Integration owner runs this to validate
 * that domain owners projected correctly; it never writes domain-owned files.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSkillContract } from "./validate.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function contractFindings() {
  const skillsRoot = join(root, "skills");
  const skills = readdirSync(skillsRoot)
    .filter((name) => statSync(join(skillsRoot, name)).isDirectory())
    .sort();
  const known = new Set(skills);
  const findings = [];

  for (const skill of skills) {
    const path = join(skillsRoot, skill, "contract.json");
    if (!existsSync(path)) {
      findings.push(`${skill}: missing contract.json`);
      continue;
    }
    let contract;
    try {
      contract = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      findings.push(`${skill}: contract.json is not valid JSON: ${error.message}`);
      continue;
    }
    for (const error of validateSkillContract(contract, { knownSkills: known })) {
      findings.push(`${skill}: ${error}`);
    }
    if (contract.skill !== skill) findings.push(`${skill}: contract.skill must match directory name ${skill}`);
  }
  return findings;
}

const contractErrors = contractFindings();
if (contractErrors.length) {
  console.error(`check-generated: invalid contract inputs (${contractErrors.length} findings)`);
  for (const error of contractErrors) console.error(`- ${error}`);
  process.exit(1);
}

try {
  const result = execFileSync(process.execPath, [
    join(root, "tools/contracts/project.mjs"),
    "--scope=all",
  ], { encoding: "utf8", cwd: root, stdio: "pipe" });
  console.log(result.trim());
  console.log("check-generated: no byte-for-byte contract drift");
} catch (err) {
  console.error(err.stdout || "");
  console.error(err.stderr || "");
  console.error("check-generated: contract drift or invalid projection detected — domain owners must re-run project.mjs --write-owned");
  process.exit(1);
}
