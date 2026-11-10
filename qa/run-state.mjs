import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const gitOutput = (root, args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim() : null;
};

export function runnerProvenance(repositoryRoot, catalogSourceRevision) {
  const root = resolve(repositoryRoot);
  const revision = gitOutput(root, ["rev-parse", "--verify", "HEAD"]);
  const status = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const gitDirectory = gitOutput(root, ["rev-parse", "--git-dir"]);
  const commonDirectory = gitOutput(root, ["rev-parse", "--git-common-dir"]);
  const ref = gitOutput(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const inGitCheckout = revision !== null;
  const kind = !inGitCheckout ? "unavailable"
    : gitDirectory !== null && commonDirectory !== null && resolve(root, gitDirectory) !== resolve(root, commonDirectory)
      ? "linked-worktree" : "primary-worktree";
  return {
    checkout: {
      revision,
      ref,
      dirty: status === null ? null : status.length > 0,
      kind,
    },
    catalog_source_revision: catalogSourceRevision,
  };
}

export function createRunState(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const tempBase = resolve(tmpdir());
  if (tempBase === root || tempBase.startsWith(`${root}${sep}`)) {
    throw new Error("OS temporary directory is inside the repository checkout; set TMPDIR to an external directory");
  }
  const workRoot = mkdtempSync(join(tempBase, "tastecheck-qa-work-"));
  let cleaned = false;
  const pathFor = (group, id) => {
    if (!/^[A-Z][0-9]+$/.test(id)) throw new Error(`invalid catalog path ID for isolated state: ${id}`);
    return join(workRoot, group, id);
  };
  return {
    root: workRoot,
    home: (id) => pathFor("homes", id),
    xdg: (id) => pathFor("isolated-state", id),
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      rmSync(workRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

/* Operator-path result lifecycle — the ONLY place these states are named.
 *
 *   (running) ──no error──────▶ PASS
 *             ──Blocked error──▶ BLOCKED   (a prerequisite is missing, e.g. no browser)
 *             ──any other error▶ FAIL
 *
 * All three are terminal; summary.json stores these exact strings. The run's exit
 * code is 1 if any path FAILED, else 2 if any was BLOCKED, else 0. */
export const PATH_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED" });

export class Blocked extends Error {}

/** The single transition out of "running": no error is PASS. */
export function pathStatusFor(error) {
  if (error === undefined || error === null) return PATH_STATUS.PASS;
  return error instanceof Blocked ? PATH_STATUS.BLOCKED : PATH_STATUS.FAIL;
}

/** Count results per status; an unknown status is an illegal state and throws. */
export function countStatuses(results) {
  const counts = { passed: 0, failed: 0, blocked: 0 };
  const key = { [PATH_STATUS.PASS]: "passed", [PATH_STATUS.FAIL]: "failed", [PATH_STATUS.BLOCKED]: "blocked" };
  for (const result of results) {
    const field = key[result?.status];
    if (!field) throw new Error(`unknown operator-path status: ${JSON.stringify(result?.status)}`);
    counts[field] += 1;
  }
  return counts;
}

export function exitCodeFor(counts) {
  if (counts.failed) return 1;
  if (counts.blocked) return 2;
  return 0;
}
