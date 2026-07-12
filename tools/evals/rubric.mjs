#!/usr/bin/env node
/**
 * tools/evals/rubric.mjs — anchored rubric and calibration for corpus evaluation.
 * Importable library AND standalone CLI (guarded by isMain check at bottom).
 *
 * Provides:
 *   - Anchored 1-5 scale definitions for all seven rubric dimensions
 *   - Six-item calibration set (one each: obvious regression, superficial rewrite, true lift,
 *     incoherent novelty, diagnostic disagreement, deterministic-gate case)
 *   - Calibration validator: >=5/6 correct classifications, <=1 scale-point MAE against anchors
 *   - Anti-slop heuristics for structural/phrase/aesthetic concentration checks
 *
 * Usage:
 *   node tools/evals/rubric.mjs                   # print rubric reference
 *   node tools/evals/rubric.mjs --calibration      # print calibration set
 *   node tools/evals/rubric.mjs --validate <file>  # validate a calibration result JSON file
 *   node tools/evals/rubric.mjs --anti-slop <file> # run anti-slop checks on an output file
 *
 * Or import rubric definitions directly:
 *   import { RUBRIC, validateCalibration, antiSlopChecks } from "./rubric.mjs";
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Anchored 1-5 rubric dimensions
export const RUBRIC = {
  version: "v1",
  dimensions: {
    brief_fit: {
      label: "Brief fit",
      description: "Output addresses the specific product context, constraints, and requirements in the brief.",
      anchors: {
        1: "Ignores the brief; generic advice that applies to any product.",
        2: "Acknowledges the brief but major constraints or context signals are missing.",
        3: "Addresses most brief requirements; some specific constraints underserved.",
        4: "Directly engages all stated requirements with product-specific decisions.",
        5: "Every decision is traceable to the brief; nothing generic substituted for specificity.",
      },
    },
    specificity: {
      label: "Specificity",
      description: "Decisions are concrete, named, and measurable — not vague principles or placeholder values.",
      anchors: {
        1: "All advice is abstract (e.g. 'use appropriate spacing', 'choose good colors').",
        2: "Some concrete examples but majority are vague or generic placeholders.",
        3: "Mix of concrete decisions and some vague guidance.",
        4: "Most decisions are named and concrete; minimal hedging.",
        5: "All decisions are measured, named, or traced to cited evidence; no placeholder values.",
      },
    },
    actionability: {
      label: "Actionability",
      description: "A practitioner can implement the output without further invention or clarification.",
      anchors: {
        1: "No actionable guidance; only principles or questions.",
        2: "Major implementation gaps that require significant invention.",
        3: "Actionable for most parts; some gaps remain.",
        4: "Complete enough to implement with minor clarifying questions.",
        5: "Fully actionable with referenced tokens, measured values, and implementation notes.",
      },
    },
    coherence: {
      label: "Coherence",
      description: "Internal consistency; decisions do not contradict each other.",
      anchors: {
        1: "Self-contradictory or internally inconsistent.",
        2: "Notable tensions that are unresolved or unexplained.",
        3: "Generally consistent with isolated unresolved tensions.",
        4: "Consistent throughout; any tensions are acknowledged and resolved.",
        5: "Fully internally consistent; decisions reinforce each other.",
      },
    },
    usability: {
      label: "Usability",
      description: "Output is accessible, compliant with relevant constraints, and usable by the target audience.",
      anchors: {
        1: "Contains accessibility failures or ignores stated usability constraints.",
        2: "Major usability gaps; accessible only in trivial respects.",
        3: "Meets basic usability requirements; some accessibility gaps remain.",
        4: "Meets stated usability requirements with evidence; accessibility addressed.",
        5: "Exceeds usability requirements with measured accessibility evidence and alternative paths.",
      },
    },
    non_generic_judgment: {
      label: "Non-generic judgment",
      description: "Output is distinguishably tailored to this product, not a recycled SaaS skeleton or AI default.",
      anchors: {
        1: "Generic SaaS skeleton, startup palette, or AI default phrasing throughout.",
        2: "Generic structure with product-specific details as superficial overlay.",
        3: "Product-specific in some dimensions; generic defaults persist in others.",
        4: "Distinct product character throughout; generic tropes avoided or explicitly rejected.",
        5: "Unmistakably specific to this product and brief; no identifiable AI/SaaS template.",
      },
    },
    skill_requirements: {
      label: "Skill requirements",
      description: "Skill-class-specific evidence fields (status/reason/remediation/evidence/provenance) and behaviors are present.",
      anchors: {
        1: "Required evidence fields entirely absent; skill contract ignored.",
        2: "Some required fields present; majority missing or empty.",
        3: "Most required fields present; some missing or token-only.",
        4: "All required fields present with substantive content.",
        5: "All required fields present with cited, measurable, and traceable evidence.",
      },
    },
  },
  lift_threshold: {
    mean_delta: 0.60,
    median_preference: ">=2 of 3 judges",
    no_mandatory_regression: -0.25,
    note: "A paired skill passes when upgraded mean delta >= +0.60, median judge preference >= 2 of 3, and no mandatory dimension mean delta below -0.25.",
  },
};

// Six-item calibration set
export const CALIBRATION_SET = [
  {
    id: "cal-01",
    label: "obvious-regression",
    description: "An output that clearly degrades from the baseline: drops specificity, ignores the brief, uses generic placeholder values, and loses accessibility compliance.",
    expected_verdict: "regressed",
    expected_rubric_range: { brief_fit: [1, 2], specificity: [1, 2], usability: [1, 2] },
    anchor_notes: "Evaluator must score all dimensions <= 2; any score >= 4 on the regressed dimensions fails calibration.",
  },
  {
    id: "cal-02",
    label: "superficial-rewrite",
    description: "Output uses different words and section order but the same generic skeleton, identical placeholder values, and equivalent brevity. Token-level changes only.",
    expected_verdict: "no_material_lift",
    expected_rubric_range: { non_generic_judgment: [2, 3], brief_fit: [2, 3] },
    anchor_notes: "Must not be scored as 'improved'. Evaluator who scores this >= 4 on non_generic_judgment fails calibration.",
  },
  {
    id: "cal-03",
    label: "true-lift",
    description: "Output replaces a generic startup palette with OKLCH-derived hues from the brief's existing brand color, names measured contrast pairs, separates semantic roles from primitives, and produces a clear token block.",
    expected_verdict: "improved",
    expected_rubric_range: { specificity: [4, 5], brief_fit: [4, 5], skill_requirements: [4, 5] },
    anchor_notes: "Must score >= 4 on specificity, brief_fit, and skill_requirements. Lower scores fail calibration.",
  },
  {
    id: "cal-04",
    label: "incoherent-novelty",
    description: "Output is visually novel and structurally distinct from the baseline but ignores the product brief, contradicts stated constraints, and produces an incoherent result that could not be implemented.",
    expected_verdict: "regressed",
    expected_rubric_range: { coherence: [1, 2], brief_fit: [1, 2], usability: [1, 2] },
    anchor_notes: "Novelty is not lift; evaluator who scores this as 'improved' fails calibration.",
  },
  {
    id: "cal-05",
    label: "diagnostic-disagreement",
    description: "Two repair outputs that differ in their severity classification of the same finding: one calls it WCAG AA failure, the other calls it a minor enhancement. The core finding is the same; only the severity label differs.",
    expected_verdict: "adjudication_required",
    expected_rubric_range: { skill_requirements: [2, 4] },
    anchor_notes: "Calibration case for repair-class truth convergence. Evaluator must flag adjudication; scoring without flagging fails.",
  },
  {
    id: "cal-06",
    label: "deterministic-gate",
    description: "A tastecheck-pass gate output where the canonical evidence rows, measurements, skips, and verdict are byte-identical across three runs. Only the executive narrative and report structure differ.",
    expected_verdict: "improved",
    expected_rubric_range: { skill_requirements: [4, 5], coherence: [4, 5] },
    anchor_notes: "Gate class: structural/voice variation in explanation is allowed; canonical row mutation is a regression. Evaluator must distinguish presentation from authoritative rows.",
  },
];

export function validateCalibration(results) {
  // results: array of { id, evaluator_verdict, evaluator_scores: {dim: score}, flagged_adjudication }
  const errors = [];
  let correct = 0;
  let totalMAE = 0;
  let dimensionCount = 0;

  for (const calItem of CALIBRATION_SET) {
    const result = results.find((r) => r.id === calItem.id);
    if (!result) { errors.push(`Missing calibration result for ${calItem.id}`); continue; }

    // Check verdict
    const verdictCorrect = result.evaluator_verdict === calItem.expected_verdict
      || (calItem.expected_verdict === "adjudication_required" && result.flagged_adjudication);
    if (verdictCorrect) correct++;
    else errors.push(`${calItem.id}: expected verdict "${calItem.expected_verdict}", got "${result.evaluator_verdict}"`);

    // Check rubric ranges
    for (const [dim, [lo, hi]] of Object.entries(calItem.expected_rubric_range)) {
      const score = result.evaluator_scores?.[dim];
      if (score === undefined) { errors.push(`${calItem.id}: missing score for ${dim}`); continue; }
      const midpoint = (lo + hi) / 2;
      totalMAE += Math.abs(score - midpoint);
      dimensionCount++;
      if (score < lo - 1 || score > hi + 1) {
        errors.push(`${calItem.id}: ${dim} score ${score} outside acceptable range [${lo - 1}, ${hi + 1}]`);
      }
    }
  }

  const mae = dimensionCount > 0 ? totalMAE / dimensionCount : 0;
  const pass = correct >= 5 && mae <= 1.0 && errors.length === 0;

  return {
    correct,
    total: CALIBRATION_SET.length,
    mean_absolute_error: parseFloat(mae.toFixed(3)),
    pass,
    errors,
    requirement: ">=5/6 correct classifications and <=1 scale-point mean absolute error",
  };
}

// Anti-slop heuristics
export function antiSlopChecks(outputs) {
  // outputs: array of { run_id, skill, text } from accepted upgraded runs
  const findings = [];

  // 1. Exact pack-example reuse
  const PACK_EXAMPLES = ["civic flood-alert", "coastal transit cooperative", "repair shop", "night-shift logistics"];
  for (const out of outputs) {
    for (const example of PACK_EXAMPLES) {
      if (out.text.toLowerCase().includes(example.toLowerCase())) {
        findings.push({ run_id: out.run_id, check: "pack_example_reuse", excerpt: example });
      }
    }
  }

  // 2. Generic SaaS skeleton markers
  const SLOP_MARKERS = [
    "hero section", "three-card grid", "indigo gradient", "pill button", "centered hero",
    "modern and clean", "sleek design", "user-friendly", "seamless experience",
    "leverage synergies", "delightful", "elevate your brand",
  ];
  for (const out of outputs) {
    for (const marker of SLOP_MARKERS) {
      if (out.text.toLowerCase().includes(marker.toLowerCase())) {
        findings.push({ run_id: out.run_id, check: "generic_saas_marker", excerpt: marker });
      }
    }
  }

  // 3. Phrase reuse: normalized phrases of >=8 words that appear across unrelated runs
  const phrases = new Map();
  for (const out of outputs) {
    const words = out.text.toLowerCase().split(/\s+/);
    for (let i = 0; i <= words.length - 8; i++) {
      const phrase = words.slice(i, i + 8).join(" ");
      if (!phrases.has(phrase)) phrases.set(phrase, []);
      phrases.get(phrase).push(out.run_id);
    }
  }
  for (const [phrase, runs] of phrases) {
    const uniqueSkillRuns = new Set(runs);
    if (uniqueSkillRuns.size > outputs.length * 0.1 + 1) {
      findings.push({ check: "phrase_reuse", phrase: phrase.slice(0, 60), runs: [...uniqueSkillRuns] });
    }
  }

  const blocked = findings.some((f) =>
    f.check === "pack_example_reuse" || f.check === "generic_saas_marker"
  );

  return { blocked, findings };
}

// CLI — only runs when this file is the entry point, not when imported
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!isMain) { /* imported as library — skip CLI */ }
else {
const [,, cmd, filePath] = process.argv;

if (!cmd || cmd === "--help") {
  console.log("TasteCheck Rubric v1");
  console.log("\nDimensions:", Object.keys(RUBRIC.dimensions).join(", "));
  console.log("\nLift threshold: mean delta >= +0.60, median preference >= 2/3 judges");
  console.log("\nUsage:");
  console.log("  node tools/evals/rubric.mjs                   # print summary");
  console.log("  node tools/evals/rubric.mjs --calibration     # print calibration set");
  console.log("  node tools/evals/rubric.mjs --validate <file> # validate calibration results");
  console.log("  node tools/evals/rubric.mjs --anti-slop <file># anti-slop checks on output list");
} else if (cmd === "--calibration") {
  for (const item of CALIBRATION_SET) {
    console.log(`\n[${item.id}] ${item.label}`);
    console.log(`  ${item.description}`);
    console.log(`  Expected verdict: ${item.expected_verdict}`);
    console.log(`  Anchor notes: ${item.anchor_notes}`);
  }
} else if (cmd === "--validate" && filePath) {
  if (!existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }
  const results = JSON.parse(readFileSync(filePath, "utf8"));
  const outcome = validateCalibration(results);
  console.log(JSON.stringify(outcome, null, 2));
  if (!outcome.pass) process.exit(1);
} else if (cmd === "--anti-slop" && filePath) {
  if (!existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }
  const outputs = JSON.parse(readFileSync(filePath, "utf8"));
  const result = antiSlopChecks(outputs);
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked) process.exit(1);
} else {
  console.error("Unknown command. Run with --help for usage.");
  process.exit(1);
}
}
