# P8 recording evidence and real historical estimates

The normal analytics page renders `RealExpenseForecast` from the accepted P5
cohort, not the standalone fictional example. `recordingEvidenceInput` feeds the
unchanged P3 forecast engine. Unsupported money never gets rounded into eligible
history. Source facts/classifications are never modified.

Calendar elapsedness is distinct from recordkeeping completeness. Every fully
selected elapsed month requires explicit user confirmation, including empty months.
Nothing is inferred from nonempty lists, API completeness or classification coverage.
Confirmation is memory-only and bound to the exact accepted cohort; refresh/source/
session/period changes invalidate it. It is neither server authority nor cryptographic
proof. Durable evidence would need separate schema/privacy/retention approval.
Twelve confirmed elapsed months and some approved ordinary spending are required.
Empty history cannot fabricate a forecast.

The original engine calculates monthly everyday median, means/variation/half-year
trend, irregular/emergency annual historical allocation, user scenario adjustment
and derived-only nearest-kopeck rounding. Goals/capital still require manual targets.
Coverage by count/amount and uncovered money remain visible; zero monetary denominator
is undefined, not invented100%. Partial classification produces only qualified
confirmed-component estimates, never a complete necessary budget.

Previous-year comparison explicitly loads another bounded coherent annual cohort
and requires separate month confirmations. Only adjacent comparable complete years
pass the original helper. Differences in classification coverage remain a caveat;
confirmed-component changes are not an unbiased spending/price trend.

The optional `onCalculated` internal port supplies an eligible observed suggestion
for P9 after explicit calculation, and clears it on evidence/scenario edits.
Consumers must bind it to the same accepted cohort; it is not persistent authority.
No AI/ML/provider, dependency, browser storage, Mongo schema or deployment.
