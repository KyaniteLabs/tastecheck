#!/usr/bin/env node
/** Prove public-status regeneration remains stable across a no-op file change. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkPublicStatus, derivePublicStatus } from "../tools/release/project-public-status.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT, "_retrofit-2026-09-04/TPS2-STABILITY-PROOF.log");
const NOOP_TARGET = "tools/release/project-public-status.mjs";

function run(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
}

function output(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");
}

function main() {
  const regenerate = run(["tools/release/project-public-status.mjs", "--write"]);
  const regeneratedStatus = derivePublicStatus(ROOT);
  const firstTest = run(["tools/release/test-public-status.mjs"]);
  const sourceBeforeNoop = regeneratedStatus.source_tree_sha256;
  const bytesBeforeNoop = sha256(NOOP_TARGET);

  const targetStat = statSync(join(ROOT, NOOP_TARGET));
  utimesSync(join(ROOT, NOOP_TARGET), targetStat.atime, new Date(targetStat.mtimeMs + 1000));

  const afterNoopStatus = derivePublicStatus(ROOT);
  const bytesAfterNoop = sha256(NOOP_TARGET);
  const secondTest = run(["tools/release/test-public-status.mjs"]);
  const sourceAfterNoop = afterNoopStatus.source_tree_sha256;
  const directErrors = checkPublicStatus(ROOT);
  const stable = regenerate.status === 0
    && firstTest.status === 0
    && secondTest.status === 0
    && sourceBeforeNoop === sourceAfterNoop
    && bytesBeforeNoop === bytesAfterNoop
    && directErrors.length === 0;

  const lines = [
    "TPS2 public-status stability proof",
    "=================================",
    "",
    "This proof exercises regenerate -> persisted projection -> test, then repeats the test after a no-op mtime-only change.",
    "The Git commit boundary is intentionally not invoked here (task GIT: none); the persisted projection and this log are the artifacts for the enclosing commit.",
    "",
    "$ node tools/release/project-public-status.mjs --write",
    `exit: ${regenerate.status ?? 1}`,
    `output: ${output(regenerate) || "(none)"}`,
    `source_tree_sha256_after_regenerate: ${sourceBeforeNoop}`,
    "",
    "$ node tools/release/test-public-status.mjs",
    `exit: ${firstTest.status ?? 1}`,
    `output: ${output(firstTest) || "(none)"}`,
    "",
    `no-op change: mtime-only touch of ${NOOP_TARGET}`,
    `file_sha256_before_noop: ${bytesBeforeNoop}`,
    `file_sha256_after_noop:  ${bytesAfterNoop}`,
    `source_tree_sha256_after_noop: ${sourceAfterNoop}`,
    "",
    "$ node tools/release/test-public-status.mjs",
    `exit: ${secondTest.status ?? 1}`,
    `output: ${output(secondTest) || "(none)"}`,
    `direct_check_errors_after_noop: ${directErrors.length ? directErrors.join("; ") : "none"}`,
    "",
    `stability: ${stable ? "PASS" : "FAIL"}`,
    `regeneration_and_both_tests_passed: ${regenerate.status === 0 && firstTest.status === 0 && secondTest.status === 0}`,
    `source_digest_unchanged: ${sourceBeforeNoop === sourceAfterNoop}`,
    `no_op_file_bytes_unchanged: ${bytesBeforeNoop === bytesAfterNoop}`,
    "",
  ];
  writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`${stable ? "PASS" : "FAIL"}: wrote ${relative(ROOT, OUTPUT_PATH)}`);
  if (!stable) process.exitCode = 1;
}

main();
