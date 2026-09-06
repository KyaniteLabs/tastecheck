# TasteCheck — Evidence edition

**HOLD for release; the commissioned landing-page draft and static self-check are complete.** Browser observations, independent judgment, and the legacy integration contract remain open. No SHIP result is claimed.

Artifact: [index.html](index.html). Design date: 2026-09-05. Scope: this isolated copy, one self-contained landing page. No network, installs, publishing, receipt refresh, or changes to the kit. The published release and historical effectiveness statuses remain **UNVERIFIED** and **BLOCKED** respectively.

## Inferred-system statement

The user commissioned a new design and delegated its visual decisions. This statement is the design specification for this draft, kept here to preserve the requested two-deliverable format. It is not a claim of independent design approval. The nine-dimension decision method comes from [design-system-interview](skills/design-system-interview/SKILL.md); its downstream choices are explicit below.

| Dimension | Committed implementation and evidence |
| --- | --- |
| Reference | The supplied README, changelog, review closure, and density report. `index-PREVIOUS.html` was absent; the pre-existing `index.html` supplied the previous page's product facts and public status. |
| Personality | Direct and accountable. Each technical claim has a visible consequence and a nearby source link. |
| Aesthetic | An editorial release record: warm black, chalk type, citron paper, ruled evidence rows. |
| Type | Oversized bold sans for the proposition; ordinary sans for sustained reading; monospace for identifiers. System fonts only. |
| Color mode | Authored dark mode, a higher-contrast preference mapping, and system forced colors. No theme selector or saved preference. |
| Density / shape | Zero corner radius and zero shadow. Compact evidence rows sit between larger narrative breaks. |
| Structure / rhythm | Asymmetric headline and gate schematic; status line; five repair rows; density comparison; grouped skill index; installation and limits. All release-story content is in the continuous document, without disclosure controls. |
| Signature | The citron gate schematic makes the dependency between observations, review, and verdict visible. It labels itself a model, never a receipt. |
| Imagery / iconography | No photography or screenshots. Original HTML schematic and a simple check glyph; inline SVG favicon. Decorative arrows and mark have `aria-hidden`. No third-party asset rights are implied. |

The stance, through [art-direction](skills/art-direction/SKILL.md): give engineers evaluating the kit a visible evidence trail before asking them to trust a verdict. The schematic's fallback is its native ordered text list; its order never changes at narrow widths. There are no crops, image overlays, fabricated assets, logos from other organizations, or press claims. Favicon legibility at 16 × 16 still needs rendered inspection; a separate raster icon was omitted under the single-file commission.

The structural decision through [deslop-ui](skills/deslop-ui/SKILL.md) is to organize this release by causality rather than twenty equal demo cards. The preserved signals are the skill inventory, gallery, installation path, and honest public status. Surface, structure, and verbal choices still require independent against-spec inspection.

## Section → skill → measured implementation

Measurements below are **source arithmetic and sRGB calculations**, not observed browser geometry. Pair IDs refer to the contrast table. Type values assume a 16px root; the scale remains relative to user preferences.

