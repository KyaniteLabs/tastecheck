---
name: data-viz
description: >-
  Honest, Tufte-informed web data visualization. Use for charts, dashboards,
  metrics, KPI tiles, sparklines, chart accessibility, chartjunk removal,
  genre choice, lie-factor checks, direct labels, data tables, and themed SVG/HTML.
---

# Data Viz (honest, web-native, Tufte)

Make web-native charts with honest marks: tokenized, responsive, accessible. Reuse
type, spacing, surface, color tokens; one accent adds craft but never competes with data.
Use Tufte tooling when present.

## Decision order

1. State comparison question, source/grain, missingness, and uncertainty.
2. Prefer a table for small exact lookup; chart shape, change, or comparison.
3. Encode honestly (zero-baseline bars; 1-D length/position; lie factor ≈1), direct-label,
   and remove non-data ink.
4. Provide tokenized, responsive, contrast-safe chart/table parity; keep data keyboard reachable.

## Data quality

Before genre, record question, unit, time grain, source, and absent status. A missing
month can mean **zero**, **not observed**, **suppressed**, **not applicable**, or **not yet
reported**; these states cannot share a mark, line, or cell treatment.

Name the uncertainty band (e.g. confidence interval, forecast range, or measurement error),
level if known, and shared method. Missing values, units, provenance, or interval meaning means
stop at a representation spec/data-request checklist. Never invent a trend, interpolate a gap,
or manufacture an empty chart.

For sparse monthly series, prefer an observed-month table or interval strip. If a line helps,
break it at missing observations, plot estimated uncertainty only, label the gap, and never
imply continuity with a continuous area.

## Genre selection

| Data shape | Use | Not |
|---|---|---|
| Small; exact lookup | **table** (or supertable) | slow-lookup chart |
| 1 series/time | line / **sparkline** | 3D, decorative area |
| Few categories/one value | **zero bar**, direct-labeled | pie (hard angles) |
| Part-to-whole, 2–4 | bar/stacked; number + bar | pie/donut (>3 slices) |
| Many series/facets | **small multiples** (shared scale) | spaghetti |
| Group distribution | quartile/box or strip | bar-of-averages |
| Two variables | scatter with **range frame** | bordered box + gridlines |
| Table-row trend | inline **sparklines** | separate chart page |
| Geographic/multivariate | map / Minard-style layered | rainbow choropleth |

**Default-challenge rule:** justify an unprompted pie, 3-color bar, or spaghetti line, or use
a stronger Tufte move (table, small multiples, sparkline, range frame).

### Refuse misleading requests

Refuse a dramatic 3-D chart because depth, perspective, and occlusion encode absent values.
Name the distortion; offer the smallest honest alternative: direct-labeled interval strip,
observed-month table, shared-scale small multiple, or zero-baseline bar.

## Non-negotiables

- **Table for lookup; chart for shape.** A 12-month trend may deserve a line; a 40-cell audit
  may belong in a sortable table.
- **Bars start at zero when length encodes magnitude.** For floating ranges or deltas, use
  explicit interval/difference encoding, not a truncated bar.
- **Use position or length for comparison.** Never exaggerate area or volume. Redundant
  color-plus-shape, label, or pattern aids identification/accessibility; channels must agree.
- **Lie factor ≈ 1.0** (visual-change% ÷ data-change%, acceptable 0.95–1.05); check
  dramatic proportions.
- **Direct labels, not a legend** where feasible; label line end/bar.
- **Kill chartjunk:** no heavy gridlines, non-data fills/gradients, drop shadows, decorative
  imagery, or non-data borders.
- **Limit hues to distinguishable colors; color is never the only channel.** Use position,
  direct label, or pattern too (color-blind + WCAG 1.4.1). Series colors come from
  `color-system` tokens and must hit ≥3:1 vs background and adjacent series.
- **Works in dark mode** (re-check axes/text contrast).
- **Responsive** — SVG `viewBox`/fluid width; no fixed px overflow at 320px.
- **Every chart has a text equivalent** — takeaway caption plus accessible data table
  (visually-hidden or toggle); non-sighted users get the numbers.

## Quick-start

Use `assets/chart-starter.html`; keep range-frame axis, direct end labels, caption, and parity.

## References

- `references/tufte-and-genres.md` — data-ink, lie factor, genres.
- `references/web-and-a11y.md` — tokens, SVG, parity.
- `references/decision-records.md` — novel-case ADR rules.

## Evidence

Chart/table expose the same value, unit, uncertainty, missingness, source, and filter. Caption
what can/cannot be concluded; record quality, genre choice/refusal, encoding, parity, and
rendered evidence.

## Check

1. Table/genre fits the comparison, not a default?
2. Zero bars, 1-D encoding, lie factor ≈1, direct labels/range frame, no chartjunk?
3. Tokenized ≤5-hue non-color encoding, ≥3:1 contrast, dark mode, 320px behavior?
4. Caption/table retain source, unit, uncertainty, filters, missingness; gaps imply no continuity.

## How to deliver

State genre/rationale, material lie factor, parity, caption, contrast, and theming evidence.
Use specialist Tufte tooling only when available.

## Provenance

This is an independent web-and-accessibility synthesis of Tufte principles; use
specialist assessment/rendering tools when available.

<!-- contract:v1:start -->
## Contract (generated)

Canonical detail: [contract.json](contract.json).

- Route: Data needs a chart, table, uncertainty treatment, or accessible comparison.; avoid: There is no data subject or the request is only a decorative illustration.
- Exclude: Do not choose a chart before identifying the comparison task. (+1 in contract.json)
- Stop / handoff: Stop when the data provenance or comparison question is missing. (+1 in contract.json); receives [color-system, design-system-interview, improve-existing-website, tasteroll] -> sends [a11y-pass, empty-states, tastecheck-pass]
- Output: honest chart/table recommendation and implementation plan
- Evidence: `table_with_evidence` with `status`, `reason`, `remediation`, `evidence`, `provenance`.
<!-- contract:v1:end -->
