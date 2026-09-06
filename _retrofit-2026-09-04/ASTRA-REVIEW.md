182,943
**REFUTE: the installed SHIP path does not establish that design QA occurred.** It validates author-supplied records and hashes, then derives SHIP from their declared statuses; it does not derive those statuses from the measurements. Confidence: 9/10. [`release-gate.mjs:370–398,414–428,491–520`](skills/tastecheck-pass/assets/release-gate.mjs)

My criterion, stated before inspection: SHIP must bind the verdict to the artifact actually reviewed. This was a static, offline review; I executed no bypasses, tests, or mutations.

## 1. The gate-runner paradox

**#1 — A ledger can be internally consistent while documenting no QA.** The evidence validator requires a mode, nonempty summary, non-null `details`, and matching hash. It neither requires check-specific measurements nor compares them with the declared status. Consequently, an actual failing contrast measurement could remain in `details` while the row says `pass`; the validator contains no numerical contradiction check. [`release-gate.mjs:370–384,414–428`](skills/tastecheck-pass/assets/release-gate.mjs)

This is visible in existing source without constructing an attack: the release-gate test creates evidence containing only `{check_id, observed}`, supplies synthetic browser/inspector/reviewer identities, and asserts SHIP. That fixture tests record acceptance; its accepted shape also demonstrates how little observation the production runner requires. [`test-tastecheck-gate.mjs:77–140`](tools/evals/test-tastecheck-gate.mjs)

**Existing defense:** missing, duplicate, unknown, malformed, and required `n/a` rows are rejected. **Surviving hole:** those defenses establish record completeness, not whether the record proves its conclusion. [`release-gate.mjs:470–512`](skills/tastecheck-pass/assets/release-gate.mjs)

**#2 — An approval can travel without the pixels it approved.** A review contains reviewer, rubric, decision, independence, disagreement, timestamps, and hash—but no artifact hash, evidence hash, or check ID. A genuine old passing review can therefore be transplanted onto a different passing row without changing the review’s own hash. [`release-gate.mjs:26–28,183–186,344–367`](skills/tastecheck-pass/assets/release-gate.mjs)

**Existing defense:** reviewer type must be `human`, `independent` must be true, decisions must match, and disagreement requires adjudication. **Surviving hole:** human identity is supplied text; the self-certification check compares reviewer ID only with the execution tool’s name. These checks cannot establish that a separate person approved this particular evidence. [`release-gate.mjs:324–367`](skills/tastecheck-pass/assets/release-gate.mjs)

**#3 — Hash the page, change what renders it.** File artifacts hash exactly one file. Directory artifacts hash everything beneath the selected directory, but neither path discovers the rendering dependency closure or separately binds the approved specification. An unchanged HTML file can retain its verified digest while shared CSS, fonts, scripts, or its design specification change elsewhere. [`release-gate.mjs:214–274`](skills/tastecheck-pass/assets/release-gate.mjs)

**Existing defense:** changed bytes inside the selected artifact are detected; escaping paths and external symlink targets are rejected; URL artifacts remain HOLD. **Surviving hole:** the author selects the boundary whose integrity is checked. [`release-gate.mjs:201–211,243–274`](skills/tastecheck-pass/assets/release-gate.mjs)

Two tempting accusations do **not** survive inspection:

- CLEAN from the cold-load heuristic is explicitly **not** a release decision; presenting it as SHIP violates the current skill contract. [`SKILL.md:52–58`](skills/tastecheck-pass/SKILL.md)
- NIMA’s absence does not prove a release bypass: NIMA is deliberately advisory, and malformed gate verdicts return HOLD. [`nima.mjs:8–19,88–98`](tools/lib/nima.mjs)

## 2. Pixel epistemics

My ranking below is a threat assessment, not measured attack-frequency data. It combines fabrication effort with the consequence of trusting the result.

1. **Measurement prose dressed as execution evidence — easiest, maximum damage.** No screenshot needs to be fabricated: browser evidence can inhabit unrestricted `details`, and screenshots are explicitly optional in the skill contract. Verification checks the record’s hash, not the existence of a corresponding capture. [`release-gate.mjs:370–397`](skills/tastecheck-pass/assets/release-gate.mjs); [`contract.json:7`](skills/tastecheck-pass/contract.json)
2. **Borrowed reviewer approval — equally cheap, maximum authority damage.** Reusing an approval can falsely attribute acceptance of different pixels to a real reviewer because the review has no binding to those pixels. [`release-gate.mjs:26,344–367`](skills/tastecheck-pass/assets/release-gate.mjs)
3. **Authentic capture of the wrong scope — cheap, high damage.** A real screenshot can be perfectly honest about one page or state while the ledger asserts category-wide completion. The runner groups exclusively by catalog check ID; it has no required route × state × viewport inventory to reconcile. [`check-catalog.json:11–31`](skills/tastecheck-pass/assets/check-catalog.json); [`release-gate.mjs:465–493`](skills/tastecheck-pass/assets/release-gate.mjs)
4. **Replaced screenshot plus regenerated digests — more work, still high damage.** The effectiveness renderer genuinely captures HTML, DOM, styles, and PNGs. Its verification functions subsequently compare supplied and stored hashes, identities, and environment metadata; they do not rerender the artifact and compare the resulting pixels. This protects against inconsistent substitution, not coordinated replacement by someone controlling the evidence files. [`render.mjs:250–295,310–372`](tools/evals/v2/lib/render.mjs)

