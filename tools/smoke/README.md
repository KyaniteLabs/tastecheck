# Smoke prompts — model-interpretation regression tests

Static checks (`npm test`) verify the *files*. This harness verifies the thing that
actually broke once: **how models read them**. The founding example: agents treated the
five sample design systems as a menu ("I'll implement Copper") because the files were
named `*.DESIGN-SYSTEM.md` — no link checker can catch that class of bug.

## Running

```bash
npm run smoke                 # uses the claude CLI (claude -p)
SMOKE_AGENT=codex npm run smoke
node tools/smoke/run-smoke.mjs --only samples-menu-trap
node tools/smoke/run-smoke.mjs --dry-run   # print prompts, no model calls
```

Costs real model calls — run manually before releases and after editing any skill's
framing language. Deliberately **not** part of `npm test` or CI.

## Adding a scenario

Add to `prompts.json`: `{ id, description, prompt, mustMatch: [regex…],
mustNotMatch: [regex…] }`. Write the prompt the way a real user would (vague where
users are vague). Patterns are matched case-insensitively against the agent's whole
output.

## Reading failures

The assertions are heuristics, not truth: a failure means "read this transcript," not
"the skill is broken." Two useful follow-ups: run the same scenario against a second
agent (`SMOKE_AGENT=codex`), and check whether the failing phrase came from the skill
text itself — if a model quotes a skill's example as its answer, the fix belongs in
the skill's framing (see the do-not-copy-the-examples guard in
design-system-interview).
