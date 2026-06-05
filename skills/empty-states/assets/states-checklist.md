# Empty / Loading / Error — Ship Checklist

For every data region (list, table, search, dashboard, feed, detail):

## Three states exist
- [ ] Loading designed
- [ ] Empty designed
- [ ] Error designed
- [ ] (Where relevant) not-found and permission handled distinctly

## Loading
- [ ] Skeleton matches real layout and reserves space (no layout shift on arrival)
- [ ] Spinner only for short in-place waits, not whole pages
- [ ] Sub-300ms loads show nothing (no flash)
- [ ] Loading has an accessible label / `role="status"`

## Empty
- [ ] Correct flavor: first-run vs cleared vs no-results
- [ ] Heading + one-line context + primary action
- [ ] "No results" echoes the query and offers an exit (clear filters / broaden / create)
- [ ] Not confused with an error

## Error
- [ ] Plain-language explanation (no raw code/stack trace alone)
- [ ] Blameless tone; gravity matches the failure
- [ ] Retry (or recovery path) present
- [ ] User work preserved
- [ ] `role="alert"` so it's announced; focus moved to it after submit
- [ ] Fails per-widget where possible (one failure ≠ whole page blank)
