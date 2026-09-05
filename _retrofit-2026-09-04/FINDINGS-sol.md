# Chief auditor findings — systemic and architecture

**VERDICT: RETROFIT-NEEDED yes — the advertised fail-closed gate is internally inconsistent, the shipped suite is incomplete, and the verification/landing surfaces can report green or PASS without proving the product contract.**

## Findings

### SOL-01 — P0 — Flagship gate routes to an absent skill and contradicts its canonical contract

**Evidence:** `skills/tastecheck-pass/SKILL.md:43-47` says, verbatim, `` `design-critique` against spec`` and makes the ``against-spec `design-critique` audit`` required. No `skills/design-critique/` directory exists. `skills/tastecheck-pass/contract.json:5,10` instead names `deslop-ui` in `adjacent_skills` and `handoff.receives_from`. The generated block in `skills/tastecheck-pass/SKILL.md:88` also says `receives [... design-critique ...]`, while the canonical JSON says `deslop-ui`.

**Why:** A required nonexistent predecessor makes every honest release decision HOLD. It also proves the human-facing contract block is not generated from the declared authority.

**Fix sketch:** Restore `deslop-ui` in the ordered gate and generated block (or add a real `design-critique` skill and update every manifest/contract/command deliberately). Re-project from JSON and add a test that rejects every unknown backticked skill reference and compares every embedded block byte-for-byte with `skillBlock(contract)`.

### SOL-02 — P0 — The installable 20-skill pack contains an incomplete skill

**Evidence:** `skills/deslop-ui/SKILL.md:55-60` requires four `references/*.md` files and `skills/deslop-ui/SKILL.md:68-78` links `contract.json`; all five paths are currently deleted. `install.sh:43-46,121-125` enumerates every skill directory and reports all links installed without validating contents. A clean temporary-home run reported `linked 20 skills`, but `~/.agents/skills/deslop-ui/contract.json` did not exist. `node tools/verify.mjs` reported nine missing-reference/contract failures.

**Why:** Installation succeeds while distributing a skill that cannot satisfy its own routing, evidence, or reference contract.

**Fix sketch:** Restore/reconcile the known deletions, then make installation preflight every skill for `SKILL.md`, `contract.json`, and referenced local resources before creating any link; fail atomically with the offending skill list.

### SOL-03 — P0 — Missing gate input defaults to CLEAN

**Evidence:** `tools/lib/nima.mjs:87-91` contains `const gateVerdict = gate?.verdict ?? "CLEAN"`. `tools/test/nima.test.mjs:76-83` explicitly asserts `combinedVerdict(null, null) === "CLEAN"` and `{}` defaults to CLEAN.

**Why:** This is the inverse of `skills/tastecheck-pass/SKILL.md:26-28`, which requires HOLD when a required check could not run or lacks evidence. Any consumer of this exported combiner can convert absent/malformed gate evidence into release success.

**Fix sketch:** Make absent, malformed, or unknown gate verdicts return HOLD/FAIL (or a distinct non-shippable ERROR), validate the structured gate schema before combination, and replace the green-path tests with fail-closed adversarial cases.

### SOL-04 — P1 — The canonical inventories disagree after adding the twentieth skill

**Evidence:** `skills.json:3-18` declares version `1.4.1` and includes `tasteroll`; the directory and manifest counts are both 20. `contracts/v1/commands.json:3,26-31` still declares “20 command files, 19 skills, 1 approved alias.” Its command rows have no `tasteroll` target and retain two commands for `theming` (`commands/darkmode.md` and `commands/theming.md`). `README.md:9,21,44,80` and `index.html:3-4,49,63,69` still claim 19, while `index.html:17,27,314,326,337,619` claims 20.

**Why:** Users cannot tell whether this is a 19-skill release plus an experiment or a coherent 20-skill suite. Command coverage is one canonical entry short.

**Fix sketch:** Decide whether `tasteroll` is a released skill. If yes, add its canonical command, update command invariants to 21 files/20 skills/one alias, and project all public counts from `skills.json`; if no, remove it from release-facing inventory and landing coverage.

### SOL-05 — P1 — The flagship audit executable covers only a fraction of its own gate promises

**Evidence:** `skills/tastecheck-pass/assets/gate-audit.js:38-180` implements ten DOM heuristics and emits only `{verdict,fails,warns,notes}`. The required gate ledger is seven fields per row (`skills/tastecheck-pass/SKILL.md:30-35`) and requires browser rendering, 320px/400% zoom, keyboard, theme contrast, reduced motion, cold load, manual shadow-root/iframe inspection, spec conformance, and three gate self-check rows (`:49-60,75-79`). `tools/verify-gate-audit.mjs:7-14` explicitly tests only checks 1 and 3 plus the output shape, while its success line says the “gate-audit asset verification passed.”

**Why:** The executable is useful as a cold-load heuristic, but neither it nor its passing unit test proves the SHIP/HOLD ledger contract. The current naming invites a partial check to be mistaken for the release gate.

**Fix sketch:** Separate `cold-load-heuristic` from `release-gate`. Define a machine-readable ledger schema, require all mandatory rows and provenance, run real-browser fixtures for all automated checks, and keep manual-only rows explicitly non-passing until evidence is attached.

### SOL-06 — P1 — Verification has two silent-green paths and one non-reproducible top-level path

