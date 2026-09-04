# Product coherence findings — luna-b

Verdict: RETROFIT-NEEDED yes

The package has 20 skills and 20 commands, but the release-gate spine, the deleted `deslop-ui` contract/resources, and multiple public count/version/gallery claims disagree.

## Findings

### TC-LUNA-B-01 — P1 — gate order references a nonexistent skill and disagrees with its contract

- Evidence: `skills/tastecheck-pass/SKILL.md:44` — `design-critique` against spec, and `humanize-copy`; then this gate.
- Evidence: `skills/tastecheck-pass/SKILL.md:47` — `against-spec `design-critique` audit are required.`
- Evidence: `skills/tastecheck-pass/contract.json:10` — `"handoff": {"receives_from": ["a11y-pass", "cognitive-a11y", "i18n-ready", "deslop-ui", ...]`
- Evidence: `README.md:176` — `... with **deslop-ui** and **humanize-copy** auditing the result ...`
- Why: There is no `skills/design-critique/` directory, manifest entry, or contract. The current gate body therefore requires an un-runnable stage, while its JSON contract and the public pipeline still route through `deslop-ui`. The generated contract block is also inconsistent with the JSON source.
- Fix sketch: Decide whether this is a rename or an accidental replacement. If `deslop-ui` remains canonical, restore it in the gate body and regenerate the contract block. If `design-critique` is the intended replacement, add its complete skill/contract/manifest/command and update every handoff and public surface atomically.

### TC-LUNA-B-02 — P1 — `deslop-ui` is advertised and routed but cannot load its required package files

- Evidence: `skills/deslop-ui/SKILL.md:57` — ``references/anti-patterns.md``.
- Evidence: `skills/deslop-ui/SKILL.md:58` — ``references/structural-tells.md``.
- Evidence: `skills/deslop-ui/SKILL.md:59` — ``references/design-direction.md``.
- Evidence: `skills/deslop-ui/SKILL.md:60` — ``references/decision-records.md``.
- Evidence: `skills/deslop-ui/SKILL.md:71` — the canonical detail names `contract.json`.
- Evidence: `skills.json:91` — `"name": "deslop-ui",`
- Why: FACTS records these as unstaged deletions. `node tools/verify.mjs` reports nine failures for the four missing references/resource targets and missing contract; `check-generated` and `test-contracts` abort when they try to load `skills/deslop-ui/contract.json`. The skill remains in the manifest and is named by many handoffs, so installation can expose a broken skill and the contract-driven pipeline cannot validate the full set.
- Fix sketch: Restore or deliberately replace the deleted contract and four references as one owned artifact family, then run structural verification and generated-contract checks. Preserve the known dirty state until the stage-3 owner resolves it; do not silently remove `deslop-ui` from consumers.

### TC-LUNA-B-03 — P1 — public counts, gallery counts, and version metadata have no single current truth

- Evidence: `skills.json:3` — `"version": "1.4.1",`; `skills.json:11` — `"name": "tasteroll",`; `skills.json:101` — `"name": "tastecheck-pass",` (the manifest contains 20 entries).
- Evidence: `README.md:9` — `It's a set of **19 craft skills ...`; `README.md:21` — `skills-19`; `README.md:80` — `coverage for all 19 skills`.
- Evidence: `llms.txt:3` — `Twenty connected frontend craft skills ...`; `llms.txt:29`–`llms.txt:47` list the skills but omit `tasteroll`.
- Evidence: `index.html:4` — `...set of 19 craft skills ...`; `index.html:49` — `...set of 19 frontend craft skills ...`; `index.html:53` — `"softwareVersion": "1.4.0"`.
- Evidence: `index.html:314` — `design intelligence · 20 skills`; `index.html:316` — `... then nineteen skills ...`; `index.html:324` — `aria-label="v1.4.1 results"`.
- Evidence: `package.json:3` — `"version": "1.4.1",`.
- Evidence: `samples/index.html:3` — `eight design systems`; `samples/index.html:68` — `one product story, seven design systems`; `samples/index.html:69` — `One page. Eight committed design systems.`; `samples/index.html:139`–`samples/index.html:145` — the eighth `Seed / Procedural specimen` card.
- Evidence: `llms.txt:24` — `seven design systems`; `README.md:16`–`README.md:18` — `Five real browser renders`; `README.md:37` — `five-design-system gallery`; `README.md:220` — `five visibly different design systems`.
- Evidence: `docs/LAUNCH.md:3` — `Public copy for the 19-skill pack`; `docs/LAUNCH.md:36` — `Nineteen skills total`; `docs/LAUNCH.md:69` — `currently contains 19 skills`; `docs/VERIFICATION.md:40` — `19 skill directories`; `docs/VERIFICATION.md:92` — `all six committed samples`; `docs/VERIFICATION.md:170` — `Additional landing-page 19-skill evidence`.
- Why: The current manifest, source directories, landing data-skill markers, and gallery cards are 20 skills, 20 commands, and 8 gallery cards. Search/discovery, social previews, structured data, README, machine-readable instructions, launch copy, and verification guidance give different counts and version numbers; agents and readers cannot tell which surface is authoritative.
- Fix sketch: Establish a generated release facts source from `skills.json`, package metadata, and actual sample cards. Regenerate README/llms/landing metadata/JSON-LD/launch/verification copy from it; label dated historical receipts as historical instead of leaving current-sounding 19/six claims in active docs. Re-run landing/link checks after regeneration.

