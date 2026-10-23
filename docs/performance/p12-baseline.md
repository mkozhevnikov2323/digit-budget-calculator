# P12 baseline — captured before production changes

## Reproduction and provenance

Frontend `ab3848addd1b5fca735903b7ee4e3e36ad929852`, backend
`81ee073d2acadb22dc212a48a2e1c6a5c020a9a2`. The preceding main baselines are
`0c9d02e6e637ee079fb271cb6487755370e952c8` and
`491bae6ab05a28e0e3d26ddfaadc15a06aba9b4b`; intermediate commits add test tooling only.
Node 22.23.3, MongoDB 7.0.45 (official immutable CI image), local Chromium 154.
Intel Xeon Platinum 8573C, two logical CPUs; cgroup CPU quota 2 and RAM limit
8 GiB. This is cloud synthetic evidence, not an Ubuntu home-machine capacity claim.

Build the backend with `npm ci && npm run build`, install frontend with `npm ci`.
Use only the existing disposable MongoDB service and guards:

```sh
MONGODB_INTEGRATION_TEST=1 MONGODB_TEST_BASE_URI=mongodb://127.0.0.1:27017 TZ=UTC npm run bench:p12 -- --sizes 100,1000,10000 --repetitions 3 --query-indexes
MONGODB_INTEGRATION_TEST=1 MONGODB_TEST_BASE_URI=mongodb://127.0.0.1:27017 TZ=UTC npm run bench:p12:browser -- --sizes 100,1000,10000 --repetitions 3
MONGODB_INTEGRATION_TEST=1 MONGODB_TEST_BASE_URI=mongodb://127.0.0.1:27017 TZ=UTC npm run bench:p12 -- --sizes 50000 --repetitions 1 --xl --query-indexes
```

Pass `--backend /absolute/checkout` to override the sibling checkout. Browser runs
use pinned Playwright Chromium in CI; this local run explicitly selected the
available `/usr/bin/chromium`. Never use an application URI. No production
bootstrap is imported. Fictional bearer tokens remain in IPC/browser memory;
artifacts contain only aggregate metrics and closed operational fields.

## Observations

Loading times are milliseconds; heap is sampled frontend/Node pipeline MiB.
The total pipeline also performs separately measured aggregation and forecasting.

| Mode | Operations | Repetitions | p50 | empirical p95 | max | sampled peak heap MiB | membership + batches |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| node-ssr | 100 | 3 | 102.8 | 180.9 | 180.9 | 28.2 | 4 + 1 |
| node-ssr | 1000 | 3 | 517.5 | 600.9 | 600.9 | 45.0 | 20 + 10 |
| node-ssr | 10000 | 3 | 6829.6 | 7579.2 | 7579.2 | 128.9 | 200 + 100 |
| node-ssr | 50000 | 1 | 102937.0 | UNMEASURED (n<3) | 102937.0 | 203.2 | 1000 + 500 |
| chromium | 100 | 3 | 149.8 | 248.9 | 248.9 | 20.3 | 4 + 1 |
| chromium | 1000 | 3 | 703.6 | 849.3 | 849.3 | 30.2 | 20 + 10 |
| chromium | 10000 | 3 | 10359.8 | 10434.4 | 10434.4 | 84.0 | 200 + 100 |

See accompanying raw JSON for every repetition, backend CPU/heap/RSS, response
bytes, request concurrency, MongoDB command durations and execution plans.
All financial integer-kopeck reference invariants and exact source BSON
immutability checks passed; every disposable database was dropped and verified empty.

## Method and limitations

- Each profile seeds a new generated database. The first pipeline follows seeding;
  it is **not** an OS-cache or MongoDB-cache cold start. Later repetitions are warm.
- p50/p95 use nearest-rank empirical quantiles. Three observations provide very
  weak tail evidence; their empirical p95 is the maximum, not a reliable population
  p95. XL runs once: no p95 or variance claim.
- Real loopback Express, Mongoose and MongoDB are used. No mocked HTTP in the
  measured path. Node executes actual frontend modules through Vite SSR; browser
  executes the actual report and React Profiler through Vite development mode.
- HTTP counts exclude browser CORS preflight; backend records OPTIONS separately.
  Both membership passes remain. Batch size 100 and concurrency <=4 are asserted.
  Each classification batch has exactly one observed decision query, not N queries.
- MongoDB driver durations include command transport/serialization; explain server
  executionTimeMillis is independent, rounded server-side evidence. `returned` is
  the cursor execution-plan nReturned, including count-scan input rows, not the
  final aggregate scalar count. Overlapping command/fetch durations are sums,
  not a decomposition of wall latency.
- JSON parsing is timed separately. Validation wrappers time unmodified exports;
  instrumented timings add overhead equally before and after. Aggregation measures
  the UI report model; forecasting includes fresh trust-boundary validation.
- Heap is sampled every 10ms plus end observations, not an exact transient peak.
  Backend maxRSS includes seeding. Chromium precise-memory mode is browser-specific;
  heartbeat gaps include validation, aggregation, scheduling and rendering. React
  development timings include development overhead and are not production paint times.
- Test-only comparative indexes are created and dropped only in the generated DB,
  after baseline HTTP measurements. No production DDL, model or index changes.

## Measured bottlenecks and bounded changes to evaluate

1. Membership `countDocuments` and sorted pages use COLLSCAN plus SORT: no actual
   source compound index exists. At L the expense page examines 8,802 documents
   for 100 returned rows, including deep pages. Repeated counts amplify this.
2. The test-only `{owner:1,date:1,createdAt:1}` index reduces the first L expense
   page to 100 documents/100 keys and the deepest to 100 documents/8,000 keys.
   Count becomes COUNT_SCAN. Deep offset cost remains linear in skipped keys.
   Additional source index storage is measured in raw artifacts. Production
   rollout, write amplification and rollback require separate approval.
3. Coherent frontend validation invokes the full owned-history validator N+2
   times: 10,002 at L, 50,002 at XL. Validate each bounded batch once while
   preserving every fact, identity, period, money and final membership check.
4. The report invokes the same statistics calculation twice, once directly and
   once for category reconciliation. A local joint report can share one result
   without weakening forecast/evidence trust-boundary validation.
5. A failed batch rejects publication but other workers can keep scheduling
   remaining batches. Stop future scheduling on failure; in-flight requests still
   finish, and server cancellation must not be claimed.

No hydration, readiness, pagination/API, security limits or backend production
behavior is changed without measured evidence and compatible contracts. A future
cursor/snapshot proposal must separately address total ordering, A→B→A, source
changes after observation, classification-only changes and migration compatibility.

Full Chromium XL baseline also completed: 145219.9 ms loading, one observation, no p95 claim. See `p12-browser-xl-baseline.json`; financial invariants, 1,500 request budget, concurrency <=4 and BSON/DB cleanup passed.
