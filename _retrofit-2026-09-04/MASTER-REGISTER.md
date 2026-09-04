# Tastecheck master retrofit register

Synthesized from all seven available stage-2 reports. The missing `luna-correctness` voice was excluded as directed. `FINDINGS-floor-lfm.md` and `FINDINGS-dsv4.md` end mid-response; their usable observations are included, but they do not independently establish severity. The practitioner verdict is mildly contended: `FINDINGS-floor-crack.md` calls the concept GOOD-ENOUGH, while the chief, coherence, risk, and fresh-eyes reports identify release-blocking implementation gaps. No concrete finding was contradicted by a majority.

## Merged findings

| ID | Title | Severity consensus | Corroborating voices | Strongest file:line evidence | Fix sketch |
|---|---|---:|---|---|---|
| MR-001 | Required gate predecessor does not exist and the embedded contract disagrees with canonical JSON | P0 | `FINDINGS-sol.md`, `FINDINGS-luna-b.md`, `FINDINGS-dsv4.md` | `skills/tastecheck-pass/SKILL.md:43-47,88`; `skills/tastecheck-pass/contract.json:5,10` | Decide `deslop-ui` versus a new `design-critique` skill as one atomic product decision. Restore the canonical predecessor in the ordered gate and regenerate its embedded contract, or add the complete replacement across skill, contract, manifest, command, and public pipeline. Reject unknown skill references and generated-block drift in tests. |
| MR-002 | The installable pack contains a broken `deslop-ui` skill | P0 | `FINDINGS-sol.md`, `FINDINGS-luna-b.md` | `skills/deslop-ui/SKILL.md:55-60,68-78`; deleted `skills/deslop-ui/contract.json` and four `skills/deslop-ui/references/*.md` | Restore or deliberately replace the five deleted resources as one artifact family. Add an atomic installer preflight that validates `SKILL.md`, `contract.json`, and every local reference before linking anything. |
| MR-003 | Missing gate evidence defaults to a shippable verdict | P0 | `FINDINGS-sol.md`, conceptually reinforced by `FINDINGS-bonus-grok.md` and `FINDINGS-floor-crack.md` | `tools/lib/nima.mjs:87-91`; `tools/test/nima.test.mjs:76-83` | Validate gate input before combining. Map missing, malformed, empty, and unknown verdicts to `HOLD`/`FAIL` or a distinct non-shippable `ERROR`; add negative fixtures for each case. |
| MR-004 | Released skill, command, gallery, and version inventories disagree | P1 | `FINDINGS-sol.md`, `FINDINGS-luna-b.md` | `skills.json:3-18`; `contracts/v1/commands.json:3,26-31`; `README.md:9,21,44,80`; `index.html:3-4,49,53,314-337`; `samples/index.html:3,68-69,139-145` | Decide whether `tasteroll` is released. Generate counts, command coverage, versions, and gallery totals from one release-facts source; treat aliases and dated historical receipts separately. |
| MR-005 | The flagship “release gate” automates only a small heuristic subset | P1 | `FINDINGS-sol.md`, `FINDINGS-floor-champion.md`, `FINDINGS-floor-crack.md`, `FINDINGS-dsv4.md` | `skills/tastecheck-pass/assets/gate-audit.js:38-180`; `skills/tastecheck-pass/SKILL.md:30-35,49-60,75-79`; `tools/verify-gate-audit.mjs:7-14` | Rename the existing asset as a cold-load heuristic and implement a separate release-gate runner. Give every mandatory row a closed ID, explicit applicability rule, evidence/provenance schema, and automated or explicitly manual status. Missing required evidence must remain non-passing. |
| MR-006 | Required scope, `n/a`, real-artifact input, and provenance rules are ambiguous and gameable | P1 | `FINDINGS-bonus-grok.md`, `FINDINGS-floor-champion.md`, `FINDINGS-floor-crack.md` | `skills/tastecheck-pass/SKILL.md:26-35,43-60` | Define accepted artifact inputs and failure output; publish a closed check catalog; encode required/applicable predicates; require an evidence hash, artifact identity, timestamp, tool/browser identity, and inspector for manual evidence. Forbid `n/a` on foundations and require proof that optional subjects are absent. |
| MR-007 | Audit data and target-origin execution lack trust and safety boundaries | P1 | `FINDINGS-bonus-grok.md`; risk echoed by manual-evidence concerns in `FINDINGS-floor-crack.md` | `skills/tastecheck-pass/SKILL.md:49-60` and `skills/tastecheck-pass/assets/gate-audit.js` target-origin execution described in `FINDINGS-bonus-grok.md:4-17` | Make audit mode read-only; separate fixes into a newly authorized pass. Treat specs, DOM text, class names, audit JSON, and specialist reports as untrusted data. Ban authenticated-production injection by default, redact captured text, constrain output, and verify hashed evidence against a schema. |
| MR-008 | Verification can pass contradictions, stops opaquely, and is not clean-clone reproducible | P1 | `FINDINGS-sol.md`, `FINDINGS-luna-b.md` | `tools/lint-skills.mjs:65-77`; `tools/verify-landing.mjs:108-118`; `package.json:7,98-106`; `tools/contracts/test-contracts.mjs:12-21`; `tools/contracts/check-generated.mjs:14-25` | Split dependency-free structural checks from browser/Oracle checks, preflight dependencies, and run both in CI. Fail unknown references, accumulate all missing/invalid/drift errors, compare embedded blocks byte-for-byte, and include contract checks in the required umbrella command. |
| MR-009 | Public PASS and verification claims are self-attested or stale | P1 | `FINDINGS-sol.md`, `FINDINGS-dsv4.md`; evidence-integrity concern reinforced by `FINDINGS-bonus-grok.md` | `index.html:447-449,487`; `README.md:23,151-159` | Generate public status from dated, hashed release receipts. Any missing, stale, malformed, or failed required receipt must render `HOLD`/`UNVERIFIED`; a deliberate failed fixture must flip the public result. Clearly label simulated and historical evidence. |
| MR-010 | Subjective audits are presented as deterministic without independence or adjudication | P2 | `FINDINGS-floor-crack.md`, `FINDINGS-floor-champion.md`, `FINDINGS-bonus-grok.md` | `skills/tastecheck-pass/SKILL.md:43-60,75-79` | Separate deterministic policy checks from reviewer judgments. Define rubrics, reviewer identity, disagreement/adjudication rules, and independent review for any subjective row that can affect SHIP/HOLD; stop using “deterministic” for unverified LLM-authored ledgers. |
| MR-011 | `humanize-copy` is not portable and its contract omits the new mandatory dependency | P2 | `FINDINGS-luna-b.md` | `skills/humanize-copy/SKILL.md:87-90`; `skills/humanize-copy/contract.json:18-20`; `README.md:164`; `llms.txt:7-8` | Bundle the minimal writing rules in the repository or make them an optional named input with a portable fallback. If mandatory, add the resource/input and handoff evidence to the contract and regenerate projections. |
| MR-012 | Browser, accessibility, and effectiveness claims lack current external execution proof | P2 | `FINDINGS-dsv4.md`, with runtime uncertainty corroborated by `FINDINGS-sol.md` and `FINDINGS-luna-b.md` | `FINDINGS-sol.md:89-93`; `FINDINGS-luna-b.md:61-64`; claimed status at `index.html:447-449` | Produce current browser/manual receipts for keyboard, zoom, contrast, reduced motion, iframe/shadow-root coverage, and cold load; validate effectiveness claims against actual judge/result packets rather than schemas, fixtures, screenshots, or workflow definitions alone. Keep unexecuted claims `UNVERIFIED`. |