### TC-LUNA-B-04 — P2 — the humanize-copy addition breaks the portability claim and is absent from its contract

- Evidence: `skills/humanize-copy/SKILL.md:87` — `## Information-architecture gate`.
- Evidence: `skills/humanize-copy/SKILL.md:89` — `Humanizing edits must respect the Writing Constitution (`~/workspaces/agent-policy/policy/writing.md`):`.
- Evidence: `skills/humanize-copy/SKILL.md:90` — `old-before-new (topic = doorstep, comment = room), stress position ...`.
- Evidence: `skills/humanize-copy/contract.json:18`–`skills/humanize-copy/contract.json:20` — the contract exclusions contain only the existing copy-safety rules and no portable writing-constitution resource/input.
- Evidence: `README.md:164` — `Skills are plain Markdown — no SDK, no runtime.`
- Evidence: `llms.txt:7`–`llms.txt:8` — `Plain Markdown ... portable to agents that can read skill files or directories.`
- Why: An installed agent outside this workstation cannot resolve the home-relative `agent-policy` path, and the new mandatory gate has no bundled reference, contract input, or handoff evidence requirement. The skill’s body and declared contract now promise different operating requirements.
- Fix sketch: Bundle the minimum writing rules as a repository-owned reference or make the dependency an optional, explicitly named input with a safe fallback. Extend/regenerate the contract only if the gate is a real acceptance requirement; otherwise keep it as local authoring guidance outside the portable skill.

## Coverage swept

- All 20 `skills/*/SKILL.md` files, contracts present on disk, frontmatter descriptions, generated contract blocks, handoff lists, adjacent-skill references, and referenced `assets/`/`references/` paths.
- `skills/tastecheck-pass/` as the ordering spine; `skills.json`; all 20 command wrappers; `README.md`; `llms.txt`; `index.html`; all root `docs/`; all root `demos/`; `samples/index.html`; all eight gallery cards and representative sample copy.
- Cross-reference result: all present contract/body handoff lists align except the intentional/current `tastecheck-pass` `design-critique` versus `deslop-ui` mismatch; command wrappers target existing skill names.
- Checks: `node tools/lint-skills.mjs` passed (20 skills, 0 failures, 0 warnings); `node tools/verify-landing.mjs`, `node tools/verify-integration.mjs`, and `node tools/verify-gate-audit.mjs` passed. `node tools/verify.mjs` failed on the nine known `deslop-ui` missing-file/contract failures. `check-generated` and `test-contracts` fail on the missing `deslop-ui/contract.json`. Full `npm test` reached `test:oracle-capture` but was blocked by sandbox `EPERM` creating a temp directory inside the source checkout.

## Unknowns

- No network or live GitHub Pages fetch was used, so deployed public surfaces and remote freshness remain unverified.
- The source checkout contains pre-existing uncommitted edits to `skills/tastecheck-pass/SKILL.md`, `skills/humanize-copy/SKILL.md`, and `tools/lib/nima.mjs`; this audit reports the current on-disk state and did not modify or restore them.
- The arena exposes FACTS/brief at its root while the source repository holds `_retrofit-2026-09-04/`; the findings file is written in this arena as required by the FACTS CWD output contract.

## IMPROVEMENTS

- Improve the release facts flow because the same audit hit 19/20 skill and five/seven/eight gallery contradictions across active surfaces; generate public counts, versions, and card lists from one manifest.
- Improve contract enforcement because the normal `npm test` chain omits `test:contracts`, allowing a missing skill contract and generated-block drift to survive the advertised verification path; add the contract checks to the required chain after making them sandbox-safe.
- Improve retrofit arena setup because the brief referenced a nested FACTS path while the arena supplied it at root and isolated source files elsewhere; provision a consistent source/output layout or state the mapping in the worker brief.
