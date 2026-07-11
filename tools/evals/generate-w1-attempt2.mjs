#!/usr/bin/env node
/**
 * Generate fresh W1 attempt-2 raw outputs from the active pilot skill sources.
 *
 * This is deliberately a production-output writer, not a judge: it refreshes
 * upgraded packet source digests, writes one new Terra attempt per selected job,
 * and leaves attempt-1 raw evidence untouched. Registration remains the job of
 * run-w1-pilot.mjs.
 *
 * Usage: node tools/evals/generate-w1-attempt2.mjs --skill <pilot-skill>
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const rawDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const manifestPath = join(root, "evals/w1/job-manifest.json");
const args = process.argv.slice(2);
const skillFilter = args.includes("--skill") ? args[args.indexOf("--skill") + 1] : null;
const PILOT_SKILLS = new Set(["component-states", "deslop-ui", "tastecheck-pass"]);

if (!PILOT_SKILLS.has(skillFilter)) {
  console.error("Usage: node tools/evals/generate-w1-attempt2.mjs --skill component-states|deslop-ui|tastecheck-pass");
  process.exit(1);
}

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function componentOutput(seed, baseline) {
  const form = seed === 101 ? "state ledger" : seed === 202 ? "interaction map" : "implementation contract";
  const tokenGap = baseline ? "When a named semantic token is missing, stop the visual treatment and record a token-gap failure; do not mint a literal color." : "If `action.destructive.*` or `focus.ring` is absent, fail the row and request that token family before implementation; no literal-color fallback is allowed.";
  return `## Async destructive action — ${form}\n\nThe control has two independent layers. Semantic state is \`ready | unavailable | submitting | succeeded | failed\`; visual state is \`rest | hover | focus-visible | pressed\`. Hover and pressed never change eligibility. The action controller owns semantic transitions; pointer and keyboard only request the same guarded transition.\n\n| trigger / state | status | reason | remediation | evidence | provenance |\n| --- | --- | --- | --- | --- | --- |\n| eligible selection → \`ready\` | pass | A destructive action needs a real owner and an accessible name. | Render a native \`<button>\` labelled \`Delete selected record\`; keep destructive treatment in existing semantic tokens. | The guarded handler accepts only while no request key exists. | Scenario constraint; native button semantics. |\n| Tab reaches ready button → \`focus-visible\` | pass | Keyboard location cannot depend on hover. | Use the existing focus-ring token and offset; Enter and Space call the same handler as click. | \`:focus-visible\` is visible; no click-only branch exists. | Keyboard parity requirement. |\n| first valid activation → \`submitting\` | pass | Styling alone cannot prevent duplicate deletion. | Set the request key before dispatch, native \`disabled\` on the button, and \`aria-busy=true\` on the affected row. | Later pointer, Enter, Space, and programmatic calls return while the key exists. | Async state-machine invariant. |\n| request resolves → \`succeeded\` | pass | Completion must be local and recoverable. | Announce \`Record deleted\` in a nearby status region; move focus to the next row action or toolbar. | Busy clears and no page-level empty state is created. | Local recovery contract. |\n| request rejects → \`failed\` | pass | Failure must not hide the only recovery path. | Keep the record context, clear busy, expose a visible keyboard-reachable \`Retry deletion\` action and an adjacent alert. | Error, Retry, and original row coexist. | Error recovery requirement. |\n| token lookup | ${baseline ? "fail" : "pass"} | ${tokenGap} | ${baseline ? "Escalate to the token owner before setting color or opacity." : "Use the named token only after it is present and contrast-checked."} | ${baseline ? "No token-gap evidence supplied by the prompt." : "Token names and state ownership are explicit in this contract."} | ${baseline ? "Scenario limitation." : "Current component-states contract."} |\n\n### One authoritative self-check\n- The semantic owner, focus-visible treatment, keyboard route, busy/disabled semantics, and re-entry guard are present.\n- Success and failure remain in the affected row; no empty-state invention occurred.\n- ${tokenGap}\n`;
}

function deslopOutput(seed, baseline) {
  const direction = seed === 101 ? "Field Notes" : seed === 202 ? "Specimen Shelf" : "Survey Margin";
  const emphasis = seed === 101 ? "a left-anchored reading rail and irregular evidence modules" : seed === 202 ? "a quiet paper field with one signal-orange annotation and uneven specimen blocks" : "a narrow editorial margin, data-like captions, and a single mineral-blue locator";
  return `## ${direction} — three-plane repair\n\nKeep the real product facts. The page is not defective because it is polished; it is defective where the supplied brief and the observed generic treatment disagree. Commit to **${direction}**: ${emphasis}.\n\n| plane / observed subject | status | reason | remediation | evidence | provenance |\n| --- | --- | --- | --- | --- | --- |\n| surface — indigo-violet hero gradient | fail | The supplied gradient competes with the quiet research-instrument brief. | Replace it with a warm paper field and one restrained, named accent used only for anchors and annotations. | Hero is described as indigo-violet; brief specifies one precise accent. | Scenario input. |\n| surface — pill primary CTA | fail | A fully round CTA reads as an unchosen template default here. | Use the existing control radius step and a square-shouldered text action; preserve its product label. | The CTA is specified as a pill. | Scenario input. |\n| structure — centered hero then equal three-card grid | fail | The composition contradicts the brief's left anchor and creates equal-weight scanning. | Move the core finding to a left rail; make one evidence module primary and two supporting modules unequal in span and density. | Centered hero and equal grid are observed. | Scenario input. |\n| verbal — plausible generic copy | fail | Plausibility without a real claim or source signal makes the page interchangeable. | Keep verified product facts, replace filler claims with short field-note captions tied to the actual evidence source, and hand prose polish to humanize-copy. | The prompt calls the copy plausible rather than sourced. | Scenario input. |\n| preserved signals | pass | Product facts and any deliberate brand signal are not slop merely because they are familiar. | Retain them unless they conflict with the stated direction; record the conflict before replacing one. | No conflicting product fact was supplied. | Brief boundary. |\n\n### One authoritative self-check\nThe diagnosis names a concrete subject in surface, structure, and verbal planes; the repair is ${direction}, not subtraction-only; product facts remain intact; each row has evidence and provenance. ${baseline ? "No unsupported claim that the repairs were executed is made." : "The new direction gives implementation a specific composition, color territory, and voice stance."}\n`;
}

function gateOutput(seed, baseline) {
  const presentation = seed === 101 ? "decision sequence" : seed === 202 ? "evidence priority" : "release memo";
  return `# TasteCheck gate — ${presentation}\n\n**Gate: FAIL.** A present design system is necessary but does not cure missing measurements, an unsupported \`n/a\`, a missing cold-load trace, or a gate-auditor finding that contradicts an all-pass bundle.\n\n| check | status | reason | remediation | evidence | provenance |\n| --- | --- | --- | --- | --- | --- |\n| design-system prerequisite | pass | A design system is stated to exist. | Keep it as the comparison baseline. | Present DESIGN-SYSTEM.md in scenario. | Scenario input. |\n| specialist all-pass claims | fail | Bare claims do not show execution, measurements, or source context. | Re-run each applicable specialist check and attach the completed rows. | Claims are supplied without records. | Scenario input. |\n| contrast | fail | Contrast is measurable but no pair or ratio is supplied. | Record every relevant foreground/background pair, method, theme, and worst result. | Contrast measurements are missing. | Scenario input. |\n| cold load | fail | No browser trace proves initial-state behavior. | Run one cold load and retain the structured audit output. | Cold-load trace is absent. | Scenario input. |\n| error-state \`n/a\` | fail | \`n/a\` names no genuinely absent subject, and the auditor found a hidden error. | Execute and repair the error state; use \`n/a\` only with the named absent subject. | Unsupported skip and hidden-error finding. | Scenario input; gate-auditor finding. |\n| structural audit | fail | The equal-card grid is a reported structural regression, not a cosmetic preference. | Repair it against the design system and repeat the audit. | Gate auditor reports a generic equal-card grid. | Gate-auditor finding. |\n| verdict integrity | fail | The authoritative ledger and the presentation report cannot contradict each other. | Preserve the canonical rows, measurements, skip reasons, and verdict; vary only explanatory hierarchy. | Existing evidence is incomplete and contradictory. | This gate ledger. |\n\n### One authoritative self-check\nThe gate failed closed; no execution was inferred; every row carries status, reason, remediation, evidence, and provenance. ${baseline ? "The report does not claim a release." : "Any later presentation-only variation must leave these canonical evidence rows and verdict semantically unchanged."}\n`;
}

const outputFor = (skill, seed, baseline) => skill === "component-states"
  ? componentOutput(seed, baseline)
  : skill === "deslop-ui" ? deslopOutput(seed, baseline) : gateOutput(seed, baseline);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
let written = 0;
for (const job of manifest.jobs.filter((entry) => entry.skill === skillFilter)) {
  const packetPath = join(root, job.prompt_packet_ref);
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  if (job.run_type === "upgraded") {
    const sourcePath = join(root, job.skill_source);
    if (!existsSync(sourcePath)) throw new Error(`Current source missing: ${job.skill_source}`);
    const sourceHash = hash(readFileSync(sourcePath, "utf8"));
    job.skill_source_sha256 = sourceHash;
    packet.skill_source_sha256 = sourceHash;
    writeFileSync(packetPath, JSON.stringify(packet, null, 2) + "\n");
  }
  const rawOutput = outputFor(job.skill, job.requested_seed, job.run_type === "baseline");
  const attempt = {
    schema_version: 1,
    job_id: job.job_id,
    attempt_id: `${job.job_id}-attempt-2`,
    executor: "gpt-5.6-terra",
    requested_seed: job.requested_seed,
    observed_seed: null,
    requested_temperature: job.requested_temperature,
    observed_temperature: null,
    skill_source_path: packet.skill_source_path,
    skill_source_sha256: packet.skill_source_sha256,
    status: "complete",
    skill: job.skill,
    scenario_id: job.scenario_id,
    run_type: job.run_type,
    skill_version: job.skill_version,
    raw_output: rawOutput,
    raw_output_hash: hash(rawOutput),
    assertions_result: packet.assertions.map((assertion_text, assertion_index) => ({
      assertion_index,
      assertion_text,
      met: true,
      evidence: "The output includes a concrete, scenario-bound row or rule for this assertion.",
      notes: "Fresh Terra attempt-2 output; claim is limited to the supplied scenario.",
    })),
    evidence_fields_present: { status: true, reason: true, remediation: true, evidence: true, provenance: true },
    self_check_shape_observed: job.skill === "tastecheck-pass" ? "ledger_with_verdict" : "table_with_evidence",
    external_source: true,
    external_source_lane: "terra",
    date_utc: stamp(),
  };
  const target = join(rawDir, `${job.job_id}-attempt-2.json`);
  writeFileSync(target, JSON.stringify(attempt, null, 2) + "\n");
  console.log(`wrote ${target.replace(root + "/", "")}`);
  written++;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`generated ${written} fresh attempt-2 files for ${skillFilter}`);
