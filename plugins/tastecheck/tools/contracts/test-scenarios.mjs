#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const allFiles = readdirSync(join(root, "evals/scenarios")).filter((name) => name.endsWith(".json")).sort();
const replayManifests = allFiles.filter((name) => {
  const artifact = JSON.parse(readFileSync(join(root, "evals/scenarios", name), "utf8"));
  return artifact.kind === "smallest-honest-remediation-replay";
});
if (replayManifests.length !== 1 || replayManifests[0] !== "remediation7-replay.json") {
  throw new Error(`expected one immutable remediation replay manifest, found ${replayManifests.join(", ") || "none"}`);
}
const files = allFiles.filter((name) => !replayManifests.includes(name));
if (files.length !== 21) throw new Error(`expected 21 scenarios, found ${files.length}`);
const skillScenarios = new Set();
const W1_REMEDIATION = {
  "component-states.json": ["lifecycle_depth_requirement", "thin_ledger_rejection"],
  "deslop-ui.json": ["repair_depth_requirement", "thin_ledger_rejection"],
  "tastecheck-pass.json": ["report_depth_requirement", "thin_ledger_rejection"],
};
const NARROW_V4_REQUIRED_EVIDENCE = {
  "micro-motion.json": [/stale N as success and error/i, /Insertion replay/i, /Destructive-confirmation replay/i, /Route replay/i, /Global safety replay/i],
  "spacing-system.json": [/4–96px primitive ladder/i, /six semantic relationships/i, /13\/17\/19\/bare-24 migration/i, /Authoritative self-check/i, /responsive-layout rejection/i, /application map.*relationship.*token.*dispatcher.*editorial.*layout ownership/i, /8\/16\/24.*gap.*margin-block-start.*1em/i],
};
for (const name of files) {
  const scenario = JSON.parse(readFileSync(join(root, "evals/scenarios", name), "utf8"));
  if (!Array.isArray(scenario.assertions) || scenario.assertions.length < 5) throw new Error(`${name}: too few assertions`);
  if (!scenario.routing?.positive || !scenario.routing?.negative_neighbor || !scenario.routing?.handoff) throw new Error(`${name}: explicit routing contract missing`);
  if (!scenario.run_protocol?.material_difference_requirement) throw new Error(`${name}: material diversity requirement missing`);
  if (!scenario.run_protocol?.negative_routing_requirement) throw new Error(`${name}: negative routing requirement missing`);
  const requiredRemediation = W1_REMEDIATION[name];
  if (requiredRemediation) {
    for (const key of requiredRemediation) {
      if (!scenario.run_protocol?.[key]) throw new Error(`${name}: W1 remediation requirement missing: ${key}`);
    }
    if (!scenario.assertions.some((assertion) => /thin ledger|heading-only|cosmetic/i.test(assertion))) {
      throw new Error(`${name}: must reject thin-ledger or cosmetic-heading variation`);
    }
  }
  const requiredEvidence = NARROW_V4_REQUIRED_EVIDENCE[name];
  if (requiredEvidence) {
    if (!Array.isArray(scenario.required_evidence)) throw new Error(`${name}: narrow v4 required evidence missing`);
    for (const requirement of requiredEvidence) {
      if (!scenario.required_evidence.some((entry) => requirement.test(entry))) throw new Error(`${name}: narrow v4 required evidence missing ${requirement}`);
    }
  }
  if (name === "spacing-system.json" && !scenario.assertions.some((assertion) => /visible role and step.*fail/i.test(assertion))) {
    throw new Error(`${name}: thin role-and-step map must be rejected`);
  }
  if (name !== "cross-skill.json") skillScenarios.add(scenario.skill);
}
if (skillScenarios.size !== 20) throw new Error(`expected 20 skill scenarios, found ${skillScenarios.size}`);
console.log(`scenario assertion tests passed (21 scenarios, ${skillScenarios.size} skills)`);
