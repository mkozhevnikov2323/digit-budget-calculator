# Financial analytics foundation — Phase 1

## Definitions

- Recorded operations are existing `Income` and `Expense` documents. The page counts every separate expense document once, including units created by bulk entry. It does not infer quantities.
- Recorded inflows/outflows and their arithmetic difference are not earned income, cost of living, bank balance, savings or free cash flow.
- Loan issuance is an expense in `Выдача займа`; repayment is income with source `Возврат займа`. Both remain included and explicitly disclosed. They represent changes in a receivable as well as recorded cash movements, not ordinary consumption/earnings.
- Categories describe transaction purpose. The five future financial layers describe money's role: everyday spending, irregular obligations, emergency fund, major goals and long-term capital. No category-to-layer mapping exists in this phase.
- Actual expenses are already recorded operations. Planned expenses are future obligations, not existing `Expense` documents. Reserving money is an allocation, not an actual expense; treating it as another expense would double count when the purchase occurs.
- `controllers/balance.js` computes lifetime recorded income minus recorded expense for the authenticated owner. It has no account balances, opening balances or transfer model, so it is not necessarily a bank account balance.

## Implementation and date policy

`pages/AnalyticsPage/model` contains pure period and aggregation functions; the page fetches each dataset once using the existing date-scoped RTK Query GET hooks and passes derived results to UI components. Existing charts, mutations and schemas are unchanged.

Backend inspection: both models store MongoDB `Date`; both create controllers pass the submitted date through Mongoose; both range filters use `$gte` / `$lte` and scope reads to `req.user._id`. Existing frontend date defaults use `toISOString().slice(0, 10)`; edit forms likewise use the first 10 ISO characters. Manual date-only input therefore represents UTC midnight.

Analytics uses explicit UTC calendar boundaries for both datasets: `startDate=YYYY-MM-DDT00:00:00.000Z`, `endDate=YYYY-MM-DDT23:59:59.999Z`. A timestamp later on the last day is included; the next UTC day is excluded. Buckets use the UTC date of each persisted instant, including any legacy offset timestamps. Month/year filters on the backend use server-local `Date` constructors, and old charts format dates locally: analytics deliberately does not use those filters/charts. UTC is visible on the page. Adopting a user's local calendar/timezone across historical data requires an explicit business decision.

Months, quarters and years are calendar periods, not rolling durations. Custom ranges of up to 62 inclusive days use daily buckets; longer ranges and all quarters/years use monthly buckets, including zero buckets. ISO keys are chronological; locale text is never used for sorting.

Persisted amounts must be finite nonnegative Numbers. Their decimal string representation is rounded half-up to integer kopecks with BigInt, including scientific notation. Sums remain safe integers; invalid amounts, overflow, duplicate IDs, out-of-range dates and incomplete response metadata stop reporting instead of becoming zero. Display formatting alone uses rubles. Percentages are nonmonetary ratios and may round to a combined value slightly different from 100%.

Loading, API failures and absent/current-period data are distinct from a successfully returned empty dataset. `currentData` prevents reporting stale data from another period. No mutation is invoked by analytics.

## Limitations and decisions requiring approval

- `noPagination=true` loads all matching documents into the browser. Long selected periods/large histories may require approved server aggregation or paginated processing later; no such API is added now.
- The category chart shows at most 12 largest categories; the table includes all categories. Missing/blank category is explicitly shown as `Без категории`.
- API completeness checks cannot detect a server that consistently omits records and reports an equally incorrect total. The two GET requests are not a transactional snapshot; simultaneous writes elsewhere can change the observed datasets.
- Before normalized indicators, approve treatment of loan principal, refunds, transfers, opening balances and account coverage. Before financial planning, approve classification ownership/history, planning periods, reserve accounting and persistence models.
- Future irregular-expense classification can be a separate explicit user-reviewed analytical dimension. It must not mutate existing category documents or silently reinterpret past transactions. New schemas/API contracts and any persistence of such decisions require approval.
- Next small iteration: review labels and UTC period behavior on real read-only data; agree on normalization of loan operations before adding normalized living-cost indicators. Phase 2 is not implemented.
