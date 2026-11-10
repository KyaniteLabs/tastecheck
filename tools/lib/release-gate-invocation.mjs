#!/usr/bin/env node
/**
 * Invocation-shape harness for the deep-lane release gate.
 *
 * The gate is installed into agent homes by `install.sh`, which links each
 * skill as a symlink (and profile trees chain more symlinked directories).
 * Node resolves the entry module's `import.meta.url` to its real path while
 * `process.argv[1]` keeps the symlinked path, so a lexical entry guard makes
 * the installed CLI exit 0 without running — a silent false pass that looks
 * exactly like a SHIP verdict to anything gating on the exit code.
 *
 * This harness stages the installed shapes in a temp directory and runs the
 * same file, with the same arguments and the same ledger, through each one:
 *   - checkout:            <repoRoot>/skills/tastecheck-pass/assets/release-gate.mjs
 *   - installed-skill:     a symlinked skill directory (install.sh's shape)
 *   - installed-dir-chain: a chain of symlinked directories (profile-tree shape)
 *   - installed-file:      a symlinked entry file
 * Every shape must produce the same verdict, the same exit code and a report;
 * no shape may exit 0 with empty stdout/stderr and no report.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const GATE_RELATIVE = "skills/tastecheck-pass/assets/release-gate.mjs";
export const CATALOG_RELATIVE = "skills/tastecheck-pass/assets/check-catalog.json";
export const BROWSER_MANIFEST_RELATIVE = "tools/evals/fixtures/release-gate/browser-subject-manifest.json";

function stageInvocations(repoRoot, stageRoot) {
  const verifier = join(stageRoot, "verifier");
  mkdirSync(join(verifier, "skills/tastecheck-pass/assets"), { recursive: true });
  mkdirSync(join(verifier, "tools/evals/fixtures/release-gate"), { recursive: true });
  mkdirSync(join(verifier, "reports"), { recursive: true });
  cpSync(join(repoRoot, CATALOG_RELATIVE), join(verifier, CATALOG_RELATIVE));
  cpSync(join(repoRoot, BROWSER_MANIFEST_RELATIVE), join(verifier, BROWSER_MANIFEST_RELATIVE));

  // install.sh: one symlink per skill directory.
  const installedSkills = join(stageRoot, "installed-skills");
  mkdirSync(installedSkills, { recursive: true });
  symlinkSync(join(repoRoot, "skills/tastecheck-pass"), join(installedSkills, "tastecheck-pass"), "dir");

  // profile tree: symlinked directories that chain to the shared skill tree.
  const shared = join(stageRoot, "installed-chain/real");
  mkdirSync(shared, { recursive: true });
  symlinkSync(join(repoRoot, "skills/tastecheck-pass"), join(shared, "tastecheck-pass"), "dir");
  const platformSkills = join(stageRoot, "installed-chain/skills/shared-seats/platform");
  mkdirSync(platformSkills, { recursive: true });
  symlinkSync(join(stageRoot, "installed-chain/real"), join(platformSkills, "tastecheck"), "dir");

  // npm bin shim: a symlink to the entry file itself.
  const fileLink = join(stageRoot, "installed-file");
  mkdirSync(fileLink, { recursive: true });
  symlinkSync(join(repoRoot, GATE_RELATIVE), join(fileLink, "release-gate.mjs"), "file");

  return {
    verifier,
    shapes: [
      { shape: "checkout", gate: join(repoRoot, GATE_RELATIVE) },
      { shape: "installed-skill", gate: join(installedSkills, "tastecheck-pass/assets/release-gate.mjs") },
      { shape: "installed-dir-chain", gate: join(platformSkills, "tastecheck/tastecheck-pass/assets/release-gate.mjs") },
      { shape: "installed-file", gate: join(fileLink, "release-gate.mjs") },
    ],
  };
}

function readReport(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

/**
 * Run every installed shape and compare it with the checkout invocation.
 *
 * @param {object} options
 * @param {string} options.repoRoot      real path of the tastecheck checkout
 * @param {object} options.ledger        ledger object written into the verifier root
 * @param {"SHIP"|"HOLD"} options.expectedVerdict
 * @param {string} [options.artifactRoot] root the ledger's artifact paths resolve against
 * @param {string[]} [options.extraArgs] extra CLI arguments appended to every run
 * @param {boolean} [options.keep]       keep the staged tree (returns its path)
 */
