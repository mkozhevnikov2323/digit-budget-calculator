# Temporary owner classification review

Technical foundation only. The taxonomy remains provisional; the product owner
has not approved review UX, persistence or reporting policy. No route, component
or production consumer mounts this composition.

## Design boundaries

- `useOwnerClassificationData(period)` alone owns paired financial GETs,
  verified-owner gating, complete response validation and snapshot adaptation.
- `reviewSession.ts` owns immutable, explicit local transitions. It performs no
  money/calendar calculations. The existing resolver checks snapshot equality,
  taxonomy, assignment shape, economic role and dataset compatibility.
- `useOwnerClassificationReview(period)` owns the React lifecycle and action
  acknowledgement. It adds no query subscriptions, requests or persistence.
- No suggestions or category rules are supplied. Category labels cannot approve
  anything. All new decisions have manual provenance.

The PR #20 textual `loadGeneration` uses `useId()` plus a local sequence. It is
useful metadata, not a globally unique remount identifier. Changing that data
contract was unnecessary: review binds to the **exact accepted publication
object** and creates a fresh **context object capability** for each review
session. Equal context fields, including a repeated textual generation after
remount, do not grant access to a previous session. Context copies are rejected.

## Pure model

`createReviewSession(context, checkedSnapshots)` returns an empty active session
or a static failure code. Every checked operation remains visible as
`unclassified`. Inputs must come from the existing validated adapter; this is
not a replacement boundary for raw server records or monetary validation.

`transitionReviewSession(state, action)` returns a new state on success, or the
original state reference on failure. Actions are `approve`,
`leave_unclassified`, `reset` and `discard`. The first three require the exact
active context reference, supported taxonomy and the current operation snapshot.
Identity compares owner, dataset and transaction ID separately; no delimiter keys
or Unicode normalization are used. The resolver checks decisions against the
canonical snapshot, including revision and facts, even for reset.

An approved decision requires an explicit assignment. `explicit_unclassified`
is a manual decision; reset removes that decision and restores `unclassified`.
Resetting one operation preserves unrelated decisions. Discard produces an
inactive state without records or decisions. Outputs own and freeze their
snapshot/decision copies; caller inputs and previous states are never mutated.

Decision IDs/revisions are sequence values local to one review context. They
are not durable identifiers, server versions or concurrency tokens.

## Hook contract and lifecycle

Only `ready` exposes `context`, `revisionAuthority: 'caller_local'`, `entries`
(checked operation, resolved outcome, decision or null) and guarded `actions`:

```ts
approve(operation, assignment): Promise<ReviewActionResult>
leaveUnclassified(operation): Promise<ReviewActionResult>
reset(operation): Promise<ReviewActionResult>
```

Actions are temporary local commands, not financial mutations. Success means
the resulting entry was committed by React in the current review context.
Scheduling a state update alone never reports success. Functional updaters are
pure; a layout effect acknowledges committed entries. If two same-operation
commands are batched, a result replaced before commit returns `superseded`.
Commands on different operations compose independently. Failures expose only
static codes, never records or payloads.

A guarded render-time state adjustment discards the model on **every exit from
ready**, before a stale frame can commit. A new exact accepted publication also
initializes empty decisions. Refetch (including an identical payload), retry,
invalid period, period A/B/A, verification, owner A/B/A and same-owner login
therefore cannot revive approvals. Non-ready states expose no context, records,
decisions or review actions; an existing data error may expose its retry.

Callbacks capture their original context and accepted publication. Invocation
and commit both check the lifecycle; the session generation is also checked.
Unmount invalidates the instance and rejects pending commands. Old callbacks
cannot act on another publication or a new hook instance even if all textual
metadata and financial facts repeat. No drafts survive unmount.

## Limits

These are in-memory `caller_local` decisions, not persisted or concurrency-safe
approvals. An unmounted/suspended tab still depends on the observation guarantees
and limitations documented in `docs/auth-session-boundary.md`. The underlying
two GETs are not an atomic server snapshot, and server owner authorization has
not been verified by this work. Monthly response-size and completeness limits
remain those of PR #20. Product approval is still required before UI integration,
final taxonomy, durable decisions, reporting policy or persistence are added.
