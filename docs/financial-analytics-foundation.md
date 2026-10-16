# Financial analytics — first read-only page

## Definitions

- Recorded operations are existing `Income` and `Expense` documents. The page counts every separate expense document once, including units created by bulk entry. It does not infer quantities.
- Recorded inflows/outflows and their arithmetic difference are not earned income, cost of living, bank balance, savings or free cash flow.
- Loan issuance is an expense in `Выдача займа`; repayment is income with source `Возврат займа`. Both remain included and explicitly disclosed. They represent changes in a receivable as well as recorded cash movements, not ordinary consumption/earnings.
- Categories describe transaction purpose. The five future financial layers describe money's role: everyday spending, irregular obligations, emergency fund, major goals and long-term capital. No category-to-layer mapping exists in this phase.
- Actual expenses are already recorded operations. Planned expenses are future obligations, not existing `Expense` documents. Reserving money is an allocation, not an actual expense; treating it as another expense would double count when the purchase occurs.
- `controllers/balance.js` computes lifetime recorded income minus recorded expense for the authenticated owner. It has no account balances, opening balances or transfer model, so it is not necessarily a bank account balance.

## Implementation and date policy

The UI was selectively adapted from `feat/financial-analytics-foundation` at
`84b05157f0feaac3a9fdb36cb5057e8de7b022fe`: AnalyticsPage, PeriodSelector,
AnalyticsResults, lazy exports, protected route/navigation and focused UI tests.
The preserved branch was not changed or merged wholesale.

`pages/AnalyticsPage/ui` uses `useFinancialAnalytics` as its only data/calculation
integration point. The authoritative `features/FinancialAnalytics/model` modules
from PR #6 and PR #7 remain unchanged. Selection state/adapters only translate UI
controls to `monthPeriod`, `previousMonthPeriod`, `quarterPeriod`, `yearPeriod`
and `customPeriod`; there is no second calendar or aggregation engine.

The protected `/analytics` route uses the existing Protected wrapper and lazy-page
convention. The shared navigation item is `Аналитика`. No authentication, API,
mutation, backend, schema or stored-date behavior is changed.

UTC reporting boundaries are provisional, visibly disclosed, and have not been
approved as a permanent reporting timezone. The current month uses the UTC date.
Selected dates are inclusive; PR #7 maps the half-open UTC interval to the existing
inclusive GET filters. No stored instants are modified. Calendar years 0001–9999
are supported; impossible navigation is disabled. Invalid/unfinished custom dates
remain editable and produce no financial requests or stale totals.

Dynamics are MONTHLY for every period, including short custom ranges and a single
month. Chronological YYYY-MM keys and zero months come directly from PR #7.
The category table contains every category; only its chart is capped at 12.
Chart data remains in integer kopecks; both axes and tooltips display rubles
through PR #6 `formatKopecks` with explicit result handling. Null/invalid money
never falls back to zero. A single monthly observation has a visible marker.

Persisted amounts are validated by PR #7 with the unchanged PR #6 money policy:
unsupported precision (for example 1.005 RUB), unsafe values, overflow, duplicate
IDs, invalid/out-of-period dates and incomplete metadata stop reporting.
Historical amounts are never automatically rounded. Percentage shares are
nonmonetary display ratios and may sum to slightly more/less than 100% after
display formatting. Loan issuance/repayment remain included once in the primary
recorded totals; the page discloses their treatment without reclassification.

Loading/refetch, API failures and invalid data hide summaries. Only a ready result
can render totals; a genuinely empty response has zero summaries and an explicit
empty-state message. Russian errors use fixed field-level descriptions and never
include raw records, credentials or stack traces. Analytics invokes no mutation.

Targeted verification covers mocked-transport page integration, auth route/shared
navigation, actual MUI charts at simulated narrow/wide sizes, and the existing
analytics model regressions. CI registers the explicit UI test paths alongside
the existing selected checks; the full Jest suite is not enabled.

## Limitations and decisions requiring approval

- Manual acceptance with real user-owned data has NOT been performed. Synthetic
  automated checks do not establish acceptance on a live account. Use the Russian
  [read-only manual checklist](financial-analytics-manual-qa.md) for the first review.
- Read-only source inspection of backend commit
  `b6cafc9559608ec0592b64bcd11bc10eb17dab8a` confirms both GET routes accept ISO
  `startDate`/`endDate` and `noPagination=true`; both controllers use inclusive
  `$gte`/`$lte`, scope by `req.user._id`, and return `page: 1`, document-count
  `total` and `limit` equal to the returned array length (including zero).
  Analytics sends neither month/year nor pagination parameters, so the routes'
  separate `year >= 2020` restriction is not applied to this adapter. Compatibility
  is established from source, not by running the API or inspecting stored data.
  Backend Number validation does not enforce two decimal places; historical
  unsupported precision can therefore legitimately stop analytics with an error.
- Existing transaction-list month/year filters use server-local boundaries and
  their displayed/CSV dates are localized in the browser. Their selected month
  is not automatically the same UTC interval as analytics. Reconciliation needs
  all relevant pages and original timestamps; the manual checklist documents the
  preconditions and an UNVERIFIED outcome when exact matching cannot be established.
- `noPagination=true` loads all matching documents into the browser. Long selected periods/large histories may require approved server aggregation or paginated processing later; no such API is added now.
- The category chart shows at most 12 largest categories; the table includes all categories. Missing/blank category is explicitly shown as `Без категории`.
- API completeness checks cannot detect a server that consistently omits records and reports an equally incorrect total. The two GET requests are not a transactional snapshot; simultaneous writes elsewhere can change the observed datasets.
- Before normalized indicators, approve treatment of loan principal, refunds, transfers, opening balances and account coverage. Before financial planning, approve classification ownership/history, planning periods, reserve accounting and persistence models.
- Future irregular-expense classification can be a separate explicit user-reviewed analytical dimension. It must not mutate existing category documents or silently reinterpret past transactions. New schemas/API contracts and any persistence of such decisions require approval.
- Next small iteration: review labels and UTC period behavior on real read-only data; agree on normalization of loan operations before adding normalized living-cost indicators. Phase 2 is not implemented.
