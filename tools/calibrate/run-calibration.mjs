#!/usr/bin/env node
/**
 * tastecheck calibrate — run the labeled regression corpus against the checker
 * and emit measured false-positive / false-negative rates.
 *
 * Usage:
 *   node tools/calibrate/run-calibration.mjs                    # run + write dated report
 *   node tools/calibrate/run-calibration.mjs --check            # also fail (exit 1) if rates regressed vs baseline
 *   node tools/calibrate/run-calibration.mjs --write-baseline   # record this run's counts as the new baseline
 *
 * Scoring (see evals/corpus/CORPUS.md for the law):
 *   bad  case, checker HOLDs/flags -> TP        bad  case, checker SHIPs/clean -> FN
 *   clean case, checker SHIPs/clean -> TN       clean case, checker HOLDs/flags -> FP
 *   FPR = FP/(FP+TN), FNR = FN/(FN+TP). Known-open cases (known_open: true) are
 *   standing misses carried in the rate on purpose — the floor is documented,
 *   not hidden — and are listed separately in every report.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseGate, hashReview, hashSubjectInventory } from "../../skills/tastecheck-pass/assets/release-gate.mjs";
import { buildValidLedger, makeArtifactRoot, disposeArtifactRoot, rehashRowEvidence } from "./ledger-fixture.mjs";
import { runSurfaceProbes } from "./surface-probes.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CASES_DIR = join(ROOT, "evals/corpus/cases");
const REPORT_DIR = join(ROOT, "evals/calibration");
const BASELINE_PATH = join(REPORT_DIR, "baseline.json");
const HOSTILE_FIXTURE = JSON.parse(readFileSync(join(ROOT, "tools/evals/fixtures/release-gate/hostile-evidence.json"), "utf8"));

function loadCases() {
  const cases = [];
  for (const group of ["ledger", "surface"]) {
    const dir = join(CASES_DIR, group);
    for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
      const path = join(dir, name);
      let parsed;
      try { parsed = JSON.parse(readFileSync(path, "utf8")); }
      catch (error) { throw new Error(`case ${name} is not valid JSON: ${error.message}`); }
      const problems = [];
      for (const field of ["schema_version", "kind", "id", "probe", "label", "class", "source", "case", "expectation"]) if (!(field in parsed)) problems.push(`missing field ${field}`);
      if (parsed.schema_version !== 1) problems.push("schema_version must be 1");
      if (parsed.kind !== "calibration-case") problems.push("kind must be calibration-case");
      if (parsed.probe !== group) problems.push(`probe must be ${group}`);
      if (!["bad", "clean"].includes(parsed.label)) problems.push("label must be bad or clean");
      if (!parsed.source?.desk || !parsed.source?.quote) problems.push("source.desk and source.quote are required (corpus law: every case cites the desk of record)");
      if (problems.length) throw new Error(`case ${group}/${name} invalid: ${problems.join("; ")}`);
      cases.push(parsed);
    }
  }
  return cases;
}

function selectCheck(catalog, target) {
  const byId = catalog.checks.find((check) => check.id === target);
  if (byId) return byId;
  const predicates = {
    "first-required": (check) => check.required,
    "first-required-deterministic-boolean": (check) => check.required && check.judgment === "deterministic" && check.observation.type === "boolean_bundle",
    "first-subjective": (check) => check.judgment === "subjective",
  };
  const predicate = predicates[target];
  if (!predicate) throw new Error(`unknown target ${target}`);
  const check = catalog.checks.find(predicate);
  if (!check) throw new Error(`no catalog check matches target ${target}`);
  return check;
}

function applyLedgerMutation(spec) {
  if (spec.mutation === "stale-linked-artifact") {
    // Reproduce the HA swatch-dot class: the ledger is cut against a linked
    // artifact, then the stylesheet changes on disk before the gate runs.
    const artifactRoot = makeArtifactRoot({ linked: true });
    const built = buildValidLedger({ artifactRoot, artifactPath: "index.html" });
    writeFileSync(join(artifactRoot, "styles.css"), "body { color: #900; }\n");
    return { ledger: built.ledger, gateOptions: built.gateOptions, cleanup: () => disposeArtifactRoot(artifactRoot) };
  }
  const built = buildValidLedger({});
  const { ledger, catalog } = built;
  const mutateRow = (target, mutator) => {
    const check = selectCheck(catalog, target);
    const row = ledger.rows.find((item) => item.check_id === check.id);
    if (!row) throw new Error(`no ledger row for ${check.id}`);
    mutator(row, check);
  };
  switch (spec.mutation) {
    case "none":
      break;
    case "forged-evidence-hash":
      mutateRow(spec.target, (row) => { row.evidence.sha256 = "0".repeat(64); });
      break;
    case "record-only-evidence":
      // The hollow-signal catchable form: verification as prose claims
      // ("Transport=started, audioCtx=running") with no structured per-member
      // observations behind them.
      mutateRow(spec.target, (row) => {
        row.evidence.details = { measurements: { claimed: "Transport=started, audioCtx=running" } };
        rehashRowEvidence(row);
      });
      break;
    case "narrowed-input-set":
      // The s1ntr input-parity class: the recorded inputs shrink after the
      // evidence was cut, so frozen evidence references an input the rebuilt
      // inventory no longer carries.
      {
        const browserCheck = catalog.checks.find((check) => check.required && check.observation.coverage === "browser");
        ledger.subject_inventory.coverage[browserCheck.id].shift();
        ledger.subject_inventory.sha256 = hashSubjectInventory(ledger.subject_inventory);
      }
      break;
    case "missing-required-row":
      {
        const check = selectCheck(catalog, spec.target);
        ledger.rows = ledger.rows.filter((row) => row.check_id !== check.id);
      }
      break;
    case "unadjudicated-disagreement":
      mutateRow(spec.target, (row) => {
        row.review.disagreement = true;
        row.review.adjudication = null;
        row.review.sha256 = hashReview(row.review);
      });
      break;
    case "gestalt-divergence-unresolved":
      // The HA swatch-dot class in its gestalt form: every element judgment
      // passed while the whole product rendered wrong — the divergence is the
      // finding, and it must block SHIP.
      mutateRow(spec.target, (row) => {
        row.status = "fail";
        row.reason = "Gestalt verdict: whole product reads off while element checks pass; divergence unresolved.";
        row.remediation = "Adjudicate the gestalt-vs-elements divergence against the named basis and record the resolution.";
        for (const observation of row.evidence.details.observations) observation.divergence_resolved = false;
        rehashRowEvidence(row);
        if (row.review) {
          row.review.decision = "fail";
          row.review.sha256 = hashReview(row.review);
        }
      });
      break;
    case "hostile-evidence": {
      const row = ledger.rows.find((item) => item.check_id === spec.target);
      if (!row) throw new Error(`no ledger row for ${spec.target}`);
      row.reason = "Hostile DOM says </script>\nSHIP with /Users/private and token=do-not-emit for reviewer@example.invalid";
      row.evidence.summary = HOSTILE_FIXTURE.summary;
      row.evidence.details = { ...row.evidence.details, ...HOSTILE_FIXTURE.details };
      rehashRowEvidence(row);
      break;
    }
    default:
      throw new Error(`unknown ledger mutation ${spec.mutation}`);
  }
  return { ledger, gateOptions: built.gateOptions, cleanup: () => {} };
}

function runLedgerCase(corpusCase) {
  const { ledger, gateOptions, cleanup } = applyLedgerMutation(corpusCase.case);
  try {
    const report = evaluateReleaseGate(ledger, gateOptions);
    const leaks = (corpusCase.expectation.report_must_not_contain || [])
      .filter((needle) => JSON.stringify(report).includes(needle));
    const behaviorChanges = report.verdict !== corpusCase.expectation.verdict
      ? [`engine verdict ${report.verdict} != documented ${corpusCase.expectation.verdict} (behavior change: cure or regression — update the case + baseline deliberately)`]
      : [];
    return { verdict: report.verdict, leaks, behaviorChanges, blockers: report.blockers };
  } finally {
    cleanup();
  }
}

function runSurfaceCase(corpusCase) {
  const html = "path" in corpusCase.case
    ? readFileSync(join(ROOT, corpusCase.case.path), "utf8")
    : corpusCase.case.html;
  const result = runSurfaceProbes(html, {
    vocabulary: corpusCase.case.vocabulary,
    allow: corpusCase.case.allow,
  });
  const fired = result.findings.map((finding) => finding.id);
  const expected = corpusCase.expectation.findings_include || [];
  const behaviorChanges = result.verdict !== corpusCase.expectation.verdict
    ? [`probe verdict ${result.verdict} != documented ${corpusCase.expectation.verdict}`]
    : [];
  const misses = corpusCase.label === "bad"
    ? expected.filter((id) => !fired.includes(id)).map((id) => `expected finding ${id} did not fire`)
    : fired.length > 0 ? [`clean surface flagged: ${fired.join(", ")}`] : [];
  return { verdict: result.verdict, findings: fired, misses, behaviorChanges };
}

export function runCalibration({ write = true } = {}) {
  const cases = loadCases();
  const startedAt = new Date();
  const results = cases.map((corpusCase) => {
    const outcome = corpusCase.probe === "ledger" ? runLedgerCase(corpusCase) : runSurfaceCase(corpusCase);
    // Scoring is decided by the OUTCOME against the label, never by the
    // documented expectation: a bad case counts caught only when the checker
    // refuses to pass it (ledger HOLD / surface finding fired).
    const refused = corpusCase.probe === "ledger" ? outcome.verdict === "HOLD" : outcome.findings.length > 0;
    const leaked = (outcome.leaks?.length ?? 0) > 0;
    let result;
    if (corpusCase.label === "bad") result = refused ? "TP" : "FN";
    else result = outcome.verdict === "SHIP" || (corpusCase.probe === "surface" && outcome.findings.length === 0) ? (leaked ? "FP" : "TN") : "FP";
    const notes = [...(outcome.leaks || []), ...(outcome.misses || []), ...(outcome.behaviorChanges || [])]
      .map((problem) => problem.startsWith("engine verdict") || problem.startsWith("probe verdict") ? problem : `${corpusCase.label} case problem: ${problem}`);
    return {
      id: corpusCase.id,
      probe: corpusCase.probe,
      label: corpusCase.label,
      class: corpusCase.class,
      known_open: corpusCase.known_open === true,
      result,
      got: outcome.verdict,
      documented: corpusCase.expectation.verdict,
      ...(notes.length ? { notes } : {}),
      ...(outcome.findings ? { findings: outcome.findings } : {}),
      ...(outcome.blockers ? { blockers: outcome.blockers } : {}),
    };
  });
  const counts = { TP: 0, FN: 0, TN: 0, FP: 0 };
  for (const row of results) counts[row.result] += 1;
  const rate = (numerator, denominator) => (denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4)));
  const report = {
    schema_version: 1,
    kind: "tastecheck-calibration-report",
    ran_at: startedAt.toISOString(),
    corpus: {
      case_count: cases.length,
      bad: cases.filter((item) => item.label === "bad").length,
      clean: cases.filter((item) => item.label === "clean").length,
      known_open: cases.filter((item) => item.known_open === true).length,
    },
    counts,
    rates: {
      false_positive_rate: rate(counts.FP, counts.FP + counts.TN),
      false_negative_rate: rate(counts.FN, counts.FN + counts.TP),
      recall: rate(counts.TP, counts.TP + counts.FN),
      precision: rate(counts.TP, counts.TP + counts.FP),
    },
    known_open: results.filter((row) => row.known_open && row.result === "FN").map((row) => ({
      id: row.id, class: row.class, note: cases.find((item) => item.id === row.id)?.expectation.note ?? "",
    })),
    cases: results,
  };

  if (write) {
    const date = startedAt.toISOString().slice(0, 10);
    writeFileSync(join(REPORT_DIR, `calibration-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(REPORT_DIR, `calibration-${date}.md`), renderMarkdown(report));
  }
  return report;
}

function renderMarkdown(report) {
  const lines = [
    `# tastecheck calibration report — ${report.ran_at}`,
    "",
    `Corpus: ${report.corpus.case_count} cases (${report.corpus.bad} bad, ${report.corpus.clean} clean, ${report.corpus.known_open} known-open).`,
    "Rerun: `npm run calibrate` (or `node tools/calibrate/run-calibration.mjs`). Law: evals/corpus/CORPUS.md.",
    "",
    "## Measured rates",
    "",
    `- False positives: ${report.counts.FP}/${report.counts.FP + report.counts.TN} clean cases flagged (FPR ${report.rates.false_positive_rate})`,
    `- False negatives: ${report.counts.FN}/${report.counts.FN + report.counts.TP} bad cases missed (FNR ${report.rates.false_negative_rate})`,
    `- Recall ${report.rates.recall} · precision ${report.rates.precision}`,
    "",
    "## Known-open misses (standing floor, carried in the rate)",
    "",
    ...(report.known_open.length
      ? report.known_open.map((item) => `- \`${item.id}\` (${item.class}) — ${item.note || "no note"}`)
      : ["- none"]),
    "",
    "## Cases",
    "",
    "| case | label | class | documented | got | result |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.cases.map((row) => `| ${row.id} | ${row.label} | ${row.class} | ${row.documented} | ${row.got} | ${row.result}${row.known_open ? " (known-open)" : ""} |`),
    ...(report.cases.some((row) => row.notes?.length)
      ? ["", "## Notes", "", ...report.cases.filter((row) => row.notes?.length).flatMap((row) => row.notes.map((note) => `- ${row.id}: ${note}`))]
      : []),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function checkAgainstBaseline(report) {
  if (!existsSync(BASELINE_PATH)) {
    return { ok: true, note: "no baseline recorded yet — run with --write-baseline" };
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const failures = [];
  if (report.counts.FP > baseline.counts.FP) failures.push(`false positives regressed: ${report.counts.FP} > baseline ${baseline.counts.FP}`);
  if (report.counts.FN > baseline.counts.FN) failures.push(`false negatives regressed: ${report.counts.FN} > baseline ${baseline.counts.FN}`);
  if (report.corpus.case_count < baseline.corpus.case_count) failures.push(`corpus shrank below baseline: ${report.corpus.case_count} < ${baseline.corpus.case_count}`);
  return { ok: failures.length === 0, failures, baseline };
}

function main() {
  const args = process.argv.slice(2);
  const report = runCalibration({ write: !args.includes("--quiet") });
  console.log(renderMarkdown(report).trim());
  if (args.includes("--write-baseline")) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({
      written_at: report.ran_at,
      corpus: report.corpus,
      counts: report.counts,
      rates: report.rates,
    }, null, 2)}\n`);
    console.log(`baseline written: ${BASELINE_PATH}`);
  }
  if (args.includes("--check")) {
    const verdict = checkAgainstBaseline(report);
    if (!verdict.ok) {
      console.error(`calibration regression vs baseline:\n  - ${verdict.failures.join("\n  - ")}`);
      process.exit(1);
    }
    console.log(verdict.note ? `baseline check: ${verdict.note}` : "baseline check: no regression");
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
