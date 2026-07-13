# Changelog

All notable changes to the tastecheck skill pack. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [1.4.0] — 2026-07-13

### Added — 20th skill: `chance-design`

Procedural design-system generation through seeded randomness. The feature
originated as C8 ("Chance-Styled Notes") in Rutile/FeatherMark's SPEC — a dice
button that uses Chance (kyanitelabs/chance) to auto-answer every
design-system-interview question from a bounded option space.

- **New skill `chance-design`** — seeded PRNG (xoshiro128++) picks from curated
  options for each design dimension (reference, personality, aesthetic, type,
  color_mode, density, rhythm, signature, imagery, motion)
- **`assets/bounded-space.json`** — the complete answer space with 8 reference
  territories, 8 personalities, 8 aesthetic approaches, 5 type directions, 8
  signature moves, 10 accent hue ranges, and the design bounds (measure 58–75ch,
  line-height 1.5–1.8, etc.)
- **`assets/chance-engine.js`** — pasteable zero-dependency PRNG with `pick`,
  `range`, `float`, `shuffle`, `chance` (same seed → same design, always)
- **Relaxed gate** — chance-generated designs need readable + WCAG AA contrast +
  self-contained + inert, not the full 19-skill strict gate (LD-8b pattern)
- **Landing page**: "Roll the dice" button in the bento grid with live seeded
  randomness demonstration
- **References Chance** (kyanitelabs/chance) as the conceptual source and
  optional MCP upgrade path for multi-source entropy mixing

### Changed

- Skill count: 19 → 20 across landing page, llms.txt, integration demo
- Version bumped to 1.4.0
- Contract handoff graph: design-system-interview now sends to chance-design;
  12 downstream skills receive from chance-design
- Context budget baseline rebaselined to include chance-design

## [1.3.1] — 2026-07-13

### Fixed — All deferred items closed

- **web-typography**: `--step--2` token added to canonical glossary (was used in
  starter.css but absent from the documented token list)
- **spacing-system**: `assets/spacing-starter.css` created (was the only generative
  skill without a starter asset)
- **theming**: `light-dark()` CSS function shorthand documented
- **component-states**: `role="switch"` HTML example added (screen readers
  previously announced a generic element)
- **art-direction**: favicon guidance added + `references/patterns.md` created
  (thinnest skill at 3.8KB, claimed favicon expertise with zero guidance)
- **i18n-ready**: `assets/locale-fixtures.json` created (built around locale
  fixtures but shipped none)
- **a11y-pass**: viewport zoom regex fixed — no longer false-FAILs on
  `maximum-scale=1.5` or `maximum-scale=10` (word-boundary matched between `1` and `.`)

### Fixed — Release-blocking issues

- **Gallery CSS**: broken `.swatch.verge` (missing semicolon caused contrast failure)
  and missing `.swatch.dispatch` background fixed
- **Gallery a11y**: Verge `.open` link contrast fixed (3.6:1 → 5.9:1 on dark card)
- **Maximal sample**: `html { overflow-x: hidden }` added (390px horizontal overflow)
- **Browser + e2e receipts**: regenerated (all 495 browser checks pass)
- **Contract.json handoff graph**: bidirectional edge symmetry verified and fixed
  across all 19 skills (A.sends_to ∋ B ⟺ B.receives_from ∋ A)

### Changed — Visual evolution

- **Landing page**: audit results strip in hero, Dispatch + Verge in sample nav,
  gate cell updated with audit stats, version bumped to 1.3.1
