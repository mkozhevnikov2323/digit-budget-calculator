# P3: transparent historical expense-component estimates

forecastExpenses revalidates the complete P2 cohort; it never trusts precomputed
client totals. Exactly 12 consecutive fully selected elapsed months, explicit
complete recording evidence and a trusted asOf time are required. Missing/current/
partial/unverified months do not become zeroes. Explicitly complete zero-valued
records are valid; empty/no-confirmed-spending history is unavailable.

Each stable ordinary_expense layer includes mean, median, min/max, range and recent
six-month mean minus prior six-month mean. All original outliers stay in history.
everyday estimate uses the median of all twelve monthly sums. Irregular/emergency
use annual historical sum / 12 as a **historical allocation**, not event prediction.
major_goals/long_term_capital require a user target; no recurring forecast is invented.
Non-spending roles and income flows are separate indicators, never living costs.

Mean/median/scenario derived estimates explicitly round nearest kopeck, half up
(signed trend half away from zero), using BigInt arithmetic. No source is rounded.
Projection = 12 x rounded monthly estimate; summed components reconcile and overflow
fails closed. Optional integer adjustmentBasisPoints [-10000,100000] is a user
scenario, not verified prediction. No confidence interval, ML/provider or background
service exists. Adjacent full-year comparison validates owner/period eligibility.

Partial classification is labelled partial with uncovered amount/count, never a
full budget requirement. Even complete classification forecasts only historical
components, not an all-inclusive future need. Legitimate zero versus missing history
depends on trusted recording evidence; current raw GETs cannot establish this.
The analytics UI therefore exposes only an explicitly selected fictional demo.
Real estimates await the approved coherent read/recording coverage adapter (P1/P2).
