# Proposed budget-plan persistence — requires owner approval

Status: design only. No collection/schema/index/API/migration/deployment implemented.
Local versioned export/import remains the working persistence alternative.

Problem: memory drafts disappear on reload/session loss; plain exports cannot offer
cross-device storage, server-side authorization, conflict resolution or erasure.

Smallest proposed model: one independently owner-scoped plan document containing
server plan ID, planning year, historical reference, manual/synthetic basis, validated
monthly layer targets and separate reserve schedule, positive safe revision and
server timestamps. Reuse budget-plan-v1 validation; do not add fields to expense,
income or classification documents. A plan is a target, never a financial operation.

Proposed future API should authenticate via the existing verified server boundary,
derive owner exclusively from it, scope every read/write/delete by owner+planId,
use strict DTO/size/version/money validation and no-store, and require CAS for edits.
New submissions need bounded request-id reconciliation and unknown-commit handling;
UI must preserve failed edits and avoid duplicate-plan retries. No endpoint is
selected/activated by this RFC. Local synthetic provenance must survive import/save.

Alternatives: keep explicit local exports (no new server surface), a user-approved
encrypted local store (new privacy/lifecycle decision), or the proposed server model
(durability with additional operational/auth/CAS obligations). Do not silently use
browser persistence, reuse classification collections or auto-install a collection.

Pending owner decisions:

| ID | Required decision |
| --- | --- |
| BP1 | Whether durable storage is needed; collection, retention, multiple plans per year and canonical-plan selection |
| BP2 | Exact document/DTO versions, max size/values, unique owner/plan identity index and MongoDB validator |
| BP3 | HTTP endpoints, authenticated account eligibility, CAS/idempotency/unknown-result contracts |
| BP4 | Account erasure, backup/restore/ID reuse, permissions, export/privacy/at-rest policy |
| BP5 | Reviewed migration, default-off rollout, readiness, drain, rollback without deleting plans |
| BP6 | Synthetic owner-isolation/concurrency/cleanup/compatibility verification and frontend save authorization |

Migration must first verify namespace/version/privileges and tested backups, install
only an approved plan validator/index in an isolated test environment, and test
rollback/erasure before production approval. No historical financial data migration
is necessary or permitted. Real plans/history must never enter tests or PR examples.
Classification H1–H10/R1–R4 implementation was approved separately in P5–P9.
Their production operational gates and Option A limitations remain independent;
persisting a plan would not prove source consistency or actual recording coverage.

## P9 concrete proposal for BP1–BP6 review (NOT IMPLEMENTED)

The following is one proposed contract, not authorization or an installed namespace.
Collection name proposal: `budget_plans`, separate from sources/classifications.
Native `_id` remains canonical ObjectId. Proposed closed document:

```text
{_id:ObjectId,owner:ObjectId,plan:<validated budget-plan-v1>,
 decisionRevision:positive safe integer,
 creationRequestId:canonical UUID-v4,creationHash:private versioned SHA-256,
 lastMutation:{requestId:canonical UUID-v4,commandHash:private versioned SHA-256},
 createdAt:Date,updatedAt:Date}
```

`plan` retains the existing export fields: year, reference inclusive calendar dates,
manual/synthetic_suggestion basis, exactly five layer arrays of12 nonnegative safe
integer kopecks and a separate12-value reserve schedule. Reference must precede
planning year; checked aggregate cannot exceed the existing safe money boundary.
No source facts, proof tokens, recording attestations or classification authority
are embedded. A user-accepted real-history suggestion is a manual target plan;
an imported synthetic basis must stay synthetic. Future schema/version changes
need explicit BP2 compatibility approval, not permissive unknown-field acceptance.

Proposed indexes, subject to BP1/BP2: existing `_id`, unique simple-collation
`{owner:1,creationRequestId:1}` for bounded create reconciliation, and optional
`{owner:1,'plan.year':1,_id:1}` for bounded list reads. No unique owner/year index
until multiple plans/canonical selection is decided. Exact strict validator and
index manifest require independent fixtures/readiness checks, never startup repair.

Proposed HTTP version `budget-plan-write-v1`, maximum65536 decoded UTF-8 bytes,
closed JSON/UUID/money/date validation, duplicate-key rejection, no-store and the
approved authenticated-account boundary. Caller owner is forbidden everywhere:

| Method / path | Proposed contract |
| --- | --- |
| POST `/budget-plans` | `{version,requestId,plan}`;201 new,200 same owner/create ID+hash replay,409 same ID/different intent; server assigns planId/revision1 |
| GET `/budget-plans` | Owner-scoped list, optional year, bounded limit1–50 and validated continuation; no unbounded export |
| GET `/budget-plans/:planId` | Strict safe DTO, revision, no private hashes/raw BSON; uniform404 missing/foreign |
| PATCH `/budget-plans/:planId` | `{version,requestId,expectedRevision,plan}` full validated replacement of targets; owner+ID+revision CAS,200 ack,409 conflict; no silent rebase |
| POST `/budget-plans/:planId/reconcile` | Read-only exact owner/request intent check, latest_applied/indeterminate/conflict; never execute on recovery |
| DELETE `/budget-plans/:planId` | Explicit revision/confirmation policy still BP3; uniform private missing/foreign behavior; must not resurrect a plan after uncertain acknowledgement |

Update replay is bounded by latest lastMutation; intervening edits/erasure/restore
can make an old outcome indeterminate. Create dedup survives updates only while
that document/creationRequestId exists; deletion/retention ends it. This is not an
unbounded exactly-once ledger. Stronger guarantees require a separately approved
storage/retention design. Never automatically recreate with a new ID after an
unknown response. Server receipts are not proof that a human reviewed targets.

BP4 proposal: owner-scoped account-erasure workflow covering plans and backup
retention, least-privilege DB roles, encrypted backups, restore drills and explicit
retention/at-rest/export policy. Erasure and ID reuse need a writer drain; restored
receipts do not prove uninterrupted execution history. No TTL deletion until owner
approves retention. Logs must exclude targets, bodies, hashes and private failures.

BP5 proposal: preflight verified backup/restore and namespace privileges; install
only the approved validator/index manifest through a reviewed migration; fixture
owner/CAS/unknown-outcome/erasure tests; default-off server write/read gates;
readiness checks; staged reviewed rollout. Rollback disables/drains writers and
keeps existing documents readable/exportable under the prior compatible version;
never drop the collection or rewrite source history. No migration is run by P9.

BP6 acceptance proposal: two-owner CRUD/list isolation,100 concurrent CAS contenders
with bounded fixtures, create/update response loss, current-record replay limits,
bad metadata/validator/index readiness, import/version compatibility, erasure and
restore simulations, no financial DML/DDL and mandatory disposable DB cleanup.
Frontend server-save controls require a new explicit implementation approval.