- **Hero image**: regenerated as `seven-systems.png` (7 samples composited, was 6)
- **llms.txt**: updated from six → seven systems, effectiveness v2 infrastructure noted
- **Stale worktrees**: effectiveness-v2-* removed (merged via PR #17)


## [1.3.0] — 2026-07-13

### Fixed — Full 19-skill audit (3 P0, 8 P1)

- **deslop-ui**: emoji-header grep detector rewritten (was silently broken on macOS BSD
  grep — `\x{}` Unicode escapes require PCRE `-P`)
- **theming**: `--color-primary`/`--color-primary-hover`/`--color-primary-ink` and
  `--color-success`/`--color-error`/`--color-warning`/`--color-info` added to the
  canonical token list and `theme-starter.css` light + dark (components using
  `var(--color-primary)` got undefined variables with no dark-mode mapping)
- **micro-motion**: shipped asset no longer implements the anti-pattern the SKILL.md
  prohibits — `html.js .reveal { opacity: 0; }` replaced with the visible-by-default
  `data-reveal="pending"` pattern (content was permanently invisible if JS failed or
  bfcache restored)
- **color-system**: hover L-nudge corrected (0.08 → 0.06, matching the stated rule),
  hardcoded `white` → `var(--color-primary-ink)`, ramp endpoint corrected (~0.20 → ~0.30)
- **component-states**: `.menu-item:focus-visible` no longer removes the focus outline
  without an adequate replacement (was ~1.5:1 contrast, below WCAG minimum); added
  aria-disabled keyboard activation note
- **tastecheck-pass**: gate-audit gradient regex now catches Tailwind v3 space-separated
  rgb and hex forms of the indigo→violet AI tell (was comma-rgb-only)
- **micro-motion**: `.popover[data-open]` → `.popover[data-open="true"]` (presence-based
  selector matched `data-open="false"`)

### Audited — 19-skill systematic review

Full per-skill audit across all 19 skills for staleness, gaps, bugs, swallowed errors,
missed opportunities, blind spots, and integration debt. 3 P0, 15 P1, ~40 P2, ~30 P3
findings triaged. P0 and key P1 fixed; P2+ deferred with documented rationale.

### Changed

- Gallery samples gate-audit cleaned (all 11 surface/mode combinations)
- Gallery index: system-ui → Archivo committed display face
- Gallery now shows seven design systems (Verge added in v1.2)

### Added — Effectiveness v2 blind evaluation infrastructure

- **Machine-only blind evaluation protocol** — 12 scenarios, 2 seeds, 2 opaque arms,
  24 comparison units, 48 generation calls, 96 production judgments, 16 anchor judgments,
  maximum 160 external calls, zero retries, `exclusions=[]`. Production has not started;
  the 160-call budget is untouched.
- **Sealed generation and render pipeline** — hash-bound generation receipts, local
  Playwright render capture with PNG/DOM/style evidence, Ed25519-signed one-time map
  opening, HMAC-derived packet coordinates.
- **Reservation and admission system** — strict run IDs, containment/symlink defenses,
  argv-only Git, exact HEAD binding, untracked cleanliness, fail-closed fsync. Caller
  ledger root bound to committed reservation.
- **Synthesis and scoped claims** — family-separated aggregation, hard-regression
  blocking, pure `aggregateAdmissibleResults` scoring function, `projectPublicClaim`
  with claim-scope enforcement. Synthesis returns `production_not_started` when
  trusted signed provider evidence is unavailable.
- **Adversarial QA gate** — preregistered source-hash drift detection, network
  isolation enforcement, exact case-set verification. Runs as `npm run eval:v2:qa`.
- **Fake-only rehearsal** — `npm run eval:v2:rehearse` drives the full pipeline with
  injected local fakes: 160 simulated calls, 0 real calls, no unmask, no spend.

### Changed — Trust-boundary closeout

- **Render authenticity** — `verifyRenderReceiptBinding` recomputes and verifies all
  21 receipt fields (schema, kind, run, unit/artifact/arm, viewport dimensions, artifact
  hash, evidence ID, embedded PNG/DOM/style hashes, manifest fields) from embedded
  evidence during synthesis. Negative tests cover every field.
- **Executor manifest binding** — exact `canonicalJson` equality on all 14
  manifest-derived executor fields (adapter, system prompt, rubric, settings, tool
  policy, time budget, etc.), not just the 5 previously checked.
- **Provider authenticity gate** — `verifyResolverAttestation` now requires a trusted
  signature verified against a pinned trust anchor. Unsigned caller-authored
  attestations throw `trusted-signature|required`. Scoring extracted to pure
  `aggregateAdmissibleResults` so fake fixtures cannot create a release claim.
- **Canonical ledger binding** — `bindAndAppendTerminal` derives the ledger path from
  `repoRoot` (not `judgeEvidence.ledgerPath`), validates runId against path traversal,
  rejects symlinks, verifies disk-vs-supplied canonical equality, and appends the
  terminal event atomically with fsync.

### Changed — Documentation and receipts

- Updated `docs/EFFECTIVENESS-V2.md` with full protocol description.
- Regenerated all 6 source-bound v1 receipts with current source tree hash.
- Updated pinned receipt hashes in `contracts/v1/release-receipts.json`.

### Changed

- Reframed the headline interview around a concrete recommend-then-react exchange,
  visible decision snapshots, a build-ready output, and an interruption-safe resume card.
- Reframed `tastecheck-pass` around a BLUF **SHIP** / **HOLD** release brief while
  preserving the fail-closed evidence table and actionable rerun requirements.
- Rewrote the 20-command product surface as concise jobs with explicit user-visible
  outputs; removed stale shortcuts and internal evaluator language from command prompts.
- Reworked the README and launch kit around the brief → artifact → implementation →
  ship-gate product story, corrected the gallery to six systems, and tightened claim boundaries.
- Replaced brittle universal recipes in color, charts, responsive layout, theming, and
  typography with evidence-led decisions and explicit exceptions that still verify.
- Hardened loading, form validation, motion, and existing-site repair against stale async
  results, delayed JavaScript, interrupted sessions, and accidental identity erasure.
- Rebuilt `humanize-copy` around protected source facts, authorized stance, and a worked
  before/after instead of a longer list of AI-writing tells.

## [1.0.0] — 2026-07-11

### Release status

- 1.0 engineering readiness and effectiveness are separate gates. Contract, static, and
  evidence-pipeline readiness can pass while effectiveness remains blocked and unsupported.
  The terminal blind evaluation remains below its release threshold; historical or failed
  evidence cannot be presented as current effectiveness proof.

The "the gate actually runs, and it caught us" pass — findings from a cross-model audit
(one build brief through 7 model lanes) shipped back into the pack, then the pack held to
its own standard on its own surfaces.

### Guardrails
- **`verify.mjs` now fails on curly quotes used as HTML attribute delimiters** (`class=”…”`).
  LLM agents emit smart quotes in code constantly; the browser then never matches the
  class, the layout silently degrades, and the page still passes every content check.
  Four agents shipped curly-broken sample layouts in this very pass — all reporting
  `npm test` green. The signature (`=` followed by a curly quote) is never valid HTML and
  never appears in prose, so the check is zero-false-positive.

### Samples & landing (dogfooding the structural plane)
- **The landing page now runs all 19 skills live** (was 15). The four newer skills —
  spacing-system, art-direction, i18n-ready, tastecheck-pass — are now working bento
  cells (the gate cell shows a live PASS), `landing:true` in the manifest, with
  `skillCount` bumped to 19 on the landing and the integration harness.
- **The landing page was restructured to break the SaaS-skeleton order** it was quietly
  shipping (hero → problem → how → grid → CTA): it now leads with the live bento and
  demotes "the problem" to a principle after the demonstration. The structural self-check
  caught this; the mechanical auditor could not.
- **All five samples stopped being recolors of one skeleton.** Each gets a reading order
  AND a skills-section layout native to its committed aesthetic: concrete a spec-sheet
  ledger, swiss a modular grid, maximal a color-block wall, copper a tessellated bento,
  clay soft grouped clusters.
- **A sixth sample — Dispatch / Shipping log** — a dark emerald-slate release timeline
  whose content is the changelog of the work above. The gallery is now "six committed
  design systems," a claim now backed by structure (no two share a section order or a
  skills layout), not skin.

