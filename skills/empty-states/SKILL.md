---
name: empty-states
description: >-
  Empty, loading, and error-state design. Use for first-run screens, zero results,
  empty lists/tables/dashboards, loading skeletons, offline/permission errors,
  retries, layout stability, and state copy.
---

# Empty States

The states with no happy-path data are the most-skipped and most-noticed parts of any
app. LLMs and rushed builds render the populated view and stop — so the first thing a
*new* user sees (an empty dashboard) and the thing a *frustrated* user hits (no
results, an error) get a blank void or a raw error. These states are where trust is
won or lost, because they're exactly when the user is uncertain.

Core principle: **there is no such thing as "no state."** Every data region has at
least three non-happy states — **loading, empty, error** — and each needs a designed
answer. This skill makes each one checkable.

## The three states (always design all three)

For any region that fetches or holds data, answer all three before shipping:

1. **Loading** — what shows while data is in flight.
2. **Empty** — what shows when the fetch succeeds but there's nothing (and *why*:
   first-run vs. user-cleared vs. no-results-from-filter — these are different).
3. **Error** — what shows when the fetch fails (network, permission, server, offline).

A frequent bug is conflating them: showing "No data" (empty) when the request actually
*failed* (error), or a spinner forever when it errored. Distinguish: zero-as-value vs.
not-available vs. loading are three different things and must look different.

## Loading: skeleton over spinner

- **Use a skeleton** (gray placeholder matching the real layout) for content areas —
  it communicates structure, reduces perceived wait, and **prevents layout shift**
  because it reserves the real dimensions. (See `micro-motion` for the shimmer.)
- **Use a spinner** only for short, indeterminate, in-place waits (a button submitting,
  a small inline action) — not for whole pages. A full-page spinner reads as "stuck."
- **Reserve space** so content arriving doesn't shove the layout (CLS). The skeleton
  should occupy the same box the data will.
- For very fast loads (<~300ms) show nothing rather than a flash of skeleton/spinner.
- Optimistic UI: for user actions, show the result immediately and reconcile, instead
  of a spinner, when the action is very likely to succeed.

## Empty: the three flavors, each with a next step

An empty state is a **moment to onboard or guide**, never a dead end. Always include:
a short heading, one line of context, and **a primary action**. The three flavors:

- **First-run / never-had-data** — the highest-value empty state. New user, empty
  dashboard/list. Teach the value and give the first action: "No projects yet — create
  your first to start tracking." Big primary CTA. Optionally a sample/template.
- **User-cleared** — they completed/deleted everything. Affirm it: "Inbox zero. You're
  all caught up." Lighter, positive.
- **No results (search/filter)** — their query/filter matched nothing. This is the most
  botched one. Don't just say "No results." Say what was searched, and offer a way
  out: clear filters, broaden, check spelling, or a "create '<query>'" action.

Every empty state = **heading + one-line context + a way forward**. If there's no
action possible, at least explain why it's empty and what would fill it.

## Error: explain, reassure, offer recovery

- **Say what happened in plain language** — never a raw stack trace or code alone
  ("Error 500"). "We couldn't load your orders."
- **Don't blame the user.** Neutral, blameless tone. Avoid "You did X wrong."
- **Offer recovery:** a Retry button, a link to a working area, or contact/support.
  Most transient errors just need Retry.
- **Distinguish error types** where it helps: offline ("You're offline — reconnect to
  continue"), permission ("You don't have access — request it"), not-found, server.
- **Preserve user work** — never wipe a half-filled form on error.
- Keep brand voice but match gravity — a payment failure isn't the place for a joke.

## Quick-start pattern

```html
<!-- region renders ONE of these based on state -->
<section data-state="loading">  <!-- skeleton matching real layout -->
  <div class="skeleton" style="height:1.25rem;width:60%"></div>
  <div class="skeleton" style="height:1rem;width:90%;margin-top:.5rem"></div>
</section>

<section data-state="empty">    <!-- first-run flavor -->
  <img src="/illustrations/empty-projects.svg" alt="" role="presentation" width="120">
  <h2>No projects yet</h2>
  <p>Create your first project to start tracking work.</p>
  <button class="btn-primary">New project</button>
</section>

<section data-state="no-results">
  <h2>No results for “<span data-query>widget</span>”</h2>
  <p>Try a different term or clear your filters.</p>
  <button>Clear filters</button>
</section>

<section data-state="error">
  <h2>We couldn’t load your projects</h2>
  <p>Something went wrong on our end. Your work is safe.</p>
  <button class="btn-primary" data-retry>Try again</button>
</section>
```
Keep all four boxed in the same container dimensions so switching states doesn't shift
layout.

## Reference files

- `references/patterns.md` — per-surface playbook (list, table, search, dashboard,
  feed, detail), skeleton construction, copy templates for each state, illustration
  guidance, and accessibility (announce state changes to screen readers).
- `references/decision-records.md` — meta-patterns + ADR rules for novel cases.

## Self-check (before shipping any data region)

1. Are **loading, empty, and error** all designed (not just the populated view)?
2. Is **empty distinguished from error** (success-but-zero vs. fetch-failed)?
3. Does the empty state have a **heading + context + a next action**?
4. Is "no results" a guided exit, not a dead "No results"?
5. Does the error **explain + reassure + offer Retry**, with no raw stack trace?
6. Does loading use a **skeleton that reserves space** (no layout shift on arrival)?
7. Are state changes **announced** to assistive tech (`aria-live`/`role="status"`)?
8. Is user work **preserved** across errors?

## How to deliver

- When you build any list/table/search/dashboard, deliver all three states by default
  and say so: "added loading skeleton, first-run empty with CTA, and a retryable error."
- Keep the states in one fixed-size container to avoid CLS.
- Pair with `micro-motion` (skeleton shimmer, gentle state cross-fade), `form-ux`
  (inline errors), and `deslop-ui` (these states are exactly the "functional slop"
  models skip).
