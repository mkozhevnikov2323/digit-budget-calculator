# Income refetch and balance chart hotfix

Baseline: `df1eaa37d448247d12e18065e6a52ae1ae5727b5`.

## Income lifecycle

`useSyncIncomesWithStore` previously treated every `isFetching` transition as
initial loading. Income tag invalidation therefore removed the page subtree,
including financial forms and their busy/uncertain-result guards.

The hook now distinguishes a request without `currentData` from a background
refresh with data for the same query arguments. Synchronization to Redux uses
`currentData`, not the previous arguments' `data`. The table also renders these
argument-specific rows so it cannot briefly label old Redux rows as a new period
before the synchronization effect runs. Redux filters, pagination and edit-form
selectors remain in place.

The add modal sits outside the loading/error content boundary. Initial loading,
a period change, or a failed request cannot erase its draft. Cached rows may stay
visible after a failed refresh for the same period, with an error alert. Rows
from a different period are hidden. Mutation endpoints, invalidation tags,
financial calculations and explicit close/uncertain-result behavior are unchanged.

The income page tests use real RTK Query endpoint definitions, invalidation,
Redux, table, modal and forms with an in-memory synthetic transport. All-time
income charts are substituted to isolate this lifecycle. No HTTP requests,
credentials, backend service or database are needed. Jest explicitly maps the
application alias prefixes to `src`, matching production paths and avoiding
load-order collisions between real modules and existing virtual form mocks.

## Balance chart compatibility and verification limit

The locked and installed `@mui/x-charts` version is **8.4.0**. Inspection of its
`BarChart` implementation shows that it places children inside `ChartDataProvider`
and `ChartsSurface`; nesting `ChartsReferenceLine` is supported in principle.
Thus the reported missing-context error cannot be attributed solely to nesting.
The library's error also identifies multiple bundled library instances as a
possible cause, which has not been established here.

The optional `y={0}` reference line and its package-root import are removed.
The existing `BarChart` uses its normal zero baseline. Its three series, values,
labels, colors and 400px height are unchanged. Tests render the installed chart,
not a placeholder, with synthetic positive, negative and zero balances, plus
loading and API errors. Only query results and JSDOM layout measurements are
substituted.

**The original balance implementation also passes these Jest/CommonJS rendering
tests.** The reported browser context exception was not reproduced in this
runtime, so these tests demonstrate compatibility but do not establish a
red-to-green reproduction of that exception. Recheck `/balance` in the original
local browser/Vite environment before approving the fix; compare all three bars,
legend, totals, zero baseline and the console. No browser end-to-end verification
against a backend or real financial data was performed for this task.

## Default catalogs: diagnosis only

The frontend already requests both catalog variants:

- Income sources: `GET /sources/default` and `GET /sources/user`, used by
  `AddIncomeForm` and `IncomeSourceField`.
- Expense categories: `GET /categories/default` and `GET /categories/user`, used
  by `AddExpenseForm` and `ExpenseCategoryField`.

The fields combine default and user names into their options. They do not supply
hardcoded default records. Query data falls back to an empty array, so a failed
or still-pending default request can also appear as an empty default group.

An empty server default catalog or missing provisioning is a plausible cause if
the default endpoints successfully return empty arrays. A request failure is
another possibility. **Actual endpoint responses, MongoDB contents and catalog
provisioning are unverified.** No application API requests or database access
were used to distinguish these possibilities. No seeds, catalog values or backend
changes are included; catalog contents and provisioning require a separate task.