## Fix waves

Each wave contains at most ten findings and can be executed and committed as a focused run. A wave may start from the same audited baseline or from committed earlier waves; none relies on another worker’s uncommitted state.

### W1 — restore fail-closed authority

- Scope: `skills/tastecheck-pass/SKILL.md`, `skills/tastecheck-pass/contract.json`, `skills/deslop-ui/contract.json`, `skills/deslop-ui/references/*.md`, `install.sh`, `tools/lib/nima.mjs`, `tools/test/nima.test.mjs`, focused installer/contract fixtures.
- Rows: MR-001, MR-002, MR-003.
- Acceptance: `node tools/verify.mjs && npm run test:contracts && node --test tools/test/nima.test.mjs && tmp_home="$(mktemp -d)" && HOME="$tmp_home" ./install.sh && test -f "$tmp_home/.agents/skills/deslop-ui/contract.json"`; expected: every command exits 0, all 20 installed skills are complete, unknown/missing gate inputs assert a non-shippable result, and no generated contract block drifts.
- Rollback: revert the single W1 commit; do not restore or discard unrelated pre-existing worktree edits.

### W2 — establish one release inventory

- Scope: `skills.json`, `contracts/v1/commands.json`, the chosen `commands/*.md`, `package.json`, `README.md`, `llms.txt`, `index.html`, `docs/LAUNCH.md`, `docs/VERIFICATION.md`, `samples/index.html`, and a generated release-facts source/projector under `tools/`.
- Rows: MR-004.
- Acceptance: `node tools/lint-skills.mjs && node tools/verify-landing.mjs && node tools/verify-integration.mjs && npm run test:contracts`; expected: exit 0 with exact set equality among released skills, canonical commands, displayed counts, gallery cards, and version metadata; aliases are counted separately.
- Rollback: revert the W2 projection commit and regenerate all derived surfaces from the prior release-facts source; never hand-restore individual totals.

### W3 — make the gate executable and ungameable

- Scope: `skills/tastecheck-pass/SKILL.md`, `skills/tastecheck-pass/contract.json`, `skills/tastecheck-pass/assets/gate-audit.js`, a new ledger/check-catalog schema and release-gate runner under `skills/tastecheck-pass/assets/` or `tools/`, `tools/verify-gate-audit.mjs`, and focused fixtures.
- Rows: MR-005, MR-006.
- Acceptance: `node tools/verify-gate-audit.mjs && npm run test:release-eval-contracts`; expected: exit 0; every closed required check ID appears exactly once, missing required evidence and required-row `n/a` produce HOLD, optional `n/a` requires absence evidence, and the output validates artifact/provenance hashes.
- Rollback: revert the W3 commit; retain the old heuristic only under its honest cold-load name if the full runner is rolled back.

