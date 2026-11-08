# Tastecheck — 90-second demo (gate-first)

Opens on **the user's own project** — never the canned demo page. The gate is the
story: Taste Roll shows the eye candy, the completion gate proves it has teeth,
the audit proves it runs against a real rendered page.

Recording surface: Hermes Desktop. Scrub tokens/private paths. Banner 2:1 uses
`assets/tastecheck-r21.png` (approved master, sha256
`50b7be9d349ea3d341c6bb64667497cb0b78c7cc7fbbb57f7a99b80a6a5a21f4`).

## Timeline

- **0–10 s HOOK (the gate bites first).** In a session whose task is frontend
  work, the agent calls `kanban_complete` with a "landing page done" summary.
  Show the tool result: the block message — "Tastecheck ship gate … no fresh
  SHIP verdict … fail closed." One line of narration: "Hermes now refuses to
  call UI work done on a claim."
- **10–25 s YOUR PAGE, RESTYLED (Taste Roll).** Open your own project in
  Desktop. Click **🎲 Taste Roll** in the composer. Grant the project folder
  when asked (one picker, once). The `Taste Roll` pane opens beside the chat:
  left column = your unchanged page (file named in the header); column 2 =
  your same DOM restyled by a seeded roll (ref · vibe · mode · sig + seed).
- **25–40 s COLUMNS ACCUMULATE.** Click Taste Roll twice more. New columns
  append; the earlier ones stay. Roll labels/ seeds visible per column.
  Narration: "Every click adds a direction; nothing replaces your work."
- **40–55 s THE MARK.** Frame the pane with the r21 icon shown as the mark
  (banner overlay bottom-right, 2:1). Narration: one sentence on what a roll
  is (the system merged on tastecheck main, applied to your surface).
- **55–75 s REAL AUDIT.** Run `/tastecheck audit <your-page-or-dev-server>`
  (or ask the agent). Show the verdict-first output: `SHIP`/`HOLD`, hold
  reasons with selectors/measurements, evidence dir. On camera, open one
  screenshot (`shot-light.png` / `shot-narrow-390.png`) from plugin-data.
- **75–83 s THE GATE LIFTS.** Retry the completion; it passes now — the ledger
  holds a fresh SHIP. Narration: "Same command, evidence in hand."
- **83–90 s CLOSE.** One line: "Fail-closed by default; SHIP only with
  rendered evidence." Install/docs pointer.

## Capture needs (Growth)

1. Desktop 1440×900 window recording ≥ 60 fps; cursor highlight on the three
   Taste Roll clicks.
2. The folder-grant picker moment (first click only) — keep it; it is the
   trust story.
3. A frontend kanban card whose `kanban_complete` is actually vetoed (record
   the block message full-screen for 3 s — it is the hook).
4. `/tastecheck audit` output + one evidence screenshot opened from
   `<HERMES_HOME>/plugin-data/tastecheck/audits/<ts>-*/`.
5. r21 icon as banner/mark overlay (bottom-right, 2:1); no other branding.
6. FFmpeg labels via `textfile=` (colon-safe), e.g. `demo/label.txt` with
   `SURFACE: tastecheck ship gate`.
7. No secrets, tokens, or private paths in frame. Record only real behavior.

## Honest scope notes (do not paper over on camera)

- The completion veto fires in sessions where this plugin is enabled; the
  demo card must be a real frontend task, not a mock.
- The desktop half is opt-in (Capabilities ▸ Plugins → Tastecheck).
- Column sandbox = the built-in preview frame (`allow-forms allow-scripts`,
  `fullscreen`, no-referrer).
