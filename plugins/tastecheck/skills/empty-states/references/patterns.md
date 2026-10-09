# Empty States — Patterns by Surface

Read when building a specific surface. Each has its own empty/loading/error nuances.
Copy templates included; adapt the voice to the product.

## Skeletons: how to build one

A skeleton mirrors the real content's *layout* with neutral placeholder blocks. Rules:
- Match the real element count and rough dimensions (one skeleton row per expected row).
- Reserve the real height/width so data arrival causes zero layout shift.
- Subtle shimmer (see `micro-motion` `../../micro-motion/assets/motion-tokens.css` `.skeleton`); disable
  under `prefers-reduced-motion`.
- Don't over-detail — a few bars conveying "title + lines + thumbnail" is enough.
- Cap how long a skeleton shows; if loading exceeds ~10s, switch to a slow-load message
  or error path.

## Per-surface playbook

### List / table
- **Loading:** 5–8 skeleton rows matching column layout.
- **Empty (first-run):** heading + value prop + primary CTA ("Add your first customer").
- **Empty (filtered):** "No customers match these filters" + Clear filters.
- **Error:** "Couldn't load customers" + Retry; keep the table chrome (headers) so the
  page doesn't collapse.

### Search / results
- **Loading:** skeleton result rows (not a spinner) once a query is submitted.
- **No results:** echo the query ("No results for "<q>""), suggest: check spelling,
  remove a filter, broaden terms; offer a relevant action ("Create "<q>"" / "Browse
  all"). Never a bare "No results."
- **Error:** "Search is unavailable right now" + Retry.

### Dashboard / analytics
- **Loading:** skeleton cards/charts at final size (charts are big CLS offenders).
- **Empty (no data yet):** explain that data appears once events flow; link the setup
  step ("Connect a source to see metrics").
- **Empty (range has no data):** "No activity in this period" + change-range hint.
- **Error per widget:** fail widgets independently — one broken chart shouldn't blank
  the whole dashboard; show a small retry in that card.

### Feed / messages / notifications
- **Empty (caught up):** positive affirmation ("You're all caught up").
- **Empty (first-run):** explain what will appear and how to get the first item.
- **Loading:** skeleton feed items.

### Detail / profile page
- **Loading:** skeleton of the known layout (avatar circle, title bar, body lines).
- **Not found:** distinct from empty — "This item doesn't exist or was removed" + link
  back, don't show an empty shell.
- **Permission:** "You don't have access" + request-access / contact owner.

## Copy templates

Empty (first-run): `No {things} yet` · `{One line on the value of having them}` · `[Add your first {thing}]`
Empty (cleared): `All done — no {things} left` / `You're all caught up`
No results: `No results for "{query}"` · `Try fewer filters or a different term` · `[Clear filters]`
Error (transient): `We couldn't load {things}` · `Something went wrong on our end. Your work is safe.` · `[Try again]`
Error (offline): `You're offline` · `Reconnect to see {things}` · `[Retry]`
Error (permission): `You don't have access to {thing}` · `Ask the owner for access` · `[Request access]`

Voice rules: plain language, no codes-only, no blame, match gravity (no jokes on
payment/security failures). See the `humanize-copy` skill for tone.

## Illustrations
- Optional and nice for first-run/empty, but keep them light and on-brand; mark
  decorative images `alt=""` / `role="presentation"`.
- Don't use illustrations for errors that need urgency, or where they'd trivialize a
  serious failure.
- A good empty state works *without* the illustration — copy + action carry it.

## Accessibility
- **Announce state changes** to assistive tech: wrap the live region in
  `role="status"` / `aria-live="polite"` for loading→loaded; use `role="alert"` for
  errors so they're announced immediately.
- Don't convey state by icon/color alone — include text.
- Keep focus sane: on error after submit, move focus to the error/Retry.
- Loading spinners need an accessible label (`aria-label="Loading"`).