| Section / selectors | Skills that drove the section | Concrete values and intended reading behavior |
| --- | --- | --- |
| Masthead / `.masthead`, `.menu` | [web-typography](skills/web-typography/SKILL.md), [component-states](skills/component-states/SKILL.md), [responsive-layout](skills/responsive-layout/SKILL.md), [a11y-pass](skills/a11y-pass/SKILL.md) | 22px wordmark; 14px navigation; 44px minimum navigation height; 24px header padding and gaps. Wrapping keeps every link available. P1/P3/P7. |
| Hero / `.hero-copy`, `.trail` | [art-direction](skills/art-direction/SKILL.md), [color-system](skills/color-system/SKILL.md), [web-typography](skills/web-typography/SKILL.md), [spacing-system](skills/spacing-system/SKILL.md) | H1 50 / 67.008 / 95.68px at 390 / 768 / 1280; 1.02 line-height; −.055em tracking. Introduction 18 / 19.104 / 20.64px, 1.6 line-height, maximum 46ch. Diagram padding 24px, becoming 32px above 64rem. P2/P3/P4. |
| Release status / `.status-strip` | [humanize-copy](skills/humanize-copy/SKILL.md), [theming](skills/theming/SKILL.md) | 14px text at 1.6; 24px vertical padding; 16px row and 32px column gaps. Exact 20/20/8 inventory, explicit UNVERIFIED text, never color-only status. P1/P2/P3. |
| Retrofit / `#retrofit`, `.changes` | [humanize-copy](skills/humanize-copy/SKILL.md), [cognitive-a11y](skills/cognitive-a11y/SKILL.md), [spacing-system](skills/spacing-system/SKILL.md), [responsive-layout](skills/responsive-layout/SKILL.md) | Five distinct repairs: a 32px number rail, title, then consequence. 24px row padding; 12px narrow row gap; paragraph measure capped at 56ch. Main section heading 40 / 52.48 / 70.4px. P1/P2/P3. |
| Density / `.density` | [data-viz](skills/data-viz/SKILL.md), [web-typography](skills/web-typography/SKILL.md), [theming](skills/theming/SKILL.md) | Reduction figure 75.3 / 101.76 / 128px, unit at half that size; tabular numbers. A native before/after table uses 14px text and 12px cell padding. 24px between explanations. P5/P6. |
| Skills / `#skills`, `.skill-group` | [cognitive-a11y](skills/cognitive-a11y/SKILL.md), [deslop-ui](skills/deslop-ui/SKILL.md), [component-states](skills/component-states/SKILL.md) | Six groups with 3 + 4 + 4 + 3 + 5 + 1 unique skills. Labels use step 1; links use 14px mono with 44px minimum height. Group padding 24px, link column gap 24px. P1/P2/P7. |
| Installation / `#use`, `.install`, `.boundary` | [component-states](skills/component-states/SKILL.md), [a11y-pass](skills/a11y-pass/SKILL.md), [humanize-copy](skills/humanize-copy/SKILL.md) | Primary link minimum 48px; 12 × 24px padding. Install panel padding 24px. Code is 13.125px inside a 14px preformatted block, soft-wrapping at narrow widths. Limits remain beside the action. P1/P2/P4/P8. |
| Footer / `.footer` | [spacing-system](skills/spacing-system/SKILL.md), [a11y-pass](skills/a11y-pass/SKILL.md) | 14px text; 44px link minimum height; 24px padding/gaps; wrapping. P2/P7. |
| Whole artifact | [tastecheck-pass](skills/tastecheck-pass/SKILL.md) | Catalog coverage, identity, static checks, open evidence, and release HOLD are recorded below. |

Listing all 20 skills on the page is navigation, not an execution claim. `tasteroll`, `improve-existing-website`, `form-ux`, `empty-states`, `micro-motion`, and `i18n-ready` were not applied to this implementation. No seeded exploration or additional locale is claimed. Motion, forms, and async application states are absent.

## Color and theme measurements

[color-system](skills/color-system/SKILL.md) determines roles and measured pairs; [theming](skills/theming/SKILL.md) maps them. Citron highlights the evidence model and actionable links, not success. Green-tinted warm neutrals connect the document to that field. The small palette has six used neutral stops and three accent states, rather than unused ramps. The brief explicitly permits documented equivalents: CSS uses these sRGB hex values, with their computed OKLCH equivalents here. No P3 claim or gamut clipping is involved. Hue correction toward 106.65° at near-white keeps the text warmer; the neutral chroma tapers at both ends.

| Primitive | sRGB | OKLCH (L, C, H°) | Role |
| --- | --- | --- | --- |
| neutral-950 | `#171815` | .20675, .00601, 121.96 | Background; ink on citron |
| neutral-900 | `#22241e` | .25605, .01135, 122.21 | Density section surface |
| neutral-700 | `#52574a` | .44817, .02161, 124.42 | Decorative dividers |
| neutral-500 | `#909780` | .66414, .03401, 121.09 | Panel boundaries; higher-contrast dividers |
| neutral-300 | `#b8bdac` | .78963, .02415, 120.30 | Secondary and visited text |
| neutral-100 | `#f0f0e6` | .95240, .01325, 106.65 | Primary text |
| citron-300 | `#e5ef73` | .91992, .14819, 113.11 | Accent, button, schematic, focus |
| citron-200 | `#f1fa9c` | .95771, .11726, 113.08 | Hover |
| citron-400 | `#cbd558` | .84117, .14831, 113.40 | Active |

