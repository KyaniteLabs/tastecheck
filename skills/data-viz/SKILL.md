---
name: data-viz
description: >-
  Honest, Tufte-informed web data visualization. Use for charts, dashboards,
  metrics, KPI tiles, sparklines, chart accessibility, chartjunk removal,
  genre choice, lie-factor checks, direct labels, data tables, and themed SVG/HTML.
---

# Data Viz (honest, web-native, Tufte-informed)

Most charts are decoration wrapped around a few numbers. This skill makes the
opposite: visualizations where **ink maps to data**, the genre fits the data shape,
the proportions don't lie, the labels are direct, and the result lives correctly
inside your design system — responsive, theming-ready, and accessible. Every rule
here is checkable.

It is the **web/design-system layer for Tufte-informed charts.** If specialist
assessment/rendering skills such as **`assess-graphical-excellence`** or
**`render-tufte-chart`** are available, use them for deep critique or publication
SVGs. This skill must still stand alone for *building the chart into a web UI,
on-brand and accessible.*

## The decision order

1. **Does it even need a chart?** ≤ ~20 numbers almost always reads better as a
   **table** (Tufte: a table beats a chart for small datasets). Say so before drawing.
2. **Pick the Tufte genre for the data shape** (table below) — *before* reaching for
   the default bar/line/pie.
3. **Maximize data-ink, delete chartjunk** — every pixel should encode data or it goes.
4. **Make proportions honest** — bars from zero; encode a 1-D quantity with
   length/position, never area/volume; check the lie factor ≈ 1.
5. **Direct-label, range-frame** — labels at the data, not a legend; axes span the
   data range.
6. **Integrate** — series colors from `color-system` tokens; works in `theming`;
   responsive; no fixed px that overflow.
7. **Accessibility pass** — text/table equivalent, not color-alone, contrast, focusable
   data for interactive charts.

## Genre selection (do this before any code)

| Data shape | Use | Not |
|---|---|---|
| ≤ ~20 numbers total | **a table** (or supertable) | pie/bar |
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

## Non-negotiables (checkable)

- **≤20 numbers → table.** Don't chart what a table shows better.
- **Bars start at zero.** Truncated value axes inflate differences — dishonest.
- **One encoding per datum, 1-D = length/position.** Never encode a single quantity
  with 2-D area or 3-D volume (that's how lie factor explodes). No 3-D charts. Ever.
- **Lie factor ≈ 1.0** (visual-change% ÷ data-change%, acceptable 0.95–1.05). Check it
  whenever a proportion looks dramatic.
- **Direct labels, not a legend** where feasible — label the line end / the bar.
- **Kill chartjunk:** no gridlines heavier than the data, no moiré fills/gradients
  carrying no data, no drop shadows, no decorative imagery, no borders that aren't data.
- **≤ ~5 hues; color is never the only channel.** Distinguish series by position,
  direct label, or pattern too (color-blind + WCAG 1.4.1). Series colors come from
  `color-system` tokens and must hit ≥3:1 vs background and vs adjacent series.
- **Works in dark mode** (axes/text re-checked for contrast on the dark surface).
- **Responsive** — SVG `viewBox`/fluid width, no fixed px that overflow at 320px.
- **Every chart has a text equivalent** — a caption stating the takeaway, plus an
  accessible data table (visually-hidden or toggle) for screen readers. A chart is
  not done until a non-sighted user can get the numbers.

## Premium restraint (honest ≠ plain)
Tufte *removes* chartjunk; it does not *add* craft — so a "correct" chart can come out
bare and unstyled, which is its own failure. **Minimal in ink, rich in craft.** A premium
chart is restrained AND considered:
- **Inherits the design system.** A chart on a copper-dark site should look copper-dark-
  premium, not generic-Tufte-on-white. Pull type, spacing, accent, and surface from the
  project's tokens (web-typography, color-system, theming) — never a default sans on #fff.
- **Typography does the work.** The number is the hero — set it large and confident in the
  display face; labels small, quiet, in the muted token. Tabular figures. Real hierarchy.
- **Generous, intentional spacing** and alignment; one refined accent, not a rainbow.
- **A whisper of craft** — a hairline baseline, a single end-dot, a subtle grain or motion
  on load — never ornament that competes with data.
- The check: does it look *considered*, like a designer made it — or *unstyled*, like a
  library default? If the latter, it's not done.

## Quick-start

A minimal honest line chart + an inline sparkline + the table-first pattern (real,
token-driven, accessible) is in `assets/chart-starter.html`. The shape of an honest
SVG line:

```html
<figure>
  <figcaption>Revenue grew 31% in Q2 — the steepest quarter on record.</figcaption>
  <svg viewBox="0 0 600 200" role="img" aria-label="Quarterly revenue, 2024–2026; up 31% in Q2 2026">
    <!-- range-frame axis: line spans exactly the data range, ends labeled. No grid box. -->
    <polyline fill="none" stroke="var(--series-1)" stroke-width="2" points="…"/>
    <text x="…" y="…">2026 ·  $4.2M</text> <!-- direct label at the end, not a legend -->
  </svg>
  <table class="visually-hidden"> … the numbers … </table>   <!-- screen-reader equivalent -->
</figure>
```

## Reference files

- `references/tufte-and-genres.md` — the Tufte/VDQI synthesis: data-ink, the
  chartjunk taxonomy (moiré, dreaded grid, the duck, decoration), lie factor with
  worked numbers, the genre playbook (sparklines, small multiples, range frames,
  supertables), and the default-challenge rule. Read when choosing a genre or
  diagnosing a bad chart.
- `references/web-and-a11y.md` — making it real on the web: token/`color-system`
  integration, theming, responsive SVG, and the accessibility contract for charts
  (text alternative, data table, not-color-alone, contrast, keyboard for interactive).
  Read when building the actual component.
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before shipping a chart)

1. Is this ≤20 numbers that should be a **table**? If so, did I use one?
2. Is the **genre** the right Tufte fit (not just the default)?
3. Do **bars start at zero**; is any 1-D quantity encoded by length/position (not area/3-D)?
4. **Lie factor ≈ 1**? No truncated/exaggerated axes?
5. **Direct labels** instead of a legend; **range-frame** axes; **no chartjunk**?
6. ≤5 hues from `color-system` tokens; **not color-alone**; contrast ≥3:1?
7. Readable in **dark mode**; **responsive** to 320px?
8. Caption states the takeaway; **accessible data table / aria-label** present?

## How to deliver

- State the genre choice and why ("12 numbers → table, not a pie"; "8 series → small
  multiples, not spaghetti"). Report the lie factor if proportions are dramatic.
- Pull series colors from `color-system`; verify theming + contrast; add the data
  table. For heavy assessment or Python SVGs, use `assess-graphical-excellence`/
  `render-tufte-chart` only when those specialist skills are available.

## Provenance — principle, not property
Grounded in Edward Tufte's *The Visual Display of Quantitative Information* and the
**gnurio/tufte-vdqi-plugin** (`assess-graphical-excellence`, `render-tufte-chart`,
`orchestrate-tufte-vdqi`) when present. This skill is an independent,
web-and-accessibility-focused synthesis of those public principles — credited, not
copied. Use specialist tools for deep assessment and rendering when they exist; use
this standalone skill to build charts into web UIs.
