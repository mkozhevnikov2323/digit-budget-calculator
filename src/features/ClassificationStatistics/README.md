# P2: classified historical accounting

Reuses Phase 1 calendar/money primitives and P1's stable C3.2 DTO validator.
Input is closed unknown data, a canonical period, trusted owner-scoped operations
and one decision for each operation, bound by sourceObservationId. This ID is a
caller-established coherent observation, not an authority created by this module.
The current API cannot supply it; origin=coherent_adapter is only a future internal
port, never a client option/API feature. Only synthetic fixtures are wired to UI.

Each expense/income enters exactly one of six statuses. Only approved assignments
enter role totals; only ordinary_expense enters layers. Layers/roles/statuses are
alternative views, not amounts to add together. Loan/transfer/capital flows stay
inside recorded cash flow and outside ordinary living expenses. Every dataset's
status amount/count sum equals recorded amount/count; monthly sums reconcile too.
Money uses safe integer kopecks with checked BigInt intermediates and no rounding.
Coverage is approved count/amount divided by recorded count/amount; zero denominator
is null (undefined), not invented 100%.

Missing/duplicate/foreign decisions, observation mismatch, bad taxonomy/input or
overflow return safe errors without partial totals. Bounds: 50,000 operations and
120 months; arrays reject holes/accessors/extra properties. Monthly recording
evidence distinguishes complete/missing/unverified independently from elapsed
calendar time. Empty recorded months are not assumed real zero-spending months.

Analytics exposes an explicitly selected fictional 2025 example, separate from
real recorded analytics. Real classification reports remain unavailable until an
approved coherent owner-scoped complete read boundary exists. No HTTP write,
new backend API, persistence, source modification or H1–H10 approval is implied.
