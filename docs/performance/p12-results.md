# P12 measured changes and verification

## Provenance and interpretation

Baseline frontend `ab3848addd1b5fca735903b7ee4e3e36ad929852`, backend
`81ee073d2acadb22dc212a48a2e1c6a5c020a9a2` (test tooling only).
Optimized frontend `142d43cc1dfc0d83ae06a887e81162db5b645a38`, backend
`6ca6892d1fa839c7d229ea740c944bc854ed1234` (additional tests/docs only).
Production backend implementation is identical. Node 22.23.3 / MongoDB 7.0.45,
same two-CPU quota and 8 GiB container; Chromium 154 both before and after.
See p12-baseline.md for exact first-after-seed/warm methodology and limitations.
No tests/builds ran concurrently with measurements. Baseline was committed before
the performance-sensitive production edits. Scripts, runtime versions and fixtures
are reproducible from those immutable revisions. Later commits only retain evidence.

The strongest improvement is reduced client validation/report work, not a proven
universal end-to-end history speedup. Backend membership scans/counts remain the
dominant constraint. Initial Node L loading regressed and is explicitly retained;
browser results and individual components vary. Shared-host timing, GC and database
command duration variation prevent attributing all wall-time differences to code.
No latency regression is hidden by retries, larger timeouts or an index activation.

## Loading and sampled frontend/Node memory

Times are ms, heap is MiB; each time cell is p50 / empirical p95 / maximum.
S/M/L have three observations, so empirical p95=max and is weak tail evidence.
XL is one actual full 50,000-operation run: no p95 claim. Positive delta is slower.

| Mode | Operations | Before ms | After ms | p50 delta | sampled peak heap MiB | requests |
|---|---:|---|---|---:|---|---|
| node | 100 | 102.8 / 180.9 / 180.9 | 119.1 / 649.4 / 649.4 | +15.8% | 28.2 → 40.5 | 5 → 5 |
| node | 1000 | 517.5 / 600.9 / 600.9 | 532.5 / 769.3 / 769.3 | +2.9% | 45.0 → 46.8 | 30 → 30 |
| node | 10000 | 6829.6 / 7579.2 / 7579.2 | 8722.8 / 10278.2 / 10278.2 | +27.7% | 128.9 → 137.6 | 300 → 300 |
| node | 50000 | 102937.0 / n/a / 102937.0 | 119932.9 / n/a / 119932.9 | +16.5% | 203.2 → 131.2 | 1500 → 1500 |
| browser | 100 | 149.8 / 248.9 / 248.9 | 133.3 / 215.5 / 215.5 | -11.0% | 20.3 → 20.7 | 5 → 5 |
| browser | 1000 | 703.6 / 849.3 / 849.3 | 692.1 / 872.9 / 872.9 | -1.6% | 30.2 → 27.3 | 30 → 30 |
| browser | 10000 | 10359.8 / 10434.4 / 10434.4 | 9750.3 / 11036.6 / 11036.6 | -5.9% | 84.0 → 88.7 | 300 → 300 |
| browser | 50000 | 145219.9 / n/a / 145219.9 | 130413.3 / n/a / 130413.3 | -10.2% | 205.8 → 84.2 | 1500 → 1500 |

These are coherent loading times, excluding separately measured aggregation and
rendering; they are not total application navigation times. Memory has not been
consistently reduced and sampling does not prove exact transient peaks or absence
of retained heap after GC. Raw files also report backend heap/RSS (RSS includes
seeding), per-run CPU, response bytes, command counts and query plans.

## Component work (median cumulative ms per run)

| Mode | Operations | full owned-validator calls | owned validation before → after | UI aggregation before → after |
|---|---:|---|---|---|
| node | 100 | 102 → 3 | 9.1 → 5.2 (-42.5%) | 9.4 → 3.1 (-66.6%) |
| node | 1000 | 1002 → 12 | 37.8 → 28.4 (-24.9%) | 26.5 → 28.5 (+7.6%) |
| node | 10000 | 10002 → 102 | 288.0 → 179.7 (-37.6%) | 301.1 → 140.7 (-53.3%) |
| node | 50000 | 50002 → 502 | 1533.1 → 1091.9 (-28.8%) | 1737.1 → 924.9 (-46.8%) |
| browser | 100 | 102 → 3 | 9.0 → 3.3 (-63.3%) | 5.8 → 4.3 (-25.9%) |
| browser | 1000 | 1002 → 12 | 44.0 → 18.5 (-58.0%) | 30.7 → 14.0 (-54.4%) |
| browser | 10000 | 10002 → 102 | 378.9 → 233.5 (-38.4%) | 229.1 → 178.2 (-22.2%) |
| browser | 50000 | 50002 → 502 | 2229.8 → 1354.7 (-39.2%) | 1168.1 → 826.9 (-29.2%) |

The owned-validator count reduction is deterministic; every fact still crosses
the same validators, now in bounded batches. The report shares one statistics
calculation instead of two. Exact-field comparisons, bounded batching and queue
stopping are one coherent-loader change; no separate causal latency percentage is
claimed for each subchange. UI memoization is component-local and does not alter
forecast/plan trust-boundary validation. No money arithmetic is changed.

## L breakdown (median ms)