**Evidence:** `tools/lint-skills.mjs:65-77` loops over unknown kebab-case tokens but adds no finding unless a token is in the two-item `KNOWN_STALE` set; it passed with the absent `design-critique` reference. `tools/verify-landing.mjs:108-118` passes by checking that the page literally states it is canonical and represents every concern. `package.json:7,98-106` makes `npm test` begin with Oracle capture tests importing Playwright; in this offline worktree it stopped with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` before the base verification chain.

**Why:** A linter and landing verifier can certify the exact contradictions they should reject, while the documented umbrella command cannot reach most checks without a prepared dependency tree.

**Fix sketch:** Fail unknown skill-like references using manifest/contract context; validate landing claims against receipts rather than matching claim strings; split dependency-free structural verification from browser/Oracle tests, add an explicit dependency preflight, and ensure CI runs both lanes.

### SOL-07 — P1 — Landing and README claim PASS/verified while current evidence is HOLD

**Evidence:** `index.html:447-449` publishes `Gate: PASS`, “20 skills audited,” keyboard, cold-load, contrast, and “no slop tells.” `README.md:23` shows a green `verified npm test` badge and `README.md:151-159` says the auditor and landing pass. Current runs: `npm test` exit 1 (Playwright unavailable), `tools/verify.mjs` exit 1 (nine missing `deslop-ui` resources), and both contract tests/projection checks exit 1 (missing `deslop-ui/contract.json`). `index.html:487` separately admits production evaluation has not started.

**Why:** Static historical claims are presented as current release evidence. The flagship rule says an ETA, file, or checkmark never changes HOLD to SHIP.

**Fix sketch:** Replace PASS badges/checkmarks with receipt-derived status and observation date. Build the landing from a committed verification summary; if required evidence is stale, missing, or the suite is red, render HOLD/UNVERIFIED automatically.

### SOL-08 — P2 — Contract validation is incomplete and fails opaquely on an absent contract

**Evidence:** `tools/contracts/test-contracts.mjs:12-21` enumerates directories and immediately reads every `contract.json`; a missing file throws raw `ENOENT`. It generates `block` only for a token-budget check and never compares it with the `SKILL.md` block. `tools/contracts/check-generated.mjs:14-25` delegates all projections to one process, so the first missing contract prevents a complete drift inventory. An independent in-memory comparison found `tastecheck-pass` drift among the 19 present contracts.

**Why:** One absent file masks all later contract drift, and the primary contract test can pass stale embedded blocks when files exist.

**Fix sketch:** Accumulate missing/invalid/drift findings per skill, compare embedded blocks in `test-contracts`, and reserve projection checks for generated non-skill artifacts. Report the full deterministic set in one run.

## Master fix plan

1. **Wave 0 — restore fail-closed authority (P0):** reconcile the dirty `deslop-ui` files; restore a real gate predecessor; change missing/malformed verdict handling to HOLD. Verify with negative fixtures for absent contract, absent predecessor, absent gate result, and broken installed skill.
2. **Wave 1 — unify the suite graph:** choose 19 versus 20 released skills; project `skills.json`, command registry/files, contracts, gate ordering, README, and landing from that decision. Verify exact set equality and one canonical command per released skill, with aliases separately counted.
3. **Wave 2 — make verification honest:** split structural and browser lanes, fail unknown skill references, accumulate all contract drift, expand real-browser gate coverage, and require evidence-ledger schema validation. Verify clean-clone dependency install plus both lanes.
4. **Wave 3 — bind public claims to receipts:** generate landing/README status from dated results and remove self-attesting proof checks. Verify a deliberately failed check changes the public status to HOLD/UNVERIFIED.
5. **Wave 4 — release proof:** run the complete clean-clone suite, actual landing/browser paths, installer install/uninstall/force cases, and the full flagship ledger; only then publish SHIP/PASS.

## Coverage swept

- Authoritative dossier and current dirty state.
- All 20 skill directories; all present contracts; manifest set equality; cross-skill references and flagship ordering.
- All 20 command files and `contracts/v1/commands.json` mapping/invariants.
- Flagship `SKILL.md`, `contract.json`, `gate-audit.js`, its fake-DOM verifier, and NIMA verdict combiner/tests.
- `npm test` plus dependency-free component runs: structural verify, lint, landing, integration, gate-audit, both NIMA tests, contract tests, and generated-projection check.
- `install.sh` in an isolated temporary HOME, including installed link counts and the incomplete `deslop-ui` payload.
- `index.html`, `site/`, README product/count/proof/install claims, and landing/integration verifiers.

## Unknowns

- Browser/manual checks were not rerun: Playwright is absent and stage 1 forbids dependency installation/network. Therefore rendering, keyboard, zoom, contrast, reduced motion, iframe/shadow-root inspection, and live GitHub Pages state remain unverified.
- The intended resolution of concurrent unstaged edits to `tastecheck-pass/SKILL.md`, `humanize-copy/SKILL.md`, and `tools/lib/nima.mjs` is unknown; this audit reports current on-disk reality and does not modify them.
- No remote, release tag, CI, or hosted receipt was queried because the dossier forbids network access.

## IMPROVEMENTS

1. **Improve inventory generation.** WHY: 19/20 drift spans manifests, commands, docs, and the landing. FIX: generate counts and command coverage from one release manifest and reject hand-authored totals in CI.
2. **Improve negative verification.** WHY: the linter and landing verifier passed absent routing and self-attesting proof. FIX: add mutation fixtures that remove a skill/contract/evidence receipt and require every relevant verifier to fail.
3. **Improve clean-clone reproducibility.** WHY: `npm test` stopped before core checks when Playwright was unavailable. FIX: provide `test:offline` plus a dependency preflight and make CI prove `npm ci && npm test` from a clean clone.
