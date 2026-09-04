#!/usr/bin/env node
/** Mutation fixtures for the four W5 verifier failure classes. */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const tempRoot = mkdtempSync(join(tmpdir(), "tastecheck-w5-"));

function run(script, args = [], cwd = root) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

function copy(relativePath) {
  cpSync(join(root, relativePath), join(tempRoot, relativePath), { recursive: true });
}

try {
  // Unknown skill-like references must fail through the production CLI.
  copy("skills");
  copy("tools/lib/skill-lint.mjs");
  copy("tools/lint-skills.mjs");
  const lintTarget = join(tempRoot, "skills", "deslop-ui", "SKILL.md");
  writeFileSync(lintTarget, `${readFileSync(lintTarget, "utf8")}\nSee \`phantom-skill-xyz\`.\n`);
  const lint = run(join(tempRoot, "tools/lint-skills.mjs"));
  assert.notEqual(lint.status, 0, "unknown skill-like reference unexpectedly passed");
  assert.match(`${lint.stdout}${lint.stderr}`, /unknown skill-like reference `phantom-skill-xyz`/);

  // Missing contracts are accumulated instead of aborting at the first directory.
  copy("tools/contracts");
  for (const skill of ["a11y-pass", "art-direction"]) rmSync(join(tempRoot, "skills", skill, "contract.json"));
  const contracts = run(join(tempRoot, "tools/contracts/test-contracts.mjs"), [`--root=${tempRoot}`]);
  assert.notEqual(contracts.status, 0, "missing contracts unexpectedly passed");
  assert.match(contracts.stderr, /a11y-pass: missing contract\.json/);
  assert.match(contracts.stderr, /art-direction: missing contract\.json/);

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
  assert.notEqual(generated.status, 0, "stale generated block unexpectedly passed");
  assert.match(`${generated.stdout}${generated.stderr}`, /deslop-ui\/SKILL\.md/);

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
    assert.notEqual(falseClaim.status, 0, "false landing claim unexpectedly passed");
    assert.match(`${falseClaim.stdout}${falseClaim.stderr}`, /does not represent the a11y-pass concern/);
    assert.match(`${falseClaim.stdout}${falseClaim.stderr}`, /claims data-skill="missing-concern"/);
  } finally {
    rmSync(landingRoot, { recursive: true, force: true });
  }

  console.log("verification failure mutation fixtures passed (unknown ref, missing contract, stale projection, false landing claim)");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
