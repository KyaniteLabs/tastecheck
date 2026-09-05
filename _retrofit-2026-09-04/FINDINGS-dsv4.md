# FINDINGS — adversarial fresh eyes (deepseek-v4-flash) on tastecheck
# bridge :8817, 30s, channel=reasoning_content, finish=length

We need answer directly plain text. Need act adversarial fresh-eyes reviewer. Need analyze repo tree, skill definition. Questions:

(1) What does hostile senior reviewer say this audit MISSES — surfaces/claims most likely to hide rot?
(2) Which public claims are NOT checkable from repo alone?
(3) The 5 things to fix FIRST in one day, and why obvious order might be wrong.
(4) Verdict: RETROFIT-NEEDED yes/no + one line.

We need likely from context of "product retrofit gauntlet for tastecheck". Need examine repo tree, skill definition. Need identify gaps/rot.

Need provide concise but substantive. Let's parse repo. It's a skill package with commands, contracts, demos, docs. TasteCheck Pass skill appears in commands/tastecheckpass.md maybe. Need evaluate whether public claims (README, docs, effectiveness) are checkable. There are release-effectiveness schemas, effectiveness v2 docs, etc. Need hostile senior perspective.

Need know what claims likely made? Repo tree includes README, docs/EFFECTIVENESS-V2.md, docs/LAUNCH.md, docs/TASTE-ORACLE.md, TASTE-ORACLE-INTEGRATION-REPORT.md, VERIFICATION.md, reports, screenshots, demos, etc. Need infer claims. Need check if audit misses: likely misses actual rendered artifact? The skill says run checks on real artifact and cold load gate-audit.js. Repo tree doesn't show an actual web artifact? It has demos and example-build after/before.html. But no built site? Maybe need check if there is a frontend artifact? TasteCheck Pass gates finished frontend work. The repo itself is not necessarily frontend; it's a skill/contract library. But "product retrofit gauntlet for 'tastecheck'": The repo has demos and example-build. But public claims in README maybe say "tastecheck validates frontends" with screenshots and examples. Audit likely misses: no real external site artifact? No live execution evidence; screenshots could be generated from demos, but no cold load receipts, no browser automation outputs, no gate-audit.js output, no accessibility tree or DOM snapshots. Claims "CE" "verified" etc maybe not checkable.

Need derive specifics: The skill has command READMEs? Need maybe inspect hidden? We only have tree. Need reason from file names and skill definition.

