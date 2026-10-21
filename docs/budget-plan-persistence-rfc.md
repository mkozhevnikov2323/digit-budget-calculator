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
Classification H1–H10 and Option A races remain separate unresolved boundaries;
persisting a plan would not authorize classification writes or prove actual coverage.
