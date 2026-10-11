# tastecheck taste corpus - the law

A labeled corpus of whole pages used to measure one narrow thing: does the
browser-lane tell detector (`skills/tastecheck-pass/assets/gate-audit.js`)
separate generic AI-default UI ("slop") from deliberate, brief-specific UI
("crafted")? It complements `evals/corpus/` (gate integrity: ledgers,
receipts, leaks), where only 2 of 17 cases are about how a UI looks.

Run it: `node tools/calibrate/run-taste-calibration.mjs` (reports land in
`evals/taste/reports/`, dated JSON + Markdown). Gate it:
`node tools/calibrate/run-taste-calibration.mjs --quiet --check`.

## What the labels mean

- **slop** - a page showing the generic AI-default look: the template that
  appears when nobody made a design decision (default sans, indigo/violet
  gradient hero, three identical cards, stat band, pill CTAs, glass cards,
  emoji section markers, neon-on-dark bento, and their usual mixes).
- **crafted** - a page built deliberately for a specific brief: its own type
  pairing, a layout derived from its content, a committed palette.

Labels describe the page's design intent and provenance, never the
detector's output. They are never changed after seeing a run.

## Provenance (mandatory)

Every case file `evals/taste/cases/<id>.json` carries:

```json
{
  "schema_version": 1, "kind": "taste-case", "id": "...",
  "label": "slop | crafted",
  "source_group": "repo | authored",
  "provenance": { "kind": "repo-sample | repo-demo | authored-fixture",
                  "path | description": "...", "why_this_label": "..." },
  "target": "repo-relative .html path",
  "viewports": [{ "name": "desktop", "width": 1280, "height": 800 },
                { "name": "mobile",  "width": 390,  "height": 844 }]
}
```

A case without `why_this_label` is invalid; the test enforces it.

Sources, and how much weight each deserves:

| group | kind | what it is | caveat |
|---|---|---|---|
| repo | `repo-sample` / `repo-demo` | Committed gallery samples, the landing page, `demos/example-build/{before,after}.html`, used as-is | Labels are the maintainers' stated intent, not independent ratings. The crafted pages were designed by the same people who wrote the detector. |
| authored | `authored-fixture` | Small single-file pages written for this corpus to reproduce common AI-default templates (slop) or deliberate designs using only locally licensed fonts (crafted) | Written by the maintainers, not scraped from real sites. Slop fixtures were written from a list of well-known tells, so they are biased toward what the detector looks for. |

Considered and not used: `demos/05-deslop.html` is one page that holds a
"slop" section and a "fixed" section side by side, so the whole page has no
single label; using it would score the fixed half as slop or vice versa.

## Scoring

Per case, each viewport (1280x800 and 390x844) is loaded fresh over a local
HTTP server, fonts are awaited (`document.fonts.ready`), `gate-audit.js` is
injected and `window.__gateAudit` is read. A **template tell** is a warn/fail
whose message is one of: uniform card grid, stat-counter band, display face
resolves to a default sans, pill text CTA, indigo-to-violet gradient. The
cold-load integrity findings (`[hidden]` defeated, visible errors, busy
state, opacity-0 content, skeletons) are recorded but are not taste signals
and never affect scoring.

| label | detector outcome | result |
|---|---|---|
| slop | any template tell on any viewport | TP |
| slop | no template tell on any viewport (CLEAN, or only integrity findings) | FN |
| crafted | no template tell on any viewport | TN |
| crafted | any template tell on any viewport | FP |

`recall = TP/(TP+FN)`, `precision = TP/(TP+FP)`, `FPR = FP/(FP+TN)`,
`FNR = FN/(FN+TP)`. Numbers are reported overall and split into repo-sourced
and authored, because the repo-sourced slice is the one that was not written
with the detector in mind. The report also lists how many true positives were
caught only by the default-display-face tell.

## Known confound: quoted exhibits

Six repo gallery samples (clay, concrete, copper, maximal, swiss, verge)
include a "what it refuses" section that shows an indigo-to-violet swatch
(`div.sw.p`) as an exhibit of the slop they reject. The detector checks every
element's computed background and cannot tell a quoted exhibit from the
page's own style, so these score as false positives. They are kept as FPs,
labeled crafted, because that is what the detector does on shipped work.

## Scope boundary (honest)

`gate-audit.js` counts surface tells: default faces, indigo/violet gradients,
uniform card grids, stat bands, pill CTAs. It does not judge composition,
hierarchy, rhythm, copy or brand fit. A page can be crafted-labeled and
pass, or slop-labeled and pass (glass cards, neon bento, emoji markers have
no countable signature in the detector). The corpus is small and partly
authored by the same people who wrote the detector. These numbers are a
regression floor for the tell detector, not evidence that TasteCheck makes
UIs better.

**This does not clear the effectiveness BLOCKED status.** Effectiveness
claims remain unsupported; only the measured counts above, with this scope,
may be stated.

## Adding cases

Add the html under `evals/taste/fixtures/{slop,crafted}/` (or point at a
committed repo page), add the case JSON with full provenance, run the runner,
and refresh the baseline with `--write-baseline` only deliberately, in the
same change, with the diff of outcomes reviewed. Taste data stays
user-local; nothing here may include private user pages.
