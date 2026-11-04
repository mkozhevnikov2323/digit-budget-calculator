# Analytics pages

The navigation introduced by PR41 is reused without merging that PR. All nine
routes now mount real functionality, one page at a time:

- `/analytics`: validated raw cash-flow summary, monthly table and dynamics.
- `/analytics/categories`: existing category sums/shares/chart.
- `/analytics/recurrence`: category activity, intervals and consecutive months.
- `/analytics/similar`: existing exact category/title/recipient expense groups.
- `/analytics/income-sources`: existing source activity, not income forecasting.
- `/analytics/history`: owned history, pagination, selection and fact inspection;
  no decision reads or mutations are initiated by selecting a history row.
- `/analytics/classification`: compact income-first tabs, ascending UTC-date groups,
  complete-period batch classifications, exact status filters and numbered 25-row
  pages. One explicit PUT saves a decision; no per-row GETs or automatic retries.
- `/analytics/classification-stats`: coherent history, status/role/layer/category
  partitions, monthly statistics and classification coverage.
- `/analytics/planning`: coherent historical basis, explicit recording attestations,
  existing forecast engine, manual plan/recommendation acceptance, JSON import/export
  and completed-month plan/actual comparison.

## State and privacy

`analyticsUI` is a normal Redux Toolkit slice, reset by the existing root LOGOUT.
The existing credential lifecycle also clears it at the start of a transition.
Page settings are independent; owner/session scope prevents private input from
being relabeled as another user's data. The optional component bridge uses the
same Redux store; standalone/demo components retain their prior local lifecycle.
No second store, server persistence, period URL parser or new financial model.

Only the versioned `budget-analytics-display-v1` preference object is persisted.
It is constructed from an explicit whitelist: validated calendar selection,
3/6/12-month recurrence mode, bounded page/visible counts. It never serializes the
store. Invalid/unknown fields, financial targets, raw facts, category labels,
selected operation IDs, JWTs, preparation IDs, proofs and confirmations are excluded.
Storage failure does not block UI editing. Public display preferences can be reused
by another account on this browser; private input cannot.

Plan fields, annual-input text (including invalid intermediate strings), manual
protections and imported/exported JSON survive tab changes only in session memory.
Explicit close/new-plan/import retain their existing meanings. Reload/session loss
clears private input; a visible warning and explicit JSON export remain available.
No recording attestations, forecast acceptance or prepared mutation are restored.

Classification uses one explicit PUT decision command, with exact SourceFacts built
from the already validated displayed operation. There is no preparation ID, expiry,
automatic prepare, mutation retry or preparation-based reconcile in this UI.
Validated classification-read-v1 responses update only the affected row, including
its revision. Reopening uses that response without another GET. Approved and
explicit-unclassified results close the editor; stale results remain visible with
a refresh warning. Unknown outcomes keep a session-memory risk flag and allow
only explicit read-state refresh. Full reload uses ordinary authenticated reads.

## Queries and calculations

Server data stays in existing RTK Query endpoints, not the UI slice. Overview and
category pages share fulfilled raw-history cache entries for identical arguments;
Expense/Income tags retain existing invalidation; decision PUTs do not invalidate
visible rows or reload history. Statistics re-entry obtains fresh coherent history and the session boundary clears
old credentials' cache. Coherent history and classification decisions deliberately
retain fresh request scopes/rechecks on re-entry; cached totals never replace the
existing before/batch/after consistency checks. These reads are not atomic snapshots.

The financial calculation, money, calendar, source fingerprint, forecast and plan
engines are unchanged. Russian labels and UTC date/time formatting are presentation
only; exact identity/category strings and API formats are preserved. A single
calendar month has an explanation/table instead of a misleading one-point line.
Zero months remain in multi-month charts. Unknown data is never converted to zero.

Production C flags, backend APIs, MongoDB schemas/configuration and deployment are
unchanged. Test-only C activation remains confined to the existing disposable
browser fixture. Previous P10/P12 assertions are adapted to destinations/labels,
with additional filter, reload, cache reuse, input-retention and privacy checks.

