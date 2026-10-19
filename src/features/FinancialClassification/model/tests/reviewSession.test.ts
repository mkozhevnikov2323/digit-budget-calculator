/** @jest-environment node */
import { createReviewSession, transitionReviewSession, type ActiveReviewSession, type ReviewAction,
  type ReviewSession } from '../reviewSession';
import { FINANCIAL_LAYERS, PROVISIONAL_TAXONOMY_VERSION, type CheckedOperationSnapshot,
  type ClassificationAssignment } from '../types';
import type { ClassificationSnapshots } from '../snapshotAdapter';

const accepted = { userId: 'owner-a', sessionGeneration: 1, periodKey: '2024-02', loadGeneration: 'repeated-text/1' };
const expense = (id = 'same'): Extract<CheckedOperationSnapshot, { dataset: 'expenses' }> => ({ ownerScope: accepted.userId, dataset: 'expenses', transactionId: id,
  revision: accepted.loadGeneration, facts: { timestamp: 1707523200000, kopecks: 1,
    category: { kind: 'label', value: 'Кредит / возврат / накопления', dictionaryStatus: 'unresolved' } } });
const income = (id = 'same'): Extract<CheckedOperationSnapshot, { dataset: 'incomes' }> => ({ ownerScope: accepted.userId, dataset: 'incomes', transactionId: id,
  revision: accepted.loadGeneration, facts: { timestamp: 1707523200000, kopecks: 30, sourceLabel: 'Synthetic source' } });
const snapshots = (): ClassificationSnapshots => ({ revisionAuthority: 'caller_local', expenses: [expense()], incomes: [income()] });
const initialize = (data = snapshots()): ActiveReviewSession => {
  const result = createReviewSession(accepted, data); if (!result.ok) throw new Error('Invalid synthetic session'); return result.state;
};
const spending: ClassificationAssignment = { economicRole: 'ordinary_expense', layer: 'everyday' };
const action = (state: ActiveReviewSession, operation = state.entries[0].operation, assignment: ClassificationAssignment = spending): Extract<ReviewAction, { type: 'approve' }> =>
  ({ type: 'approve', context: state.context, taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION, operation, assignment });
const unsafe = (value: unknown) => value as ReviewAction;
const apply = (state: ActiveReviewSession, next: ReviewAction): ActiveReviewSession => {
  const result = transitionReviewSession(state, next);
  if (!result.ok || result.state.status !== 'active') throw new Error('Invalid synthetic action'); return result.state;
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
};
const rejected = (state: ReviewSession, next: ReviewAction, code: string) => {
  const before = JSON.stringify(state); const result = transitionReviewSession(state, next);
  expect(result).toMatchObject({ ok: false, error: { code } }); expect(result.state).toBe(state); expect(JSON.stringify(state)).toBe(before);
};

