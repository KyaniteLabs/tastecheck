#!/usr/bin/env node
/**
 * Scenario-bound diversity evaluator.
 *
 * Pairwise token overlap and response-shape checks remain diagnostics. They
 * cannot release-gate a replay. A release decision requires a scenario
 * contract plus evidence-bound semantic variation declared by each attempt.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const EVALUATOR_MODEL = "gpt-5.6-luna";

function jaccardSimilarity(a, b) {
  const tokensA = new Set(a.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  const tokensB = new Set(b.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  const intersection = new Set([...tokensA].filter((token) => tokensB.has(token)));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 1;
  return intersection.size === 0 ? 0 : intersection.size / union.size;
}

function architectureSignature(output) {
  const kinds = [];
  let active = null;
  let tableHeader = null;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^#{1,4}\s/.test(line)) continue;
    const kind = /^\|/.test(line)
      ? "table"
      : /^\d+[.)]\s/.test(line)
        ? "ordered"
        : /^[-*+]\s/.test(line)
          ? "bullet"
          : /^```/.test(line)
            ? "code"
            : /^>\s/.test(line)
              ? "quote"
              : "prose";
    if (kind !== active) {
      kinds.push(kind);
      active = kind;
    }
    if (kind === "table" && !tableHeader && !/^\|\s*[-:| ]+\|?$/.test(line)) {
      tableHeader = line.toLowerCase().replace(/\s+/g, " ");
    }
  }
  return `${kinds.join(">")}|table:${tableHeader ?? "none"}`;
}

function sentenceAverage(output) {
  const sentences = output.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 10);
  if (sentences.length === 0) return 0;
  return sentences.reduce((sum, sentence) => sum + sentence.trim().split(/\s+/).length, 0) / sentences.length;
}

function heuristicDiagnostics(outputs) {
  const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => ({
    pair: `seed${i}_vs_seed${j}`,
    similarity: Number(jaccardSimilarity(outputs[i], outputs[j]).toFixed(4)),
  }));
  const architecture = outputs.map(architectureSignature);
  const sentenceAverages = outputs.map(sentenceAverage);
  const aestheticTokenCounts = outputs.map((output) => (
    output.match(/\b\d+px\b|#[0-9a-f]{3,6}\b|oklch|rem\b|radius|border|shadow|gradient|animation/gi) ?? []
  ).length);
  const axisResults = {
    structure: new Set(architecture).size === outputs.length,
    aesthetic: Math.max(...aestheticTokenCounts) - Math.min(...aestheticTokenCounts) > 2,
    voice: Math.max(...sentenceAverages) - Math.min(...sentenceAverages) > 3,
  };
  return {
    pairwise_similarity: pairs,
    max_pairwise_similarity: Math.max(...pairs.map((pair) => pair.similarity)),
    similarity_pass: Math.max(...pairs.map((pair) => pair.similarity)) < 0.75,
    architecture_signatures: architecture,
    sentence_average_lengths: sentenceAverages.map((value) => Number(value.toFixed(3))),
    aesthetic_token_counts: aestheticTokenCounts,
    axis_results: axisResults,
  };
}

function semanticContract(scenario) {
  return scenario?.semantic_diversity ?? scenario?.run_protocol?.semantic_diversity ?? null;
}

function containsEvidence(output, evidence) {
  return typeof evidence === "string" && evidence.trim().length > 0 && output.toLowerCase().includes(evidence.trim().toLowerCase());
}

function canonicalEvidence(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function derivedLabel(axis, evidence) {
  return `${axis}:${canonicalEvidence(evidence).toLowerCase()}`;
}

function normalizeAxisDeclaration(declaration, axis) {
  if (typeof declaration === "string") {
    const evidence = declaration.trim();
    return evidence ? { label: derivedLabel(axis, evidence), evidence, source_shape: "string-evidence" } : null;
  }
  if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) return null;
  const evidence = typeof declaration.evidence === "string" ? declaration.evidence.trim() : "";
  if (!evidence) return null;
  const explicitLabel = typeof declaration.label === "string" && declaration.label.trim()
    ? declaration.label.trim()
    : typeof declaration.claim === "string" && declaration.claim.trim()
      ? declaration.claim.trim()
      : null;
  return {
    label: explicitLabel ?? derivedLabel(axis, evidence),
    evidence,
    source_shape: explicitLabel ? "labeled-evidence" : "evidence-only",
  };
}

function axisDeclaration(attempt, axis) {
  const declared = attempt?.semantic_variation_evidence;
  const direct = normalizeAxisDeclaration(declared?.[axis], axis);
  if (direct) return direct;
  const material = Array.isArray(declared?.material_axes)
    ? declared.material_axes.find((item) => item?.axis === axis)
    : null;
  return normalizeAxisDeclaration(material, axis);
}

function matchesInvariant(output, invariant) {
  const token = String(invariant ?? "").trim();
  if (!token) return false;
  if (/^durations?$/.test(token.toLowerCase())) {
    return /\b\d+(?:\.\d+)?\s*(?:ms|s)\b/i.test(output);
  }
  return output.toLowerCase().includes(token.toLowerCase());
}

function semanticEvaluation(attempts, scenario, heuristic) {
  const contract = semanticContract(scenario);
  if (!contract || !Array.isArray(contract.required_axes) || contract.required_axes.length < 2) {
    return {
      eligible: false,
      pass: false,
      required_axes: [],
      axis_results: {},
      pair_results: [],
      invariant_results: [],
      notes: "No scenario-bound semantic diversity contract was supplied; heuristic diagnostics cannot release-gate.",
    };
  }

  const axes = contract.required_axes;
  const minimumAxes = Number.isInteger(contract.minimum_material_axes_per_pair)
    ? contract.minimum_material_axes_per_pair
    : Math.min(2, axes.length);
  const invariantResults = (contract.required_invariants ?? []).map((invariant) => ({
    invariant,
    pass: attempts.every((attempt) => typeof attempt.raw_output === "string" && matchesInvariant(attempt.raw_output, invariant)),
  }));
  const declarationsComplete = attempts.every((attempt) => axes.every((axis) => axisDeclaration(attempt, axis) !== null));
  const pairResults = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
    const changes = [];
    const errors = [];
    for (const axis of axes) {
      const left = axisDeclaration(attempts[i], axis);
      const right = axisDeclaration(attempts[j], axis);
      if (!left || !right) {
        errors.push(`${axis}: missing evidence declaration`);
        continue;
      }
      if (!containsEvidence(attempts[i].raw_output ?? "", left.evidence)) errors.push(`${axis}: seed${attempts[i].seed} evidence is not an exact output substring`);
      if (!containsEvidence(attempts[j].raw_output ?? "", right.evidence)) errors.push(`${axis}: seed${attempts[j].seed} evidence is not an exact output substring`);
      if (left.label !== right.label && left.evidence !== right.evidence) changes.push(axis);
    }
    return {
      pair: `seed${attempts[i].seed}_vs_seed${attempts[j].seed}`,
      material_axes: changes,
      pass: errors.length === 0 && changes.length >= minimumAxes,
      errors,
    };
  });
  const axisResults = Object.fromEntries(axes.map((axis) => {
    const labels = attempts.map((attempt) => axisDeclaration(attempt, axis)?.label).filter(Boolean);
    return [axis, labels.length === attempts.length && new Set(labels).size >= 2];
  }));
  const pass = declarationsComplete && invariantResults.every((item) => item.pass) && Object.values(axisResults).every(Boolean) && pairResults.every((pair) => pair.pass);
  return {
    eligible: declarationsComplete,
    pass,
    required_axes: axes,
    axis_results: axisResults,
    pair_results: pairResults,
    invariant_results: invariantResults,
    notes: pass ? null : "Semantic diversity failed one or more scenario-bound evidence or invariant checks.",
    heuristic,
  };
}

export function evaluateDiversity(attempts, scenario = null) {
  if (!Array.isArray(attempts) || attempts.length !== 3) {
    throw new Error(`Diversity evaluator requires exactly 3 attempts, got ${attempts?.length ?? "non-array"}`);
  }
  const outputs = attempts.map((attempt) => attempt.raw_output ?? "");
  const heuristic = heuristicDiagnostics(outputs);
  const semantic = semanticEvaluation(attempts, scenario, heuristic);
  const overallPass = semantic.eligible && semantic.pass;
  const pairIndexes = [[0, 1], [0, 2], [1, 2]];
  return {
    schema_version: 2,
    evaluator: "diversity",
    evaluator_model: EVALUATOR_MODEL,
    skill: attempts[0].skill,
    scenario_id: attempts[0].scenario_id,
    seeds: attempts.map((attempt) => attempt.requested_seed ?? attempt.seed ?? null),
    pairwise_similarity: heuristic.pairwise_similarity.map((pair, index) => ({
      pair: `seed${attempts[pairIndexes[index][0]].requested_seed ?? attempts[pairIndexes[index][0]].seed ?? pairIndexes[index][0]}_vs_seed${attempts[pairIndexes[index][1]].requested_seed ?? attempts[pairIndexes[index][1]].seed ?? pairIndexes[index][1]}`,
      similarity: pair.similarity,
    })),
    max_pairwise_similarity: heuristic.max_pairwise_similarity,
    similarity_pass: heuristic.similarity_pass,
    axis_results: semantic.eligible ? semantic.axis_results : heuristic.axis_results,
    axes_diverse_count: Object.values(semantic.eligible ? semantic.axis_results : heuristic.axis_results).filter(Boolean).length,
    required_axes: semantic.required_axes,
    semantic_pass: semantic.pass,
    release_gate_eligible: semantic.eligible,
    overall_pass: overallPass,
    verdict: overallPass ? "diverse" : "not-diverse",
    heuristic,
    semantic_pair_results: semantic.pair_results,
    invariant_results: semantic.invariant_results,
    notes: semantic.notes ?? (overallPass ? null : "Heuristic diagnostics are non-gating without a semantic scenario contract."),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const paths = process.argv.slice(2);
  if (paths.length !== 3) {
    console.error("Usage: node tools/evals/evaluators/diversity.mjs <seed101.json> <seed202.json> <seed303.json>");
    process.exit(1);
  }
  try {
    const attempts = paths.map((path) => JSON.parse(readFileSync(path, "utf8")));
    const result = evaluateDiversity(attempts);
    console.log(JSON.stringify(result, null, 2));
    if (!result.overall_pass) process.exit(1);
  } catch (error) {
    console.error("Cannot evaluate attempts:", error.message);
    process.exit(1);
  }
}
