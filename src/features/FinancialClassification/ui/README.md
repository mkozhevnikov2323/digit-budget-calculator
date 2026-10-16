# Synthetic classification preview

`ClassificationPreview({ examples })` accepts explicitly supplied, readonly
`SyntheticClassificationExample` inputs. Supply only fictional, already checked
operation snapshots with valid UTC timestamps and safe nonnegative integer
kopecks. The name/type documents this boundary; it cannot prove that arbitrary
caller data is fictional or financially validated. Never pass API responses,
session data or real records. No application page imports this module.

`ClassificationPreviewDemo` renders fresh fixed examples from
`createSyntheticClassificationExamples()`. No store, router or provider is needed.
The fixture timestamp is a fictional UTC date; no current clock is consulted.

Every article calls the real PR #12 `resolveClassification`. UI switches only
on its result/state; matching, precedence and conflict handling remain in the
resolver. Recorded income/expense, proposed assignment, confirmed synthetic
decision, explicit unclassified and resolution errors have distinct text.
Non-spending roles never receive a spending layer. Labels remain provisional
under the [Phase 2 RFC](../../../../docs/financial-planning-phase2-rfc.md).

Amounts use the existing `formatKopecks` result contract, including a visible
failure state. There are no totals, review controls, requests, effects, financial
mutations, browser storage or backend persistence. A reviewed synthetic input is
not evidence of a real review event, transfer, reserve or available funding.

The demo includes no assignment, category proposal, reviewed irregular expense,
explicit unclassified overriding a rule, loan issuance, both conflict types,
changed-amount stale decision, owner mismatch, candidate/requested taxonomy
errors, and same-ID expense/income with the same expense decision candidates.

The component uses semantic section/article headings, text as well as status
colours, wrapping content and responsive padding. It has no interactive controls.
Mobile layout still needs visual browser review; JSDOM tests do not prove layout.

Before a real owner review UI: agree taxonomy/role boundaries, history scope,
source-label provenance, authoritative revision/staleness handling, temporary
draft lifecycle, session isolation, accessibility/copy and a protected entry
point. Any future persistence needs separately approved API/schema, owner
authorization, concurrency and audit rules. This preview approves none of them.
