#!/usr/bin/env node
/** Mutation fixtures for the four W5 verifier failure classes. */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const tempRoot = mkdtempSync(join(tmpdir(), "tastecheck-w5-"));
const mutationResults = [];

function run(script, args = [], cwd = root) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

function copy(relativePath) {
  cpSync(join(root, relativePath), join(tempRoot, relativePath), { recursive: true });
}

function recordMutation(id, result, evidencePredicate) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const observedRejection = result.status !== 0;
  const evidenceMatched = evidencePredicate(output);
  mutationResults.push({
    id,
    expected: "reject",
    exit_code: result.status ?? 1,
    observed_rejection: observedRejection,
    evidence_matched: evidenceMatched,
    killed: observedRejection && evidenceMatched,
  });
  return output;
}

try {
  // Unknown skill-like references must fail through the production CLI.
  copy("skills");
  copy("tools/lib/skill-lint.mjs");
  copy("tools/lint-skills.mjs");
  const lintTarget = join(tempRoot, "skills", "deslop-ui", "SKILL.md");
  writeFileSync(lintTarget, `${readFileSync(lintTarget, "utf8")}\nSee \`phantom-skill-xyz\`.\n`);
  const lint = run(join(tempRoot, "tools/lint-skills.mjs"));
  const lintOutput = recordMutation("unknown-skill-reference", lint, (output) => /unknown skill-like reference `phantom-skill-xyz`/.test(output));
  assert.notEqual(lint.status, 0, "unknown skill-like reference unexpectedly passed");
  assert.match(lintOutput, /unknown skill-like reference `phantom-skill-xyz`/);

  // Missing contracts are accumulated instead of aborting at the first directory.
  copy("tools/contracts");
  for (const skill of ["a11y-pass", "art-direction"]) rmSync(join(tempRoot, "skills", skill, "contract.json"));
  const contracts = run(join(tempRoot, "tools/contracts/test-contracts.mjs"), [`--root=${tempRoot}`]);
  const contractsOutput = recordMutation(
    "missing-contracts-accumulated",
    contracts,
    (output) => /a11y-pass: missing contract\.json/.test(output) && /art-direction: missing contract\.json/.test(output),
  );
  assert.notEqual(contracts.status, 0, "missing contracts unexpectedly passed");
  assert.match(contractsOutput, /a11y-pass: missing contract\.json/);
  assert.match(contractsOutput, /art-direction: missing contract\.json/);

  // Generated projections are compared as exact bytes by check-generated.
  copy("skills");
  copy("skills.json");
  copy("commands");
  copy("contracts/v1");
  copy("tools/contracts/check-generated.mjs");
  copy("tools/contracts/project.mjs");
  copy("tools/contracts/validate.mjs");
  const generatedTarget = join(tempRoot, "skills", "deslop-ui", "SKILL.md");
  const generatedSource = readFileSync(generatedTarget, "utf8");
  writeFileSync(generatedTarget, generatedSource.replace("Canonical detail:", "Stale generated detail:"));
  const generated = run(join(tempRoot, "tools/contracts/check-generated.mjs"), [], tempRoot);
  const generatedOutput = recordMutation("stale-generated-projection", generated, (output) => /deslop-ui\/SKILL\.md/.test(output));
  assert.notEqual(generated.status, 0, "stale generated block unexpectedly passed");
  assert.match(generatedOutput, /deslop-ui\/SKILL\.md/);

  // The landing verifier must reject a claim for an unrepresented concern.
  const landingRoot = mkdtempSync(join(tmpdir(), "tastecheck-w5-landing-"));
  try {
    mkdirSync(join(landingRoot, "tools"), { recursive: true });
    cpSync(join(root, "index.html"), join(landingRoot, "index.html"));
    cpSync(join(root, "skills.json"), join(landingRoot, "skills.json"));
    cpSync(join(root, "skills"), join(landingRoot, "skills"), { recursive: true });
    cpSync(join(root, "tools/verify-landing.mjs"), join(landingRoot, "tools/verify-landing.mjs"));
    const landingPath = join(landingRoot, "index.html");
    const landing = readFileSync(landingPath, "utf8").replace('data-skill="a11y-pass"', 'data-skill="missing-concern"');
    writeFileSync(landingPath, landing);
    const falseClaim = run(join(landingRoot, "tools/verify-landing.mjs"), [], landingRoot);
    const falseClaimOutput = recordMutation(
      "false-landing-claim",
      falseClaim,
      (output) => /does not represent the a11y-pass concern/.test(output) && /claims data-skill="missing-concern"/.test(output),
    );
    assert.notEqual(falseClaim.status, 0, "false landing claim unexpectedly passed");
    assert.match(falseClaimOutput, /does not represent the a11y-pass concern/);
    assert.match(falseClaimOutput, /claims data-skill="missing-concern"/);
  } finally {
    rmSync(landingRoot, { recursive: true, force: true });
  }

  const killed = mutationResults.filter((mutation) => mutation.killed).length;
  const total = mutationResults.length;
  const score = {
    schema_version: 1,
    kind: "w5-verification-mutation-score",
    generated_by: "tools/test/test-verification-failures.mjs",
    mutations: mutationResults,
    summary: {
      total,
      killed,
      survived: total - killed,
      kill_rate: total === 0 ? 0 : killed / total,
      all_expected_rejections_killed: total > 0 && killed === total,
    },
  };
  if (process.env.MUTATION_SCORE_OUT) {
    const destination = join(root, process.env.MUTATION_SCORE_OUT);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(score, null, 2)}\n`);
  }
  console.log(`verification failure mutation fixtures passed (unknown ref, missing contract, stale projection, false landing claim); mutation score ${killed}/${total} killed, ${total - killed} survived (${(score.summary.kill_rate * 100).toFixed(2)}%)`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
