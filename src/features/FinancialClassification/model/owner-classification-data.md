# Owner classification data hook (PR #20, not mounted)

`useOwnerClassificationData(period: CalendarPeriod | null): OwnerClassificationData`
is a read-only integration foundation. No application page, route, provider,
barrel or production consumer imports it. It creates no decisions, suggestions,
drafts, totals, persistence, new API or mutations. Use one coordinator per future
review composition and pass its result to children, as specified in the owner RFC.

## Contract and scope

- `blocked`: static reason `unauthenticated`, `verifying`, `verification_error` or
  `invalid_period`; no financial requests until owner verification and valid month.
- `loading` / `fetching`: no records, previous context or approval candidates.
- `error`: existing payload-free `SnapshotAdapterError` and explicit `retry()`.
  Repeated retry clicks coalesce into one round; no automatic retry loop.
- `ready`: existing readonly `ClassificationSnapshots` in `data` and readonly
  `context: { userId, sessionGeneration, periodKey, loadGeneration }`.
  Only this state contains records; `data.revisionAuthority` is `caller_local`.

Owner comes exclusively from `useVerifiedOwner`, never caller props, email, JWT
decode or operation content. PR #17–19 keep their existing responsibilities and
limitations. No second authentication generation or independent auth framework.
Only a complete canonical UTC month is supported: compare against `monthPeriod`,
then use `toAnalyticsQueryParams` for both GETs. No inferred current month, host
timezone, arbitrary range, filtering, pagination or truncation is introduced.
UTC/month restriction remains provisional, not an approved product timezone policy.

## Paired request coordinator

The existing `useGetExpensesQuery` / `useGetIncomesQuery` own subscriptions and
cache reuse. No second slice/endpoint/fetch, lazy-query duplicate or custom query
key. A local metadata coordinator is the sole source of forced refreshes; do not
also enable unconditional refetch-on-mount in this composition.

Installed RTK Query 2.8.2 serializes endpoint/args, deduplicates pending requests,
and can return an initiation handle whose attempted requestId differs from the
actual cache requestId. Its promise selects the shared cache at completion.
Therefore the coordinator reads actual endpoint selectors for the exact current
args (the data underlying `currentData`), not promise data or hook `data` fallback.
Only projected status/requestId/data enters local tracking; HTTP error bodies,
Request/Response metadata and authentication headers are not exposed.

1. New owner/session/month/verification entry gets a fresh local round. A rendered
   A/B/A context is remembered before commit, so matching a previously used string
   key cannot revive its publication. Render-time metadata/context guards close
   ready before cleanup/coordinator effects run.
2. Already-pending identical current-context requests can be shared. Fulfilled
   cached entries never open a new lifecycle alone: force one fresh request each.
   Request IDs belonging to a retired pending round cannot be adopted; wait for
   them to settle, then obtain a fresh response. Tracking retains only pending
   metadata selectors and prunes settled entries, not a history of raw records.
3. Assign each endpoint one expected actual requestId per round. A new external
   request, including a tag-triggered or already completed fast refresh, invalidates
   the pair. A fresh pending/new-ID response can seed the new round; the unchanged
   counterpart requires its own fresh GET. A counterpart still pending from the
   retired round must settle before a replacement can be started.
4. All expected responses must be fulfilled for the same current context, with no
   partial publication. Structural sharing of identical payloads cannot preserve
   old revisions: new request IDs create a fresh round regardless of data identity.
   Data reference changes additionally detect cache edits, not proof of a refresh.
5. A failed endpoint closes the whole pair with a static dataset error. A slow
   counterpart settling does not auto-retry the failure. Explicit retry starts
   one new pair. Each completed round is validated/published once; unrelated
   renders do only small metadata checks, without revalidating financial arrays.

No timers or polling drive pairing. No shared request is aborted by this hook.
A retired request that never settles can delay a fresh round; there is no new
timeout/cancellation policy here. This fails closed and needs an explicit future
availability decision if adopted in a user-facing page.

## Checked facts, revisions and provenance

Call both existing Phase 1 response validators before constructing any revision
descriptors. Descriptors cover only validated IDs, with full owner/dataset/ID
identity, `kind: caller_local` and the current load-generation string. Feed the
original complete responses and descriptors through the unchanged snapshot adapter,
including its own repeated validation. Any failure blocks both collections.

`loadGeneration` combines a React hook-instance identity and a local round sequence;
it changes on context invalidation, detected refresh and explicit retry, including
identical financial content. It is ephemeral association metadata, not a server
version, audit record, timestamp, transaction revision or persistent decision token.
It is not derived from IDs, positions, dates, amounts, updatedAt or __v.

Adapter joins exact original expense categories by validated ID. Missing/null,
literal `Без категории`, empty/whitespace and Unicode labels stay distinct.
Optional category evidence is omitted: strings remain `dictionaryStatus: unresolved`.
Income/expense IDs can coincide without merging their identities. No grouping,
dictionary FK, economic-role inference, rounding or monetary/calendar rule changes.

## Automated evidence and remaining release gates

The new suite uses real root reducers, middleware/endpoints, UserProvider, verified
owner and session transport, with fictional GET-only HTTP. It covers identity and
period gating, complete paired loading, errors/retry, precise validation, empty
sets, category provenance, fulfilled/pending cache reuse, month and owner ABA,
same-owner login, observed cross-tab logout, late old success/401/403, owner
revalidation, either-endpoint/tag refresh, repeated refresh while a counterpart
is pending, structural sharing, bounded GET counts and no snapshot persistence.
The real adapter is not mocked; frozen fixtures and existing adapter/validation,
period, analytics-hook and PR #17–19 regression suites are also verified.

Two GETs are **not an atomic database snapshot**. Complete metadata proves only
the current validators' completeness contract, not server correctness, simultaneous
reading or global freshness. A month bounds dates, not record count: maximum monthly
volume/memory/CPU limits need separate product approval before a user-facing page.
No arbitrary cap or silent truncation is adopted.

Production `/users/me`, backend owner authorization and multi-process browser
acceptance remain **UNVERIFIED**. PR #19 asynchronous observation and non-atomic
shared-storage limits remain unchanged. Future review UI, product choices,
authorized backend acceptance and any decision persistence need separate requests.
Do not treat successful fictional tests as deployment or personal-data acceptance.
