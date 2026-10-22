# P1: historical/manual review, no persistence

The analytics section explicitly loads full owned history using existing expense /
income GETs and Phase 1 completeness/money/UTC validation. Additional raw source
fields are checked; foreign owner or malformed/missing facts fail closed. Only 25
operation selectors render per page; selecting one issues one existing C3.2 GET.
No annual automatic N+1 fanout, backend change or new public endpoint is introduced.
History covers any selected period, including newly recorded operations on refetch.

Stable financial-classification-v1 D3 role/dataset/layer policy is represented
explicitly. Provisional preview decisions/rules never supply server authority.
Six authoritative status observations stay distinct; failure/503/404 never becomes
unreviewed. Owner/generation/request lifecycle scope is a cache/UI identity, not
server authorization. Existing JWT/baseQuery authorizes the server request.

The review presents all returned raw financial fields, a deliberate choice and
separate manual confirmation. It is **only in-memory**. Save is permanently disabled:
no mutation endpoint, proof, localStorage/sessionStorage or server write exists.
Selection/history refresh/period/session changes discard drafts; callbacks cannot
resume a retired UI. CAS, lost acknowledgements, duplicate-save protection and
reclassification persistence still require the approved server write protocol.

## Exact blockers for real reporting and writes

H1–H10 in the backend RFC remain PENDING: AEAD choice; three HTTP DTOs/endpoints;
TTL/recovery; fleet nonce/key/time/era coordination; session/logout limitations;
account/exp eligibility; exact display/privacy; UI/parser/Origin/cache/rate controls;
operational readiness/rollout; production implementation and T01–T39 authorization.
No server key, read/write gate, collection or migration is configured here.

C3.2 GET has no source facts/fingerprint/revision. A fresh approved response cannot
prove that a separately fetched history amount is the same source observation.
Therefore **never join it into monetary classification reports**. Source changes
and A→B→A races remain; the selected decision is labelled a separate observation.
Future real reporting requires an approved owner-scoped coherent facts+classification
read adapter/API. Proposed bounded batch request: version, UTC period, at most 100
operation identities and explicit pagination/snapshot continuity; response must bind
each validated owned source snapshot to its classification, include completeness /
continuation metadata, reject duplicates/foreign/missing identities and preserve
Option A observed-only semantics. Exact shape, size limits, consistency, readiness,
no-store, error/cleanup behavior need a separate backend RFC/implementation PR;
this frontend does not activate an unapproved public API or pretend a batch exists.
