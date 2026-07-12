# Taste Oracle Render-Grounded Vertical Slice Implementation Plan

> **For agents:** Execute task-by-task with strict RED/GREEN evidence, one commit per task, and a task-scoped review after every commit.

**Goal:** Prove one honest, reproducible visual-evaluation lane for `deslop-ui` using deterministic tokens, a tri-arm browser render, content-addressed evidence, uncertainty-aware statistics, and fail-closed multi-family judge packets.

**Architecture:** Add an isolated `tools/taste-oracle/` subsystem. A versioned scenario contract points to three committed HTML arms (`no-skill`, `current`, `frozen`) and one machine-readable token set. A Playwright capture command renders every arm at fixed viewports and writes screenshots plus a sanitized evidence manifest containing hashes, DOM facts, computed styles, and runtime metadata. Pure statistical and judge-quorum modules consume synthetic or collected observations; they never call a model, invent ratings, or modify the existing 1.0 release gate.

**Tech stack:** Node.js ESM, `node:assert/strict`, JSON Schema-style deterministic validators, Playwright Chromium, SHA-256.

## Global Constraints

- The existing 0.1.0/1.0 release checks, thresholds, receipts, and claims remain unchanged.
- This milestone covers exactly one skill (`deslop-ui`) and one scenario with exactly three arms: `no-skill`, `current`, and `frozen`.
- Committed fixtures contain no model-generated result presented as live evidence. Judge and human observations are inputs, never fabricated defaults.
- Browser evidence must come from a fresh real Chromium render at 390x844 and 1280x900, with animations disabled and fonts/readiness awaited.
- Evidence manifests use repo-relative paths, SHA-256 hashes, UTC timestamps, and public-safe runtime labels; no absolute paths, local usernames, emails, or environment dumps.
- Statistics report paired preference, bootstrap 95% confidence intervals, sample count, ties, and an explicit `insufficient_evidence` state. No point estimate alone can pass.
- Judge quorum requires at least two distinct evaluator families, complete arm coverage, cited artifact evidence, and non-identical judge identities. Missing or malformed evidence fails closed.
- Every implementation task starts with a focused failing test and records RED then GREEN output in its report.

---

### Task 1: Versioned tokens and tri-arm scenario contracts

**Files:**
- Create: `contracts/v2/design-tokens.schema.json`
- Create: `contracts/v2/taste-oracle-scenario.schema.json`
- Create: `evals/taste-oracle/deslop-ui-hard-001/scenario.json`
- Create: `evals/taste-oracle/deslop-ui-hard-001/tokens.json`
- Create: `tools/taste-oracle/validate-contracts.mjs`
- Create: `tools/taste-oracle/test-contracts.mjs`

**Step 1 — RED:** Write tests that require strict schema versions, the exact three arm IDs, distinct fixture paths, two fixed viewports, semantic color/type/spacing/radius roles, valid CSS values, no unknown keys, and rejection of absolute paths or duplicated arm paths. Run `node tools/taste-oracle/test-contracts.mjs` and capture the expected module/file-not-found failure.

**Step 2 — GREEN:** Implement a small explicit validator (no generic schema dependency) that returns stable, field-addressed errors. Add the two schemas as public contracts and a canonical scenario/token fixture that validates cleanly. Run the focused test until pristine.

**Step 3 — Regression:** Run `npm test` and `npm run test:contracts`.

**Step 4 — Commit:** `feat(oracle): add tri-arm visual contracts`

---

### Task 2: Deterministic fixture renderer and evidence capture

