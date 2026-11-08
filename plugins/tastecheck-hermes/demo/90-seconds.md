# Tastecheck — demo script (click-led, strictly under 90 s)

Opens on **the user's own project** — never the canned demo page. **The clicks
are the demo**: three Taste Roll clicks drive everything; the per-column gates
stamp live; the completion gate bites at the start and lifts at the end.
TOTAL 78 s — strictly under 90.

Recording surface: Hermes Desktop. Scrub tokens/private paths. Banner 2:1 uses
`assets/tastecheck-r21.png` (approved master, sha256
`50b7be9d349ea3d341c6bb64667497cb0b78c7cc7fbbb57f7a99b80a6a5a21f4`).

## Timeline (the clicks are the demo)

- **0–8 s HOOK (the gate bites first).** In a session whose task is frontend
  work, the agent calls `kanban_complete` with a "landing page done" summary.
  Show the tool result: the block message — "Tastecheck ship gate … no ledger
  verdict is bound to this workspace … fail closed." One line of narration:
  "Hermes refuses to call UI work done on a claim."
- **8–22 s CLICK 1 — your page, restyled + gated.** Open your own project in
  Desktop. Click **🎲 Taste Roll** in the composer (or ⌘K → "Taste Roll").
  Grant the project folder when asked (one picker, once). The `Taste Roll`
  pane opens BESIDE the chat, no navigation: left column = your unchanged page
  (file named in the header with how it was picked — on a host with no
  active-file API: "no active-file API in this Desktop build — picked newest
  edit (app.html); tap a file below if this isn't yours"); column 2 =
  your same DOM restyled by a seeded roll (ref · vibe · mode · sig + seed id).
  The column header shows **GATE… → SHIP/HOLD** — the real audit ran on that
  exact column.
- **22–38 s CLICKS 2 + 3 — columns accumulate, gates per column.** Click
  Taste Roll twice more. Columns append to the right; earlier columns stay
  (nothing replaced, no tab reuse). After three rolled columns the strip
  scrolls horizontally — show the scroll. Point at one **HOLD** stamp with its
  reasons visible (a HOLD column stays on screen). Narration: "Every click is
  a new direction — and every column carries its own verdict."
- **38–50 s THE MARK.** Frame the pane with the r21 icon as the mark (banner
  overlay bottom-right, 2:1). One sentence: a roll is the system merged on
  tastecheck main, applied to YOUR surface — the same DOM, a different legal
  visual system.
- **50–66 s REAL AUDIT.** Run `/tastecheck audit <your-page-or-dev-server>`
  (or ask the agent). Show the verdict-first output: `SHIP`/`HOLD`, hold
  reasons with selectors/measurements, evidence dir. Open one screenshot
  (`shot-light.png` / `shot-narrow-390.png`) from plugin-data.
- **66–74 s THE GATE LIFTS.** Retry the completion; it passes now — the ledger
  holds a fresh SHIP bound to this workspace/artifact. "Same command, evidence
  in hand."
- **74–78 s CLOSE.** One line: "Fail-closed by default; SHIP only with
  rendered evidence." Install/docs pointer. **TOTAL 78 s.**

## Capture needs (Growth)

1. Desktop 1440×900 window recording ≥ 60 fps; cursor highlight on the three
   Taste Roll clicks.
2. The folder-grant picker moment (first click only) — keep it; it is the
   trust story.
3. A frontend kanban card whose `kanban_complete` is actually vetoed (record
   the block message full-screen for 3 s — it is the hook).
4. Per-column SHIP **and** HOLD stamps visible in the pane (one close-up of a
   HOLD column with its reasons).
5. `/tastecheck audit` output + one evidence screenshot opened from
   `<HERMES_HOME>/plugin-data/tastecheck/audits/<ts>-*/`.
6. r21 icon as banner/mark overlay (bottom-right, 2:1); no other branding.
7. FFmpeg labels via `textfile=` (colon-safe), e.g. `demo/label.txt` with
   `SURFACE: tastecheck ship gate`.
8. No secrets, tokens, or private paths in frame. Record only real behavior.

## Honest scope notes (do not paper over on camera)

- The completion veto fires in sessions where this plugin is enabled; the
  demo card must be a real frontend task, not a mock.
- The desktop half is opt-in (Capabilities ▸ Plugins → Tastecheck); the
  per-column gate needs the agent half installed + enabled (it calls this
  plugin's own backend namespace). Without it, columns stamp an honest
  fail-closed "gate unavailable" HOLD.
- Column sandbox = the built-in preview frame (`allow-forms allow-scripts`,
  `fullscreen`, no-referrer).
