import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(HERE, "../../..");

const SUITES = Object.freeze([
  { id: "contracts", file: "tools/evals/v2/test-contracts.mjs", source_sha256: "48ff6d8bd01d3227f6d9db2bb61ff2459b9e3711af2d4da57a9e06b3bf770ac2" },
  { id: "registry", file: "tools/evals/v2/test-registry.mjs", source_sha256: "fcafb02924a75c6b1faad47cac30d7fac243b5066aefc529e35b7c1c20f99ed7" },
  { id: "generation", file: "tools/evals/v2/test-generation.mjs", source_sha256: "c8e4dd3c5d9f680a957dd5a05498e7562dc96249aa6a370845c467d91643fc98" },
  { id: "render", file: "tools/evals/v2/test-render.mjs", source_sha256: "b816b77b83d157a5291759b4ee5d939e210d80919ddc9bf6a374706702a83706" },
  { id: "judges", file: "tools/evals/v2/test-judges.mjs", source_sha256: "a32b46266348ca1448d3f5c864fdb84e2b25de8b45619f08d66d889b3bcc7d25" },
  { id: "synthesis", file: "tools/evals/v2/test-synthesis.mjs", source_sha256: "5d261a23da1116c07946d3b168a5f5bfe0c19db48aa5f163fc419edadc1ec15b" },
  { id: "foundation", file: "tools/evals/v2/test-foundation.mjs", source_sha256: "7be38ef71d83251bef2e16287e738c5c054d6180d0b56156e7b3effcb206670a" },
  { id: "schedule", file: "tools/evals/v2/test-schedule.mjs", source_sha256: "a75f4a72e4b061ebecf669bad5a213061c8c8b77090dd813c71191da77800903" },
  { id: "rehearsal", file: "tools/evals/v2/test-rehearsal.mjs", source_sha256: "1202a242f725e31274dd459ada181e2528ae053a4a643e0b89966cd4740f5aec" }
]);

