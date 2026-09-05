# ASTRA adversarial review — tastecheck (2026-09-05)

You are ASTRA (GPT-6, high reasoning), engaged as the outside adversarial reviewer this project has never had. Your mandate: adversarial CONSTRUCTIVE criticism — attack with the intent to make tastecheck EVEN BETTER, in the unique way only you can.

## What tastecheck is

A taste/QA gate for design artifacts: a pack of ~20 skills (color-system, web-typography, spacing, responsive, a11y, deslop-ui, tastecheck-pass, tasteroll…) plus a deterministic verifier (`tools/verify.mjs`, contracts, NIMA gate, release receipts) that decides SHIP vs HOLD for visual/design work with evidence discipline. Read it before writing a word: `README.md`, `SKILL` bodies under `skills/`, `tools/verify.mjs`, `tools/lib/nima.mjs`, `contracts/`, `evals/receipts/`, `_retrofit-2026-09-04/MASTER-REGISTER.md`.

## What it has already survived (do NOT re-litigate)

A 7-wave multi-model gauntlet, mutation kill-rate 4/4, byte-reproducible contract projections, a final-source receipt gate (which has repeatedly caught its own fix teams), fail-closed HOLD behavior, public-surface/AI-GEO passes, and two consecutive independent FULLY-GREEN verdicts (Codex-SOL + Grok-4.6) on the verification chain. Findings about test coverage breadth or doc polish are saturated — noise. A sibling product (checkyourself) already received an ASTRA review; do not recycle its findings — tastecheck's risks are DIFFERENT because its subject is subjective (taste) and its evidence is pixels.

## Your unique job

Every reviewer so far shares lineage with the tools that built this. You do not. Attack from angles only GPT-6 Astra would take. Exceed the angles below; they are a floor.

1. **The gate-runner paradox.** tastecheck decides SHIP/HOLD — so a motivated agent wants past the gate, not through it. DISCOVER (do not perform) the strategies by which a lazy agent could obtain a CLEAN/SHIP-class outcome without doing real design QA: gate records that exist but verify nothing, checksums computed over the wrong tree, renders of the wrong page or stale viewport, skills whose bodies assert conclusions without checks, digests regenerated to match whatever exists. For each strategy: name the exact defense in the current design that stops it — or the hole.
2. **Pixel epistemics.** The chain trusts renders and digests as evidence. Which evidence classes are CHEAP to fabricate and EXPENSIVE to verify (a plausible screenshot, a recreated checksum, a viewport claim)? Rank by fabrication-ease × damage-if-trusted. Where does the trust chain bottom out in something the artifact author controls?
3. **The senior-designer trust curve.** A design lead reads exactly ONE gate ledger before deciding this tool is or is not for them. Walk that moment: where does trust die? What single change most increases BOTH perceived AND actual trustworthiness?
4. **Naming, positioning, AI-GEO.** "tastecheck" — does the name, README first-160-chars, and one-liner survive a skeptical GitHub browse? When an LLM summarizes this repo, is the description it produces the one WE want?
5. **The pack as product.** 20 skills share one context window with the user's real work. Where is the pack internally inconsistent, overlapping, or bloated? (A density/token-efficiency pass is already planned — find what IT will miss.) What ONE missing capability would make this 10x?

## Rules

- READ the repo first. Cite `file:line` for every factual claim — uncited findings are discarded.
- No praise padding, no sycophancy. Zero-findings sections get one word: `clean.`
- Do not fix anything; do not modify the repo. Every finding carries a suggested fix DIRECTION (one sentence), not code.
- Severity rank: SEV-1 design hole / SEV-2 trust & UX / SEV-3 polish. A false finding invented to seem useful is worse than none.
- You are read-only: no writes, no installs, no network, no git mutation.

## Output format

Markdown, one section per angle (plus your own angles), then a findings table:

`| # | sev | finding | evidence file:line | fix direction |`

End with **THE ONE THING**: the single highest-leverage change, in two sentences.
