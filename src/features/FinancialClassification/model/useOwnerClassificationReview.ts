import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import type { CalendarPeriod } from '../../FinancialAnalytics/model/period';
import { useOwnerClassificationData, type OwnerClassificationData } from './useOwnerClassificationData';
import { createReviewSession, transitionReviewSession, type ReviewAction,
  type ReviewActionResult, type ReviewContext, type ReviewEntry, type ReviewErrorCode, type ReviewSession } from './reviewSession';
import type { CheckedOperationSnapshot, ClassificationAssignment } from './types';

type Accepted = Extract<OwnerClassificationData, { status: 'ready' }>;
type Receipt = { ticket: object; result: ReviewActionResult; entry?: ReviewEntry };
type Local = { accepted: Accepted | null; model: ReviewSession; receipts: readonly Receipt[]; error?: ReviewErrorCode };
const empty: Local = { accepted: null, model: { status: 'inactive' }, receipts: [] };
const failed = (code: ReviewErrorCode): ReviewActionResult => ({ ok: false, error: { code } });
export type ReviewActions = Readonly<{
  approve: (operation: CheckedOperationSnapshot, assignment: ClassificationAssignment) => Promise<ReviewActionResult>;
  leaveUnclassified: (operation: CheckedOperationSnapshot) => Promise<ReviewActionResult>;
  reset: (operation: CheckedOperationSnapshot) => Promise<ReviewActionResult>;
}>;
export type OwnerClassificationReview =
  | Exclude<OwnerClassificationData, { status: 'ready' }>
  | Readonly<{ status: 'error'; error: { code: 'invalid_review_session'; reason: ReviewErrorCode } }>
  | Readonly<{ status: 'ready'; context: ReviewContext; revisionAuthority: 'caller_local';
      entries: readonly ReviewEntry[]; actions: ReviewActions }>;

/** Unmounted/inactive lifecycles never retain capabilities or drafts. This
 * composition adds no subscriptions/GETs and has no production UI consumer. */
export const useOwnerClassificationReview = (period: CalendarPeriod | null): OwnerClassificationReview => {
  const data = useOwnerClassificationData(period);
  const [local, setLocal] = useState<Local>(empty);
  // A render adjustment prevents even one committed frame with old decisions.
  // The exact accepted publication, not its textual loadGeneration, is the
  // boundary. Returning after any non-ready state always initializes afresh.
  if (data.status !== 'ready') {
    if (local.accepted !== null) setLocal(empty);
  } else if (local.accepted !== data) {
    const initialized = createReviewSession(data.context, data.data);
    setLocal({ accepted: data, model: initialized.state, receipts: [],
      ...(!initialized.ok ? { error: initialized.error.code } : {}) });
  }
  const alive = useRef(false);
  const committed = useRef<Local>(empty);
  const pending = useRef(new Map<object, { context: ReviewContext; resolve: (result: ReviewActionResult) => void }>());
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; committed.current = empty;
      for (const action of pending.current.values()) action.resolve(failed('inactive_session'));
      pending.current.clear();
    };
  }, []);
  useLayoutEffect(() => {
    committed.current = local;
    const acknowledged = new Set<object>();
    for (const [ticket, action] of pending.current) {
      const receipt = local.receipts.find((item) => item.ticket === ticket);
      let result: ReviewActionResult | undefined;
      if (local.model.status !== 'active' || local.model.context !== action.context ||
          !isCurrentSession(action.context.sessionGeneration)) result = failed('stale_context');
      else if (receipt) result = !receipt.result.ok ? receipt.result
        : receipt.entry && local.model.entries.includes(receipt.entry) ? { ok: true } : failed('superseded');
      if (result) { action.resolve(result); pending.current.delete(ticket); acknowledged.add(ticket); }
    }
    if (acknowledged.size) setLocal((current) => ({ ...current,
      receipts: current.receipts.filter((receipt) => !acknowledged.has(receipt.ticket)) }));
  });
  const enqueue = useCallback((accepted: Accepted, action: ReviewAction): Promise<ReviewActionResult> => {
    const current = committed.current;
    if (!alive.current) return Promise.resolve(failed('inactive_session'));
    if (current.accepted !== accepted || current.model.status !== 'active' || current.model.context !== action.context ||
        !isCurrentSession(action.context.sessionGeneration)) return Promise.resolve(failed('stale_context'));
    return new Promise((resolve) => {
      const ticket = {};
      pending.current.set(ticket, { context: action.context, resolve });
      // No side effects or promise resolution in an updater (StrictMode may
      // evaluate it twice). Acknowledgement happens after the actual commit.
      setLocal((previous) => {
        const transition = previous.accepted === accepted ? transitionReviewSession(previous.model, action)
          : { ...failed('stale_context'), state: previous.model };
        const entry = transition.ok && transition.state.status === 'active' && action.type !== 'discard'
          ? transition.state.entries.find(({ operation }) => operation.ownerScope === action.operation.ownerScope &&
            operation.dataset === action.operation.dataset && operation.transactionId === action.operation.transactionId) : undefined;
        return { ...previous, model: transition.state,
          receipts: [...previous.receipts, { ticket, result: transition.ok ? { ok: true } : failed(transition.error.code), entry }] };
      });
    });
  }, []);
  const model = local.model;
  const ready = useMemo(() => {
    if (!local.accepted || model.status !== 'active') return null;
    const accepted = local.accepted;
    const { context } = model;
    const target = (operation: CheckedOperationSnapshot) => ({ context, operation, taxonomyVersion: context.taxonomyVersion });
    const actions: ReviewActions = {
      approve: (operation, assignment) => enqueue(accepted, { ...target(operation), type: 'approve', assignment }),
      leaveUnclassified: (operation) => enqueue(accepted, { ...target(operation), type: 'leave_unclassified' }),
      reset: (operation) => enqueue(accepted, { ...target(operation), type: 'reset' }),
    };
    return { status: 'ready' as const, context,
      revisionAuthority: 'caller_local' as const, entries: model.entries, actions };
  }, [local.accepted, model, enqueue]);
  if (data.status !== 'ready') return data;
  if (!ready) return { status: 'error', error: { code: 'invalid_review_session', reason: local.error ?? 'inactive_session' } };
  return ready;
};
