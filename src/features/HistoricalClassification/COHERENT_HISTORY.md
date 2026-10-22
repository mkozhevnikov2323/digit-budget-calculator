# P5 observed coherent history adapter

`getCoherentHistory` is an explicit owner/session/requestScope keyed query. It
uses existing paginated period GETs, then the separately enabled backend POST
`/classifications/history/read`. Every returned item is validated against its
requested dataset/id and exact window; facts and classification come from that
single server source observation. Private fingerprints are never accepted.

Page size100, maximum50000 records, batches100, concurrency4. All identities and
every batch must be accounted for; no silent truncation, duplicate or omission.
The final second complete period pass must match initial membership and observed
facts. Session changes/abort/failure/precision overflow invalidate everything.
Empty periods still need two complete empty list passes. Metadata alone is
insufficient. No rounding of unsupported binary64 values; the existing money
engine rejects such reports. Safe raw facts preserve negative zero, exact dates,
Unicode and missing/null/empty comments.

This is not an atomic annual snapshot, server revision, or proof of real-world
recording completeness. Changes after observation and A→B→A may be undetected.
The local observationId only binds this adapter's returned facts/decisions within
one report lifecycle. It is not cryptographic authority or a source digest.

Backend R1–R4 implementation and default-off gate must be available before this
query can succeed. No classification writes/proofs are introduced in P5. P7 will
connect this validated cohort to the existing statistics engine and user UI.
