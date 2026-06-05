---
name: data-viz
description: >-
  Honest, Tufte-grade data visualization for the web — charts that show the data,
  not decoration, and that fit your design system and pass accessibility. Apply
  this whenever you build, choose, or fix a chart, graph, dashboard, metric, KPID
  tile, sparkline, or any quantitative display in HTML/CSS/SVG/React/etc. Use it to
  avoid the usual failures: charting ≤20 numbers that should be a table, chartjunk
  (3D, gradients-as-data, heavy gridlines, decoration), dishonest proportions
  (truncated bar axes, area/volume encoding a 1-D quantity — high "lie factor"),
  legends the eye has to ping-pong to instead of direct labels, rainbow palettes,
  meaning carried by color alone, charts unreadable in dark mode, and charts with
  no text/table alternative for screen readers. Trigger on cues like "make a chart/
  graph", "visualize this data", "build a dashboard", "which chart should I use",
  "this chart looks cluttered/misleading", "add a sparkline", or "chart isn't
  accessible". Gives genre-selection, the chartjunk taxonomy, the lie-factor check,
  and web/token/a11y integration — checkable, not vibes. Grounded in Edward Tufte's
  *Visual Display of Quantitative Information* and the gnurio/tufte-vdqi-plugin;
  pairs with color-system, dark-mode, a11y-pass. For deep Tufte assessment or
  Python chart rendering, hand off to the installed assess-graphical-excellence /
  render-tufte-chart skills.
---

# Data Viz (honest, web-native, Tufte-grade)

Most charts are decoration wrapped around a few numbers. This skill makes the
opposite: visualizations where **ink maps to data**, the genre fits the data shape,
the proportions don't lie, the labels are direct, and the result lives correctly
inside your design system — responsive, dark-mode-ready, and accessible. Every rule
here is checkable.

It is the **web/design-system member of a Tufte toolkit.** For deep critique of an
existing graphic (nine criteria, named-failure catalogue, lie-factor scoring) or for
Python-rendered publication SVGs, hand off to the installed **`assess-graphical-
excellence`** and **`render-tufte-chart`** skills (the gnurio/tufte-vdqi-plugin).
This skill is for *building the chart into a web UI, on-brand and accessible.*

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
6. **Integrate** — series colors from `color-system` tokens; works in `dark-mode`;
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
  integration, dark-mode, responsive SVG, and the accessibility contract for charts
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
- Pull series colors from `color-system`; verify dark-mode + contrast; add the data
  table. For heavy assessment or Python SVGs, defer to `assess-graphical-excellence`/
  `render-tufte-chart`.

## Provenance — principle, not property
Grounded in Edward Tufte's *The Visual Display of Quantitative Information* and the
**gnurio/tufte-vdqi-plugin** (the `assess-graphical-excellence` / `render-tufte-chart`
/ `orchestrate-tufte-vdqi` skills). This skill is an independent, web-and-accessibility-
focused synthesis of those public principles — credited, not copied. Use the original
plugin for deep assessment and rendering; use this to build charts into web UIs.
