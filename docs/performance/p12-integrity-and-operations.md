# P12 integrity, resource budgets and operating limits

Parent: frontend main `0c9d02e6e637ee079fb271cb6487755370e952c8`.
Depends on backend [PR #35](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/pull/35)
at immutable `6ca6892d1fa839c7d229ea740c944bc854ed1234`; review/merge that
test-only foundation first. Baseline provenance and raw measurements are in
`p12-baseline.md`. Production classification activation remains unapproved.

## Small production changes and preserved boundaries

- Validate one bounded classification batch through the SAME owned-history,
  complete-envelope, money, date, owner and identity validators. The before and
  after membership passes still validate the full cohort. Calls fall from N+2
  to ceil(N/100)+2; every operation still crosses all validators.
- Compare the exact validated immutable fact fields directly instead of creating
  two JSON strings for every comparison. Object.is preserves binary64 negative
  zero; own comment presence, null, empty strings and Unicode stay distinct.
- Stop scheduling future batches after any worker failure. At most four already
  in-flight calls can finish; there is no claim of cancelling admitted MongoDB work.
- Reject the combined 50,001+ total as soon as second-dataset metadata proves it,
  without downloading the remaining pages. No partial report is accepted.
- A private category reconciler shares the current report's validated statistics.
  The UI memoizes only by its own cohort object. No cross-owner/global cache,
  persistent financial browser storage, or caller-supplied aggregate authority.
  Forecast/evidence/plan validation is deliberately retained at its trust boundary.

HTTP endpoints, query parameters, sorting, source amounts, domain policy, schema,
indexes, proofs, CAS/idempotency, authentication and backend limits are unchanged.
No production backend optimization was justified without the separate source
index decision; changing hydration/readiness/pagination was deliberately deferred.

## 23-scenario consistency matrix

`U` = deterministic adapter unit case in `performanceIntegrity.test.ts` (existing
`coherentHistory.test.ts` retained); `M` = real Express/MongoDB suite in backend
P12 or existing P5/P11; `B` = real Chromium/Vite/Express/MongoDB P12 browser case.
Delivery gates in browser cases delay an actual fetch response; they do not
replace its body, status, authentication or persistence. No HTTP response mock is
used for primary benchmark/integration paths.

| # | Controlled scenario | Strongest verified behavior / limit | Coverage |
|---|---|---|---|
| 1 | Expense inserted between pages | Changed total/identity coverage rejects the entire cohort | U |
| 2 | Expense deleted between pages | Changed total or short page rejects | U, M deletion |
| 3 | Expense amount edited during load | Observed exact mismatch rejects; no rounding | U, M, B01/B06 |
| 4 | Income edited | Same exact-fact rule, stale decision against new observation | U, M |
| 5 | Operation enters period | Final membership difference rejects | U |
| 6 | Operation leaves period | Period/final-membership or server 409 rejects | U, M |
| 7 | Category/title/recipient/source edited | Any observed exact string mismatch rejects | U |
| 8 | Equal-date page tie | Distinct createdAt + full identity checks work; exact date+createdAt ties lack a unique DB order | U, M; total-order RFC needed |
| 9 | Duplicate/missing operation | Page/batch coverage and unique identity checks reject | U, M |
| 10 | Total changes between pages | Reject before classification/publication | U |
| 11 | Edit between first membership and batch | Reject mismatching observed facts | U, M |
| 12 | Edit before final membership | Reject; never publish partial financial totals | U, B01/B06 |
| 13 | Classification revision changes after its batch | Old observed revision may be accepted: no second decision pass / transaction claim | U, M |
| 14 | Classification changes with same source amount | Does not change source financial BSON; a batch observes one decision state | U, M |
| 15 | Owner/session generation changes mid-request | Lifecycle checks refuse late result; new owner sees only own report | U, B02 |
| 16 | Logout mid-load | Late response cannot republish previous owner's totals | U, B02 |
| 17 | Two tabs load same history | Separate in-flight cohorts, complete totals in each, unchanged BSON | B05 |
| 18 | One tab edits while another calculates | Real PATCH after a batch is caught by final source observation | B06 |
| 19 | Response arrives after cancellation | Current=false rejects; actual HTTP abort can leave bounded admitted DB work finishing | U, M abort, B02/B04 |
| 20 | Middle batch fails | Whole result rejects; no new queued batches after worker failure | U, existing real M driver faults |
| 21 | Batch deadline exceeds | Port rejection stops publication/queue; source query retains maxTimeMS=3000 | U, M injected code50 |
| 22 | Unsupported source precision | Reject accounting; backend retains exact wire/BSON representation | U, M, original P10-13 |
| 23 | History >50,000 | Fail on individual/combined advertised cap; full valid 50,000 actually benchmarked | U, real XL Node/Chromium |

No finite multi-request protocol detects A→B→A between observations or changes
after final observation. A stale classification decision can be accepted if it
changes only after its batch; the result is explicitly observed-only/non-atomic.
No new stronger consistency promise is made. A report already open in a different
tab is not a live subscription to arbitrary database edits. Local acknowledged
mutations retain existing RTK invalidation; cross-tab source edits are checked
when the new cohort reaches its final membership, not by a new distributed bus.

Closing an RTK subscription hides its report immediately, but unsubscription
alone does not guarantee request abortion. Existing session/owner checks prevent
cross-owner publication. Avoided future scheduling after failure is verified;
full query-lifecycle cancellation remains a possible separately scoped follow-up.

## Independent financial checks

The real fixture oracle sums integer BigInt kopecks independently of production
calculators: dataset/month/category/status/role/layer amounts and counts, unique
dataset+operation IDs, approved ordinary consumption versus loans/repayments/
transfers/capital, partial classification and exact UTC boundaries. Both datasets
are reconciled; unreviewed spending is never silently zeroed.

`performanceFinancial.test.ts` runs 12 recorded LCG seeds x 240 operations with
independent BigInt partitions, dataset ID collisions and null/missing/empty fields.
It checks immutable forecast/plan calculations, partial coverage disclosure,
unverified recording by default, large safe totals and overflow rejection. Existing
fixed financial, forecast and plan tests plus P10's independent browser money
assertions remain mandatory. Plans/reserves are targets, not source transactions;
account balances are not inferred. Exact raw BSON digests are compared internally
around real benchmark reads/estimates and never emitted as financial artifacts.

## Deterministic budgets versus measurements

For E expenses, I incomes and N=E+I, membership requests are
`2 * (max(1, ceil(E/100)) + max(1, ceil(I/100)))`; classification POSTs are
`ceil(N/100)` (zero for empty history). The measured 80/20 fixtures require
5/30/300/1,500 requests at S/M/L/XL. No HTTP N+1 or cache removes the second pass.
Frontend concurrency stays <=4; MongoDB decision find count equals batch count.
Real server tests prove 4 active reads per owner, 16 per process, other-owner
progress under one-owner saturation, and release after error, abort and outage.
The 600/min owner quota, bounded request JSON, 100-identity batches, 8,192-character
source fields and existing response-size limits are not raised for benchmarks.

MongoDB delays use controlled native-query barriers or injected code50 faults,
not unbounded sleep/DoS/OOM workloads. Driver disconnect is real and reconnects
only the guard-generated DB. No claim of physically inducing a 3-second server
timeout, network partition or machine memory exhaustion. Those operational chaos
experiments need a separate bounded environment, not financial application data.

## Reproduction and CI

```sh
npm ci
npm run build
npm run lint
npm test -- --runInBand
# existing real MongoDB service and guards required for the following:
npm run test:e2e
npm run test:e2e:p12
npm run bench:p12 -- --sizes 100,1000 --repetitions 1
npm run bench:p12:browser -- --sizes 100,1000,10000 --repetitions 3
```

Set `MONGODB_INTEGRATION_TEST=1`, exact
`MONGODB_TEST_BASE_URI=mongodb://127.0.0.1:27017`, and `TZ=UTC`. For browser E2E
also use `BUDGET_BROWSER_LOCAL_PROVIDER=1`. Check out exactly the backend manifest
commit; override the sibling path with `BUDGET_E2E_BACKEND` or benchmark `--backend`.
Use Playwright's pinned Chromium, or explicitly disclose a local executable via
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Never use production/development DB URIs.

PR CI runs all financial/session/modal/unit regressions, original 14 P10 E2E cases,
six separately counted P12 browser cases and S/M deterministic request/query smoke.
Retries stay zero. Safe reporters reject skipped/cancelled/incomplete runs and
require verified MongoDB/process cleanup. Raw response/error/DOM logs are excluded
from P12 artifacts. Timing has no arbitrary pass/fail threshold on shared runners.

`p12-scale.yml` is workflow_dispatch only: L three repetitions or explicit XL one
repetition, Node and Chromium, pinned backend/MongoDB, temporary generated DBs and
five-day aggregate-only artifacts. No schedule, deployment or production feature
flags. GitHub requires this workflow to exist on the default branch before a
manual dispatch; it cannot be activated before review/merge. Local full XL runs
are actual measurements, not an estimate or replacement for that future CI run.

Before setting future latency alerts, collect more repetitions across comparable
runners and warm/cold conditions. Three-run empirical p95 equals max and does not
establish a population tail. Wall time, overlapping command sums, sampled heap,
browser responsiveness and rendering must remain separately labeled.