Primitive → semantic → component alias: for example `--citron-300` → `--color-primary` → `--button-bg`. Semantic role names have a single definition source and are remapped for environmental preferences. No error/success palette is invented for absent application states.

WCAG 2.x formula: linearize each 8-bit sRGB component (divide by 12.92 below .04045; otherwise `((c + .055) / 1.055)^2.4`), calculate `Y = .2126 R + .7152 G + .0722 B`, then `(Ylighter + .05) / (Ydarker + .05)`.

| ID | Foreground / background | Ratio | Static disposition |
| --- | --- | ---: | --- |
| P1 | Primary / page | 15.546:1 | Above 4.5:1 |
| P2 | Secondary or visited / page | 9.265:1 | Above 4.5:1 |
| P3 | Accent / page; ink / accent | 14.369:1 | Text, mark, focus, diagram rules |
| P4 | Button ink / hover; ink / active | 16.041:1; 11.204:1 | Above 4.5:1 in both states |
| P5 | Primary / raised; secondary / raised | 13.675:1; 8.149:1 | Above 4.5:1 |
| P6 | Accent / raised | 12.640:1 | Above 4.5:1 |
| P7 | Hover / page; hover / raised; active / page; active / raised | 16.041:1; 14.110:1; 11.204:1; 9.856:1 | Link states above 4.5:1 |
| P8 | Strong border / page; strong border / raised | 5.878:1; 5.171:1 | Above 3:1 |
| P9 | Decorative divider / page; divider / raised | 2.395:1; 2.107:1 | Decoration only: not a control, status, data mark, or sole grouping cue. Headings, order, and spacing preserve the relationships. |

All default, hover, active, and visited text combinations are covered. Focus is a 3px solid outline with 4px offset, so its adjacent background is the page/raised surface rather than the button fill. The skip link uses chalk focus on the page. Higher-contrast mode changes secondary text to chalk and dividers to neutral-500; it introduces no new color pair. Forced colors use system `Canvas`, `CanvasText`, `LinkText`, `ButtonFace`, `ButtonText`, and `Highlight`; their ratios cannot be honestly fixed in advance.

The authored dark theme is available before paint because it is inline CSS. No saved preference, local storage, font download, or JavaScript initialization exists. This is source evidence only; cold-load and forced-color behavior still need observation. No zero-CLS or no-flash result is asserted.

## Type, measure, and spacing

The role scale starts around a 1.25 ratio and uses explicit optical steps for the large headline and denser labels; it is not described as a mathematically uniform modular scale. Body remains 16px with a unitless 1.6 line-height. Paragraphs cap at 60ch, the hero at 46ch, retrofit copy at 56ch, section lead-ins at 54ch. These are CSS limits, not measured glyph counts. Narrow columns necessarily fall below the 45–75ch reading guideline; font size is retained and paragraphs stay short.

| Width | Gutter | Content | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Chapter padding |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 320 | 24 | 272 | 18 | 24 | 32 | 40 | 50 | 48 |
| 390 | 24 | 342 | 18 | 24 | 32 | 40 | 50 | 48 |
| 768 | 30.72 | 706.56 | 19.104 | 26.88 | 39.36 | 52.48 | 67.008 | 62.72 |
| 1280 | 51.2 | 1177.6 | 20.64 | 32 | 48 | 70.4 | 95.68 | 83.2 |

All entries are pixels calculated from CSS at a 16px root. Step −1 is 14px and step 0 is 16px. Headings use relative `clamp()` bounds, with 1.02 / 1.08 / 1.2 line-height for H1 / H2 / H3. Large display tracking is −.055em; section tracking is −.045em. Long identifiers and commands may wrap; there is no clipping or ellipsis policy.

Arial / Helvetica / generic sans and a local monospace stack avoid a font-loading dependency. Linux font selection, accented punctuation, check/arrow glyphs, actual wraps, 200% text resizing, and text-spacing overrides remain browser gates. System fonts are a deliberate portability choice, not a promise of pixel-identical operating systems.

