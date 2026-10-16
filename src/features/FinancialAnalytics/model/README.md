# Analytics data and calculation layer

Adapted selectively from `feat/financial-analytics-foundation` at
`84b05157f0feaac3a9fdb36cb5057e8de7b022fe`. No legacy page or route is included.

- `toAnalyticsQueryParams` validates a `CalendarPeriod` using `customPeriod` and
  maps its half-open UTC interval to the existing inclusive API end (`end - 1ms`).
- `validateExpenseResponse` / `validateIncomeResponse` accept unknown API payloads,
  require complete arrays (`total` is a document count), page 1 and an integer
  limit at least as large as the array. Empty arrays may have limit 0 or larger.
  IDs are nonempty opaque strings without whitespace, unique within a dataset.
  Consumed fields are checked: ID, date, numeric amount, optional expense category,
  and required income source. Other detail fields are not used for analytics.
- Dates accept canonical calendar dates or explicit-zone ISO timestamps with
  millisecond-or-lower precision; nonexistent dates and local/ambiguous timestamp
  strings fail. Membership uses instants, not the date prefix. UTC month buckets
  do not alter stored instants. UTC remains a provisional reporting convention.
- `buildAnalytics` validates both responses and returns complete totals, counts,
  all categories and zero-filled monthly expense dynamics, or an explicit error
  without partial totals. The existing `money.ts` is the only money engine:
  `1.005` fails, zero is valid, overflow fails. Display formatting remains in
  `formatKopecks`; no formatter or rounding policy is copied from legacy code.
- Category whitespace is trimmed for grouping only; absent/blank labels use
  `Без категории` (grouped with a literal category of that name). Map keys are safe
  for names such as `constructor`. Equal totals sort by code-unit name order,
  independent of host locale. Shares are unrounded nonmonetary percentages;
  their zero-total value is 0, not a division-by-zero result.
- Loan issuance/repayment stay in raw totals. Additional loan subtotals use exact
  original labels `Выдача займа` / `Возврат займа`; no contract inference occurs.
- `useFinancialAnalytics` reuses existing GET endpoints with identical params and
  `noPagination: true`. It returns loading/fetching/error/ready states; only ready
  has data. It uses `currentData`, blocks invalid-period requests with `skipToken`,
  and hides results during refetch. Existing cache keys/tags handle reuse and
  invalidation; no new store or application credentials are introduced.

Limits: complete metadata cannot prove the server has not consistently omitted
records. The two GETs are not an atomic snapshot during concurrent writes.
Unpaginated periods can be large; server aggregation needs separate approval.
Legacy half-up rounding, a second calendar engine, daily/chart logic and the UI
are intentionally excluded. No product normalization or next-page PR is implied.