## Classification navigation and period completeness

Classification reuses getCoherentHistory unchanged: bounded membership reads before
and after batches, at most 100 identities per batch/four workers and 50,000 total
records, strict source/decision validation, current owner/session checks and no
partial publication. History readOnly keeps the previous membership-only loader.
Filters and page changes never enter the query arguments. Unknown/unavailable
cohorts show errors rather than misleading counters or partial filtered results.

Counters use all operations of the selected dataset: pending means exactly
unreviewed, approved exactly approved; explicit_unclassified, cleared, stale and
blocked remain in all only. A validated PUT updates one local decision and the
counters. Unknown outcomes change neither and retain explicit read-only recovery.
Recovery after a real error/conflict is an explicit coherent reread; there is no
global refresh button, polling or automatic reload after success.

Only navigation metadata enters the URL: dataset, filter, page, incomesPage and
expensesPage. Positive page numbers are validated/bounded then clamped to available
pages. Navigation pushes history; automatic clamping replaces it. Reload reads the
URL; Back/Forward restores it. Dataset pages are independent. Filter changes reset
both pages; calendar changes reset them using the existing session-memory Redux
period marker, not a new URL calendar mechanism. No identities, amounts, facts,
credentials or confirmations are serialized in these query parameters.

### Temporary category batch classification

The classification expenses tab can preview the complete already verified period
(not only the current page) using `temporaryCategoryRules.ts`. These eight exact
category mappings are temporary personal rules of the project owner, not a
universal policy. They never run on login or expense creation. Only `unreviewed`
expenses without unresolved write risk qualify; incomes and reviewed decisions
are excluded. Preview and cancellation before confirmation perform no writes.

Explicit confirmation uses the existing validated `putDecision` once per item,
with its observed revision/facts and a distinct requestId. Three workers bound
concurrency; there are no automatic retries. Confirmed responses update only the
local operation overlay and counters, with no automatic history refresh. Manual
and batch admission share the existing owner/session-scoped unresolved-write
flags. Cancellation, period change, session change and unmount stop new work;
in-flight requests may have persisted and retain risk when acknowledgement is
lost. Read-only recovery is explicit. Unknown items remain excluded from another
batch until their state is checked through the existing manual recovery flow.
The summary distinguishes confirmed successes, failures, unknown outcomes and
unsent operations. This is not an atomic multi-operation transaction.

### Editing a source operation over classification

Expanded classification rows open the existing EditExpenseModal/EditIncomeModal
and forms directly over `/analytics/classification`. No navigation, router state
or return destination is involved. ClassificationWorkspace owns the small
in-memory selection, bound to verified owner, session and calendar period.

The existing sourceEditApi calls read-only POST /classifications/history/read
with exactly one identity. Response identity, window, exact source facts and
classification must validate before mounting the form. The current Redux table
list, month and page are not used as a fallback. Missing, foreign, unavailable or
concurrently moved-out-of-period records show an error instead of an empty form.
The same existing history-read availability/readiness is required; no flags are
activated. Each new opening rereads current facts.

Closing/cancelling changes only the local selection: no PATCH, navigation or
coherent-history refresh. Existing calendar, tab, filter, page, expanded card and
scroll remain in place. Captured scroll is restored after closing if needed,
waiting for any coherent refresh to finish. A shrinking result set retains the
existing page-clamping behavior and browser scroll limits.

Existing forms and their PATCH/delete/validation handlers are unchanged. Their
existing Expense/Income tag invalidation refreshes coherent period membership,
facts and classification after mutation; no second manual refresh is scheduled.
Changed facts can become stale; operations moved out of the period disappear.
No classification PUT is submitted by source editing. The modal lives outside
the coherent loading/error branch, so invalidation cannot discard a financial
draft or close it after failed PATCH. Owner/session/period changes retire the
selection; stale read responses cannot open it again. Ordinary table editing and
batch classification are unchanged.
