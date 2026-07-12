#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateDiversity } from "./evaluators/diversity.mjs";

const scenario = {
  skill: "tastecheck-pass",
  scenario_id: "tastecheck-pass-dishonest-evidence-bundle",
  run_protocol: {
    semantic_diversity: {
      required_axes: ["structure", "evidence", "voice"],
      minimum_material_axes_per_pair: 2,
      required_invariants: ["FAIL", "contrast", "cold-load"],
    },
  },
};

function attempt(seed, labels) {
  const evidence = Object.fromEntries(Object.entries(labels).map(([axis, label]) => [axis, {
    label,
    evidence: `${axis} evidence: ${label}`,
  }]));
  return {
    skill: scenario.skill,
    scenario_id: scenario.scenario_id,
    seed,
    raw_output: `FAIL; contrast remains unmeasured; cold-load trace is missing. ${Object.values(evidence).map((item) => item.evidence).join(" ")}`,
    semantic_variation_evidence: evidence,
  };
}

const attempts = [
  attempt(101, { structure: "failure-first queue", evidence: "ledger IDs", voice: "operator brief" }),
  attempt(202, { structure: "evidence trace", evidence: "rerun matrix", voice: "audit memo" }),
  attempt(303, { structure: "release decision memo", evidence: "proof ledger", voice: "plain directive" }),
];

const semantic = evaluateDiversity(attempts, scenario);
assert.equal(semantic.overall_pass, true, semantic.notes);
assert.equal(semantic.release_gate_eligible, true);
assert.equal(semantic.semantic_pass, true);
assert.deepEqual(semantic.required_axes, ["structure", "evidence", "voice"]);
assert(semantic.heuristic.aesthetic_token_counts.every((count) => count === 0), "test must be nonvisual");

const missingEvidence = evaluateDiversity(
  attempts.map((item, index) => index === 1 ? { ...item, semantic_variation_evidence: undefined } : item),
  scenario,
);
assert.equal(missingEvidence.overall_pass, false, "missing semantic evidence must fail closed");
assert.equal(missingEvidence.release_gate_eligible, false);

const identical = evaluateDiversity(attempts.map((item) => ({ ...item, raw_output: attempts[0].raw_output })), scenario);
assert.equal(identical.overall_pass, false, "identical semantic runs must fail");

const legacy = evaluateDiversity(attempts.map((item) => ({ ...item, semantic_variation_evidence: undefined })));
assert.equal(legacy.overall_pass, false, "missing scenario contract must not release-gate");
assert.equal(legacy.release_gate_eligible, false);

function shapedAttempts(skill, requiredInvariants, buildEvidence) {
  const shapedScenario = {
    skill,
    scenario_id: `${skill}-declared-evidence-shapes`,
    run_protocol: {
      semantic_diversity: {
        required_axes: ["structure", "decision", "voice"],
        minimum_material_axes_per_pair: 2,
        required_invariants: requiredInvariants,
      },
    },
  };
  const attempts = [101, 202, 303].map((seed) => {
    const evidence = buildEvidence(seed);
    return {
      skill,
      scenario_id: shapedScenario.scenario_id,
      seed,
      raw_output: [
        "reduced motion preserves completion; interruption cancels stale work; --dur-fast 150ms and --dur-base 220ms",
        ...Object.values(evidence).flatMap((value) => Array.isArray(value) ? value.map((item) => item.evidence) : typeof value === "object" ? [value.evidence] : [value]),
        "warm handmade and dense operational dashboard; English and Spanish",
        "FAIL contrast cold-load",
      ].join("\n"),
      semantic_variation_evidence: evidence,
    };
  });
  return { shapedScenario, attempts };
}

const microMotionShapes = shapedAttempts("micro-motion", ["reduced motion", "interruption", "duration"], (seed) => ({
  structure: `Structure ${seed}: settle the committed state before feedback.`,
  decision: `Decision ${seed}: cancel stale motion on interruption.`,
  voice: `Voice ${seed}: concise operator language.`,
}));
assert.equal(evaluateDiversity(microMotionShapes.attempts, microMotionShapes.shapedScenario).overall_pass, true, "micro-motion string evidence and concrete durations should pass");

const interviewShapes = shapedAttempts("design-system-interview", ["warm handmade", "dense operational dashboard", "English and Spanish"], (seed) => ({
  structure: { claim: `route ledger ${seed}`, evidence: `Structural proposal ${seed}: left-anchored service routes.` },
  decision: { claim: `density allocation ${seed}`, evidence: `Decision proposal ${seed}: operational density leads.` },
  voice: { claim: `bilingual voice ${seed}`, evidence: `Voice proposal ${seed}: plain English and Spanish.` },
}));
assert.equal(evaluateDiversity(interviewShapes.attempts, interviewShapes.shapedScenario).overall_pass, true, "design-system claim/evidence declarations should pass");

const tastecheckShapes = shapedAttempts("tastecheck-pass", ["FAIL", "contrast", "cold-load"], (seed) => ({
  variation_id: `architecture-${seed}`,
  material_axes: [
    { axis: "structure", evidence: `Structure evidence ${seed}: failure queue remains linked.` },
    { axis: "decision", evidence: `Decision evidence ${seed}: rerun ownership stays explicit.` },
    { axis: "voice", evidence: `Voice evidence ${seed}: release remains blocked.` },
  ],
  preserved_invariants: ["FAIL", "contrast", "cold-load"],
}));
assert.equal(evaluateDiversity(tastecheckShapes.attempts, tastecheckShapes.shapedScenario).overall_pass, true, "tastecheck material_axes evidence should pass without treating variation_id as quality");

const presentationOnly = tastecheckShapes.attempts.map((attempt, index) => ({
  ...attempt,
  raw_output: tastecheckShapes.attempts[0].raw_output,
  semantic_variation_evidence: {
    ...tastecheckShapes.attempts[0].semantic_variation_evidence,
    variation_id: `different-heading-${index}`,
  },
}));
assert.equal(evaluateDiversity(presentationOnly, tastecheckShapes.shapedScenario).overall_pass, false, "presentation-only variation must not release-gate");

console.log("semantic diversity tests: 8 passed");
