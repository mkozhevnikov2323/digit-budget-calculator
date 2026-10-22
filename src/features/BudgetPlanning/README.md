# P4/P9: local annual planning workspace

Normal analytics now uses the P9 real-history recommendation/actual adapter.
See [RECORDED_HISTORY.md](RECORDED_HISTORY.md) for manual-layer protection,
recording evidence, draft retention across refresh and operational boundaries.

The workspace on analytics is opt-in, in memory only, within the currently verified
owner/session subtree. Close/reload/unmount/logout/verification loss deletes it.
No localStorage, sessionStorage, database, automatic upload or mutation is used.
No new financial transaction/classification is generated. No forecast or new
expense silently edits an existing plan.

budget-plan-v1 includes manual/synthetic_suggestion provenance, planning year,
historical reference dates, twelve safe nonnegative integer-kopeck values for each
stable ordinary-expense layer, and a separate twelve-month reserve allocation.
Every import/operation validates the closed complete schema and safe aggregate
range. Historical reference must precede the planning year; it is a user-selected
reference, not evidence that a report exists or is complete.

Annual allocation divides exact kopecks by 12 and assigns remainder kopecks to
earliest months. Monthly edits retain all other values and never mutate sources.
Expense targets, reserves and combined resource allocation remain distinct.
Reserve is not actual expense. Non-living roles/loan flows are excluded from
consumption comparison. Forecast suggestions are copied only on explicit action;
fictional suggestions permanently retain their provenance in exported plans.

Actual comparison requires the complete P2 cohort for the planning year, complete
recording and approved classifications for each elapsed full month, observed after
those months ended. Current/future months are excluded. Missing data fails closed,
never becomes zero. Variance = actual minus planned; positive means over target.
Remaining scheduled allocation = annual targets minus elapsed scheduled targets;
remaining against annual target = annual targets minus elapsed actual (can be
negative). Neither calculation changes the plan or subtracts reserves twice.

Real comparisons use the P5/P7 coherent adapter plus explicit ephemeral recording
evidence. The standalone no-props component retains its isolated fictional test
example; normal analytics realMode does not expose or mix it with real reports.

JSON export is a deliberate click followed by user copying the generated text.
Import requires an explicit replacement action, accepts at most 65,536 characters,
rejects duplicate keys, noncanonical escapes/numeric representations, extra fields,
unsupported versions, invalid dates/amounts and overflow. Whitespace/property order
can vary. Failure preserves the original draft and input. Invalid manual amounts
remain visible, suppress totals/export and are never rounded. No plaintext import
or financial value is logged. Exported files contain financial targets, not anonymous
data; they are never transmitted automatically.

Durable server storage is not implemented or approved. See the separate proposed
[persistence RFC](../../../docs/budget-plan-persistence-rfc.md). H1–H10/R1–R4
classification implementation was approved separately; production operational
readiness remains gated. BP1–BP6 are still pending.
