#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, "../..");
const kinds = new Set(["mechanical", "security", "clean-clone"]);
const excludedReceipts = new Set([
  "evals/receipts/v1/context-budget.json",
  "evals/receipts/v1/browser.json",
  "evals/receipts/v1/e2e.json",
  "evals/receipts/v1/mechanical.json",
  "evals/receipts/v1/security.json",
  "evals/receipts/v1/clean-clone.json",
  "contracts/v1/release-receipts.json",
]);

export function isExcludedReceiptPath(path) {
  const normalized = path.replaceAll("\\", "/");
  return excludedReceipts.has(normalized) || normalized.startsWith("evals/receipts/v1/artifacts/");
}

export function computeSourceTreeSha256(root = defaultRoot) {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root });
  const paths = output.toString("utf8").split("\0").filter(Boolean).sort();
  const digest = createHash("sha256");
  for (const path of paths) {
    if (isExcludedReceiptPath(path)) continue;
    const content = readFileSync(join(root, path));
    digest.update(path);
    digest.update("\0");
    digest.update(createHash("sha256").update(content).digest("hex"));
    digest.update("\n");
  }
  return digest.digest("hex");
}

export function deriveReceipt({ kind, sourceTreeSha256, nonce, startedAt, finishedAt, checks }) {
  if (!kinds.has(kind)) throw new Error(`unsupported engineering receipt kind: ${kind}`);
  if (!/^[a-f0-9]{64}$/.test(sourceTreeSha256)) throw new Error("sourceTreeSha256 must be a lowercase SHA-256");
  if (!/^[A-Za-z0-9._-]{16,128}$/.test(nonce)) throw new Error("nonce must be 16-128 safe characters");
  if (!Array.isArray(checks) || checks.length === 0) throw new Error("checks must be nonempty");
  const status = checks.every((check) => check.passed === true && check.exit_code === 0) ? "pass" : "fail";
  return {
    schema_version: 1,
    kind,
    producer_id: `tastecheck.release.${kind}.v1`,
    source_tree_sha256: sourceTreeSha256,
    nonce,
    started_at: startedAt,
    finished_at: finishedAt,
    checks,
    status,
    reproducible: status === "pass",
  };
}

function runCheck(cwd, id, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    id,
    command: [command, ...args].join(" "),
    passed: result.status === 0,
    exit_code: result.status ?? 1,
    output_sha256: createHash("sha256").update(combined).digest("hex"),
  };
}

function mechanicalChecks(root) {
  return [
    runCheck(root, "test", "npm", ["test"]),
    runCheck(root, "contracts", "npm", ["run", "test:contracts"]),
    runCheck(root, "eval-schema", "npm", ["run", "test:eval-schema"]),
    runCheck(root, "eval-remediation", "npm", ["run", "test:eval-remediation"]),
  ];
}

function securityChecks(root) {
  return [
    runCheck(root, "effectiveness-claims", process.execPath, ["tools/release/check-effectiveness-claims.mjs"]),
    runCheck(root, "public-replay-surface", process.execPath, ["tools/evals/test-public-replay-surface.mjs"]),
    runCheck(root, "receipt-sanitizer", process.execPath, ["tools/evals/test-sanitizer-fixtures.mjs"]),
  ];
}

function cleanCloneChecks(root) {
  const temp = mkdtempSync(join(tmpdir(), "tastecheck-clean-clone-"));
  const archive = join(temp, "source.tar");
  const clone = join(temp, "source");
  mkdirSync(clone);
  try {
    execFileSync("git", ["archive", "--format=tar", "HEAD", "-o", archive], { cwd: root });
    execFileSync("tar", ["-xf", archive, "-C", clone]);
    const checks = [runCheck(clone, "npm-ci", "npm", ["ci", "--ignore-scripts"] )];
    if (checks[0].passed) {
      checks.push(runCheck(clone, "test", "npm", ["test"]));
      checks.push(runCheck(clone, "contracts", "npm", ["run", "test:contracts"]));
      checks.push(runCheck(clone, "effectiveness-claims", process.execPath, ["tools/release/check-effectiveness-claims.mjs"]));
    }
    return checks;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export function produceEngineeringReceipt({ kind, root = defaultRoot, nonce = randomBytes(16).toString("hex") }) {
  const startedAt = new Date().toISOString();
  const checks = kind === "mechanical"
    ? mechanicalChecks(root)
    : kind === "security"
      ? securityChecks(root)
      : cleanCloneChecks(root);
  return deriveReceipt({
    kind,
    sourceTreeSha256: computeSourceTreeSha256(root),
    nonce,
    startedAt,
    finishedAt: new Date().toISOString(),
    checks,
  });
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const kind = process.argv[2];
  if (!kinds.has(kind)) throw new Error("usage: engineering-receipt.mjs <mechanical|security|clean-clone> --out <path> [--nonce <value>]");
  const out = argValue("--out") ?? `evals/receipts/v1/${kind}.json`;
  const receipt = produceEngineeringReceipt({ kind, nonce: argValue("--nonce") });
  const destination = resolve(defaultRoot, out);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`${kind} receipt ${receipt.status}: ${relative(defaultRoot, destination)}`);
  if (receipt.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
