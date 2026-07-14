---
name: data-viz
description: >-
  Honest, Tufte-informed web data visualization. Use for charts, dashboards,
  metrics, KPI tiles, sparklines, chart accessibility, chartjunk removal,
  genre choice, lie-factor checks, direct labels, data tables, and themed SVG/HTML.
---

# Data Viz (honest, web-native, Tufte-informed)

Make web-native charts whose marks map honestly to data, fit the comparison task, and
remain tokenized, responsive, and accessible. Use specialist Tufte tooling when present.

## The decision order

1. State the comparison question, source/grain, missingness, and uncertainty.
2. Prefer a table when exact lookup matters and the value set is small; prefer a chart
   when shape, change, or comparison is the task.
3. Use honest encoding (zero-baseline bars; 1-D length/position; lie factor ≈1), direct
   labels, and no non-data ink.
4. Provide tokenized responsive contrast-safe chart/table parity; interactive data is keyboard reachable.

## Data-quality gate: decide what the marks are allowed to claim

Before choosing a genre, write down the comparison question, unit, time grain, source,
and the status of every absent value. A missing month can mean **zero**, **not observed**,
**suppressed**, **not applicable**, or **not yet reported**; those are different data
states and must not share a mark, a line segment, or a table cell treatment.

Also name what an uncertainty band means (for example, confidence interval, forecast
range, or measurement error), the interval level if known, and whether all observations
use the same method. If values, units, provenance, or interval meaning are absent, stop
at a representation specification and data-request checklist. Do not invent a trend,
interpolate a gap, or manufacture an impressive empty chart.

For a sparse monthly series, prefer an observed-month table or interval strip when it
makes the absences easier to read. If a line remains useful, break it across missing
observations, plot uncertainty only where the estimate exists, directly label the gap,
and do not let a continuous area imply unobserved continuity.

## Genre selection (do this before any code)

| Data shape | Use | Not |
|---|---|---|
| Small set; exact lookup matters | **a table** (or supertable) | a chart that slows lookup |
| 1 series over time | line / **sparkline** (inline) | 3D, area-fill-as-decoration |
| Few categories, one value each | **bar from zero**, direct-labeled | pie (hard to compare angles) |
| Part-to-whole, 2–4 parts | bar or stacked bar; a number + bar | pie/donut (avoid >3 slices) |
| Many series / facets | **small multiples** (repeat one shrunken chart, shared scale) | one overplotted spaghetti chart |
| Distribution of groups | quartile/box or strip plot | bar-of-averages (hides spread) |
| Two variables | scatter with a **range frame** | bordered box + gridlines |
| Trend per row in a table | inline **sparklines** | a separate chart page |
| Geographic + multivariate | map / Minard-style layered | a generic choropleth rainbow |

**Default-challenge rule:** if your pick is the unprompted default (pie, 3-color bar,
spaghetti line), either justify why the alternatives lose, or reach for the stronger
Tufte move (table, small multiples, sparkline, range frame).

### Refuse misleading requests with a safer replacement

Refuse a dramatic 3-D chart because depth, perspective, and occlusion encode values the
data does not contain—not because “3-D is bad.” State the comparison it would distort,
then offer the smallest honest alternative: a direct-labeled interval strip, observed-
month table, shared-scale small multiple, or zero-baseline bar as appropriate. The
replacement must preserve the requested decision task where the data supports it.

## Non-negotiables (checkable)

- **Table for lookup; chart for shape.** A 12-month trend may deserve a line despite
  having only 12 values; a 40-cell audit may still belong in a sortable table.
- **Bars start at zero when length encodes magnitude.** For floating ranges or deltas,
  use an explicit interval/difference encoding instead of a conventional truncated bar.
- **Use position or length for quantitative comparison.** Do not exaggerate one value
  with area or volume. Redundant color-plus-shape, label, or pattern encoding is welcome
  when it improves identification or accessibility; redundant channels must agree.
- **Lie factor ≈ 1.0** (visual-change% ÷ data-change%, acceptable 0.95–1.05). Check it
  whenever a proportion looks dramatic.
- **Direct labels, not a legend** where feasible — label the line end / the bar.
- **Kill chartjunk:** no gridlines heavier than the data, no moiré fills/gradients
  carrying no data, no drop shadows, no decorative imagery, no borders that aren't data.
- **Limit simultaneous hues to what can be distinguished; color is never the only
  channel.** Distinguish series by position,
  direct label, or pattern too (color-blind + WCAG 1.4.1). Series colors come from
  `color-system` tokens and must hit ≥3:1 vs background and vs adjacent series.
- **Works in dark mode** (axes/text re-checked for contrast on the dark surface).
- **Responsive** — SVG `viewBox`/fluid width, no fixed px that overflow at 320px.
- **Every chart has a text equivalent** — a caption stating the takeaway, plus an
  accessible data table (visually-hidden or toggle) for screen readers. A chart is
  not done until a non-sighted user can get the numbers.

## Premium restraint

Use existing type, spacing, surface, and color tokens: hierarchy, alignment, and one
purposeful accent can add craft; decoration must never compete with data.

## Quick-start

Use `assets/chart-starter.html` for the line, sparkline, and table-first skeleton. Keep
the invariants here: range-frame axis, direct end labels, caption takeaway, and a real
table equivalent.

## Reference files

- `references/tufte-and-genres.md` — data-ink, lie factor, and genre playbook.
- `references/web-and-a11y.md` — tokens, responsive SVG, and accessible parity.
- `references/decision-records.md` — novel-case ADR rules.

## Decision order and evidence

Chart and accessible table expose the same observed value, unit, uncertainty, missingness
reason, source, and filter; a caption states what can and cannot be concluded. Record
data quality, selected/refused genre, encoding, parity, and rendered evidence.

## Self-check (before shipping a chart)

1. Table/genre fits the comparison—not a default chart?
2. Zero bars, 1-D encoding, lie factor ≈1, direct labels/range frame, no chartjunk?
3. Tokenized ≤5-hue non-color encoding, ≥3:1 contrast, dark mode, and 320px behavior?
4. Caption and table parity retain source, unit, uncertainty, filters, and missingness;
   gaps are not false continuity?

## How to deliver

State the genre and why, report a material lie factor, and include table parity, caption, contrast, and theming evidence. Use specialist Tufte tooling only when available.

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
