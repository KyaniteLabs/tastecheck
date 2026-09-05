#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateSkillContract, CANONICAL_EVIDENCE } from "./validate.mjs";

const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
const root = resolve(rootArgument ? rootArgument.slice("--root=".length) : new URL("../..", import.meta.url).pathname);
const START = "<!-- contract:v1:start -->";
const END = "<!-- contract:v1:end -->";
const CONTRACT_BLOCK_MAX_TOKENS = 250;
const BYTES_PER_TOKEN = 4;
const skills = readdirSync(join(root, "skills")).filter((name) => statSync(join(root, "skills", name)).isDirectory()).sort();
const known = new Set(skills);
const failures = [];
const validContracts = [];

function report(skill, message) {
  failures.push(`${skill}: ${message}`);
}

function sourceSummary(values) {
  const [first, ...rest] = values;
  return rest.length ? `${first} (+${rest.length} in contract.json)` : first;
}

function skillBlock(contract) {
  const receives = contract.handoff.receives_from.join(", ") || "none";
  const sends = contract.handoff.sends_to.join(", ") || "none";
  const evidence = contract.required_evidence_fields.map((field) => `\`${field}\``).join(", ");
  return `## Contract (generated)\n\nCanonical detail: [contract.json](contract.json).\n\n- Route: ${sourceSummary(contract.trigger.positive)}; avoid: ${sourceSummary(contract.trigger.negative)}\n- Exclude: ${sourceSummary(contract.exclusions)}\n- Stop / handoff: ${sourceSummary(contract.stop_conditions)}; receives [${receives}] -> sends [${sends}]\n- Output: ${contract.outputs.primary}\n- Evidence: \`${contract.self_check_shape}\` with ${evidence}.`;
}

for (const skill of skills) {
  const contractPath = join(root, "skills", skill, "contract.json");
  if (!existsSync(contractPath)) {
    report(skill, "missing contract.json");
    continue;
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(contractPath, "utf8"));
  } catch (error) {
    report(skill, `contract.json is not valid JSON: ${error.message}`);
    continue;
  }

  const errors = validateSkillContract(contract, { knownSkills: known });
  for (const error of errors) report(skill, error);
  if (contract.skill !== skill) report(skill, `contract.skill must match directory name ${skill}`);
  if (errors.length || contract.skill !== skill) continue;

  if (JSON.stringify(contract.required_evidence_fields) !== JSON.stringify(CANONICAL_EVIDENCE)) {
    report(skill, "evidence order drift");
    continue;
  }

  const block = `${START}\n${skillBlock(contract)}\n${END}`;
  const tokens = Math.ceil(Buffer.byteLength(block, "utf8") / BYTES_PER_TOKEN);
  if (tokens > CONTRACT_BLOCK_MAX_TOKENS) {
    report(skill, `generated contract block ${tokens} tokens exceeds ${CONTRACT_BLOCK_MAX_TOKENS}`);
    continue;
  }
  validContracts.push(skill);
}

for (const name of ["invalid-empty-boundaries.json", "invalid-evidence-shape.json"]) {
  const fixturePath = join(root, "tools/contracts/fixtures", name);
  try {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    if (!validateSkillContract(fixture).length) report(name, "red fixture unexpectedly passed");
  } catch (error) {
    report(name, `fixture could not be validated: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`contract schema/adversarial tests failed (${failures.length} findings)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`contract schema/adversarial tests passed (${validContracts.length} valid contracts, 2 red fixtures)`);
