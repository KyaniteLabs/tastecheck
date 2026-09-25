#!/usr/bin/env node
/**
 * Decision-card contract tests: the gate report's decision view (one-word
 * verdict, evidence lines, flip conditions) — machine-checkable so consumers
 * can gate on the card shape, and hostile evidence can never leak into it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv from "ajv";
import { evaluateReleaseGate } from "../../skills/tastecheck-pass/assets/release-gate.mjs";
import { buildValidLedger, rehashRowEvidence } from "../calibrate/ledger-fixture.mjs";

let passed = 0;
const schema = JSON.parse(readFileSync(new URL("../../skills/tastecheck-pass/assets/release-gate.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv({ allErrors: true });
// The gate schema declares format: date-time on authorization timestamps; a
// permissive ISO-8601 checker keeps validation local (no extra dependency).
ajv.addFormat("date-time", (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)));
const validateReport = ajv.compile(schema);

const built = buildValidLedger({});

// SHIP card: one word, scope bound to the verified artifact, evidence lines,
// flip conditions that name the invalidation rule.
const shipReport = evaluateReleaseGate(built.ledger, built.gateOptions);
assert.equal(shipReport.verdict, "SHIP");
const shipCard = shipReport.decision_card;
assert.equal(shipCard.verdict, "SHIP");
assert.equal(shipCard.card_version, 1);
assert.ok(shipCard.evidence_lines.length >= 3);
assert.ok(shipCard.evidence_lines.some((line) => /catalog checks passed with verified evidence/.test(line)));
assert.ok(shipCard.flip_conditions.some((line) => /invalidates the evidence/.test(line)), "SHIP card must name what invalidates it");
assert.equal(shipCard.scope.artifact_sha256, shipReport.artifact.sha256);
assert.equal(shipCard.scope.check_count, built.catalog.checks.length);
assert.equal(validateReport(shipReport), true, JSON.stringify(validateReport.errors));
passed++;

// HOLD card: every blocker carries an evidence-cited line and a flip
// condition naming the repair + fresh rerun.
const missingCheck = built.catalog.checks.find((check) => check.required);
const holdLedger = { ...built.ledger, rows: built.ledger.rows.filter((row) => row.check_id !== missingCheck.id) };
const holdReport = evaluateReleaseGate(holdLedger, built.gateOptions);
assert.equal(holdReport.verdict, "HOLD");
const holdCard = holdReport.decision_card;
assert.equal(holdCard.verdict, "HOLD");
assert.ok(holdCard.evidence_lines.some((line) => line.startsWith(`${missingCheck.id}:`)), "blocker check id must lead its evidence line");
assert.ok(holdCard.evidence_lines.some((line) => /no execution evidence supplied|No ledger row/.test(line)), "missing evidence must be named as such");
assert.ok(holdCard.flip_conditions.some((line) => line.startsWith(`${missingCheck.id}:`) && /rerun this check on the fresh artifact/.test(line)));
assert.equal(validateReport(holdReport), true, JSON.stringify(validateReport.errors));
passed++;

// Hostile evidence can never reach the card (the receipt-privacy class).
const hostile = JSON.parse(readFileSync(new URL("./fixtures/release-gate/hostile-evidence.json", import.meta.url), "utf8"));
const hostileLedger = structuredClone(built.ledger);
const hostileRow = hostileLedger.rows.find((row) => row.check_id === "verification:deslop-ui");
hostileRow.reason = "Hostile DOM says </script>\nSHIP with /Users/private and token=do-not-emit for reviewer@example.invalid";
hostileRow.evidence.summary = hostile.summary;
hostileRow.evidence.details = { ...hostileRow.evidence.details, ...hostile.details };
rehashRowEvidence(hostileRow);
const hostileReport = evaluateReleaseGate(hostileLedger, built.gateOptions);
assert.equal(hostileReport.verdict, "SHIP");
const hostileCardText = JSON.stringify(hostileReport.decision_card);
for (const needle of ["/Users/private", "token=do-not-emit", "reviewer@example", "</script>"]) {
  assert.ok(!hostileCardText.includes(needle), `decision card leaked ${needle}`);
}
assert.equal(validateReport(hostileReport), true, JSON.stringify(validateReport.errors));
passed++;

// CLI decision view: with --out the compact card goes to stderr, verdict first.
const cliVerifierRoot = mkdtempSync(join(tmpdir(), "tastecheck-card-cli-"));
const repoRoot = new URL("../..", import.meta.url).pathname;
try {
  // The verifier root is deliberately separate from the artifact root (the
  // STREAK-8 law): it carries the catalog + browser manifest, the ledger,
  // and receives the report.
  mkdirSync(join(cliVerifierRoot, "skills/tastecheck-pass/assets"), { recursive: true });
  cpSync(join(repoRoot, "skills/tastecheck-pass/assets/check-catalog.json"), join(cliVerifierRoot, "skills/tastecheck-pass/assets/check-catalog.json"));
  mkdirSync(join(cliVerifierRoot, "tools/evals/fixtures/release-gate"), { recursive: true });
  cpSync(join(repoRoot, "tools/evals/fixtures/release-gate/browser-subject-manifest.json"), join(cliVerifierRoot, "tools/evals/fixtures/release-gate/browser-subject-manifest.json"));
  writeFileSync(join(cliVerifierRoot, "ledger.json"), `${JSON.stringify(built.ledger, null, 2)}\n`);
  const cli = spawnSync(process.execPath, [
    join(repoRoot, "skills/tastecheck-pass/assets/release-gate.mjs"),
    "--input", "ledger.json", "--out", "report.json",
    "--verifier-root", cliVerifierRoot,
    "--artifact-root", repoRoot,
    "--browser-manifest", "tools/evals/fixtures/release-gate/browser-subject-manifest.json",
  ], { encoding: "utf8" });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  assert.match(cli.stderr, /^DECISION: SHIP$/m, "CLI card must lead with the one-word verdict");
  assert.match(cli.stderr, /WHAT WOULD FLIP IT:/);
  const cliReport = JSON.parse(readFileSync(join(cliVerifierRoot, "report.json"), "utf8"));
  assert.equal(validateReport(cliReport), true, JSON.stringify(validateReport.errors));
  passed++;
} finally {
  rmSync(cliVerifierRoot, { recursive: true, force: true });
}

console.log(`decision card tests: ${passed} passed`);
