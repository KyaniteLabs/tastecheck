# Density Pass Report — 2026-09-05

## Result

All 20 `skills/*/SKILL.md` bodies received a CAVEMAN/PONYTAIL compression pass. The priority
four-body target and pack-wide target are met:

- `web-typography`: 31.6% body reduction
- `theming`: 25.8%
- `tasteroll`: 25.0%
- `data-viz`: 25.1%
- All 20 bodies: 15.1% body reduction

The full-file reduction is 11.9% because protected frontmatter, code blocks, and generated
contract blocks remain unchanged.

## Measurement

Counts are `Buffer.byteLength(SKILL.md) / 3.9`, reported as approximate tokens. **Full** counts
include the complete file. **Body** counts exclude YAML frontmatter, fenced code blocks, and the
`<!-- contract:v1:start -->` through `<!-- contract:v1:end -->` generated block. Baseline is the
repository `HEAD` version before this pass.

| Skill | Full before | Full after | Full cut | Body before | Body after | Body cut |
|---|---:|---:|---:|---:|---:|---:|
| a11y-pass | 1364.9 | 1286.4 | 5.7% | 1058.2 | 979.7 | 7.4% |
| art-direction | 1130.5 | 1049.0 | 7.2% | 851.3 | 769.7 | 9.6% |
| cognitive-a11y | 992.8 | 957.2 | 3.6% | 699.0 | 663.3 | 5.1% |
| color-system | 1596.2 | 1364.4 | 14.5% | 1303.8 | 1072.1 | 17.8% |
| component-states | 1594.6 | 1494.1 | 6.3% | 1291.3 | 1190.8 | 7.8% |
| data-viz | 2030.8 | 1591.0 | 21.7% | 1754.9 | 1315.1 | 25.1% |
| design-system-interview | 1819.2 | 1618.2 | 11.1% | 1338.7 | 1137.7 | 15.0% |
| deslop-ui | 1175.4 | 1107.9 | 5.7% | 850.3 | 782.8 | 7.9% |
| empty-states | 1353.6 | 1253.6 | 7.4% | 1084.1 | 984.1 | 9.2% |
| form-ux | 1379.7 | 1321.3 | 4.2% | 1100.8 | 1042.3 | 5.3% |
| humanize-copy | 1383.8 | 1283.6 | 7.2% | 1097.4 | 997.2 | 9.1% |
| i18n-ready | 1104.6 | 1056.4 | 4.4% | 822.6 | 774.4 | 5.9% |
| improve-existing-website | 1284.9 | 1187.7 | 7.6% | 977.7 | 880.5 | 9.9% |
| micro-motion | 1474.4 | 1387.4 | 5.9% | 1088.5 | 1001.5 | 8.0% |
| responsive-layout | 1040.8 | 996.7 | 4.2% | 744.9 | 700.8 | 5.9% |
| spacing-system | 1438.5 | 1304.4 | 9.3% | 1154.9 | 1020.8 | 11.6% |
| tastecheck-pass | 1265.9 | 1233.1 | 2.6% | 982.1 | 949.2 | 3.3% |
| tasteroll | 2293.3 | 1840.0 | 19.8% | 1812.8 | 1359.5 | 25.0% |
| theming | 2375.9 | 1857.9 | 21.8% | 2008.5 | 1490.5 | 25.8% |
| web-typography | 2730.3 | 1957.4 | 28.3% | 2442.3 | 1669.5 | 31.6% |
| **TOTAL** | **30830.0** | **27147.7** | **11.9%** | **24463.8** | **20781.5** | **15.1%** |

## Losslessness proof

- SHA-256 comparison of YAML frontmatter, every fenced code block, and every generated contract
  block: **PASS for all 20 skills**.
- Contract projections and generated files: **no drift**.
- Protected commands, paths, check IDs, thresholds, verdict grammar, provenance, and release
  facts were retained. Reference descriptions were shortened only where the linked path and
  its routing purpose remained clear.
- No testable rule, handoff boundary, accessibility threshold, or evidence requirement was
  intentionally removed. Repeated prose was merged; per-skill evidence rows and contract
  content remain distinct.

## Gaps noticed

- Evidence-ledger and delivery framing repeats across skills. It remains locally explicit because
  each skill owns different fields and handoffs; a shared include would need generated-output
  safeguards before replacing those lines.
- Reference inventories still carry useful routing context but are a remaining source of pack
  bloat. A canonical reference index could shorten them without hiding which file to read.
- Structural tests prove contracts, projections, protected blocks, and executable behavior, but
  they do not prove semantic prose equivalence. Meaning-density review remains a human judgment
  until rule/threshold inventories become machine-checkable.

## Verification

- `git diff --check`: **PASS**.
- Protected-block hash comparison: **PASS (20 skills)**.
- `npm run finalize`: **PASS**; refreshed source-bound receipts, context budget, manifest pins,
  and public status while preserving the `UNVERIFIED` release state.
- `npm run test:structural`: **PASS** — dependency preflight, contracts, receipt gates,
  verification, 20-skill lint, landing/integration checks, gate audit, deterministic gate tests,
  NIMA tests, ASTRA regressions, boundary tests, and mutation fixtures.
- README, `llms.txt`, and `index.html` facts were not edited by this pass.
- No commit or push was made.

## IMPROVEMENTS

1. Add a prose-token budget checker that excludes protected blocks. WHY: the final thresholds
   required repeated manual measurement. FIX: add a deterministic `tools/verify-density.mjs`
   report and threshold assertion to the structural lane.
2. Add machine-readable inventories for rules, thresholds, paths, and check IDs. WHY: protected
   hashes catch byte changes but not semantic omission in editable prose. FIX: validate each
   skill's inventory against its body and contract.
3. Centralize reference routing metadata. WHY: repeated descriptions were the main safe source of
   remaining bloat. FIX: generate concise per-skill reference lists from one canonical index.