| Mode | Measurement | Before | After |
|---|---|---:|---:|
| node | MongoDB command duration sum (overlapping) | 8795.0 | 11225.0 |
| node | Client fetch/text duration sum (overlapping) | 12396.5 | 15785.1 |
| node | JSON.parse | 72.1 | 74.2 |
| node | Owned-history validation | 288.0 | 179.7 |
| node | Source facts parsing | 109.2 | 114.0 |
| node | Classification contract validation | 60.9 | 53.1 |
| node | Joint UI report model | 301.1 | 140.7 |
| node | Fresh recording evidence and forecast | 250.7 | 266.7 |
| node | Backend Node CPU user+system | 3564.6 | 4324.5 |
| browser | MongoDB command duration sum (overlapping) | 11201.0 | 9911.0 |
| browser | Client fetch/text duration sum (overlapping) | 19634.4 | 17249.7 |
| browser | JSON.parse | 75.2 | 76.0 |
| browser | Owned-history validation | 378.9 | 233.5 |
| browser | Source facts parsing | 88.2 | 132.7 |
| browser | Classification contract validation | 94.1 | 87.4 |
| browser | Joint UI report model | 229.1 | 178.2 |
| browser | Fresh recording evidence and forecast | 200.1 | 204.9 |
| browser | Backend Node CPU user+system | 4755.5 | 3913.8 |
| browser | React development actualDuration | 238.0 | 162.3 |
| browser | Longest 10ms heartbeat gap | 797.6 | 682.3 |

MongoDB driver times include driver transport; server executionStats lives in raw
query-plan artifacts. Client fetch includes response transfer/text conversion.
Neither isolates pure wire versus server serialization cost. Concurrent sums and
React durations overlap other work and MUST NOT be added into a wall-time model.
Browser heartbeat is a responsiveness observation, not a production input-latency
SLA. Local development React differs from an optimized production bundle.

## Additional variance check

A single additional adjacent Node L pair was run after the initial discrepancy,
baseline first (`ab3848addd1b5fca735903b7ee4e3e36ad929852`), then optimized (`142d43cc1dfc0d83ae06a887e81162db5b645a38`),
both against backend `6ca6892d1fa839c7d229ea740c944bc854ed1234`, three repetitions each:
baseline p50/p95/max = 7909.4/9199.8/9199.8 ms;
optimized = 7468.2/9205.6/9205.6 ms
(-5.6% p50). Both raw artifacts are retained.
This is a disclosed variance check, not a replacement or cherry-picked overwrite
of the original measurements. It does not establish statistical significance.


## Query counts, exact output and no-change decisions

Both revisions pass the same independent integer-kopeck reference for all totals,
months, statuses, roles, layers, categories and dataset-qualified identities.
All request counts and JSON response bytes are unchanged. Batch queries remain
one decision find per <=100 identities, concurrency <=4, full second membership
pass retained. Every benchmark verifies original financial BSON and generated-DB
empty/drop/process cleanup. No unknown amount becomes zero.

Explain shows source COLLSCAN+SORT before and after, with unchanged query shapes
and examined-document/key budgets. The test-only source compound index comparison
is retained separately. Production index rollout requires approval; no model,
index, financial schema, hydration, public API, readiness/auth/proof/CAS rule or
production flag changed. Backend PR #35 documents query plans, measured storage
cost, write trade-offs and a future cursor/total-order review.

## Regression and CI evidence

- Backend local: npm ci, typecheck, build, 1040 database-free tests, 5 runner
  self-tests, 453 real MongoDB integration tests; all parents passed, no skipped,
  cancelled or hookFailed outcomes, exact cleanup verified. Final backend SHA
  6ca6892d1fa839c7d229ea740c944bc854ed1234 CI:
  https://github.com/mkozhevnikov2323/digit-budget-calculator-api/actions/runs/39845411648
  Both Node 22 jobs and actual TAP logs were inspected.
- Frontend local: npm ci, final build and lint passed; lint retains four existing
  hook warnings and Vite retains the existing >500kB chunk warning. Full isolated
  Jest: 66 suites / 1233 tests passed in 253.203s. Original P10 14/14 and separate
  P12 6/6 real browser cases passed first-attempt with cleanup annotations.
- The first full local Jest run overlapped backend tests and had two 5s timeouts
  in existing IncomePage cases (1231 passed, 2 failed). The complete isolated
  rerun passed without exclusions or deadline changes; this history is retained,
  not reported as a clean first attempt. Load-sensitive suite deadlines remain
  an operational risk. No runner retry is configured.
- Code-head frontend CI at 142d43cc1dfc0d83ae06a887e81162db5b645a38:
  https://github.com/mkozhevnikov2323/digit-budget-calculator/actions/runs/39846078444
  actual logs: 66/66 suites, 1233/1233 tests, P10 14/14, P12 6/6, S/M deterministic
  smoke and cleanup passed. Documentation/evidence final-head CI is reported in
  the PR and delivery report, so this document does not invent its future SHA/run.

The 23-scenario coverage matrix and honest non-atomic/cancellation limitations are
in p12-integrity-and-operations.md. No production classification activation or
deployment, Ubuntu access, real financial data, merge or production DDL occurred.
The opt-in scale workflow is configured but cannot dispatch until present on the
default branch; full local XL measurements above actually ran in both engines.
