#!/usr/bin/env node
/**
 * One-way projector for v1 contract declarations.
 *
 * JSON contracts are the authority. Generated blocks are deliberately compact:
 * domain prose stays in SKILL.md and interview detail stays in generated refs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSkillContract } from "./validate.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const args = process.argv.slice(2);
const writeOwned = args.includes("--write-owned");
const scope = args.find((a) => a.startsWith("--scope="))?.split("=")[1] ?? "all";
const ownedDomain = args.find((a) => a.startsWith("--domain="))?.split("=")[1];
const START = "<!-- contract:v1:start -->";
const END = "<!-- contract:v1:end -->";
const INTERVIEW_START = "<!-- interview-contract:v1:start -->";
const INTERVIEW_END = "<!-- interview-contract:v1:end -->";
const CANONICAL_EVIDENCE = ["status", "reason", "remediation", "evidence", "provenance"];

function loadJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function replaceBlock(existing, start, end, content) {
  const block = `${start}\n${content.trimEnd()}\n${end}`;
  const startIdx = existing.indexOf(start);
  const endIdx = existing.indexOf(end);
  if (startIdx === -1 || endIdx === -1) return `${existing.trimEnd()}\n\n${block}\n`;
  return `${existing.slice(0, startIdx)}${block}${existing.slice(endIdx + end.length)}`;
}

function sourceSummary(values) {
  const [first, ...rest] = values;
  return rest.length ? `${first} (+${rest.length} in contract.json)` : first;
}

function skillBlock(contract) {
  const receives = contract.handoff.receives_from.join(", ") || "none";
  const sends = contract.handoff.sends_to.join(", ") || "none";
  const evidence = contract.required_evidence_fields.map((field) => `\`${field}\``).join(", ");
  return `## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: ${sourceSummary(contract.trigger.positive)}; avoid: ${sourceSummary(contract.trigger.negative)}
- Exclude: ${sourceSummary(contract.exclusions)}
- Stop / handoff: ${sourceSummary(contract.stop_conditions)}; receives [${receives}] -> sends [${sends}]
- Output: ${contract.outputs.primary}
- Evidence: \`${contract.self_check_shape}\` with ${evidence}.`;
}

function greenfieldReference(contract) {
  const required = contract.dimensions.required.map((d) => `| ${d.id} | ${d.label} | ${d.question_group} | ${d.abstention_default} |`).join("\n");
  const optional = contract.dimensions.optional.map((d) => `| ${d.id} | ${d.label} | ${d.question_group} | ${d.abstention_default} |`).join("\n");
  return `# Interview contract (generated)

Canonical source: [\`contracts/v1/interviews/greenfield.json\`](../../../contracts/v1/interviews/greenfield.json). Edit the JSON, then re-project; do not hand-edit this file.

## Session rules

- Use **${contract.session_model.min_exchanges}–${contract.session_model.max_exchanges} exchanges**; batch dimensions when useful.
- Existing direction covering at least five core dimensions short-circuits to confirmation.
- Surface contradictions and confirm a resolution; never silently pick a side.
- Samples are case studies, not a menu. Derive a new system from the evidence.
- An unanswered dimension receives an evidence-dependent recommendation or explicit abstention; never resolve toward the mean or a fixed house style.

## Required dimensions

| ID | Dimension | Group | Abstention recommendation |
| --- | --- | --- | --- |
${required}

## Optional dimensions

| ID | Dimension | Group | Abstention recommendation |
| --- | --- | --- | --- |
${optional}

## Readiness and handoff

Ready means every required dimension is answered or explicitly abstained with its evidence basis and confirmation state. Emit the completed token artifact only after that state is recorded.`;
}

function brownfieldReference(contract) {
  return `# Interview contract (generated)

Canonical source: [\`contracts/v1/interviews/brownfield.json\`](../../../contracts/v1/interviews/brownfield.json). Edit the JSON, then re-project; do not hand-edit this file.

## State machine

${contract.state_machine.states.join(" → ")}

Every claim about the existing system is labeled **EVIDENCE** or **INFERRED**. Resume from the last completed state after interruption; re-read preserved signals before continuing.

## Questions and approval

- Ask at most **${contract.question_constraints.max_material_questions}** material questions; each names the unresolved dimension and why the answer changes implementation.
- If evidence is sufficient, proceed without questions and state the inference.
- Material redesign requires explicit approval before execution.

## Readiness artifact

Produce \`${contract.inferred_system_artifact.file}\` with evidence, inferences, preserved signals, readiness score, and proposed scope. Do not claim completion without verification evidence.`;
}

function interviewCommandBlock(type, contract) {
  const source = type === "greenfield"
    ? "../skills/design-system-interview/references/interview-contract.generated.md"
    : "../skills/improve-existing-website/references/interview-contract.generated.md";
  const label = type === "greenfield" ? "Greenfield interview" : "Brownfield inspection/interview";
  const detail = type === "greenfield"
    ? `Use ${contract.session_model.min_exchanges}–${contract.session_model.max_exchanges} exchanges; unresolved dimensions must be evidence-dependent recommendations or explicit abstentions.`
    : `Use the generated state machine; ask no more than ${contract.question_constraints.max_material_questions} material questions and require approval for material redesign.`;
  return `## ${label} contract (generated)

Canonical detail: [${source}](${source}). ${detail}`;
}

function addProjection(projections, file, block, domain) {
  projections.push({ file, block, domain });
}

const skillDirs = Object.keys(loadJson("skills.json").skills.reduce((acc, item) => ({ ...acc, [item.name]: true }), {})).sort();
const knownSkills = new Set(skillDirs);
const projections = [];
const driftErrors = [];

if (scope === "all" || scope === "skills") {
  for (const skill of skillDirs) {
    const relSkill = `skills/${skill}`;
    const contract = loadJson(`${relSkill}/contract.json`);
    const errors = validateSkillContract(contract, { knownSkills });
    if (errors.length) throw new Error(`${relSkill}/contract.json invalid:\n- ${errors.join("\n- ")}`);
    addProjection(projections, `${relSkill}/SKILL.md`, replaceBlock(readFileSync(join(root, `${relSkill}/SKILL.md`), "utf8"), START, END, skillBlock(contract)), "A");
  }
}

if (scope === "all" || scope === "commands") {
  const commands = loadJson("contracts/v1/commands.json");
  const dark = commands.commands.find((c) => c.command === "/darkmode");
  if (dark) addProjection(projections, "commands/darkmode.md", replaceBlock(readFileSync(join(root, "commands/darkmode.md"), "utf8"), START, END, `**/darkmode** is an alias for **/theming** (${dark.alias_note ?? "theming alias"}).\nUse [commands/theming.md](theming.md) for the canonical command.`), "A");
}

if (scope === "all" || scope === "interviews") {
  const greenfield = loadJson("contracts/v1/interviews/greenfield.json");
  const brownfield = loadJson("contracts/v1/interviews/brownfield.json");
  addProjection(projections, "skills/design-system-interview/references/interview-contract.generated.md", replaceBlock(existsSync(join(root, "skills/design-system-interview/references/interview-contract.generated.md")) ? readFileSync(join(root, "skills/design-system-interview/references/interview-contract.generated.md"), "utf8") : "", INTERVIEW_START, INTERVIEW_END, greenfieldReference(greenfield)), "A");
  addProjection(projections, "skills/improve-existing-website/references/interview-contract.generated.md", replaceBlock(existsSync(join(root, "skills/improve-existing-website/references/interview-contract.generated.md")) ? readFileSync(join(root, "skills/improve-existing-website/references/interview-contract.generated.md"), "utf8") : "", INTERVIEW_START, INTERVIEW_END, brownfieldReference(brownfield)), "A");
  addProjection(projections, "commands/designsystem.md", replaceBlock(readFileSync(join(root, "commands/designsystem.md"), "utf8"), START, END, interviewCommandBlock("greenfield", greenfield)), "A");
  addProjection(projections, "commands/improvesite.md", replaceBlock(readFileSync(join(root, "commands/improvesite.md"), "utf8"), START, END, interviewCommandBlock("brownfield", brownfield)), "A");
}

for (const projection of projections) {
  const filePath = join(root, projection.file);
  if (!existsSync(filePath)) {
    if (writeOwned && (!ownedDomain || projection.domain === ownedDomain)) {
      writeFileSync(filePath, projection.block, "utf8");
      console.log(`WROTE: ${projection.file}`);
    } else if (writeOwned) console.warn(`WARN: ${projection.file} does not exist; skipping write`);
    else driftErrors.push(`${projection.file}: file does not exist`);
    continue;
  }
  const existing = readFileSync(filePath, "utf8");
  if (existing === projection.block) {
    if (!writeOwned) console.log(`OK (no drift): ${projection.file}`);
    continue;
  }
  if (writeOwned && (!ownedDomain || projection.domain === ownedDomain)) {
    writeFileSync(filePath, projection.block, "utf8");
    console.log(`WROTE: ${projection.file}`);
  } else if (writeOwned) {
    console.warn(`SKIP (not owned by domain ${ownedDomain}): ${projection.file}`);
  } else {
    driftErrors.push(`${projection.file}: generated projection differs from canonical source`);
  }
}

if (!writeOwned && driftErrors.length) {
  console.error("Contract projection drift detected:");
  for (const error of driftErrors) console.error(`  - ${error}`);
  console.error("Run: node tools/contracts/project.mjs --write-owned --domain=A");
  process.exit(1);
}
if (!writeOwned) console.log("Contract projections: no drift");

export { CANONICAL_EVIDENCE, skillBlock, greenfieldReference, brownfieldReference };
