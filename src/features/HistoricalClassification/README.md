# Historical classification workflow (P1 → P5/P6/P7)

The operation selector explicitly loads bounded paginated owner-scoped period
history using existing expense/income GETs, page size100 and ceiling50000. It shares
P5's membership validator; only25 selectors render per page. Selecting an operation
issues one existing C3.2 GET, never annual N+1. Invalid or unavailable classification
is never silently treated as unreviewed.

Stable financial-classification-v1 role/dataset/layer compatibility is explicit.
Category, AI, recurrence and provisional choices never authorize a classification.
C3.2 status is labelled a separate observation, not authority over an older amount.
P7 real monetary reports instead require P5's coherent facts/status batch adapter.

P6 adds explicit server prepare, exact server-returned facts, separate final manual
confirmation, persistence acknowledgement and authoritative refetch. The original
local temporary confirmation alone never saves. See MANUAL_REVIEW.md for proof
privacy, session/in-flight guards, failure preservation and read-only reconciliation.
Proof/draft lifetime ends on selection/history/period/session/navigation changes.
Unknown outcomes never automatically create a new command.

H1–H10 and R1–R4 were explicitly approved in the owner's P5–P9 task. Backend routes
are implemented in separate PRs, default-off, with no production runtime/key/fleet
adapter installed. Approval to implement is not production operational readiness.
No financial source documents are rewritten. Option A's non-atomic/ABA, same-token
logout, current-record D7 and concurrent account/DDL limitations remain explicit.
