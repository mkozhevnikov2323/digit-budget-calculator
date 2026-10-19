# Classification visual preview (PR #22)

Run the existing `npm run dev` and open `/classification-preview`, or choose
**Классификация (демо)** in desktop navigation / the mobile menu. No login is
needed. For acceptance without an existing authenticated application session,
use a fresh browser profile; the existing application auth bootstrap is unchanged.

Vite defines `__CLASSIFICATION_PREVIEW__` from its `serve` command. Build always
defines it as false, including `build --mode development`: no preview route,
navigation entry or dynamically imported preview chunk is included. Jest supplies
the literal through test globals, avoiding `import.meta` in its CommonJS transform.
No new auth gate, credentials or environment-variable configuration is introduced.

## Visual acceptance

- Initial month is February 2028 with two fictional expenses and one fictional
  income, all unclassified. Amounts/categories come from the existing validated
  synthetic examples. `customPeriod` and `monthPeriod` own calendar boundaries;
  the display explicitly uses UTC. No monetary totals are calculated.
- Choose a manual assignment, then Apply. Selection alone does nothing; Cancel
  preserves the previous decision. Check an expense layer and a non-spending
  role. Only compatible dataset choices are offered; `reviewSession` and the
  existing resolver validate the actual transition with manual provenance.
- Explicit-unclassified and never-reviewed have separate labels and counts.
  Reset one decision, then reset all. These actions change only local review.
- Change month/year and click Show month. Existing decisions require a simple
  confirmation. Cancel restores the selected month fields and keeps decisions.
  Returning to a previous month starts clean. Navigation/logout/browser refresh
  are never blocked by this month-only dialog.
- Expand **Примеры состояний интерфейса** to inspect loading, refreshing, empty,
  invalid-period, verification-required and error states. They are controlled
  presentation examples, not actual requests or authentication results. Leaving
  ready unmounts the old composition, so no old cards or approvals survive.
- Inspect desktop and a narrow phone viewport; operate selectors and buttons by
  keyboard. Notices distinguish temporary changes from persistence.

## Composition and boundaries

`ClassificationReviewView`, `ClassificationOperationCard`,
`ClassificationReviewSummary` and `ClassificationMonthSelector` are presentation
components. They receive checked entries/actions or UI values; they import no
transport, Redux, storage or live owner hooks. UI choice labels are not a resolver.

The page owns month/scenario/form state. Its keyed synthetic composition owns
only an immutable review reducer using `createReviewSession` and
`transitionReviewSession`. React transition pending disables local controls;
success/failure feedback is rendered with the committed reducer result, never
in a scheduling callback. The core review model and live hooks are unchanged.

All decisions are ephemeral `caller_local` interpretations. No suggestions,
automatic approval, financial mutations, reservations, allocation, persistence,
URLs/cookies/browser storage, global Redux drafts or new network requests exist.
The taxonomy/five layers remain provisional. Before real-data integration, obtain
visual/product acceptance, separately verify backend owner authorization and
review the remaining PR #20/#21 snapshot/session/concurrency limitations.
