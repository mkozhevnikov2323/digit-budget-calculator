# Validated classification snapshot adapter (synthetic integration only)

`buildClassificationSnapshots(input): SnapshotAdapterResult` is synchronous and
pure. It is deliberately unused by the application, AnalyticsPage and preview.
No fetching, React/Redux state, storage, clock, hashing, totals or financial
mutation is introduced. Existing Phase 1 validators and PR #12 contracts/resolver
remain unchanged. Tests use fictional API-shaped responses only.

## Input and result

`ClassificationSnapshotInput` supplies `expenseResponse` / `incomeResponse` as
unknown values, a `CalendarPeriod`, an explicit `ownerScope`, required `revisions`
and optional `categoryEvidence`. Use plain API-shaped data, not getters/proxies
or objects changing during the synchronous call. This is a caller precondition,
not a parser for arbitrary executable objects.

The adapter calls `validateExpenseResponse` and `validateIncomeResponse`. They
alone validate complete response metadata, IDs, amounts, precision, timestamps,
period membership and aggregate overflow. Their existing aggregate overflow
rejection remains a precondition, even though the adapter exposes no totals.
Only their checked `id/timestamp/kopecks/source` enter snapshots; raw amount/date
fields are never used to construct checked financial facts.

Success returns `{ ok: true, value: { revisionAuthority: 'caller_local',
expenses, incomes } }`. The separate readonly arrays contain existing
`CheckedOperationSnapshot` variants, sorted by code-unit transaction ID. Same IDs
in different collections remain independent. Contextual owner scope is not
authorization and does not verify ownership against raw fields or a server.

## Exact original category evidence

Original expense records are joined to validated records by validated ID using
Maps, never array position or dictionary-name lookup. Missing, undefined or null
category becomes `{ kind: 'absent' }`. Every string, including `''`, whitespace,
literal `Без категории`, Unicode and special object-property names, becomes
`{ kind: 'label', value: exactSourceString, dictionaryStatus: 'unresolved' }`.
No trim, normalization, role inference or foreign key is added. Phase 1 grouping
semantics are unaffected.

Optional `ExpenseCategoryEvidence` entries specify the full operation identity
(`dataset: 'expenses'`) and a `SourceCategory`. They must match the original
absent/label distinction and exact label. They can explicitly retain `ambiguous`
status; neither allowed status asserts a system/custom dictionary link. Missing
entries retain default unresolved provenance. Foreign, unknown, duplicate or
inconsistent entries fail; no evidence silently wins by order. Outputs copy
known fields, with no aliases to caller metadata or raw records.

## Local revision precondition and staleness

Each operation requires exactly one `LocalSnapshotRevision` descriptor:
`{ kind: 'caller_local', ownerScope, dataset, transactionId, revision }`.
Owner, ID and revision are nonempty opaque strings without whitespace, matching
PR #12 identity conventions. Duplicates (even identical), foreign owners,
unknown operations/collections and missing or malformed descriptors fail.
Empty complete datasets require an explicit empty revision list.

The snapshot revision string is copied exactly; it is never derived from ID,
index, order, time, updatedAt or a fabricated database version. The caller must
change it for every review-relevant change, including title/comment/recipient
not present in minimal checked facts. Snapshot comparisons in the resolver can
detect changed included facts or revisions; this adapter cannot prove that a
caller revision is current, correctly maintained or bound to a backend version.

The explicit input kind and result authority marker document this limitation;
the existing snapshot itself is structurally compatible, not an authorization
or persistence capability. Do not use it to enable persistent approval. A real
owner UI needs a separately agreed revision lifecycle, stale/refetch/session
handling, source provenance and review scope; persistent decisions additionally
need approved owner authorization, API/schema, audit and concurrency semantics.

## Failures and determinism

Failure is `{ ok: false, error }`, with no partial collections. Phase 1 codes,
dataset/index and monetary/calendar causes are preserved (e.g. `invalid_amount`
with `cause: 'unsupported_precision'`). Adapter failures are
`invalid_owner_scope`, `invalid_revision_metadata` and
`inconsistent_category_provenance`, with typed metadata reasons. Errors contain
no raw records, IDs, labels, revision strings or secrets.

Priority: owner validity, expense validation (including period), income
validation, revision metadata, category provenance. Successful output is
independent of record/metadata ordering and unrelated raw fields. If multiple
inputs are invalid, Phase 1 still reports the first invalid row and its original
index; error selection across unrelated failures is not order-independent.
