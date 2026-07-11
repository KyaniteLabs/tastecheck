# W1/W4 Integration Handoff

**Wave:** W1 pilot → W4 full eval
**Date:** 2026-07-10 (updated after evaluator architecture correction)
**Owner:** Integration lane
**Lane history:** initial draft → correction pass → infrastructure test repair → integration review → documentation correction → canonical validator and fixtures → judge packet repair → evaluator architecture correction

---

## What Changed This Session

### Evaluator Architecture Correction (2026-07-10)

**Scope:** Replaced the invalid 18-lane-specific packet design with the required 9 lane-agnostic blinded packets + 27 separate result stubs. Judge tests 12/12 pass.

#### Architecture change

| Before (killed) | After (this session) |
|---|---|
| 18 lane-specific packets (`{skill}-{type}-{lane}-001.json`) with judgments embedded | 9 lane-agnostic packets (`{skill}-{type}-001.json`) with no evaluator identity |
| Public index had `judgment_count` + `lane` fields | Public index has `result_count:0`, `status:"pending"`, `packet_hash` |
| Candidate objects had `attempt_id` leaking "upgraded"/"seed101" cues | Candidate objects have only `label`, `raw_output`, `raw_output_hash` |

#### Files changed/created

| Path | Change |
|------|--------|
| `.omx/evidence/tastecheck-v1/raw/judge-packets/` | Replaced 18 lane-specific packets with 9 lane-agnostic packets |
| `.omx/evidence/tastecheck-v1/raw/judge-results/` | Created 27 pending result stubs (luna-1, luna-2, sonnet-1 per packet) |
| `evals/w1/judge-packets/index.json` | Rewritten: 9 lane-agnostic entries, no raw_output |
| `evals/w1/schemas/judge-packet-schema.json` | Rewrote: removed lane/family/model/judgments; candidate allows only label/raw_output/raw_output_hash |
| `evals/w1/schemas/judge-result-schema.json` | Rewrote: result files carry evaluator identity; 6-item calibration; type-specific fields |
| `evals/fixtures/judge-packets/valid-pending.json` | Updated: removed attempt_id, updated packet_id to lane-agnostic form |
| `evals/fixtures/judge-results/` | Created: valid-complete, fabricated-evidence, calibration-fail, insufficient-families, missing-pair-evidence, anti-slop-regex-only, duplicate-judge-ids, cue-leakage |
| `tools/evals/validate-judge-packets.mjs` | Rewritten: exports `validateJudgePacket`, `validateJudgeResult`, `validateJudgeCorpus` |
| `tools/evals/test-judge-packets.mjs` | 12-test suite; all 12 pass |
| `tools/evals/aggregate-w1-receipts.mjs` | Fixed `--allow-incomplete`: always prints RELEASE BLOCKED, exits 0 (was silently skipping block messages) |

#### Test results

```
npm test                 → all 5 checks pass (verify, lint-skills, landing, integration, gate-audit)
npm run eval:w1-test     → 16/16 W1 infra tests pass
npm run eval:w1-judge-test → 12/12 judge tests pass
npm run eval:w1-aggregate:partial → RELEASE BLOCKED (correct: 0/27 judgments, 0/9 artifacts)
```

#### Validator quorum state

9 packets, 27 pending result stubs. Aggregate is release-blocked until:
- 27 valid complete judgments (luna-1, luna-2, sonnet-1 per packet, all calibrated)
- 9 synthesized evaluator artifacts (`{skill}-{type}.json` in `.omx/evidence/tastecheck-v1/raw/evaluators/`)

---

### W1 Infrastructure Repair (2026-07-10)

**Scope:** W1 infrastructure repair only. Skills, contracts, commands, and scenario shards were not modified.

#### Dispatch recurrence
A new sanitized recurrence row was appended to the private dispatch evidence ledger documenting the fourth confirmed instance of zai-glm being returned as the routing candidate. Gap remains UNRESOLVED.

#### aggregate-w1-receipts.mjs repairs
| Bug | Fix |
|-----|-----|
| `j.seed` in `upgradedSeedsComplete` | Fixed to `j.requested_seed` (canonical manifest field) |
| `pendingCount` / `errorCount` derived from manifest static field | Now derived from real ledger status: `pendingCount = missingJobs.length`, `errorCount = ledgerEntries.filter(e => e.status === "error").length` |
| Release gate passed when all 12 jobs complete but evaluator outputs missing | Gate now also checks for all 9 required evaluator output files in `.omx/evidence/tastecheck-v1/raw/evaluators/` before exiting 0 |