**Authoritative self-check — spacing-system:** the ladder is 4/8/12/16/24/32/48/64/96px via relative tokens. Attachment = 4; control = 8/12; task = 16; group = 24; region = 32/48/64; chapter = `clamp(48px, 32px + 4vw, 96px)`. Chapter spacing deliberately compresses to 48px on narrow views: the 96px end would burden the continuous release story. Narrative sections use chapter gaps; repair/index rows use compact 24px padding. The only non-token margin disposition is `margin-inline:auto`, which centers the wrapper and is not a spacing interval. Zero resets, border widths, focus offset, letter spacing, control dimensions, and grid track widths are separate geometry, not unexplained gaps. Source audit found no residual off-scale margin, padding, or gap. Rendered proximity remains open.

## Responsive and interaction contract

The narrow composition is one column in DOM order. At 44rem (704px with the default root), the hero gets a 16rem minimum trail and a 32px gap; repair, density, index, and installation sections gain readable parallel columns. At 64rem the hero trail minimum becomes 19rem, its padding 32px, and its gap 64px. These are content-fit hypotheses, not claims of observed breakpoint pressure.

At 768px, arithmetic gives hero tracks approximately 387.51px / 287.05px with a 32px gap. At 1280px, the tracks are approximately 715.89px / 397.71px with a 64px gap. At 390px all content is retained in a 342px column. `minmax(0,…)`, wrapping navigation, `min-inline-size:0`, and wrapping code address pressure without hiding overflow. No fixed content height, horizontal-scroll exception, sticky header, or responsive hiding is used.

Task path for [a11y-pass](skills/a11y-pass/SKILL.md): enter → skip to main → read proposition → activate Use TasteCheck → reach installation → open the repository quickstart. Recovery is ordinary browser Back; there is no submission or mutable form state. The quickstart is a local Markdown target with a verified heading; how a hosting server renders Markdown fragments remains a host integration check.

| Control family | States implemented | Trigger / result | Open proof |
| --- | --- | --- | --- |
| Header, body, skill, gallery, footer links | Default underlining or navigation grouping; visited text color; hover underline; focus outline; active color/thicker underline | Native click / Enter navigates to the declared anchor or local file | Tab order, Enter activation, visited rendering, accessible names, target spacing |
| Two primary action links | Citron default; lighter hover; dark ink retained when visited; focus outline; darker active with underline | Native links, no simulated button handler | Combined hover+active, focus visibility, narrow wrapping |
| Skip link | Offscreen at rest; on-screen at focus; target main is programmatically focusable | First Tab, then Enter | Actual focus destination and visibility |

Disabled, loading, selected, error, stale completion, and destructive states have no control subject here. Link activation is native; Space scrolling is not mislabeled as button activation. There is no animation, transition, smooth scroll, or timed content. Reduced-motion CSS still explicitly preserves the static path. Forced colors remain system-controlled.

[cognitive-a11y](skills/cognitive-a11y/SKILL.md) informed short consequences beside each technical term, stable section numbers, direct anchor navigation, and no timed/revealed content. These address hypothesized attention and recall burdens for a reader evaluating the kit. No user study, neurodivergent usability clearance, or observed task improvement is claimed.

## Facts and copy audit

Voice brief through [humanize-copy](skills/humanize-copy/SKILL.md): product voice addressing engineers who must decide whether and how to use the kit. Register is direct and technical, with no attributed personal voice or testimony. Protected language includes release numbers, commands, verdicts, severity, measurement scope, and uncertainty. The headline is an invitation; it does not claim measured superiority.

