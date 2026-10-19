import { resolveClassification } from './classification';
import { PROVISIONAL_TAXONOMY_VERSION, type CheckedOperationSnapshot, type ClassificationAssignment,
  type ClassificationErrorCode, type ResolvedClassification, type ReviewedDecision } from './types';
import type { ClassificationSnapshots } from './snapshotAdapter';
import type { OwnerClassificationContext } from './useOwnerClassificationData';

/** The object reference is a local capability, not a serializable identity.
 * Textual owner/load metadata alone cannot identify a React review lifecycle. */
export type ReviewContext = OwnerClassificationContext & Readonly<{ taxonomyVersion: string }>;
export type ReviewEntry = Readonly<{
  operation: CheckedOperationSnapshot;
  resolution: ResolvedClassification;
  decision: ReviewedDecision | null;
}>;
export type ReviewSession =
  | Readonly<{ status: 'inactive' }>
  | Readonly<{ status: 'active'; context: ReviewContext; entries: readonly ReviewEntry[]; sequence: number }>;
export type ActiveReviewSession = Extract<ReviewSession, { status: 'active' }>;
export type ReviewErrorCode = ClassificationErrorCode | 'inactive_session' | 'stale_context' |
  'invalid_context' | 'invalid_action' | 'missing_operation' | 'duplicate_operation' | 'superseded';
export type ReviewActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: Readonly<{ code: ReviewErrorCode }> }>;
type Target = Readonly<{ context: ReviewContext; operation: CheckedOperationSnapshot; taxonomyVersion: string }>;
export type ReviewAction =
  | (Target & Readonly<{ type: 'approve'; assignment: ClassificationAssignment }>)
  | (Target & Readonly<{ type: 'leave_unclassified' | 'reset' }>)
  | Readonly<{ type: 'discard'; context: ReviewContext }>;
type Transition = ReviewActionResult & Readonly<{ state: ReviewSession }>;
type Initialization =
  | Readonly<{ ok: true; state: ActiveReviewSession }>
  | Readonly<{ ok: false; state: ReviewSession; error: Readonly<{ code: ReviewErrorCode }> }>;
const inactive: ReviewSession = Object.freeze({ status: 'inactive' });
const failure = (state: ReviewSession, code: ReviewErrorCode): Transition => ({ ok: false, state, error: { code } });
const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !/\s/.test(value);
// Only call on new owned values. Never freeze/mutate a caller's snapshots/state.
const freezeOwned = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeOwned); Object.freeze(value); }
  return value;
};
const entryFrom = (resolution: ResolvedClassification): ReviewEntry => freezeOwned({
  operation: resolution.operation, resolution,
  decision: resolution.state === 'approved' || resolution.state === 'explicit_unclassified' ? resolution.decisions[0] : null,
});

/** Checked facts come from the existing adapter; this boundary does not parse
 * amounts/dates or assert server revisions. No suggestions are ever supplied. */
export const createReviewSession = (
  accepted: OwnerClassificationContext, snapshots: ClassificationSnapshots,
  taxonomyVersion: string = PROVISIONAL_TAXONOMY_VERSION,
): Initialization => {
  const reject = (code: ReviewErrorCode): Initialization => ({ ok: false, state: inactive, error: { code } });
  if (!accepted || !identity(accepted.userId) || !identity(accepted.periodKey) || !identity(accepted.loadGeneration) ||
      !Number.isSafeInteger(accepted.sessionGeneration) || accepted.sessionGeneration < 0) return reject('invalid_context');
  if (taxonomyVersion !== PROVISIONAL_TAXONOMY_VERSION) return reject('unsupported_taxonomy');
  if (!snapshots || snapshots.revisionAuthority !== 'caller_local' || !Array.isArray(snapshots.expenses) ||
      !Array.isArray(snapshots.incomes)) return reject('invalid_operation');
  const entries: ReviewEntry[] = [];
  for (const dataset of ['expenses', 'incomes'] as const) {
    const ids = new Set<string>();
    for (const operation of snapshots[dataset]) {
      const checked = resolveClassification({ operation, taxonomyVersion, suggestions: [], decisions: [] });
      if (!checked.ok) return reject(checked.error.code);
      if (operation.ownerScope !== accepted.userId) return reject('owner_mismatch');
      if (operation.dataset !== dataset) return reject('invalid_operation');
      if (ids.has(operation.transactionId)) return reject('duplicate_operation');
      ids.add(operation.transactionId); entries.push(entryFrom(checked.value));
    }
  }
  const context: ReviewContext = Object.freeze({ userId: accepted.userId, sessionGeneration: accepted.sessionGeneration,
    periodKey: accepted.periodKey, loadGeneration: accepted.loadGeneration, taxonomyVersion });
  return { ok: true, state: Object.freeze({ status: 'active', context, entries: Object.freeze(entries), sequence: 0 }) };
};

/** Pure explicit transitions. Reference equality guards the review context;
 * tuple fields guard operations without delimiter/Unicode key collisions. */
export const transitionReviewSession = (state: ReviewSession, action: ReviewAction): Transition => {
  if (state.status !== 'active') return failure(state, 'inactive_session');
  if (!action || action.context !== state.context) return failure(state, 'stale_context');
  if (action.type === 'discard') return { ok: true, state: inactive };
  if (action.type !== 'approve' && action.type !== 'leave_unclassified' && action.type !== 'reset') return failure(state, 'invalid_action');
  if (action.taxonomyVersion !== state.context.taxonomyVersion) return failure(state, 'unsupported_taxonomy');
  const checked = resolveClassification({ operation: action.operation, taxonomyVersion: action.taxonomyVersion, suggestions: [], decisions: [] });
  if (!checked.ok) return failure(state, checked.error.code);
  if (action.operation.ownerScope !== state.context.userId) return failure(state, 'owner_mismatch');
  const index = state.entries.findIndex(({ operation }) => operation.ownerScope === action.operation.ownerScope &&
    operation.dataset === action.operation.dataset && operation.transactionId === action.operation.transactionId);
  if (index < 0) return failure(state, 'missing_operation');
  const sequence = state.sequence + 1;
  if (!Number.isSafeInteger(sequence)) return failure(state, 'invalid_action');
  const common = { id: `manual-${sequence}`, revision: `review-${sequence}`, taxonomyVersion: action.taxonomyVersion,
    reviewerScope: state.context.userId, operation: action.operation, provenance: { kind: 'manual' as const } };
  const decision: ReviewedDecision = action.type === 'approve'
    ? { ...common, state: 'approved', assignment: action.assignment }
    : { ...common, state: 'explicit_unclassified' };
  // Even reset must prove the caller's exact snapshot is still current.
  const resolved = resolveClassification({ operation: state.entries[index].operation,
    taxonomyVersion: action.taxonomyVersion, suggestions: [], decisions: [decision] });
  if (!resolved.ok) return failure(state, resolved.error.code);
  const outcome = action.type === 'reset' ? resolveClassification({ operation: state.entries[index].operation,
    taxonomyVersion: action.taxonomyVersion, suggestions: [], decisions: [] }) : resolved;
  if (!outcome.ok) return failure(state, outcome.error.code);
  const entries = state.entries.map((entry, position) => position === index ? entryFrom(outcome.value) : entry);
  return { ok: true, state: Object.freeze({ ...state, entries: Object.freeze(entries), sequence }) };
};