### Added
- **Runnable gate auditor** (`skills/tastecheck-pass/assets/gate-audit.js`) — a paste-able
  (or browser-injectable) console auditor for the cold-load tells self-reported gate
  tables miss: `hidden` defeated by a CSS display rule, error text before input, content
  stuck at opacity 0, uniform card grids, stat-counter bands, pill CTAs, the indigo
  gradient. Prints named selectors so its output is pasteable evidence. Injecting it sets
  `window.__gateAudit = {verdict, fails, warns, notes}` so a browser-driving lane runner
  reads the result with no manual paste (Playwright/Puppeteer snippet in
  `tools/smoke/README.md`).
- **Gate-auditor regression** (`tools/verify-gate-audit.mjs`, in `npm test`) — executes
  the asset against a fake DOM and guards the attribute-pure checks plus the structured
  and console-golden contract; the layout-dependent stat-band/date-context check is
  protected by a real-browser fixture (`tools/smoke/fixtures/gate-audit-fixture.html`).
- Structural-slop self-check items hoisted into `deslop-ui`'s SKILL.md (the SaaS
  skeleton, uniform card grid, metronomic rhythm, image-shaped placeholders) so the
  structural plane runs on every pass, not just in a reference file.

### Changed
- `tastecheck-pass`: the gate outranks polish — reserve budget for it before optional
  extras, and never imply it ran when it didn't; a measurable ✓ must carry its measured
  value; added a cold-load render check and the auditor wiring.
