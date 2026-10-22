# P9 real-history recommendations and actual comparisons

Normal analytics keeps a single `BudgetPlanning realMode` workspace mounted outside
history loading/error conditions and keyed only to verified owner/session. Refresh,
new source data and selected-period changes remove old recommendations/comparisons
without rewriting the user's in-memory draft. Auth loss/close/reload deletes it.
No localStorage/sessionStorage, plan API writes or Mongo namespace is introduced.

P8 supplies suggestions bound to the exact currently accepted cohort. Their origin,
reference, partial-coverage/uncovered money and scenario assumptions are shown.
The user explicitly chooses the reference dates and separately reviews a suggestion.
`planFromRecordedHistory` revalidates original history through the existing P3
forecast engine and P4 plan validator. It fills only unprotected estimated layers;
any manual monthly/annual edit protects that whole layer, including explicit zero.
Goals/capital/reserve always remain manual. Imported layers are all protected.
Only an explicit new blank plan clears protection. No arrival/refetch applies a plan.

The existing budget-plan-v1 JSON shape is unchanged. Accepted real recommendations
become user-reviewed manual target values, not source/evidence authority. Memory
provenance is displayed, but export deliberately contains no completeness proof,
credential, source fingerprint or financial history. Imports require review; a
synthetic basis is never silently relabelled real or used for real comparisons.

`RecordedPlanActual` explicitly loads the complete selected plan year using P5,
then asks separately for recording evidence on elapsed complete months. The
unchanged P4 comparison engine requires approved classifications for every expense
in those months. Current/future months, reserves and non-consumption roles are
excluded. It shows per-layer plan/actual/variance, remaining scheduled budget and
remaining annual target. Any missing recording/classification evidence or failed
coherent read hides complete comparison; unknown money is never zero-filled.
Refresh discards evidence/comparison and preserves plan fields. No actual expense
is created automatically. The underlying reads remain observed-only/non-atomic.

BP1–BP6 remain pending. See docs/budget-plan-persistence-rfc.md for the concrete
proposed document/index/HTTP/CAS/idempotency/erasure/backup/migration/rollback
contracts. They are review material only: no plan collection, schema, index,
migration, server storage or deployment is implemented by this stage.