| Page claim | Local authority | Boundary retained |
| --- | --- | --- |
| v1.4.1 / 20 skills / 20 canonical commands / 8 gallery systems; 1 alias, 21 files | [release-facts.json](tools/release/release-facts.json), [README](README.md) | Canonical generated block retained verbatim in an inert template; visible compact inventory also present. |
| 7-wave gauntlet; 8 closures; 5 SEV-1 holes | [Changelog](CHANGELOG.md), [ASTRA fix report](_retrofit-2026-09-04/ASTRA-FIX-REPORT.md) | Historical retrofit results, not tests of this new page. |
| Derived observations, bound reviews, dependencies, inventory, complete capture | [ASTRA fix report](_retrofit-2026-09-04/ASTRA-FIX-REPORT.md), [README](README.md) | Schematic explicitly distinguished from an execution receipt. |
| 15.1%, 31.6%, before/after values, mutation 4/4 | [Density report](_retrofit-2026-09-04/DENSITY-PASS-REPORT.md) | Approximate body tokens, not full-file tokens or tokenized runtime usage. No semantic equivalence or universal mutation coverage claim. |
| npm run finalize | [Changelog](CHANGELOG.md), [package.json](package.json) | Command described, not executed during design. |
| UNVERIFIED / BLOCKED; accountable judgment | [README](README.md), [Verification](docs/VERIFICATION.md) | Existing public status unchanged; no objective guarantee. |
| Markdown / no runtime / install path / MIT | [README](README.md), [LICENSE](LICENSE) | Installation commands are displayed text, never run. |

Data-viz comparison question: how much lighter did the skill bodies become in the 2026-09-05 density pass? Grain: all twenty bodies and the heaviest individual body, before/after the recorded pass. Units: approximate tokens (bytes ÷ 3.9). The source excludes frontmatter, fenced code, and generated contracts from body counts. Rounded source values independently reproduce 15.1% and 31.6%. No statistical interval is supplied, so none is invented. There is no continuous trend, area encoding, bar baseline, or interpolated data. The large reduction is a direct text label; the accessible table provides exact source lookup.

Copy self-review followed the bundled [Writing Constitution](skills/humanize-copy/references/writing-constitution.md): `SENTENCE` puts the gate, review, or capture first and its consequence last; `PARAGRAPH` uses one repair per row and echoes check/artifact/evidence; `IDEA` connects the authority holes to their repairs; `AUDIT` checks topic strings, handoffs, and protected claims. A source review removed generic capability promises and the previous page's self-attested execution language. Silent cadence inspection was performed; spoken read-aloud and independent copy review are still open.

## Static self-gate receipt

Artifact SHA-256: `d6733aba0f83fe109d85f21fa499d8949ba32720d09aff99f92cee09e0efdfab`.

Artifact size: 28,452 bytes. Dependency closure for initial display: the HTML entry, inline CSS, inline data-URI favicon, system fonts. Linked documentation is a navigation destination rather than a rendering dependency. A formal gate manifest and environment/font identity have not been captured.

Execution environment: Python 3.14.7 and Node v26.7.0, local and offline. Python standard-library HTMLParser, regex checks, SHA-256, and numeric sRGB calculations were used. No package installs or browser were used. The existing code graph was consulted before scoped source reads; `jcode`/`jdoc` were unavailable. The attempted `td` session found no database in this isolated copy; this document carries the handoff.

Final source checks: **20/20 passed**, scoped as follows:

1. Balanced HTML nesting.
2. Unique IDs (13).
3. Exactly one H1 and main landmark.
4. Every ARIA reference resolves.
5. No scripts, external media, forms, or embeds.
6. No network resource URL in a source/href attribute; the clone URL is plain text.
7. All local navigation files and in-page anchors exist.
8. Exactly 20 distinct skill links, each existing on disk.
9. All required release/retrofit/boundary phrases are visible text.
10. No detected local user paths, host addresses, or credential-shaped strings.
11. No gradients, blur, animation keyframes, imported CSS, or external fonts.
12. No overflow concealment.
13. Nonzero spacing tokenized; only wrapper centering uses auto.
14. CSS parentheses and braces balanced (lexical check, not browser parsing).
15. Every referenced CSS variable is defined.
16. Active-state rules follow hover rules in the cascade.
17. Density table values match the source report.
18. Density table has caption, three column scopes, and two row scopes.
19. Zoom is enabled; no maximum-scale or user-scalable restriction.
20. Focus, forced-color, contrast preference, reduced-motion guards, and main focus target exist.

Additional numeric checks: all used text pairs exceed 4.5:1; necessary boundary/focus pairs exceed 3:1; the weakest normal text pair is 8.149:1. Clamp arithmetic was evaluated at 320, 390, 768, and 1280px. These do not establish actual overflow, focus behavior, or conformance.

