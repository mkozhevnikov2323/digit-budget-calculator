# Experimental pure financial classification

Implements only the isolated contract step of the
[Phase 2 RFC](../../../../docs/financial-planning-phase2-rfc.md).
No application imports this module. No UI, totals, network, state, storage or
authorization is implemented. Taxonomy/role conventions remain provisional.

Public API: constants and readonly types in `types.ts`, and the synchronous
`resolveClassification({ operation, suggestions, decisions, taxonomyVersion })`.
It returns a discriminated `ClassificationResult`, never throws for ordinary
classification conflicts, and never chooses a candidate by input order or date.

## Checked inputs and identity

- Identity is `(ownerScope, dataset, transactionId)`; IDs/revisions are opaque,
  nonempty strings without whitespace. Collection and owner are never inferred.
- `facts.timestamp` and `facts.kopecks` are already validated Phase 1 facts, not
  raw API data. This module checks snapshot structure, not financial validity;
  the caller must supply validated dates/safe integer kopecks. No parsing,
  monetary arithmetic, precision conversion or date conversion happens here.
- Snapshots retain amount/date, original expense category or income source and
  an explicit revision. Any other fact used in review (title, comment, recipient,
  etc.) must cause the caller to change the revision. There is no hash, fabricated
  server version or automatic bridge from current analytics aggregates.
- Expense categories distinguish `absent` from a literal label, including the
  literal `Без категории`. Labels match exact strings, including empty strings,
  whitespace and Unicode code units: no trim/case folding/normalization.
- `dictionaryStatus: unresolved | ambiguous` is caller-supplied provenance.
  Neither asserts a category ID. Equal system/custom names remain ambiguous;
  explicit label rules may suggest a classification but cannot resolve a FK.
- Category suggestions apply only to the current expense's declared source
  label, never income sources or other text. Matching is a proposal, not approval,
  persistence or permission to apply rules to other historical/future records.

## Resolver precedence and conflicts

1. Validate structure/identities and requested taxonomy. Only
   `financial-layers-v1-provisional` is supported.
2. All candidates must belong to the input owner/reviewer scope and taxonomy,
   even if their label/transaction does not match. Mismatches fail closed. This
   is input consistency, not server authorization or proof of a review event.
3. Well-formed decisions for another collection/ID in the same scope are ignored.
   Any matching stale snapshot produces `stale_decision`, including an old and
   current revision supplied together. Caller passes **active** decisions only;
   selecting/superseding historical revisions is deliberately not implemented.
4. A current explicit decision wins over suggestions. Approved and explicit
   unclassified decisions contradict one another; neither silently wins over
   the other. Identical duplicate IDs collapse. A changed revision/provenance
   under the same ID conflicts. Different IDs with the same outcome retain all
   evidence in code-unit ID order; different outcomes conflict.
5. `explicit_unclassified` blocks proposals. Only `state: approved` has a non-null
   `confirmed` assignment. `proposed` has `confirmed: null` and a separate proposal;
   its effective economic role remains unknown until explicit review.
6. Without a decision, applicable suggestions must agree. Identical same-ID rules
   collapse; changed active revisions under one matching ID conflict. Equivalent
   distinct IDs preserve all provenance. Irrelevant labels do not participate.
   Current explicit review overrides even contradictory well-formed suggestions.
7. No candidate means `state: unclassified`, `confirmed: null`, role `unknown`.

Stable error priority: invalid operation, unsupported requested taxonomy, invalid
suggestion, invalid decision, owner mismatch, candidate taxonomy mismatch, stale
decision, decision conflict, then suggestion conflict. Errors contain only a
typed code, never records. Outputs copy known contract fields/nested objects;
inputs and their ordering are not mutated, arbitrary extra record fields are
not propagated. This is not a persistence DTO parser.

## Conservative role conventions for this experiment

Only an explicit `ordinary_expense` assignment may carry one of the five spending
layers. `ordinary_income`, `loan_repayment` and `refund` (incoming purchase refund)
apply to incomes; `loan_issuance` applies to expenses. Internal transfer and capital
movement may describe either dataset. Every non-spending assignment has null
layer. Unknown is not an approved assignment: use unclassified/explicit unclassified.
No category, source, title, recipient, comment or Phase 1 loan label sets a role.

These restrictions are reversible domain contracts, not an approved taxonomy,
refund/net-spending policy, account ledger or final cross-role/layer design.
Permanent storage, review UI, authoritativeness of caller revisions, category
provenance adapters, audit/supersession and final product semantics need separate
decisions. No Phase 1 records or financial/reporting behavior are changed.