The final-source receipt gate addresses **staleness**, not capture authorship: it compares receipt source digests with the final tree, while the release checker verifies registered coverage and stored artifact hashes. Restamping author-controlled records does not establish that those captures came from that source tree. [`final-source-receipt-gate.mjs:33–76`](tools/release/final-source-receipt-gate.mjs); [`check.mjs:148–170`](tools/release/check.mjs)

**#4 — Category coverage is being mistaken for artifact coverage.** The component skill explicitly requires evidence per applicable state and says not to collapse controls into one checkmark. The release catalog reduces that obligation to one `structure:component-states` row, with no enforced inventory underneath it. The same aggregation gap affects forms and browser rendering. [`component-states/SKILL.md:20–22,90–95`](skills/component-states/SKILL.md); [`check-catalog.json:12–14,23`](skills/tastecheck-pass/assets/check-catalog.json)

The trust chain therefore bottoms out in the author’s choice of artifact boundary, captured scope, supplied facts, and claimed reviewer. Hashing those choices preserves them; it does not independently establish them.

## 3. The senior-designer trust curve

My predicted trust-breaking moment is the first drill-down from **SHIP** into **browser rendering**. The lead expects to inspect what was seen and why it was accepted; the runner can instead return a prose assertion, an inspector’s name, and `evidence_hashes_verified: true`, without any required image or observation-specific measurement. [`release-gate.mjs:318–321,370–397,503–520`](skills/tastecheck-pass/assets/release-gate.mjs)

That is an authority problem before it is a presentation problem. Adding thumbnails alone would make unsupported approval more persuasive.

The highest-value change is a **reviewable capture session**: show the exact candidate beside its approved reference or previous version, identify route/state/viewport and measured failures, and bind the reviewer’s decision to those captures. The lead should be able to disagree with one visual decision without having to reconstruct an entire ledger.

There is already relevant comparison machinery: the taste-oracle packet uses blinded arms, viewport-specific evidence, pairwise comparisons, ties, and abstention. That packet explicitly remains pending and is not release evidence; the opportunity is to bring that interaction into customer artifact review. [`judge-packet.json:6–8,14–17,71–84`](evals/taste-oracle/deslop-ui-hard-001/judge-packet.json)

## 4. Naming, positioning, AI-GEO

**My editorial judgment: keep “TasteCheck.”** The opening sentence identifies frontend work, coding agents, engineers, and an evidence-oriented outcome without requiring prior knowledge. [`README.md:1–3`](README.md)

**#8 — The machine-facing positioning promises stronger authority than the product establishes.** Later, the GEO block says “pass only evidence-backed ship quality” and contrasts the tool with “subjective design opinions.” Yet the runner expressly relies on human subjective reviews, and the README separately reports effectiveness as BLOCKED. [`README.md:149,170–178,137–139`](README.md); [`release-gate.mjs:324–367`](skills/tastecheck-pass/assets/release-gate.mjs)

My predicted LLM summary is therefore liable to overstate an automated quality guarantee. This is claim alignment, not another documentation-polish finding.

**Fix direction:** position TasteCheck as design QA that makes craft checks, visual evidence, and accountable judgment explicit, with each verdict’s scope and limits preserved in short summaries.

## 5. The pack as product

**#7 — The pack can replace generic AI taste with its own mandatory taste.** The spacing skill requires one exact ladder, one exact section clamp, and the specific `13/17/19/bare-24` migration exercise. The evaluation scenario demands those same literals as correctness. That evaluates adherence to a worked recipe rather than whether an existing product’s spacing system serves its hierarchy. [`spacing-system/SKILL.md:16–19,49–57,74–76`](skills/spacing-system/SKILL.md); [`spacing-system.json:6–15`](evals/scenarios/spacing-system.json)

Tasteroll makes the problem clearer: it declares one accent maximum, corners limited to 0/2/4/6px, and fixed compatibility pairings as hard constraints. The color skill, meanwhile, expressly permits several hues when the evidence calls for them and rejects a universal single-accent formula. [`design-rails.json:18–29,52–56`](skills/tasteroll/assets/design-rails.json); [`color-system/SKILL.md:28–29,60–61`](skills/color-system/SKILL.md)