Iteration: the first spacing detector flagged wrapper `auto`; it was classified as centering rather than silently removed. Cascade inspection found that hover could override active; active rules moved after hover. A proposed visited-decoration distinction was replaced with a browser-supported visited color. The diagram header now wraps under pressure. The before/after table was added to make the density claim directly inspectable. Literal spaces between display-heading spans preserve the spoken sentence in text extraction. The final 20-check source pass ran after these changes.

Repository compatibility probes (not the requested page's catalog verdict): `node tools/release/project-facts.mjs --check` reports three failures: old `data-skill` integration coverage, missing old browser `skillCount` contract, and missing old `softwareVersion` metadata. `node tools/verify-landing.mjs --root=.` reports 55 failures against the previous integration page: live forms/state demos, all-skill execution markers, chart fixture, theme toggles, and exact proof wording. The old checker also requires 20 OKLCH occurrences; this commission permits documented sRGB equivalents. These checks were not modified or padded with fake markers. The draft is not a drop-in passing replacement for that old integration suite.

## Authoritative catalog ledger

Catalog: [check-catalog.json](skills/tastecheck-pass/assets/check-catalog.json), `tastecheck-pass-v1`. This Markdown ledger records self-check scope; it is **not** an accepted machine-gate ledger or independent review. `HOLD` below means the full catalog row remains open even when its static portion passed. `N/A candidate` is a source-observed absence awaiting the gate's hashed absence evidence. No mandatory row is marked n/a.

Provenance abbreviations: **S** = final source inspection and the 20-check Python run; **C** = source sRGB computation above; **A** = CSS arithmetic above; **F** = local fact authorities above. All observations are ASTRA self-review on 2026-09-05. Remediation owners: **B** = subsequent browser reviewer; **H** = independent human reviewer; **G** = gate/repository maintainer; **D** = page designer if a defect is found.

| skill | check_id | status | reason | remediation | evidence | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| design-system-interview | direction:system | HOLD | Inferred spec and mapping exist; independent built-to-spec judgment absent | H: review nine decisions and actual renders | This document; index.html | S |
| color-system | foundation:color | HOLD | Numeric source pairs pass; rendered pairs missing | B: measure actual theme/state pairs ≥4.5 text, ≥3 UI | Color table | C |
| web-typography | foundation:typography | HOLD | Relative scale and measures present; Linux wraps unobserved | B: confirm fonts, measure, glyphs, overflow | Type table; CSS | S/A |
| spacing-system | foundation:spacing | HOLD | Source rhythm passes; rendered proximity unverified | B: inspect relationships at each width | Spacing self-check | S/A |
| theming | foundation:theming | HOLD | Authored mappings exist; environment states unmeasured | B: dark, more-contrast, forced-colors | Theme contract | S/C |
| responsive-layout | structure:responsive-layout | HOLD | Reflow rules exist; no rendered observation | B: capture full page at specified widths | Width/track arithmetic | S/A |
| component-states | structure:component-states | HOLD | Native link states defined; keyboard proof absent | B: exercise every control/state member | Interaction matrix | S/C |
| form-ux | structure:form-ux | HOLD | No form subject; catalog marks this always-required and forbids n/a | G: resolve absence policy explicitly; do not invent a form or mark pass | No form/input/script in source | S |
| empty-states | structure:empty-states | HOLD | No async data-state subject; catalog forbids n/a | G: resolve absence policy explicitly | Static document only | S |
| micro-motion | surface:micro-motion | N/A candidate | No motion subject | G: capture hashed absence; B still checks reduced-motion environment | No animation, transition, smooth scrolling | S |
| data-viz | surface:data-viz | HOLD | Source values, units, table, and limitations match | H/B: inspect actual table and metric reading | Density report and table | S/F |
| art-direction | surface:art-direction | HOLD | Original schematic and decorative decisions documented | H/B: assess wide/narrow treatment and favicon | Hero figure and inline icon | S |
| a11y-pass | verification:a11y | HOLD | Static landmarks and contrast pass; real task path absent | B: test names, reading/focus order, zoom, activation | Static receipt and path | S/C |
| cognitive-a11y | verification:cognitive-a11y | HOLD | Friction hypotheses addressed; no independent task review | H: evaluate understanding, interruption/resume, and next action | Section structure and path | S |
| i18n-ready | verification:i18n | N/A candidate | English-only commission and source | G: bind hashed absence of multilingual subject | html lang=en; no locale control | S |
| deslop-ui | verification:deslop-ui | HOLD | Source fits declared topology; independent visual rubric absent | H: review surface, structure, voice against this spec | Section map and refusals | S |
| humanize-copy | verification:humanize-copy | HOLD | Source-bound copy and writing audit performed | H: independent rubric and spoken review | Fact ledger; writing rule IDs | S/F |
| tastecheck-pass | browser:rendering | HOLD | Not run | B: full-page and viewport captures; inspect expected layout | Required widths below | A only |
| a11y-pass | browser:zoom-400 | HOLD | Not run | B: 400% zoom and 200% text resizing; no loss/2-D scrolling | Zoom remains enabled | S only |
| a11y-pass | browser:keyboard | HOLD | Not run | B: full forward/backward Tab and Enter path | Interaction matrix | S only |
| theming | browser:theme-contrast | HOLD | No browser-computed pairs | B: measure each supported environment | Source contrast table | C only |
| micro-motion | browser:reduced-motion | HOLD | Setting not exercised | B: emulate preference; verify unchanged static path | Guard exists; no motion | S only |
| tastecheck-pass | browser:cold-load | HOLD | No cold load or auditor execution | B: offline cold render, console, asset audit, gate-audit.js | Self-contained source | S only |
| tastecheck-pass | browser:shadow-iframe | N/A candidate | No scripts, shadow roots, iframe subjects in source | G/B: bind absence evidence and confirm DOM | Static source | S |
| tastecheck-pass | gate:artifact-spec | HOLD | Entry SHA recorded; formal dependency/spec identity not bound | G: freeze page + spec, capture manifest and identities | SHA above and inferred statement | S |
| tastecheck-pass | gate:required-evidence | HOLD | Numeric evidence exists; browser/member evidence absent | G: reconcile full subject universe before verdict | Source receipt; open browser rows | S/C/A |
| tastecheck-pass | gate:blocker-handoff | HOLD | Owners/actions supplied; independent handoff judgment pending | H/G: accept ownership and verify every blocker has a rerun | This ledger and sequence below | S |

## Browser / human handoff

Predecessor: freeze this draft and specification, resolve the required form/empty-state absence policy and old integration-suite mismatch, then capture the formal artifact/dependency identities. Preserve the existing UNVERIFIED public status throughout.

Browser owner B should use a Linux renderer with the font/environment identities recorded. Required width cases: **390**, **768**, **1280**; suggested capture heights are 844, 1024, and 900 respectively, plus full-page images. These heights are a proposed test setup, not a user requirement. Add 320px reflow, actual 400% zoom, 200% text resizing, and WCAG text-spacing overrides. No screenshot has been fabricated or included in this handoff.

Freeze route `/` and all 38 anchor elements as separate control subjects, including duplicate destinations. Hashes/fragments are navigation targets on this route, not fabricated extra rendered routes. Enumerate each applicable default, focus, hover, active, and visited state; inspect skip-focus separately. Cross the browser route/state inventory with every required viewport and supported preference environment. Do not infer complete coverage from one screenshot.

Run [gate-audit.js](skills/tastecheck-pass/assets/gate-audit.js) after a fresh local cold load; retain its complete output and console observations. Confirm zero missing assets and external display requests, accessible names, continuous reading order, visible focus, actual anchor navigation, readable density table, and no horizontal loss. Fix defects in the page, rerun affected subjects, and regenerate all changed artifact hashes.

Human owner H should review the rendered page independently against four explicit criteria: (1) the proposition, current release status, and next action are findable; (2) each of the five evidence repairs has a legible consequence; (3) density figures retain scope, approximation, and source; (4) the asymmetric composition survives narrow reflow without losing the visual priority of the release story. Review surface, structure, and copy separately. Bind each subjective decision to its check ID, rubric, artifact SHA, and complete-evidence SHA; disagreement stays HOLD.

Gate owner G must reconcile all observations and required members, capture complete evidence without truncation, and run the repository's release gate against the final ledger. Acceptance is every applicable catalog row passing with authentic bound evidence, not this document's source-check count. Publication and the old site's integration-test migration are outside this commission.