export function runInstalledInvocation({ repoRoot, ledger, expectedVerdict, artifactRoot, extraArgs = [], keep = false } = {}) {
  if (typeof repoRoot !== "string" || !repoRoot) throw new Error("repoRoot is required");
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) throw new Error("ledger must be an object");
  if (expectedVerdict !== "SHIP" && expectedVerdict !== "HOLD") throw new Error("expectedVerdict must be SHIP or HOLD");

  const stageRoot = mkdtempSync(join(tmpdir(), "tastecheck-invocation-"));
  const failures = [];
  try {
    const { verifier, shapes } = stageInvocations(repoRoot, stageRoot);
    writeFileSync(join(verifier, "ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);
    const artifact = artifactRoot ?? verifier;

    const invocations = shapes.map(({ shape, gate }) => {
      const out = `reports/${shape}.json`;
      const args = [
        gate,
        "--input", "ledger.json",
        "--out", out,
        "--verifier-root", verifier,
        "--artifact-root", artifact,
        "--browser-manifest", BROWSER_MANIFEST_RELATIVE,
        ...extraArgs,
      ];
      const run = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 120_000 });
      const reportPath = join(verifier, out);
      const reportWritten = existsSync(reportPath);
      const report = reportWritten ? readReport(reportPath) : null;
      const result = {
        shape,
        exit: run.status,
        signal: run.signal,
        stdout_bytes: Buffer.byteLength(run.stdout ?? ""),
        stderr_bytes: Buffer.byteLength(run.stderr ?? ""),
        report_written: reportWritten,
        verdict: report?.verdict ?? null,
        report,
      };
      const silent = result.exit === 0 && result.stdout_bytes === 0 && result.stderr_bytes === 0 && !reportWritten;
      if (silent) failures.push(`${shape}: exited 0 with no stdout, no stderr and no report (silent false pass)`);
      if (!reportWritten) failures.push(`${shape}: wrote no report (${run.stderr?.trim().split("\n")[0] ?? "no stderr"})`);
      if (result.verdict !== expectedVerdict) failures.push(`${shape}: verdict ${result.verdict ?? "none"} != expected ${expectedVerdict}`);
      const expectedExit = expectedVerdict === "SHIP" ? 0 : 1;
      if (result.exit !== expectedExit) failures.push(`${shape}: exit ${result.exit} != expected ${expectedExit}`);
      if (result.stderr_bytes === 0) failures.push(`${shape}: printed no decision card to stderr`);
      return result;
    });

    const baseline = invocations[0];
    for (const invocation of invocations.slice(1)) {
      if (invocation.exit !== baseline.exit) failures.push(`${invocation.shape}: exit ${invocation.exit} != checkout exit ${baseline.exit}`);
      if (invocation.verdict !== baseline.verdict) failures.push(`${invocation.shape}: verdict ${invocation.verdict} != checkout verdict ${baseline.verdict}`);
      if (JSON.stringify(invocation.report) !== JSON.stringify(baseline.report)) {
        failures.push(`${invocation.shape}: report differs from the checkout report`);
      }
    }

    return {
      ok: failures.length === 0,
      expected_verdict: expectedVerdict,
      verdict: invocations.every((item) => item.verdict === baseline.verdict) ? baseline.verdict : null,
      exits: Object.fromEntries(invocations.map((item) => [item.shape, item.exit])),
      silent_shapes: invocations.filter((item) => item.exit === 0 && item.stdout_bytes === 0 && item.stderr_bytes === 0 && !item.report_written).map((item) => item.shape),
      invocations: invocations.map(({ report, ...rest }) => rest),
      failures,
      ...(keep ? { stage_root: stageRoot } : {}),
    };
  } finally {
    if (!keep) rmSync(stageRoot, { recursive: true, force: true });
  }
}
