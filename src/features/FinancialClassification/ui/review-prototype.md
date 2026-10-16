# Synthetic in-memory classification review

`ClassificationReviewPrototype` accepts explicit fictional `sessionId`,
`ownerScope`, checked `ClassificationSnapshots`, optional category suggestions,
taxonomy version and `diagnosticDecisions`. Inputs must be synthetic; the type
cannot prove fictional provenance. Never wire it to API records, authentication,
an application store or a production route. It is not access control.

`ClassificationReviewPrototypeDemo` uses `createSyntheticReviewExamples()`.
The factory passes fixed fictional API-shaped responses, a fixed UTC period and
explicit `caller_local` revision descriptors to `buildClassificationSnapshots`.
It creates no reviewed decisions. The examples include proposal-only spending,
an unclassified expense labelled `Выдача займа` and an unclassified income with
the same ID as an expense. No role follows from the label.

## Explicit interaction

- Accept proposal: the real resolver must return `proposed`; a click creates a
  local reviewed decision for that exact projected checked snapshot. Single
  proposal evidence comes from resolver-validated agreeing suggestions.
- Manual selection: dataset-compatible explicit role/layer choices, no default
  assignment. Apply replaces the one active local decision; cancel discards only
  the pending selection. Ordinary spending has one of five provisional layers;
  every non-spending choice has null layer. No financial inference is added.
- Leave unclassified: creates `explicit_unclassified`, blocking category
  proposals until reset or another explicit manual decision.
- Reset: drops only the local decision and pending form; the resolver determines
  the current proposed/unclassified result again. No undo/history cache exists.

All displayed classification outcomes call the real `resolveClassification`.
Money display uses `formatKopecks` with a visible failure state and blocked review.
There is no monetary arithmetic, alternative validator, classification engine or
backend request. Original category/source and recorded dataset remain visible.

`diagnosticDecisions` is optional caller-authored synthetic resolver evidence to
exercise conflicts/staleness/scope errors. It is separate from interaction drafts;
reset cannot delete it or select a winning candidate. A single valid supplied
decision is labelled as supplied synthetic evidence, never a local user action.
Invalid/conflicting inputs block review until reset (for a local draft) or caller
input correction. The component does not silently choose the latest decision.

## Session, identity and stale drafts

An owner/session tuple keys the entire review subtree. React unmounts it on
either change, synchronously, without waiting for an effect. Going A → B → A
creates fresh empty draft state. Invalid context also unmounts the subtree.
Each operation card is keyed by dataset + ID, so equal IDs across collections do
not share drafts. Removing a card drops its state; no offscreen history is kept.

Local decisions reference a resolver-copied exact checked snapshot. On every
render, current facts and local candidates go back through the resolver. A
resolver-detected stale local decision or invalid operation is marked invalid with a guarded render
state adjustment, before DOM commit. It remains blocked even if facts later
revert; reset and a new explicit review are required. No stale assignment is
shown as current. Pending manual selection is remounted on a changed snapshot.

These are caller-local in-memory UX safeguards. The fixed local review revision
is not a backend version, audit ID, timestamp or concurrency guarantee. The caller
must still change operation revisions for review-relevant fields outside the
minimal snapshot. This experiment does not solve production refetch races.

## Boundaries before real owner review

Permanent UI text states that data is fictional, decisions exist only in memory,
nothing is saved to the server, real operations are unchanged, classification
does not reserve/transfer money and taxonomy is provisional. No storage API,
IndexedDB, network, session token, financial mutation or persistence is used.
The prototype is not imported by existing pages, routes or navigation.

Native select labels, semantic headings and buttons support keyboard interaction;
stacked mobile layout uses wrapping and responsive padding. JSDOM tests do not
prove browser/mobile visual layout or assistive-technology announcement quality.

Before connecting real records, agree owner/session integration and protected
entry, taxonomy/role boundaries, review scope and provenance, complete checked
data/refetch lifecycle, revision freshness and temporary-draft loss/reset UX.
Persistent classifications need separate authorization, schema/API, audit,
idempotency and concurrency approval. Financial operations remain separate.