Test 12 (`aggregate-receipts: exits 1 when required jobs are pending`) now passes: **16/16 W1 infra tests pass**.

#### ab-mapping.mjs repairs
- `e.variant` → `e.run_type` (canonical ledger field)
- `judgeVisibleCandidate` produces only `{ label, raw_output, raw_output_hash }`; private lineage remains outside the judge-visible candidate
- Private mapping now uses `attempt_id` + `raw_output_hash` instead of stale `run_id` + `output_ref`

#### blind-corpus.mjs repairs
- `entry.variant` → `entry.run_type`
- `entry.run_id` → `entry.attempt_id`
- `entry.seed` → `entry.requested_seed`
- `entry.failure_class` references removed (field not in ledger schema)

#### Judge packet schemas — new
| File | Purpose |
|------|---------|
| `evals/w1/schemas/judge-packet-schema.json` | Strict lane-agnostic blinded packet schema. Candidate objects contain only opaque label, raw output, and hash. |
| `evals/w1/schemas/judge-result-schema.json` | Separate result-slot schema: exactly luna-1, luna-2, sonnet-1 per packet; calibration and candidate-specific evidence are required before a result counts. |

#### Judge packet validator — new
`tools/evals/validate-judge-packets.mjs` validates the whole packet/result corpus and enforces:
- Candidate key cue-leakage (banned: baseline, upgraded, variant, etc.)
- Schema drift (`additionalProperties: false`)
- Fabrication guard (cited_evidence must appear in raw_output)
- Quorum: exactly 3 completed result files per packet
- Family diversity: ≥ 2 evaluator families across completed results
- Pending slots never count; incomplete calibration, duplicate judge IDs, fabricated evidence, and wrong corpus counts fail closed

#### Private judge packets — generated
9 private lane-agnostic packets in `.omx/evidence/tastecheck-v1/raw/judge-packets/`:
- 3 skills × 3 evaluator types (paired_lift, diversity, anti_slop)
- Each packet has 3 separate pending result slots in `.omx/evidence/tastecheck-v1/raw/judge-results/` (27 total): luna-1, luna-2, sonnet-1
- Judge-visible candidates contain only `label`, `raw_output`, and `raw_output_hash`

Public index at `evals/w1/judge-packets/index.json`: 18 entries, hashes and status only, no raw_output.

#### Adversarial fixtures and tests — new
`tools/evals/test-judge-packets.mjs` covers cue leakage, duplicate/family quorum, incomplete calibration, pending-as-complete, fabricated evidence, wrong counts, strict blocking, and partial blocked-status reporting.

#### Package scripts added
```
eval:w1-judge-validate   node tools/evals/validate-judge-packets.mjs
eval:w1-judge-test       node tools/evals/test-judge-packets.mjs
```

#### Terra ratification note
The canonical `scenario_id` → `id` field normalization (7 scenario shards) was an Integration ownership breach reported in prior sessions. Terra ratification of this change is still required before W4 proceeds. Integration confirms registry coherence only.

---

### 0. W1 Infrastructure Tests — 16/16 passing (2026-07-10)

**Two test failures fixed and evaluator entrypoints de-duped.**

#### Test fixes

| Test | Root cause | Fix |
|------|------------|-----|
| `job-manifest: 12 jobs with correct run_type distribution` | Test read `j.seed` but manifest field is `requested_seed` | Changed `j.seed` → `j.requested_seed` in `test-w1-infra.mjs` line 76 |
| `ab-map: 3 pilot skills with distinct A/B labels` | Test accessed `a.job_ids.A/B` but public schema has no `job_ids` — blinded map exposes opaque `A`/`B` null keys only | Replaced `job_ids` accessor with schema-correct `"A" in a && "B" in a` + assertion that `job_ids` is absent |

Result: **16 passed, 0 failed** (`node tools/evals/test-w1-infra.mjs`)

#### Duplicate evaluator cleanup

Canonical implementations per function are now all in `tools/evals/` (top-level) and `tools/evals/evaluators/` (canonical module set). The following **superseded** files inside `tools/evals/evaluators/` had no external code references and were removed:

| Removed | Canonical replacement |
|---------|----------------------|
| `evaluators/adjudicate.mjs` | `tools/evals/adjudicate.mjs` (package.json `eval:adjudicate`) |
| `evaluators/check-anti-slop.mjs` | `tools/evals/check-paired.mjs --check anti-slop` |
| `evaluators/check-diversity.mjs` | `tools/evals/check-paired.mjs --check diversity` |
| `evaluators/check-paired.mjs` | `tools/evals/check-paired.mjs` (package.json `eval:paired`) |
| `evaluators/aggregate-receipts.mjs` | `tools/evals/aggregate-receipts.mjs` (package.json `eval:aggregate`) |
| `evaluators/pilot-manifest.mjs` | `tools/evals/pilot-manifest.mjs` (package.json `eval:pilot-manifest`) |
| `evaluators/rubric.mjs` | `tools/evals/rubric.mjs` (imported by top-level tools) |