describe('temporary review transitions using the real classification resolver', () => {
  it('initializes checked operations visible, without decisions or automatic category inference', () => {
    const state = initialize(); expect(state.entries).toHaveLength(2);
    for (const entry of state.entries) {
      expect(entry.decision).toBeNull(); expect(entry.resolution).toMatchObject({ state: 'unclassified', economicRole: 'unknown', confirmed: null });
    }
    expect(state.entries[0].operation).toEqual(expense());
  });
  it('empty accepted datasets form a usable empty review', () => {
    expect(initialize({ revisionAuthority: 'caller_local', expenses: [], incomes: [] }).entries).toEqual([]);
  });
  it.each(FINANCIAL_LAYERS)('explicit ordinary expense approves supported layer %s with manual provenance', (layer) => {
    const state = initialize(); const next = apply(state, action(state, expense(), { economicRole: 'ordinary_expense', layer }));
    expect(next.entries[0].resolution).toMatchObject({ state: 'approved', confirmed: { economicRole: 'ordinary_expense', layer } });
    expect(next.entries[0].decision).toMatchObject({ state: 'approved', provenance: { kind: 'manual' }, operation: expense(),
      taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION, reviewerScope: accepted.userId });
    expect(state.entries[0].decision).toBeNull(); expect(next.entries[1]).toBe(state.entries[1]);
  });
  it.each(['ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement'] as const)(
    'income accepts explicit %s without spending layer', (economicRole) => {
      const state = initialize(); const next = apply(state, action(state, income(), { economicRole, layer: null }));
      expect(next.entries[1].resolution.state).toBe('approved'); expect(next.entries[0]).toBe(state.entries[0]);
    });
  it.each(['loan_issuance', 'internal_transfer', 'capital_movement'] as const)('expense accepts explicit %s', (economicRole) => {
    const state = initialize(); expect(apply(state, action(state, expense(), { economicRole, layer: null })).entries[0].resolution.state).toBe('approved');
  });
  it.each([
    ['expense role on income', income(), spending],
    ['issuance on income', income(), { economicRole: 'loan_issuance', layer: null }],
    ['income on expense', expense(), { economicRole: 'ordinary_income', layer: null }],
    ['repayment on expense', expense(), { economicRole: 'loan_repayment', layer: null }],
    ['refund on expense', expense(), { economicRole: 'refund', layer: null }],
    ['missing layer', expense(), { economicRole: 'ordinary_expense' }],
    ['null spending layer', expense(), { economicRole: 'ordinary_expense', layer: null }],
    ['unknown layer', expense(), { economicRole: 'ordinary_expense', layer: 'fictional' }],
    ['spending layer on transfer', expense(), { economicRole: 'internal_transfer', layer: 'everyday' }],
    ['spending layer on income', income(), { economicRole: 'ordinary_income', layer: 'everyday' }],
    ['unknown role', expense(), { economicRole: 'unknown', layer: null }],
    ['unsupported role', expense(), { economicRole: 'fictional', layer: null }],
    ['missing assignment', expense(), undefined],
  ])('rejects %s with unchanged original state', (_name, operation, assignment) => {
    const state = initialize(); rejected(state, unsafe({ ...action(state), operation, assignment }), 'invalid_decision');
  });
  it('explicit-unclassified is a manual decision; reset restores never-reviewed, preserving other decisions', () => {
    let state = initialize(); state = apply(state, action(state));
    state = apply(state, action(state, income(), { economicRole: 'ordinary_income', layer: null }));
    const other = state.entries[1]; const base = { context: state.context, taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION, operation: expense() };
    const left = apply(state, { ...base, type: 'leave_unclassified' });
    expect(left.entries[0].resolution).toMatchObject({ state: 'explicit_unclassified', confirmed: null });
    expect(left.entries[0].decision).toMatchObject({ state: 'explicit_unclassified', provenance: { kind: 'manual' } });
    const reset = apply(left, { ...base, type: 'reset' });
    expect(reset.entries[0].decision).toBeNull(); expect(reset.entries[0].resolution.state).toBe('unclassified');
    expect(reset.entries[1]).toBe(other); expect(state.entries[0].resolution.state).toBe('approved');
  });
  it('equal IDs across collections and separator/Unicode IDs have independent decisions', () => {
    const ids = ['same', 'expenses|incomes/same:🍎', 'e\u0301', 'é'];
    let state = initialize({ revisionAuthority: 'caller_local', expenses: ids.map(expense), incomes: ids.map(income) });
    for (const entry of state.entries) state = apply(state, action(state, entry.operation,
      entry.operation.dataset === 'expenses' ? spending : { economicRole: 'ordinary_income', layer: null }));
    expect(state.entries).toHaveLength(8); expect(state.entries.every((entry) => entry.resolution.state === 'approved')).toBe(true);
    expect(new Set(state.entries.map((entry) => entry.decision?.id)).size).toBe(8);
    state = apply(state, { ...action(state, income(ids[1])), type: 'reset' });
    expect(state.entries.filter((entry) => entry.decision === null)).toHaveLength(1);
  });
  it('fresh sessions with identical metadata have different object capabilities', () => {
    const state = initialize(); const again = initialize();
    expect(again.context).toEqual(state.context); expect(again.context).not.toBe(state.context);
    rejected(again, action(state), 'stale_context'); rejected(state, { ...action(state), context: { ...state.context } }, 'stale_context');
  });
  it.each(['other', 'financial-layers-v2', ''])('rejects unsupported action taxonomy %s', (taxonomyVersion) => {
    const state = initialize(); rejected(state, { ...action(state), taxonomyVersion }, 'unsupported_taxonomy');
  });
  it('rejects a foreign owner, missing ID and a wrong dataset even when IDs are equal', () => {
    const state = initialize({ revisionAuthority: 'caller_local', expenses: [expense()], incomes: [] });
    rejected(state, action(state, { ...expense(), ownerScope: 'owner-b' }), 'owner_mismatch');
    rejected(state, action(state, expense('missing')), 'missing_operation');
    rejected(state, action(state, income(), { economicRole: 'ordinary_income', layer: null }), 'missing_operation');
  });
  it.each([
    { ...expense(), revision: 'obsolete' },
    { ...expense(), facts: { timestamp: 1707523200001, kopecks: 1, category: { kind: 'absent' as const } } },
    { ...expense(), facts: { timestamp: 1707523200000, kopecks: 2, category: { kind: 'absent' as const } } },
    { ...expense(), facts: { timestamp: 1707523200000, kopecks: 1, category: { kind: 'absent' as const } } },
  ])('rejects stale revision or checked facts for all action types', (operation) => {
    const state = initialize();
    for (const type of ['approve', 'leave_unclassified', 'reset']) rejected(state, unsafe({ ...action(state), type, operation }), 'stale_decision');
  });
  it('rejects malformed operation and action without exposing payloads', () => {
    const state = initialize(); rejected(state, unsafe({ ...action(state), operation: null }), 'invalid_operation');
    rejected(state, unsafe({ ...action(state), type: 'automatic' }), 'invalid_action');
    rejected(state, unsafe(null), 'stale_context');
  });
  it('discards every decision and rejects all old capabilities; reinitialization is empty', () => {
    const state = initialize(); const approved = apply(state, action(state));
    const discarded = transitionReviewSession(approved, { type: 'discard', context: state.context });
    expect(discarded).toEqual({ ok: true, state: { status: 'inactive' } });
    rejected(discarded.state, action(state), 'inactive_session');
    expect(initialize().entries.every((entry) => entry.decision === null)).toBe(true);
  });
  it('never mutates or aliases frozen inputs, prior state or supplied assignment', () => {
    const data = freeze(snapshots()); const context = freeze({ ...accepted }); const before = JSON.stringify([data, context]);
    const result = createReviewSession(context, data); if (!result.ok) throw new Error('Fixture');
    const state = freeze(result.state); const assignment = freeze({ ...spending });
    const next = apply(state, action(state, data.expenses[0], assignment));
    expect(JSON.stringify([data, context])).toBe(before); expect(state.entries[0].decision).toBeNull();
    expect(next.entries[0].operation).not.toBe(data.expenses[0]); expect(next.entries[0].operation.facts).not.toBe(data.expenses[0].facts);
    expect(next.entries[0].decision?.operation).not.toBe(data.expenses[0]);
    expect(Object.isFrozen(next.entries[0].resolution)).toBe(true); expect(Object.isFrozen(next.entries)).toBe(true);
  });
  it('initialization fails closed for wrong owner, duplicates, unsupported taxonomy and invalid context', () => {
    expect(createReviewSession(accepted, { ...snapshots(), expenses: [{ ...expense(), ownerScope: 'owner-b' }] })).toMatchObject({ ok: false, error: { code: 'owner_mismatch' } });
    expect(createReviewSession(accepted, { ...snapshots(), expenses: [expense(), expense()] })).toMatchObject({ ok: false, error: { code: 'duplicate_operation' } });
    expect(createReviewSession(accepted, snapshots(), 'future')).toMatchObject({ ok: false, error: { code: 'unsupported_taxonomy' } });
    expect(createReviewSession({ ...accepted, userId: '' }, snapshots())).toMatchObject({ ok: false, error: { code: 'invalid_context' } });
  });
});