export const QA_CASES = Object.freeze([
  { id: "dirty-tree-and-source-drift", suite: "rehearsal" },
  { id: "historical-copy-and-indirection", suite: "registry" },
  { id: "commitment-and-opening-attacks", suite: "registry" },
  { id: "secret-lifecycle-and-disclosure", suite: "registry" },
  { id: "identifier-ordering-and-rebinding", suite: "judges" },
  { id: "execution-render-and-replay-drift", suite: "render" },
  { id: "late-exclusions-and-packet-transformation", suite: "generation" },
  { id: "anchor-aggregation-and-evidence-attacks", suite: "judges" },
  { id: "dispatch-cost-and-partial-production", suite: "generation" },
  { id: "ledger-reservation-and-repeat-synthesis", suite: "synthesis" },
  { id: "unknown-fields-and-validator-drift", suite: "judges" },
  { id: "failed-anchors-and-family-collapse", suite: "judges" },
  { id: "citation-span-cross-arm-and-stale-evidence", suite: "judges" },
  { id: "render-viewport-artifact-and-host-tampering", suite: "render" },
  { id: "unmask-map-completeness-and-coordinate-forgery", suite: "synthesis" },
  { id: "ordinal-failure-no-retry-or-substitution", suite: "rehearsal" }
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function publicEnvironment(extra = {}) {
  const env = {
    PATH: process.env.PATH ?? "",
    LANG: process.env.LANG ?? "C",
    LC_ALL: process.env.LC_ALL ?? "C",
    LIMINAL_AUTO_PUSH_AFTER_COMMIT: "0",
    NO_COLOR: "1",
    ...extra
  };
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
  if (process.env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = process.env.XDG_RUNTIME_DIR;
  if (process.env.DBUS_SESSION_BUS_ADDRESS) env.DBUS_SESSION_BUS_ADDRESS = process.env.DBUS_SESSION_BUS_ADDRESS;
  return env;
}

function validateManifest(root) {
  const suiteIds = new Set(SUITES.map(({ id }) => id));
  if (suiteIds.size !== SUITES.length) throw new Error("duplicate QA suite id");
  const caseIds = new Set();
  for (const entry of QA_CASES) {
    if (caseIds.has(entry.id)) throw new Error(`duplicate QA case id: ${entry.id}`);
    caseIds.add(entry.id);
    if (!suiteIds.has(entry.suite)) throw new Error(`QA case has unknown suite binding: ${entry.id}`);
  }
  for (const suite of SUITES) {
    const actual = sha256(readFileSync(join(root, suite.file)));
    if (actual !== suite.source_sha256) throw new Error(`preregistered QA source drift: ${suite.id}`);
  }
}

function sandboxCommand(nodeArgs, tracePath, env) {
  if (process.platform === "darwin") {
    const profile = "(version 1) (allow default) (deny network-outbound (remote ip)) (deny network-inbound (local ip))";
    return { command: "/usr/bin/sandbox-exec", args: ["-p", profile, process.execPath, ...nodeArgs], mode: "darwin-sandbox-deny-network", tracePath: null };
  }
  if (process.platform === "linux") {
    if (!existsSync("/usr/bin/systemd-run")) throw new Error("Linux adversarial QA requires systemd-run network enforcement");
    const strace = ["/usr/bin/strace", "/bin/strace"].find(existsSync);
    if (!strace) throw new Error("Linux adversarial QA requires strace observation");
    return {
      command: "/usr/bin/systemd-run",
      args: [
        "--user", "--wait", "--pipe", "--collect", "--quiet",
        "-p", "RestrictAddressFamilies=AF_UNIX AF_NETLINK",
        "-p", "NoNewPrivileges=yes",
        ...(env.TASTECHECK_V2_QA_EVENTS ? [`--setenv=TASTECHECK_V2_QA_EVENTS=${env.TASTECHECK_V2_QA_EVENTS}`] : []),
        "--setenv=LIMINAL_AUTO_PUSH_AFTER_COMMIT=0",
        "--setenv=NO_COLOR=1",
        strace, "-f", "-qq", "-e", "trace=network", "-o", tracePath,
        process.execPath, ...nodeArgs
      ],
      mode: "linux-systemd-address-family-deny-with-strace",
      tracePath
    };
  }
  throw new Error(`unsupported QA network-isolation platform: ${process.platform}`);
}

function networkAttempts(tracePath) {
  if (!tracePath || !existsSync(tracePath)) return 0;
  return readFileSync(tracePath, "utf8").split("\n")
    .filter((line) => /socket\(AF_INET6?[^\n]*= -1 (?:EPERM|EAFNOSUPPORT)/.test(line)).length;
}

function runIsolated(nodeArgs, { cwd, env, tracePath }) {
  const sandbox = sandboxCommand(nodeArgs, tracePath, env);
  const result = spawnSync(sandbox.command, sandbox.args, {
    cwd, encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024
  });
  return { ...result, isolation: sandbox.mode, network_attempts: networkAttempts(sandbox.tracePath) };
}

export function verifyNetworkIsolation({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), "tastecheck-v2-network-probe-"));
  try {
    const tracePath = join(scratch, "probe.trace");
    const script = "fetch('https://example.invalid').then(()=>process.exit(0),()=>process.exit(73))";
    const result = runIsolated(["-e", script], { cwd: resolve(repoRoot), env: publicEnvironment(), tracePath });
    const blocked = result.status === 73 && (process.platform !== "linux" || result.network_attempts > 0);
    if (!blocked) throw new Error("QA network isolation self-probe did not prove deny enforcement");
    return { enforcement: result.isolation, probe_blocked: true };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function assertSafeOutput(root, receiptPath) {
  const canonicalRoot = realpathSync(root);
  const output = resolve(receiptPath);
  const rel = relative(canonicalRoot, output);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new Error("QA output must stay inside the repository");
  }
  let cursor = canonicalRoot;
  for (const part of rel.split(sep)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) continue;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error("QA output path must not contain symlinks");
  }
  return output;
}

function writeReceipt(path, receipt) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const next = `${path}.next`;
  rmSync(next, { force: true });
  const fd = openSync(next, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(receipt, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(next, path);
}

export function runAdversarialQa({ receiptPath, repoRoot = DEFAULT_REPO_ROOT } = {}) {
  if (!receiptPath) throw new Error("adversarial QA receiptPath is required");
  const root = realpathSync(resolve(repoRoot));
  const output = assertSafeOutput(root, receiptPath);
  validateManifest(root);
  const isolation = verifyNetworkIsolation({ repoRoot: root });
  const scratch = mkdtempSync(join(tmpdir(), "tastecheck-v2-qa-"));
  try {
    const suiteResults = [];
    const observedCases = [];
    for (const suite of SUITES) {
      const eventsPath = join(scratch, `${suite.id}.jsonl`);
      const tracePath = join(scratch, `${suite.id}.trace`);
      const run = runIsolated([join(root, suite.file)], {
        cwd: root,
        env: publicEnvironment({ TASTECHECK_V2_QA_EVENTS: eventsPath }),
        tracePath
      });
      const events = existsSync(eventsPath)
        ? readFileSync(eventsPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
        : [];
      observedCases.push(...events.map((entry) => ({ ...entry, suite: suite.id })));
      suiteResults.push({
        id: suite.id,
        source_sha256: suite.source_sha256,
        state: run.status === 0 ? "passed" : "failed",
        blocked_ip_attempts: run.network_attempts
      });
    }

    const expected = QA_CASES.map(({ id, suite }) => `${suite}:${id}`).sort();
    const observed = observedCases.map(({ id, suite }) => `${suite}:${id}`).sort();
    const exactCaseSet = canonical(expected) === canonical(observed);
    const suiteState = new Map(suiteResults.map((entry) => [entry.id, entry.state]));
    const cases = QA_CASES.map((entry) => ({
      id: entry.id,
      suite_id: entry.suite,
      state: exactCaseSet && suiteState.get(entry.suite) === "passed" ? "passed" : "failed"
    }));
    const blockedAttempts = suiteResults.reduce((sum, entry) => sum + entry.blocked_ip_attempts, 0);
    const suiteDigest = sha256(canonical({ cases: QA_CASES, suites: SUITES, isolation: isolation.enforcement }));
    const passed = exactCaseSet && cases.every((entry) => entry.state === "passed") && suiteResults.every((entry) => entry.state === "passed");
    const receipt = {
      schema_version: "effectiveness-v2-adversarial-qa-receipt-v2",
      status: passed ? "passed" : "failed",
      external_calls: isolation.probe_blocked ? 0 : null,
      network_enforcement: isolation.enforcement,
      network_probe_blocked: isolation.probe_blocked,
      blocked_ip_attempts: blockedAttempts,
      exact_case_set: exactCaseSet,
      suite_digest: suiteDigest,
      cases,
      suites: suiteResults
    };
    writeReceipt(output, receipt);
    if (!passed) {
      const failed = suiteResults.filter((entry) => entry.state === "failed").map((entry) => entry.id).join(", ");
      throw new Error(`effectiveness-v2 adversarial QA failed: ${failed || "case-set mismatch"}`);
    }
    return receipt;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function cliOutputPath(argv, root) {
  const index = argv.indexOf("--out");
  if (index < 0 || !argv[index + 1]) throw new Error("usage: adversarial-qa.mjs --out <repo-relative-path>");
  return assertSafeOutput(realpathSync(root), resolve(root, argv[index + 1]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runAdversarialQa({ receiptPath: cliOutputPath(process.argv.slice(2), DEFAULT_REPO_ROOT) });
    console.log("effectiveness-v2 adversarial QA passed; external calls 0");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
