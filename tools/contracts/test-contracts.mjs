#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSkillContract, CANONICAL_EVIDENCE } from "./validate.mjs";
import { skillBlock } from "./project.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const START = "<!-- contract:v1:start -->";
const END = "<!-- contract:v1:end -->";
const CONTRACT_BLOCK_MAX_TOKENS = 250;
const BYTES_PER_TOKEN = 4;
const skills = readdirSync(join(root, "skills")).filter((name) => statSync(join(root, "skills", name)).isDirectory()).sort();
const known = new Set(skills);
for (const skill of skills) {
  const contract = JSON.parse(readFileSync(join(root, "skills", skill, "contract.json"), "utf8"));
  const errors = validateSkillContract(contract, { knownSkills: known });
  if (errors.length) throw new Error(`${skill}: ${errors.join("; ")}`);
  if (JSON.stringify(contract.required_evidence_fields) !== JSON.stringify(CANONICAL_EVIDENCE)) throw new Error(`${skill}: evidence order drift`);
  const block = `${START}\n${skillBlock(contract)}\n${END}`;
  const tokens = Math.ceil(Buffer.byteLength(block, "utf8") / BYTES_PER_TOKEN);
  if (tokens > CONTRACT_BLOCK_MAX_TOKENS) throw new Error(`${skill}: generated contract block ${tokens} tokens exceeds ${CONTRACT_BLOCK_MAX_TOKENS}`);
}
for (const name of ["invalid-empty-boundaries.json", "invalid-evidence-shape.json"]) {
  const fixture = JSON.parse(readFileSync(join(root, "tools/contracts/fixtures", name), "utf8"));
  if (!validateSkillContract(fixture).length) throw new Error(`${name}: red fixture unexpectedly passed`);
}
console.log(`contract schema/adversarial tests passed (${skills.length} valid contracts, 2 red fixtures)`);
