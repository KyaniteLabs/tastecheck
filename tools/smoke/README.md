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

## Auto-running the gate auditor on a built page

`skills/tastecheck-pass/assets/gate-audit.js` is paste-into-the-console by default, but
a lane runner that drives a browser can inject it and read the structured result —
the evidence appears with no model paste. The IIFE runs on inject and assigns
`window.__gateAudit = { verdict, fails, warns, notes }` (with the *full* warns list,
not the console cap). Playwright:

```js
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const audit = readFileSync("skills/tastecheck-pass/assets/gate-audit.js", "utf8");
const page = await (await chromium.launch()).newPage();
await page.goto(pageUrl);                 // a FRESH load — no clicks/scroll first
await page.addScriptTag({ content: audit }); // runs synchronously; sets window.__gateAudit
const result = await page.evaluate(() => window.__gateAudit);
if (result.verdict === "FAIL") { /* fail the run; result.fails has the named defects */ }
```

Puppeteer is identical (`page.addScriptTag({ content })` → `page.evaluate`). No need to
wait after `addScriptTag` — the result global is set by the time it resolves. The
auditor reads computed style + layout, so it needs a real browser; jsdom won't do.

### `gate-audit-fixture.html` (in `fixtures/`)

A real-browser regression fixture for the auditor's layout-dependent checks (the ones
`tools/verify-gate-audit.mjs` deliberately skips). Serve this dir, open the fixture,
and run the auditor: current verdict is **1 warn** (the stat band). The fixture's
header comment documents the mutation test that proves the stat-band/date-context
guard has teeth. `gate-audit-golden.txt` is the committed console baseline the Node
verifier asserts against — regenerate it with `UPDATE_GOLDEN=1 node tools/verify-gate-audit.mjs`
only when an intended change to the auditor's output lands.
