# Empty States — Meta-Patterns & Decision Records

Reasoning for novel cases. Independent synthesis of established UX guidance on empty/
loading/error states (NN/g and the broader UX community, 2024–2026). Credited ideas,
own expression.

## Meta-patterns

### MP-1 · "No data" is still a screen with a job
The absence of data is a design state, not a gap to leave blank. **Consequence:**
treat loading/empty/error as first-class deliverables for every data region, not
afterthoughts.

### MP-2 · These states appear exactly when the user is uncertain
A new user (empty), a waiting user (loading), a blocked user (error) — all are moments
of doubt. **Consequence:** their #1 job is to reduce uncertainty: say what's happening
and what to do next.

### MP-3 · Empty and error are different truths
Success-with-zero, fetch-failed, and still-loading are three different system states
and must look and read differently. **Consequence:** never show "empty" for a failure
or spin forever on an error; branch on the real state.

### MP-4 · Perceived performance beats raw performance
A skeleton that reserves layout feels faster than a spinner and prevents CLS.
**Consequence:** prefer skeletons for content; reserve space; show nothing for sub-
300ms loads.

### MP-5 · The empty state is your best onboarding surface
First-run empty is the most valuable real estate in the app — the user is ready to act.
**Consequence:** make first-run teach value and offer the first action, not apologize
for being empty.

## Decision records

### DR-1 · Always design three states
- **Why (MP-1):** completeness. **Apply:** loading + empty + error for every fetched
  region before shipping.

### DR-2 · Branch empty vs error vs not-found
- **Why (MP-3):** truthful status. **Apply:** distinct UI for zero-value, failure,
  missing, and loading.

### DR-3 · Skeleton, reserve space
- **Why (MP-4):** perceived speed + no CLS. **Apply:** skeleton matches layout;
  spinner only for short in-place waits.

### DR-4 · Every empty has a next action
- **Why (MP-2/MP-5):** no dead ends; onboarding. **Apply:** heading + context + primary
  CTA; "no results" offers an exit.

### DR-5 · Errors explain, reassure, recover
- **Why (MP-2):** uncertainty + trust. **Apply:** plain language, blameless, Retry,
  preserve user work, no raw stack traces.

### DR-6 · Announce state changes
- **Why:** accessibility. **Apply:** `role="status"`/`aria-live` for load,
  `role="alert"` for errors; text not icon-only.

## Principle, not property
Distills shared UX practice on empty/loading/error states; credit lineage (NN/g) where
natural; never copy prose. Your implementation is your own.