Remaining canonical evaluator modules (unchanged):

| File | Exports |
|------|---------|
| `evaluators/anti-slop.mjs` | `evaluateAntiSlop()` |
| `evaluators/diversity.mjs` | `evaluateDiversity()` |
| `evaluators/adjudication.mjs` | `adjudicate()` |
| `evaluators/paired-lift.mjs` | `evaluatePairedLift()` |
| `evaluators/blind-corpus.mjs` | CLI (package.json `eval:blind`) |
| `evaluators/collect-attempt.mjs` | standalone |
| `evaluators/test-sanitizer.mjs` | CLI (package.json `test:eval-schema`) |

Package scripts require no changes — they already targeted canonical paths.

---

### 1. Greenfield Contract — art-direction & micro-motion downstream

`contracts/v1/interviews/greenfield.json` now includes `art-direction` and `micro-motion` in `handoff.downstream`.

**Semantic rationale:**
- `imagery_iconography` dimension → feeds `art-direction` source-and-rights decisions
- `motion` optional dimension → feeds `micro-motion` token plan

**Domain A projection status (verified by Terra):**
Terra confirmed the projector made no writes; projected surfaces were already consistent with the new downstream. check-generated clean, `npm test` passed. No projection reruns required.

### 2. Context Budget — overall_pass now true

`evals/receipts/v1/context-budget.json` updated. All 19 skills within caps after Terra's token reductions.

- `design-system-interview`: was 14,718 bytes (growth_ratio 0.20, FAIL) → now 13,636 bytes (11.1% growth, PASS)
- `improve-existing-website`: was 6,463 bytes (growth_ratio 0.49, FAIL) → now 4,972 bytes (14.2% growth, PASS)

No action required. Receipt is authoritative.

### 3. Scenario Registry — canonical id field, no scenario_id drift

Registry state: 20 scenarios, 19 skills, no missing, no dual-field entries.

Verify: `node tools/evals/build-registry.mjs` → exits 0.

**Ownership note:** Scenario normalization (`scenario_id` → `id` field unification, 7 shards) was an earlier Integration ownership breach. The change has been returned to Terra for ratification. Integration confirms registry coherence only; Terra must ratify the field name change before W4 proceeds.

### 4. W1 Evaluator Infrastructure

#### New files

| Path | Purpose |
|------|---------|
| `evals/w1/operational-matrix.json` | Approved skill × executor matrix |
| `evals/w1/job-manifest.json` | 12 pilot job specs |
| `evals/w1/jobs/*.json` | 12 prompt packets (one per job) |
| `evals/w1/blind-map/ab-map.json` | Randomized evaluator blind assignments |
| `.omx/evidence/tastecheck-v1/ab-unmask.json` | Truth map (private path; open post-evaluation only) |
| `evals/w1/rubric/anchored-rubric.json` | Scoring anchors 1-5 per dimension; paired release requires +0.60 mean delta, 2/3 upgraded preference, no mandatory-dimension regression below -0.25, and no safety/accessibility/contract regression |
| `evals/w1/rubric/calibration.json` | 3 calibration examples with anchor scores |
| `evals/w1/schemas/attempt-output-schema.json` | JSON Schema for raw attempt outputs |
| `evals/w1/schemas/w1-receipt-schema.json` | JSON Schema for W1 receipt |
| `.omx/evidence/tastecheck-v1/raw/ledger.jsonl` | Append-only attempt log (private path; initially empty) |
| `tools/evals/evaluators/paired-lift.mjs` | A/B lift evaluator |
| `tools/evals/evaluators/diversity.mjs` | Structural diversity evaluator |
| `tools/evals/evaluators/anti-slop.mjs` | AI slop pattern detector |
| `tools/evals/evaluators/adjudication.mjs` | Disagreement/majority-vote handler |
| `tools/evals/lib/w1-attempt-validator.mjs` | **Canonical validator library** — used by both CLIs |
| `tools/evals/run-w1-pilot.mjs` | Job runner (discovers external output files; uses canonical validator) |
| `tools/evals/validate-w1-outputs.mjs` | Attempt validator CLI (uses canonical validator) |
| `tools/evals/test-w1-validator.mjs` | 20 validator tests (7 red adversarial + 1 green fixture + 12 real attempts) |
| `tools/evals/aggregate-w1-receipts.mjs` | Receipt aggregator (release-blocking; `--allow-incomplete` for partial check) |
| `tools/evals/test-w1-infra.mjs` | 16 deterministic validation tests |
| `evals/fixtures/sanitizer/*.json` | Sanitizer leak fixtures |
| `evals/fixtures/w1-validator/*.json` | W1 validator adversarial + green fixtures |
| `evals/receipts/v1/codex-outage.json` | Sanitized Codex auth failure record |
| `evals/receipts/v1/w1/w1-pilot-receipt.json` | Partial W1 receipt (pending runs) |

