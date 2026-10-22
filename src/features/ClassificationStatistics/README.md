# Recorded classification statistics (P2 engine, P5/P7 adapter)

The normal `/analytics` page explicitly loads the selected real period through
`getCoherentHistory`. `recordedHistoryInput` maps only the accepted same-observation
cohort into the existing P2 pure engine. No separately loaded C3.2 GET is joined
with historical money. The synthetic example remains an isolated no-period
component/test fixture and is not mixed into the real report.

Each expense/income belongs to exactly one of approved/unreviewed/stale/blocked/
explicit_unclassified/cleared. Only approved assignments enter roles, and only
ordinary_expense enters layers. Status and role views are not added together.
The existing safe integer-kopeck engine reconciles period/month/dataset amount
and count totals; zero coverage denominator is null. No rounding or category-based
classification. Category distribution is a separate exact-string partition,
checked against the same validated recorded expense total.

Bounded P5 membership and batch checks precede reports. Missing/duplicate/foreign
items, unsupported precision, changed facts/membership, failed batches, session
transition or refresh invalidate the entire report. No cached previous-period
report is displayed while fetching. Classification writes invalidate existing
Expense/Income tags, refreshing the active aggregate and discarding prior evidence.
The operation selector now shares the bounded paginated membership helper rather
than downloading unbounded noPagination lists.

Three independent properties remain explicit: complete response for stored records,
classification coverage, and real-world recording completeness. No nonempty/empty
month is automatically attested. P8 may accept explicit ephemeral user evidence;
a checkbox is not cryptographic server proof. Multiple observations are non-atomic;
A→B→A and later source/decision changes can escape detection. No new source revision,
transaction, source mutation, persistent attestation or plan collection is added.

Backend P5 must be reviewed/available with its default-off history read gate.
Backend P6 writes additionally require approved real operational key/fleet/readiness
wiring; the frontend cannot enable these production capabilities.