**Files:**
- Create: `evals/taste-oracle/deslop-ui-hard-001/fixtures/no-skill.html`
- Create: `evals/taste-oracle/deslop-ui-hard-001/fixtures/current.html`
- Create: `evals/taste-oracle/deslop-ui-hard-001/fixtures/frozen.html`
- Create: `tools/taste-oracle/capture.mjs`
- Create: `tools/taste-oracle/lib/evidence.mjs`
- Create: `tools/taste-oracle/test-evidence.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1 — RED:** Test canonical JSON hashing, repo-relative path enforcement, deterministic evidence normalization, leakage rejection, exact viewport/arm coverage, and manifest rejection when a screenshot or DOM/style hash is absent. Run `node tools/taste-oracle/test-evidence.mjs` and capture the expected missing-module failure.

**Step 2 — GREEN:** Implement pure evidence helpers. Build three visually distinct but content-equivalent fixtures: a deliberately generic no-skill treatment, the present skill-guided treatment, and a pinned frozen comparator. All must consume `tokens.json`, share the same semantic content and accessible landmarks, and expose stable `data-oracle-*` probes.

**Step 3 — Browser capture:** Add Playwright as an exact dev dependency. Implement `npm run oracle:capture -- --out <directory>` to validate contracts, serve/open the local fixtures without an external server, wait for `document.fonts.ready`, disable motion, capture both viewports, collect DOM facts and selected computed styles, hash every artifact, and write a sanitized `manifest.json`. The command must fail closed on console errors, missing probes, viewport drift, or leakage.

**Step 4 — Verification:** Run the focused unit test, then one real capture into an ignored temporary directory. Validate six screenshots and the manifest; inspect at least one desktop and one mobile screenshot for clipping or font failure. Run `npm test` and `npm run test:contracts`.

**Step 5 — Commit:** `feat(oracle): capture render-grounded tri-arm evidence`

---

### Task 3: Uncertainty-aware preference analysis

**Files:**
- Create: `contracts/v2/taste-oracle-observations.schema.json`
- Create: `tools/taste-oracle/lib/statistics.mjs`
- Create: `tools/taste-oracle/analyze.mjs`
- Create: `tools/taste-oracle/test-statistics.mjs`
- Create: `evals/taste-oracle/fixtures/observations-synthetic.json`
- Modify: `package.json`

**Step 1 — RED:** Test deterministic seeded bootstrap behavior, paired wins/losses/ties, 95% percentile interval bounds, order invariance, empty/single-family/too-small samples, invalid arm IDs, and the rule that an interval crossing zero returns `insufficient_evidence`. Run the focused test and capture failure.

**Step 2 — GREEN:** Implement pure aggregation over pairwise observations. `analyze.mjs` must emit JSON with sample counts, family counts, preference rate, tie rate, bootstrap method/seed/iterations, 95% interval, and one of `supported`, `not_supported`, or `insufficient_evidence`. Synthetic fixtures must be unmistakably labeled and cannot be accepted as release evidence.

**Step 3 — Verification:** Run the focused test and CLI against the synthetic fixture. Run `npm test`.

**Step 4 — Commit:** `feat(oracle): add uncertainty-aware preference analysis`

---

### Task 4: Multi-family judge packet and honest milestone receipt

**Files:**
- Create: `contracts/v2/taste-oracle-judge-result.schema.json`
- Create: `tools/taste-oracle/validate-judges.mjs`
- Create: `tools/taste-oracle/test-judges.mjs`
- Create: `evals/taste-oracle/deslop-ui-hard-001/judge-packet.json`
- Create: `docs/TASTE-ORACLE.md`
- Modify: `package.json`

**Step 1 — RED:** Test rejection of one-family panels, repeated judge identity, missing arm/viewports, uncited preferences, evidence hashes not present in the capture manifest, hidden arm labels, and any claim of human calibration without human observation records. Capture expected failure.

**Step 2 — GREEN:** Add a blinded packet format that maps opaque labels to capture hashes while keeping the unmask map separate. Implement fail-closed validation for at least two evaluator families and complete cited evidence. The canonical packet is `pending`, contains no invented verdict, and documents exactly what external judges must return.

**Step 3 — Documentation:** Explain the workflow, threat model, commands, evidence boundaries, statistical interpretation, current limitations, and why this lane does not clear the existing release gate. Include a concise roadmap for adaptive interviews, drift-watch, and a small human calibration panel without claiming they exist.

**Step 4 — Verification:** Run all four focused oracle tests, a real capture, `npm test`, `npm run test:contracts`, `npm run test:eval-schema`, and `npm run test:eval-remediation`. Confirm `npm run verify:release` remains blocked for its pre-existing version/current-evidence reasons and that no oracle script mutates release receipts.

**Step 5 — Commit:** `feat(oracle): add fail-closed judge quorum`

---

## Final Review and Completion Gate

1. Generate a whole-branch review package from `d85d221` to branch HEAD and dispatch an independent reviewer.
2. Fix all Critical and Important findings; rerun affected focused tests after each fix.
3. Run the full verification matrix from Task 4 and inspect `git diff --check` plus a public leak scan.
4. Record exact screenshot count, manifest hash, test receipts, remaining unknowns, and the unchanged 1.0 gate status.
5. Do not push, publish, or claim release eligibility in this milestone.