#### Key commands

```bash
# Dry-run: see what jobs would execute
npm run eval:w1-pilot:dry-run

# Validate externally-written output files (from Codex Desktop Terra/Luna)
npm run eval:w1-validate

# Register validated outputs into ledger (idempotent — safe to re-run)
npm run eval:w1-pilot

# Check W1 gate status (blocks release if pending)
npm run eval:w1-aggregate

# Allow partial status check without blocking (flag: --allow-incomplete)
npm run eval:w1-aggregate:partial

# Run all 16 infrastructure validation tests
npm run eval:w1-test

# Run validator unit tests (7 red adversarial + 1 green fixture + 12 real attempts)
node tools/evals/test-w1-validator.mjs
```

#### Canonical validator rules (enforced before any ledger write)

- `additionalProperties: false` — any unknown field is rejected
- Packet binding: `job_id`, `skill`, `scenario_id`, `run_type`, `executor`, `requested_seed`, `requested_temperature`, `observed_seed=null`, `observed_temperature=null`, `skill_version`, `skill_source_path`, `skill_source_sha256` must each match the job packet exactly
- Live re-hash of skill source at `skill_source_path` — compared to both attempt and packet digest
- `raw_output_hash` always required and always recomputed from `raw_output`
- `assertions_result` cardinality and each `assertion_text` must match packet `assertions` exactly
- All 5 `evidence_fields_present` keys required: `status`, `reason`, `remediation`, `evidence`, `provenance`
- `external_source` and `external_source_lane` required
- `date_utc` preserved from attempt when present; **never synthesized in the ledger**
- Idempotent registration: duplicate `attempt_id` in ledger → skip, no duplicate write

### 5. Codex Outage — Encoded Receipt

`evals/receipts/v1/codex-outage.json` records the `refresh_token_reused/token_expired` failure.

**Workaround for Terra/Luna:** Write raw outputs directly to `.omx/evidence/tastecheck-v1/raw/` using the filename convention `<job_id>-attempt-<n>.json` (e.g. `tastecheck-pass-upgraded-seed101-attempt-1.json`). Each file must pass `npm run eval:w1-validate` before ingestion. Set `external_source: true` and `external_source_lane: "terra"` (or `"luna"`). Use distinct attempt index values per thread to avoid collisions.

---

## W4 Requirements (not yet implemented)

W4 extends W1 to all 19 skills × 20 scenarios. The following are required before W4:

1. **Domain A projections already verified** — Terra confirmed projector made no writes, check-generated clean, `npm test` passed. No reruns needed.
2. **W1 pilot jobs must reach 12/12 complete** via external Codex output files or re-authenticated executor.
3. **Evaluator outputs** must be written to `.omx/evidence/tastecheck-v1/raw/evaluators/<skill>-<evaluator>.json` for all 3 pilot skills (9 files total: 3 skills × paired-lift/diversity/anti-slop) before `aggregate-w1-receipts.mjs` (non-partial) will pass the release gate. The partial flag (`--allow-incomplete`) bypasses this check for progress checks only.
4. **Adjudication** must resolve for any skill where evaluators disagree.
5. **W4 operational matrix** should cover all 19 skills × 2 executors. Copy `operational-matrix.json` structure and expand `pilot_skills` → `skills`.

---

## Exact commands to hand to Terra

```bash
# After Terra updates projected surfaces:
node tools/evals/build-registry.mjs        # verify registry still clean
node tools/evals/context-budget.mjs        # verify budget still passes
npm test                                    # full suite

# After Terra/Luna write output files to .omx/evidence/tastecheck-v1/raw/:
npm run eval:w1-validate                   # check all files conform to schema
npm run eval:w1-pilot                      # register them into ledger
npm run eval:w1-aggregate:partial          # check progress without blocking

# Once all 12 complete:
npm run eval:w1-aggregate                  # full gate — exits 0 if ready
```
