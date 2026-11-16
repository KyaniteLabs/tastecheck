# TasteCheck architecture

```text
agent -> skill + contract / slash command -> direction + UI changes (separate approval)
real rendered artifact -> CDP probes + screenshots -> evidence -> SHIP / HOLD
source contracts + labeled corpora + release facts -> verification / regression gates
```

`skills/` contains procedural context/contracts; `commands/` are entry adapters. [release-facts.json](tools/release/release-facts.json) is the generated inventory source. [CLI](bin/tastecheck.mjs) dispatches install/profile/calibration and runs [cdp-qa.mjs](skills/tastecheck-pass/assets/cdp-qa.mjs) for audit. Shell/Node installers link skills into detected agent homes; links point back at the checkout, so checkout changes affect consumers.

The browser driver launches Chromium with a throwaway profile, uses CDP/WebSocket, collects per-probe statuses/evidence/screenshots and maps missing/failed required checks to HOLD. Local taste profiles affect template-tell judgments, not objective checks. [tastecheck-pass](skills/tastecheck-pass/SKILL.md) additionally requires gestalt-first judgment and a named design basis; automation does not replace subjective review. Deep-lane ledgers/release tools bind evidence to source and distinct reviewers where required.

## Risk / failure boundaries

- Installer force/uninstall and profile forget/reset modify/delete local state. Never run against shared agent homes to prove docs. Updating a linked checkout changes installed skills across consumers.
- Browser audits execute page code and collect screenshots/logs; private URLs and evidence can leak sensitive material. Missing Chrome/resources/required probes must remain explicit not-run/HOLD, not green checkmarks.
- Stale or internally consistent false observations can escape offline integrity checks. Hashed receipts are not independent witnesses; historical release receipts are head-bound and effectiveness is a separate claim.
- Template-tell counts and self-authored corpus labels are regression floors, not composition/brand judgment or controlled effectiveness. README/CLI inventory differences require reading actual source rather than guessing shipped-package parity.

## Docs verification

Read purpose/rules, inventory, actual CLI/install/skill/browser-driver boundaries. Help, inventory check and `tools/verify.mjs` passed; Chromium screenshot of the static landing captured. Audit driver/full suites were not run because they include cleanup paths; no installation, local profile mutation, inference, publication or effectiveness measurement. Independent review/head-bound CI and user-side acceptance remain open. Runtime unchanged; revert docs for rollback.
