# Tufte & Genres — the synthesis

Read when choosing a genre or diagnosing a bad chart. This is an independent synthesis
of Edward Tufte's *The Visual Display of Quantitative Information* (VDQI) and the
gnurio/tufte-vdqi-plugin — credited, expressed in our own words. For deep, page-cited
scoring use `assess-graphical-excellence` when that specialist skill is available.

## Data-ink (the core idea)
**Data-ink ratio = ink that encodes data ÷ total ink.** Typical charts sit at 0.1–0.2;
edit toward 1.0. The method: *erase non-data-ink, then erase redundant data-ink.* Every
gridline, border, tick, fill, and shadow must justify itself as information or be deleted.

## Lie factor (honesty)
`lie factor = (size of effect shown in the graphic) / (size of effect in the data)`.
Acceptable ≈ 0.95–1.05. It blows up when:
- a value axis is **truncated** (doesn't start at zero for bars) → exaggerates differences,
- a 1-D quantity is encoded with **2-D area or 3-D volume** → effect grows as the square/cube
  (famous failures reach lie factors of 2.8, 14.8, even 59.4).
Fix: zero-baseline bars; encode magnitude with **length or position**, one dimension only.

## Chartjunk taxonomy (name it, then kill it)
- **Moiré vibration** — cross-hatching, dense stipple, gradients that shimmer; carry no data.
- **The dreaded grid** — gridlines darker/heavier than the data marks; the cage dominates.
- **The duck** — decoration *is* the chart; style and dimensionality exceed the data
  (3-D bars, pictorial volumes, themed skins).
- **Decoration** — ornament with zero information (clip-art, textures, bevels, shadows).
If a chart exhibits any of these, remove it; don't "balance" it.

## The genre playbook (reach past the default)
- **Table / supertable** — for ≤ ~20 numbers, or when exact values matter. Right-align
  numbers, tabular figures, minimal rules. Often the *correct* "chart."
- **Sparkline** — a word-sized, axis-less line/bar inline in text or a table row; shows
  shape/trend at a glance. Great for dashboards and "trend" columns.
- **Small multiples** — repeat one small chart across facets with **shared scales**;
  the eye compares by position. The antidote to the overplotted spaghetti chart.
- **Range frame** — a scatter/line frame whose axis lines span *exactly* the data range
  (min→max), ends labeled, no enclosing box. Adds info (the range) while removing ink.
- **Dot-dash / marginal** — mark each datum's x and y as ticks in the margins (a
  distribution + scatter in one).
- **Quartile / box / strip** — distributions of groups; shows spread, not just the mean.
- **Slopegraph** — two time points, many series; direct-labeled lines; shows rank change.
- **Bar from zero, direct-labeled** — categories; the honest workhorse (not pie).

## Default-challenge rule
If your first pick is what an unprompted model reaches for — **pie, 3-color bar, single
spaghetti line, bordered scatter** — you must either (a) justify it by naming what the
alternatives lose, or (b) switch to the stronger Tufte move (table, small multiples,
sparkline, range frame, slopegraph) and say why. Quiet defaulting to the obvious chart
is the failure this rule prevents.

## Direct labeling
Put the label at the data — the end of the line, beside the bar, on the slope. A legend
forces the eye to ping-pong between a key and the marks and re-decode color each time.
Direct labels remove that tax and a whole block of non-data-ink.

## Quantitative defaults (when unsure)
- Bars: zero baseline, gaps < bar width, direct value labels, no border.
- Lines: 1.5–2px, distinguishable by label + position (not color alone), no marker
  unless points matter.
- Axes: range-frame; ticks only where labeled; faint hairline grid *only* if it aids
  reading exact values, and lighter than the data.
- Color: sequential/diverging from a real scale (OKLCH via `color-system`), ≤5 hues,
  categorical hues distinguishable for color-blind viewers.
