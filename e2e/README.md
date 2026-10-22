# P10: real browser verification

## Baseline and design

Frontend main `2a9f2c1102c580df7cf67373964b8d86ac3569a2`, backend main
`257a0ebe45d8935c38e8bf512d824ed77edd5a80` already have real history,
prepare/apply/reconcile, deterministic P2/P3/P4 calculations and extensive unit /
Express/MongoDB contracts. Production intentionally has **no** classification
protocol installation. Existing browser coverage was missing.

Reuse Vite, the actual React routes, real login and JWT, the actual compiled
Express app, the guarded unique-database helper and exact validator/index
manifest. The paired backend PR adds only a test-owned IPC bootstrap and a
listener URL accessor; no second application architecture or test HTTP routes.
The test adapter is **not** production fleet governance. Production bootstrap,
flags, logging allowlist, schemas, APIs and financial operations are unchanged.

`backend-revision.json` pins the public backend commit. CI reads and validates
that manifest, checks out the exact SHA with read-only permissions and no extra
secrets, then builds it. Local runs default to the sibling repository and must
use this same revision. Updating the pin is an explicit reviewable change.

## Reproduce (Node 22)

Use only a dedicated disposable loopback MongoDB 7.0.45, as in backend CI.
Never use an application database. MongoDB container lifecycle belongs to the
invoking environment; GitHub Actions supplies and removes its isolated service.
The harness allocates and destroys a unique guarded DB **for every test**.

```
# Backend at the pinned revision:
npm ci
npm run build
# Frontend:
npm ci
npx playwright install --with-deps chromium
MONGODB_INTEGRATION_TEST=1 \
MONGODB_TEST_BASE_URI=mongodb://127.0.0.1:27017 npm run test:e2e
```

`BUDGET_E2E_BACKEND` may select that pinned checkout. A system Chromium can be
selected explicitly with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; CI always uses
the browser bundled for the locked Playwright version. No retries or sleeps.
One worker prevents process-wide env/logging conflicts and port contention.
Express uses port 0. Vite binds loopback port 5173 with **strictPort** because
existing CORS/Origin policy permits exactly `http://localhost:5173`; occupied
port fails instead of silently moving to a forbidden origin. No production CORS
changes. Vite disables `.env` loading and receives only the owned API address.

Browser networking permits only this Vite origin and the owned Express listener;
other HTTP destinations are aborted without synthetic responses.
Browser contexts and DBs are independent. Backend child processes have bounded
startup/RPC/teardown; parent disconnect/signals trigger backend teardown too.
Every passing scenario requires verified DB drop/empty/disconnect, closed HTTP
listener/log streams and Vite shutdown. Cleanup failure fails the test. Browser
lifecycle is owned by Playwright. CI has a 20-minute bound and service teardown.

## Coverage and independent expectations

The 14 required E2E IDs are in `financial-cycle.spec.mjs`; the reporter and CI
require all 14 on their first attempt. A filtered/empty/skipped/cancelled run
cannot be green. Existing Jest and both backend CI jobs remain independent.

Fixtures: 2025 has 15 expenses / 179000 kopecks and 13 incomes / 1205000 kopecks.
Twelve fuel expenses are 10000 each; repair 24000, loan issuance 30000,
unreviewed miscellaneous 5000. Income is twelve times 100000 plus loan return
5000. Two additional owner-A expenses lie exactly outside the year's UTC
boundaries, and owner B has an independent private expense. Monthly January
expenses are 69000; other months 10000. Category sums are 144000/30000/5000.
After the primary browser approval: approved 174000, unreviewed 5000, count
coverage 14/15=93.3%, amount coverage 174000/179000=97.2% (UI precision).
Everyday forecast is 10000/month / 120000/year, irregular 2000/24000. Unknown
components remain disclosed. Plan/actual fixture consumption is 149000,
excluding loan issuance; a 144000 plan has variance +5000 and remaining annual
target -5000. Reserve is separate. Integer-kopeck expectations are independent
of the production calculators. Full source BSON equality and source counts
prove classification/forecast/planning never create or overwrite financial facts.

The main manual operation always uses the browser's real prepare, separate
checkbox, real apply and authoritative read. Existing UI refetch resets selected
operation after acknowledgement; tests explicitly reselect to inspect revision.
Reload verifies DB persistence; it also clears recording evidence and local plans.
Other previously approved fixtures pass backend fingerprint/persistence validation.

Two pages prepare independent intents for the same operation: one wins CAS and
the other conflicts; synchronous duplicate clicks submit once. The backend's
bounded test-only fault throws **after a real MongoDB insert**, producing unknown
outcome. Browser blocks new writes and explicitly reconciles read-only; no
mutation/count change occurs during recovery. Advancing only the protocol clock
301s tests real expired-proof rejection without sleeping. Existing authoritative
Express/MongoDB suites retain the broader deletion/race/ABA/cryptographic matrix.
Network unavailability uses `route.abort`, never invented success responses;
all primary flows have unmocked API responses. Unsupported precision is a
controlled fixture mutation and must explicitly fail reporting without rounding.

## Diagnostics and privacy

Only fictional data. No network traces, videos, raw subprocess output, console
capture, storage dumps or raw HTTP/DOM attachments: these can contain JWTs,
proofs or entered passwords. The custom reporter emits named steps, assertion
locations and a closed diagnostic classification, plus sanitized JUnit/JSON and
summary. Playwright automatic error-context files are removed before artifact
upload. Failure screenshots mask all form inputs and contain fictional DOM only.
Artifact retention is five days. Authentication assertions compare
secret-bearing values only as booleans, never as printable expected/actual data.

## Limits / production prerequisites

These are observed non-atomic reads, not snapshot isolation; concurrent PATCH /
DELETE and A→B→A limitations remain. A single disposable process with bounded
quota and ephemeral keys does not implement fleet nonce budgets, key/era
rollout, rotation/revocation, healthy clock governance, writer drain or external
APM/service-worker privacy. Production classification writes remain uninstalled.
Budget plans remain memory-only; no BP persistence decisions are implemented.
P11 operational work and architectural approval remain required before activation.
