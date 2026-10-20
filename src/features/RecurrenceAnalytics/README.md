# Read-only recurrence observations

Contract inspected at backend `b550ac8afc7164768507b35bece0c6a555a46929`:
`routes/recurrence.js`, `controllers/recurrence.ts`, `domain/recurrence.ts`,
`docs/recurrence-read-api-v0.md`. No backend or classification-preview changes.

- One `baseApi.injectEndpoints` GET; only startMonth/endMonthExclusive go on
  the wire. Expense/Income tags reuse existing transaction invalidation.
- `useVerifiedOwner` gates the request. Existing UserProvider/session boundary
  remains authoritative for credentials, teardown and obsolete result rejection.
- Cache arguments include owner, session generation and an ephemeral UI scope.
  A period A/B/A or verified/verifying/verified lifecycle cannot deduplicate an
  obsolete in-flight request. Unused recurrence cache entries expire immediately.
- `currentData` is exposed only after validation and outside any refetch. Errors
  and blocked/loading states contain no previous report. Private error bodies,
  raw invalid DTOs and transport metadata are discarded, not logged or persisted.
- Validator checks exact v0 shapes/coverage/period, label_only provenance,
  dataset/level combinations, unique group identities, integer/dataset bounds,
  canonical active months, intervals/series and parent-category consistency.
- Default is the previous **3 completed UTC months**, with independent 6/12
  choices. This is a UI lookback, never a classification threshold. The period
  advances at UTC month rollover. Cards paginate in batches of 20 for rendering.

The DTO has no owner/revision field: frontend cannot independently prove the
server's owner scoping or detect a valid-looking stale server snapshot. It relies
on the existing verified credential lifecycle and backend authorization. Coverage
does not prove continuous bookkeeping; the two datasets are not an atomic snapshot.
Labels are exact historical strings, not verified dictionary IDs or classifications.

Focused tests use real RTK Query, UserProvider/session guard, Profiler commit
frames and synthetic mocked HTTP transport. Existing analytics tests retain their
original mocks: without verified owner context this independent query stays skipped.

Visual acceptance uses Chromium at narrow/wide viewports with fictional responses,
all nonlocal traffic intercepted. Check wrapping, native selector/summary keyboard
focus, loading/refetch hiding, empty/error/413 states and independent monetary totals.
No live financial API, production credentials, localStorage report persistence,
manual decisions or writes are used.
