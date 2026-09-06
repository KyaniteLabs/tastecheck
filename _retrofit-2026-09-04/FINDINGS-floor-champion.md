# FLOOR OPINION — lane 'floor' (model Qwen3.8-27B) on tastecheck
# via engines bridge :8817, 50s

1. What does this product do?
TasteCheck is a final release gate that forces a binary SHIP or HOLD decision on frontend work by demanding real, executed evidence rather than file existence or self-reported checkmarks. It acts as a fail-closed auditor that converts every failed check into a specific, owned remediation path.

2. If you had to run this skill yourself, where would you get stuck or confused?
*   **The "Real Artifact" Ambiguity:** The prompt demands checks on the "real rendered artifact," but it doesn't define the environment. Do I need a live URL? A local dev server? A screenshot? If I can't spin up a browser, do I fail the gate immediately, or is there a fallback?
*   **The `gate-audit.js` Dependency:** Step 3 references `assets/gate-audit.js`. If this file isn't provided in the context, I cannot run the cold load check. The prompt doesn't say what to do if the script is missing—do I write it, or fail?
*   **Subject Existence Detection:** The prompt says "Only absent subjects skip," but it doesn't tell me how to determine if a subject (like `data-viz` or `i18n`) is "absent." Do I inspect the codebase? Ask the user? Guess based on the file structure?
*   **Contradiction in "n/a" Logic:** It says `n/a` means the subject is absent, but also says "lacks a real artifact" is a HOLD. If a subject is absent, is it `n/a` (pass) or HOLD (fail)? The distinction between "feature not present" and "feature present but broken" is blurry in the execution steps.
*   **Evidence Provenance:** It asks for `provenance` in the evidence table, but doesn't define what format that takes. Is it a git commit hash? A timestamp? A screenshot filename?

3. Top 5 problems you see
*   **Missing Tooling Definition:** The skill relies on `assets/gate-audit.js` and manual browser inspection but provides no mechanism to actually perform these actions. It’s a policy document, not an executable tool.
*   **Ambiguous "Required" Scope:** It lists many skills (e.g., `micro-motion`, `art-direction`) as "where subject exists," but the "Required" list only includes direction, foundations, structure, accessibility, and design-critique. It’s unclear if a missing `micro-motion` check is a pass (n/a) or a fail (missing evidence).
*   **No Input Validation:** The skill assumes `DESIGN-SYSTEM.md` exists. If it doesn’t, it says "fail and return to direction," but it doesn’t specify *how* to return or what the output should be in that failure state.
*   **Over-Reliance on Manual Steps:** Step 3 requires manual inspection of shadow roots/iframes. This is not automatable and makes the "evidence-backed" claim weak if the human inspector is biased or lazy.
*   **Vague "Honest" Verdict:** The prompt asks for an "honest" decision but provides no objective criteria for "honesty" beyond the checks. It’s subjective and prone to model bias if