### W4 — isolate unsafe execution and subjective judgment

- Scope: `skills/tastecheck-pass/SKILL.md`, gate runner/schema from W3, redaction and injection-safety fixtures, and reviewer/adjudication contract fixtures under `tools/`.
- Rows: MR-007, MR-010.
- Acceptance: `npm run test:release-eval-contracts && npm run test:eval-schema`; expected: exit 0; audit mode performs no writes, authenticated-origin execution is denied without explicit authorization, hostile DOM/spec strings cannot alter verdict structure or escape redaction, and subjective rows cannot self-certify without reviewer/adjudication provenance.
- Rollback: revert the W4 commit; default to disabling target-origin audit execution and subjective SHIP rows rather than restoring an unsafe permissive mode.

### W5 — make verification complete and reproducible

- Scope: `package.json`, `tools/lint-skills.mjs`, `tools/verify-landing.mjs`, `tools/contracts/test-contracts.mjs`, `tools/contracts/check-generated.mjs`, CI workflows, dependency preflight, and negative/mutation fixtures.
- Rows: MR-008.
- Acceptance: `npm ci && npm run test:contracts && npm test`; expected: exit 0 from a clean clone; structural checks run independently of browser checks, both lanes run in CI, and fixtures for an absent skill reference, absent contract, stale embedded block, and false landing claim each fail the relevant verifier with a complete error inventory.
- Rollback: revert the W5 commit; preserve the last known structural command as a documented non-release diagnostic rather than presenting it as full verification.

### W6 — bind public status to current receipts

- Scope: `index.html`, `README.md`, receipt schemas and projectors under `contracts/`, `evals/`, and `tools/release/`, plus release-claim tests.
- Rows: MR-009, MR-012.
- Acceptance: `npm run test:release-contracts && npm run verify:claims && npm run verify:release`; expected: exit 0 with current hashed receipts for every asserted browser/effectiveness claim; a deliberately failed or stale required receipt renders `HOLD`/`UNVERIFIED` in generated public surfaces.
- Rollback: revert the W6 commit and publish no PASS badge/status; the safe fallback is dated `UNVERIFIED`, not the prior static claim.

### W7 — restore portable copy guidance

- Scope: `skills/humanize-copy/SKILL.md`, `skills/humanize-copy/contract.json`, a bundled repository-owned writing reference if selected, and generated contract projections/tests.
- Rows: MR-011.
- Acceptance: `npm run test:contracts && node tools/verify.mjs`; expected: exit 0 when installed under a temporary home with no `~/workspaces/agent-policy` path, and the skill body, contract, and bundled resources agree on whether the writing gate is mandatory or optional.
- Rollback: revert the W7 commit; remove the workstation-local requirement from the portable skill until a bundled contract exists.

## Source coverage

- `FINDINGS-sol.md`: all eight findings merged into MR-001 through MR-009 and MR-012.
- `FINDINGS-luna-b.md`: all four findings merged into MR-001, MR-002, MR-004, and MR-011.
- `FINDINGS-bonus-grok.md`: write/execution/exfiltration, injection, forged SHIP, closed IDs, strict `n/a`, and auditor/fixer separation merged into MR-003, MR-006, MR-007, MR-009, and MR-010.
- `FINDINGS-floor-champion.md`: artifact input, subject detection, `n/a`, provenance, manual inspection, and tooling ambiguity merged into MR-005, MR-006, and MR-010.
- `FINDINGS-floor-crack.md`: artifact proof, `n/a`, required coverage, circular spec inference, and subjective determinism merged into MR-003, MR-005, MR-006, and MR-010; its GOOD-ENOUGH product vote is recorded as the minority contention above.
- `FINDINGS-dsv4.md`: its incomplete fresh-eyes notes on missing design critique, reproducible browser evidence, receipt provenance, and externally unverifiable claims merged into MR-001, MR-005, MR-009, and MR-012.
- `FINDINGS-floor-lfm.md`: the response truncates before giving a finding or vote; its only completed substantive statement describes the intended evidence-backed, fail-closed behavior and introduces no distinct defect to register.

## IMPROVEMENTS

1. **Require a valid, complete report artifact from every gauntlet lane.** WHY: two of seven inputs ended mid-generation, so their opinions could not carry normal corroboration weight. FIX: validate required sections and terminal status before admitting a lane to synthesis; label rescued partial output explicitly.
2. **Emit machine-readable findings beside prose.** WHY: deduplication depended on manually reconciling titles, severities, and citations across incompatible formats. FIX: require JSON rows with stable source IDs, severity, evidence paths, and fix scope, then render Markdown from the merged register.
3. **Provision a local `td` database or suppress the startup directive in isolated arenas.** WHY: the mandated `td usage --new-session` failed because this worktree has no database. FIX: initialize arena-local tracking during dispatch setup or pass an explicit shared read/write tracking root.
