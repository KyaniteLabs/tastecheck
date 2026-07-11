const EVALUATORS = [
  {
    key: "paired_lift",
    label: "paired-lift",
    passes: (result) => result?.release_eligible === true && result?.verdict === "improved",
    describe: (result) => `release_eligible=${result?.release_eligible}, verdict=${result?.verdict}`,
  },
  {
    key: "diversity",
    label: "diversity",
    passes: (result) => result?.overall_pass === true && result?.verdict === "pass",
    describe: (result) => `overall_pass=${result?.overall_pass}, verdict=${result?.verdict}`,
  },
  {
    key: "anti_slop",
    label: "anti-slop",
    passes: (result) => result?.pass === true && result?.verdict === "pass",
    describe: (result) => `pass=${result?.pass}, verdict=${result?.verdict}`,
  },
];

/**
 * Strict W1 evaluator release gate. File presence is never evidence of a
 * passing evaluator verdict: every evaluator must meet both of its declared
 * release predicates for every pilot skill.
 */
export function evaluateW1EvaluatorGate(artifactsBySkill, pilotSkills = Object.keys(artifactsBySkill).sort()) {
  const failures = [];
  const summaries = Object.fromEntries(EVALUATORS.map(({ key }) => [key, { total: pilotSkills.length, pass: 0, fail: 0 }]));
  for (const skill of pilotSkills) {
    const artifacts = artifactsBySkill[skill] ?? {};
    for (const evaluator of EVALUATORS) {
      const result = artifacts[evaluator.key];
      if (evaluator.passes(result)) {
        summaries[evaluator.key].pass++;
      } else {
        summaries[evaluator.key].fail++;
        failures.push(`${skill}/${evaluator.label}: ${result ? evaluator.describe(result) : "artifact missing"}`);
      }
    }
  }
  return { pass: failures.length === 0, failures, summaries };
}