A token-efficiency pass could compress these rules perfectly and preserve the entire problem.

The applicability model also needs the scope repair in finding #4: forms are always required, while cognitive accessibility is optional when “cognitive-friction” is absent. The latter makes the defect being sought serve as the condition for looking for it. [`check-catalog.json:13,19`](skills/tastecheck-pass/assets/check-catalog.json)

**The missing capability with 10× potential:** comparative visual acceptance for the user’s actual artifact—“what became better, what stayed recognizable, and what regression would make us reject this change?” The existing-site skill already asks for same-path comparison and preservation proof; the gate should make those obligations directly inspectable and binding. [`improve-existing-website/SKILL.md:59–63`](skills/improve-existing-website/SKILL.md)

## 6. Additional angle: evidence can disappear before its hash is checked

**#5 — Lossy sanitization can still produce verified evidence.** Captured arrays are truncated after 64 items, objects after 64 keys, and strings after 4,096 characters. Hashing occurs over that sanitized representation; validation does not make truncation markers a completeness failure. [`release-gate.mjs:30–33,70–98,171–186,370–397`](skills/tastecheck-pass/assets/release-gate.mjs)

Consequently, the 65th observation can disappear while the evidence hash remains valid. A long contrast or component-state report can lose a failing observation without anyone falsifying the original measurement.

**Fix direction:** separate bounded presentation from complete evidence storage, bind the complete capture, and keep any lossy evidence input non-passing.

## 7. Additional angle: the installed gate points at its own repository

**#6 — The ordinary CLI cannot directly audit a separate consumer checkout.** `ROOT` derives from the gate module’s location, and the CLI uses it for both ledger loading and artifact inspection. The installer links skills back into TasteCheck; absolute paths, parent traversal, and external symlink targets are rejected. Changing the working directory does not change this root. [`install.sh:2–8,187–188`](install.sh); [`release-gate.mjs:15–16,201–211,541–554`](skills/tastecheck-pass/assets/release-gate.mjs)

This fails safely, but it breaks the natural product workflow. The exported API’s root override also relocates catalog lookup, coupling the consumer artifact root to TasteCheck’s own directory layout. [`release-gate.mjs:305–309,442–447`](skills/tastecheck-pass/assets/release-gate.mjs)

**Fix direction:** separate the pinned verifier/catalog root from an explicit consumer artifact root and record both identities in the result.

## Findings

| # | sev | finding | evidence file:line | fix direction |
|---|---|---|---|---|
| 1 | SEV-1 | SHIP accepts evidence structure without deriving check results from observations. | `skills/tastecheck-pass/assets/release-gate.mjs:370–398,414–428,512–520` | Require check-specific observations and derive deterministic statuses from them. |
| 2 | SEV-1 | Reviewer approval is self-declared and replayable across artifacts and checks. | `skills/tastecheck-pass/assets/release-gate.mjs:26,324–367` | Bind independently authenticated approval to the check, rubric, artifact, and exact evidence. |
| 3 | SEV-1 | Artifact hashes need not cover the dependencies or specification determining the rendered result. | `skills/tastecheck-pass/assets/release-gate.mjs:214–274` | Bind captures to a complete build/dependency manifest and approved specification. |
| 4 | SEV-1 | Complete check categories do not establish complete page, state, control, or viewport coverage. | `skills/tastecheck-pass/assets/check-catalog.json:11–31`; `skills/tastecheck-pass/assets/release-gate.mjs:465–493` | Freeze an applicable subject inventory and reconcile observations against every required member. |
| 5 | SEV-1 | Sanitization can discard observations while their evidence hash still verifies. | `skills/tastecheck-pass/assets/release-gate.mjs:70–98,171–186,370–397` | Preserve complete evidence separately and fail incomplete or lossy submissions. |
| 6 | SEV-2 | The installed CLI binds consumer artifact paths to TasteCheck’s checkout. | `install.sh:2–8,187–188`; `skills/tastecheck-pass/assets/release-gate.mjs:15,305–309,541–554` | Separate verifier authority from the explicit target-project root. |
| 7 | SEV-2 | Evaluation recipes and aesthetic rails become universal design obligations. | `skills/spacing-system/SKILL.md:16–19,49–57`; `evals/scenarios/spacing-system.json:8–15`; `skills/tasteroll/assets/design-rails.json:18–29` | Separate invariant craft requirements from optional, brief-dependent style policies. |
| 8 | SEV-2 | GEO claims imply an objective ship-quality guarantee beyond the implemented authority. | `README.md:149,170–178`; `skills/tastecheck-pass/assets/release-gate.mjs:324–367` | Align every short description with evidence scope and accountable subjective judgment. |

**THE ONE THING**

