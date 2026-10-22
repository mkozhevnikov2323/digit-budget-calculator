# P6 persistent manual classification

The selected operation's validated GET revision is used to prepare an explicit
stable manual intent. The server returns its exact owned facts and sealed proof.
The UI renders raw round-trip amount, full UTC milliseconds, escaped exact strings,
tagged comments and the proposed decision before a separate final checkbox/action.
An old local preview/temporary confirmation is never sufficient for persistence.

Proofs, pending command and reviewed facts remain in component memory only.
`manualClient` uses ephemeral fetch outside Redux/RTK actions/cache, preserves the
existing exact bearer/session observer boundary, no-store and no credentials in
URLs. The shared API base URL is reused. There is no browser storage/persistence
or production secret in this feature.

A synchronous in-flight guard prevents double-click sends. Only a strictly
validated server acknowledgement or latest_applied receipt reports success; then
Expense/Income RTK tags and the authoritative selected GET are refreshed.
On conflict/failure the user's selected draft remains. Unknown acknowledgement
disables new prepare/apply and offers only explicit read-only reconciliation of
the exact pending command. No automatic retry/new request ID or proof refresh.
Expired proof is never reauthorized for apply. Reconcile indeterminate is not
proof of rollback/non-execution. Navigation/unmount loses memory-only recovery;
session changes/page restoration purge proofs and suppress stale callbacks.

Backend P6 depends on backend P5 and an explicitly installed safe runtime. All
three backend gates are default-off; flags alone cannot enable production writes.
Keyring/fleet governance/clock/DDL readiness remain operational blockers. Isolated
tests exercise the complete backend HTTP persistence cycle using disposable keys
and real guarded test MongoDB. Current-record D7, source ABA/non-atomic races,
same-token logout and concurrent account erasure retain the approved limitations.

The CI branch filter includes the named parent branches for this finite PR stack
so each focused PR receives actual Node22 build/critical tests without merging
parents or disguising a main-only unrun stacked job as passed. No checks removed.