(1) What does audit MISSES — surfaces/claims most likely to hide rot:
- The audit's own "gate self-check" only validates presence of ledger rows, not truth. It doesn't inspect the actual runtime artifact beyond command? The file tree lacks rendered deployment or browser test artifacts. It misses "execution evidence" vs "file existence": demos exist, but "built-to-spec" status and DESIGN-SYSTEM.md? Demos example-build DESIGN-SYSTEM.md exists. But no evidence that DESIGN-SYSTEM.md was used to generate after.html; could be after-the-fact doc.
- It misses no accessibility tree audit results (axe/pa11y), no keyboard script, no contrast measurements, no 320px/400% zoom screenshots? Some screenshots exist (390 etc) but not 320/400% maybe? It has 390, 768, 1280, dark. Need not infer. It misses viewport 320 and 400% zoom evidence.
- It misses semantic HTML structure, headings, landmarks, focus order, iframe/shadow DOM inspection.
- It misses motion check evidence: reduced-motion media query? Example screenshot 04-motion-forms-empty? no video.
- It misses copy/verbal plane: no transcript/copy artifacts? no localization? i18n ready?
- It misses "taste oracle" judgments? There are taste-oracle schemas but no outputs? Maybe no judge results? There are evals fixtures. But public claims likely around effectiveness v2 machine-only blind effectiveness: judged by "taste oracle" etc. It misses randomization commitment/unmask? Need check.
- It misses external claims: docs mention "effectiveness-v2", "taste oracle integration report"; no raw logs, packet hashes, unmask keys, attestations, judge ids, calibration results.
- It misses "seven systems" concept? No actual design token? Contracts/v2/design-tokens.schema exists but no actual token CSS? demos example-build/tokens.css. Need ensure token schema vs actual tokens.
- It misses "release receipts": There is contracts/v1/release-receipts.json/schema. Is it populated? Need likely not checkable. If file present? Tree includes release-receipts.json, but maybe with canned contract? Need not infer.
- Hostile reviewer says audit misses "what happens when someone actually runs it": no CI logs? .forgejo/workflows/ci.yml and .github/workflows/verify.yml exist but cannot know if passing; workflow files are not execution evidence. No live receipt of last run.
- Misses comparing before/after: demos/example-build/before.html/after.html and before/after images. But no paired diff, no metric for "improved" aesthetic? Design critique not possible from screenshots? There is design-critique command? Actually no command design-critique file in tree? Wait commands list: a11y.md, artdirection.md, cognitive.md, colorsystem.md, darkmode.md, dataviz.md, designsystem.md, deslop.md, emptystates.md, formux.md, humanize.md, i18n.md, improvesite.md, motion.md, responsive.md, spacing.md, states.md, tastecheckpass.md, theming.md, typography.md. No design-critique.md, no component-states? There is states.md likely. No design-critique command, though contract mentions design-critique. Ah! Critical: The TasteCheck skill says required checks include a11y-pass, cognitive-a11y, i18n-ready if multilingual, design-critique against spec, humanize-copy. But repo has no command/check implementation for design-critique. There is no design-critique.md command. So audit misses that required skill component absent. Also "component-states" command is states.md but no actual component library? Demos/02-states.html demonstrates generic states? Need check.
- Misses hidden rot in "effectiveness" claims: The repo is a skill package at maybe v2; there are many schema files, but no "execution receipt" or "judgment results" actual samples except fixtures. Public claim "taste-oracle" likely overclaims if no oracle implementation.
- Misses "functional evaluator" vs "expert reviewers": taste-oracle has schemas but no model? Need no external server.
- Misses "anti-slop" "coherence" "human-like" metrics? docs VIDEO SCRIPT, LAUNCH etc. Repo can talk.
- Misses tests: no actual test suite in tree beyond CI and evals fixture. No unit test files. The verification docs might claim? The repo has docs/VERIFICATION.md, but no automated tests? CI workflow maybe runs tests but no test code. No package.json? There is no package.json in tree! (First 120 files include no package.json outside? Wait no package.json displayed; no JS source, only commands/*.md and contracts JSON, docs/demos HTML). Actually first 120 files no package.json, no .js files except gate-audit.js maybe referenced but not listed? Tree only first 120 maybe truncated? We cannot infer beyond first 120. There are commands .md; styles maybe not shown? Maybe deeper not shown. Need be careful. "assets/gate-audit.js" maybe referenced but not in first 120? It might be after first 120? Need avoid false claim if not complete. The prompt gives first 120 files, not full tree. Need mention "from repo alone first 120" no evidence.
- Surfaces most likely hide rot: README claims, screenshots (static images), docs/handoffs, contracts with lots of schema, "demos" (self-authored playground), "screenshots" selected to look good. The rot hides in rendered behavior, accessibility, and "judgment" processes.

(2) Which public claims are NOT checkable from repo alone?
Need list claims that require execution or external evidence:
- "CI passing" / "verified" badges if any: workflows define jobs but no run artifacts/logs.
- "Gate audit" cold load performance: no asset/gate-audit.js output, no HAR/timing, no network logs, no screenshot? Skill itself calls for attached output; absent.
- "Browser rendering at 320px/400% zoom, keyboard, theme contrast, reduced motion, cold load" all require live run or recorded traces; repo alone has only screenshots at 390/768/1280 maybe not 320/400%, no accessibility snapshots.
- "a11y pass": no axe/pa11y report or issue ledger.
- "design-critique against spec": no original design spec? DESIGN-SYSTEM.md exists in example-build but no "built-to-spec" mapping? Need before/after. No actual critique result.
- "humanize-copy" quality: no copy inventory or tone check outputs.
- "i18n-ready": no translation files, locale tags, or multilingual claim evidence? no language list.
- "effectiveness v2 machine-only blind" claims: requires unmask/render-receipt/judge-result payloads with commitments and attestations, not just schema; release-receipts.json maybe maybe just contract. Need if public claims "effectiveness" in README/Docs? Likely yes. Need mention release effectiveness cannot be verified without judge packets, quorum, randomization commitment, unmask result. Existing evals fixtures are fixtures, not actual evidence.
- "judgment calibration/anti-slop/coherence/human-likeness" outputs: only anti-slop regex fixture, no actual run.
- "Taste Oracle integration": docs/integration report may assert integration; repo alone can't show live endpoint/model.
- "Design system compliance": tokens.css exists, but no automated token/brand-conformance checks or computed style audit.
- "Visual regression" / "screenshots show before/after": static screenshots could be cherry-picked, no headless run with timestamps/hashes.
- "Reference to superpowers plans/effectiveness": plan docs don't prove execution.
- "Efficiency/effectiveness W1 and terminal-v5": There are immutable source files maybe "evals/evidence/v1/immutable/terminal-v5-source.json" etc, but from repo alone cannot prove those are real outputs with valid block timestamps? If they are committed maybe checkable? Need not claim.
- Public claim "Ship/HOLD decision" maybe "tastecheck-pass" itself must produce ledger. Without real artifact, no verdict. Need state "if README says artifact is shippable, that is not checkable."

Need answer with specifics from repo files.

(3) The 5 things to fix FIRST in one day, and why obvious order might be wrong.
Need choose highest leverage fixes. Need perhaps 5 items:
1. Add actual rendering/execution evidence: run browser audit against demos/example-build/after.html and commit output (gate-audit.js, axe report, keyboard/theme/zoom/reduced-motion logs). Because without real artifact, no ship claim.
2. Add missing design-critique command/check implementation. Skill contract references design-critique but no command file. This is required check; missing skill component.
3. Replace screenshots with verifiable provenance: attach timestamps, viewport metadata, URL/file hash, browser env, maybe generated via script from demos, to avoid cherry-pick.
4. Add deterministic test harness and package/script definitions? There are workflows but no package.js? Need if no package; maybe npm test? But command skill maybe markdown. Need perhaps add validation of contracts/examples via CI script. Wait "first in one day" maybe with ordering. Need understand what "obvious order might be wrong": likely first instinct is add missing commands, write docs, more screenshots, more schema, add CI. But wrong because skill's final output is gate decision on real artifact; need first produce an actual artifact and evidence, then retrofit checks. If no actual runtime environment, tests may test demo not real. Need maybe "fastest path to credibility is running current skill against one real before/after page and generating a ledger, not adding features."

Let's map "5 things":
- P0: Run the existing TasteCheck gate against `demos/example-build/after.html` as if it's the finished artifact; publish the ledger with actual PASS/FAIL rows. This forces evidence and reveals missing checks. Obvious order wrong because people fix commands first; actually end-to-end run surfaces which checks need tools.
- P0/P1: Add a tiny headless browser execution harness (Node script) to produce reproducible evidence at 320/390/768/1280, dark, reduced-motion, keyboard, and cold load timing. Because all top-level claims hinge on browser-pass proof. Use existing screenshots? no.
- P1: Define/complete the missing "design-critique" audit as actual scored rubric against DESIGN-SYSTEM.md; tie to before/after spec. This is required by skill but absent. But maybe "commands/deslop.md" is design-critique? Wait "deslop" maybe detect slop? Not design-critique. The skill contract requires design-critique; no command. Need mention.
- P1: Implement "ledger with verdict" as a JSON artifact with `status`, `reason`, `remediation`, `evidence`, `provenance`, validated against contracts/v1/live-execution-receipt.schema and release-receipt.schema. Because skill contract demands `ledger_with_verdict`, and no such file? There are schemas but not instance. Make CI verify shape.
- P2: Add tests that assert every markdown command file has corresponding check IDs,