- `design-system-interview`: budget for the gate from minute one (rule 2.6), at the front
  door of the pipeline rather than only in the last-read skill.
- `micro-motion`: reveal-on-scroll must not park content at `opacity: 0` in static CSS —
  gate the hidden state behind a JS-added hook so a no-JS reader never sees blank
  sections; the canonical example now uses the `html.js` hook.

## [0.1.0] — 2026-06-12

The "make every agent read it the same way" overhaul.

### Added
- **Four new skills** closing expert-workflow gaps: `art-direction` (imagery,
  illustration, iconography as committed decisions), `spacing-system` (owns the
  `--space-*` scale and section rhythm), `i18n-ready` (multilingual-resilient UI,
  EN/ES first-class), `tastecheck-pass` (the ship gate; states the canonical pipeline
  once and executes every relevant self-check with a pass/fail report).
- **Canonical token glossary** in `skills/design-system-interview/references/tokens.md`
  — the exact names every skill consumes/emits (semantic `--color-*`, type, space,
  radius, shadow, motion, data-viz series).
- **`skills.json` manifest** — drives all three verifiers; landing coverage is
  declared, not implied.
- **Skill lint** (`tools/lint-skills.mjs`, in `npm test`) — dead skill cross-refs,
  off-glossary tokens, frontmatter drift.
- **Smoke-prompt harness** (`tools/smoke/`, manual) — regression-tests how models
  interpret the skills (the samples-as-menu failure class).
- CI workflow (`.github/workflows/verify.yml`), `FONTS-LICENSES.md`,
  `install.sh --uninstall`, and slash commands for the new skills.

### Changed
- **Every skill normalized to the canonical token contract** (theming, web-typography,
  component-states, data-viz, deslop-ui, color-system — SKILL.md, assets, references).
- **Samples renamed** `samples/*.DESIGN-SYSTEM.md` → `*.case-study.md` (the old name
  collided with the artifact the interview emits) and each now opens with a
  do-not-implement header; llms.txt carries an anti-menu note for AI readers.
- **design-system-interview hardened**: existing-direction skip path, anti-menu rule,
  domain-bounded boldness, imagery/iconography question, light/dark decided at
  interview time, do-not-copy-the-examples guard.
- **improve-existing-website brought to parity**: audit procedure, signal-vs-drift
  tests with a worked example, ADRs, run checklist.
- Reduced-motion doctrine unified under `micro-motion` (designed fallback primary,
  global kill switch demoted to retrofit baseline); duration values reconciled across
  skills; slash commands now symlinked so `git pull` updates them.

### Fixed
- Dead skill references (`idiomatic-translation`, `web-design-guidelines`).
- Indigo/Tailwind-blue fallback colors in the component-states quick-start (the exact
  default the pack exists to kill).
- Copper-hardcoded data-viz chart starter (now canonical tokens + a clearly-marked
  example palette).
- Nested media query in the theming starter; stale `text-rendering` advice; ungrounded
  letter-spacing self-check item in web-typography.
