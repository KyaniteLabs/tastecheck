# Data Viz — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of Tufte/VDQI and the gnurio/tufte-vdqi-
plugin, extended with web + accessibility practice. Credited ideas, own expression.

## Meta-patterns

### MP-1 · Ink should map to data
A graphic's job is to let the data be seen; ink that isn't data is noise. **Consequence:**
default to subtraction — erase non-data-ink, then redundant data-ink — before adding anything.

### MP-2 · The genre is the biggest decision
Most "bad chart" problems are really "wrong genre" problems (pie for comparison, spaghetti
for many series, chart for 12 numbers). **Consequence:** choose the genre for the data shape
*before* styling, and challenge the default pick.

### MP-3 · The graphic must not lie
Truncated axes and area/volume encodings distort magnitude. **Consequence:** zero baselines,
1-D quantities as length/position, lie factor ≈ 1 — always checkable with a number.

### MP-4 · A web chart is a system component, not a poster
It must use the design tokens, work in dark mode, and reflow responsively. **Consequence:**
series colors from `color-system`, contrast re-checked per surface, fluid SVG.

### MP-5 · A chart no one can read with a screen reader is unfinished
SVG/canvas marks are invisible to AT and to color-blind users if color is the only channel.
**Consequence:** every chart ships a takeaway caption + a data table + non-color encoding.

### MP-6 · Small data wants a table
Below ~20 numbers, a table conveys more, faster, exactly. **Consequence:** ask "should this
be a table?" first; often the answer is yes.

## Decision records

### DR-1 · Table-first for small data
- **Why (MP-6):** precision + density. **Apply:** ≤20 numbers → table/supertable, not pie/bar.

### DR-2 · Genre before style; challenge the default
- **Why (MP-2):** wrong genre can't be styled into rightness. **Apply:** map data shape →
  Tufte genre; if it's the obvious default, justify or switch to the stronger move.

### DR-3 · Honest proportions
- **Why (MP-3):** distortion is the cardinal sin. **Apply:** zero baselines; length/position
  not area/volume; compute lie factor when a difference looks dramatic.

### DR-4 · Delete chartjunk, maximize data-ink
- **Why (MP-1):** signal over noise. **Apply:** no 3-D, gradients-as-data, heavy grids,
  shadows, decoration; direct-label instead of legend; range-frame axes.

### DR-5 · Build it into the system
- **Why (MP-4):** consistency + dark mode. **Apply:** token series colors, contrast ≥3:1,
  fluid viewBox, reflow at 320px.

### DR-6 · Accessibility is part of "done"
- **Why (MP-5):** everyone must get the data. **Apply:** caption takeaway + data table +
  role/aria-label + not-color-alone + keyboard for interactive.

### DR-7 · Hand off deep work
- **Why:** don't reinvent the toolkit. **Apply:** for nine-criteria assessment / lie-factor
  catalogue / Python publication SVGs, use `assess-graphical-excellence` and
  `render-tufte-chart` when those specialist skills are available.

## Principle, not property
Distills Tufte's public principles and the gnurio/tufte-vdqi-plugin's approach, extended
with web/a11y practice. Credit Tufte (VDQI) and the plugin; never copy their prose. Your
charts and code are your own.
