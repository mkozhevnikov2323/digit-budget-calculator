/** @jest-environment node */
import { resolveClassification } from '../classification';
import {
  ECONOMIC_ROLES, FINANCIAL_LAYERS, PROVISIONAL_TAXONOMY_VERSION as version,
  type CategorySuggestion, type CheckedOperationSnapshot, type ClassificationAssignment,
  type ClassificationErrorCode, type ResolveClassificationInput, type ReviewedDecision,
} from '../types';

const owner = 'synthetic-owner';
const expense = (): Extract<CheckedOperationSnapshot, { dataset: 'expenses' }> => ({
  ownerScope: owner, dataset: 'expenses', transactionId: 'opaque-id', revision: 'facts-v1',
  facts: { timestamp: 1707523200000, kopecks: 1,
    category: { kind: 'label', value: 'Еда', dictionaryStatus: 'unresolved' } },
});
const income = (): Extract<CheckedOperationSnapshot, { dataset: 'incomes' }> => ({
  ownerScope: owner, dataset: 'incomes', transactionId: 'opaque-id', revision: 'facts-v1',
  facts: { timestamp: 1707523200000, kopecks: 1, sourceLabel: 'Synthetic income' },
});
const everyday: ClassificationAssignment = { economicRole: 'ordinary_expense', layer: 'everyday' };
const irregular: ClassificationAssignment = { economicRole: 'ordinary_expense', layer: 'irregular' };
const suggestion = (overrides: Partial<CategorySuggestion> = {}): CategorySuggestion => ({
  id: 'rule-a', ownerScope: owner, taxonomyVersion: version, ruleRevision: 'rule-v1',
  sourceLabel: 'Еда', assignment: everyday, ...overrides,
});
const approval = (operation: CheckedOperationSnapshot = expense(), assignment: ClassificationAssignment = everyday, id = 'decision-a'): Extract<ReviewedDecision, { state: 'approved' }> => ({
  id, revision: 'review-v1', taxonomyVersion: version, reviewerScope: owner,
  operation, state: 'approved', assignment, provenance: { kind: 'manual' },
});
const decline = (operation: CheckedOperationSnapshot = expense()): Extract<ReviewedDecision, { state: 'explicit_unclassified' }> => ({
  id: 'leave-unclassified', revision: 'review-v1', taxonomyVersion: version,
  reviewerScope: owner, operation, state: 'explicit_unclassified', provenance: { kind: 'manual' },
});
const input = (overrides: Partial<ResolveClassificationInput> = {}): ResolveClassificationInput => ({
  operation: expense(), taxonomyVersion: version, suggestions: [], decisions: [], ...overrides,
});
const value = (data: ResolveClassificationInput) => {
  const result = resolveClassification(data);
  if (!result.ok) throw new Error(`Unexpected synthetic classification error: ${result.error.code}`);
  return result.value;
};
const expectError = (data: ResolveClassificationInput, code: ClassificationErrorCode) =>
  expect(resolveClassification(data)).toEqual({ ok: false, error: { code } });
// Deliberate boundary corruption: verify runtime consistency beyond TS callers.
const malformed = (data: unknown): ResolveClassificationInput => data as ResolveClassificationInput;

describe('provisional classification contracts', () => {
  it('has exactly five provisional layers and eight distinct economic roles', () => {
    expect(FINANCIAL_LAYERS).toEqual(['everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital']);
    expect(ECONOMIC_ROLES).toEqual(['unknown', 'ordinary_expense', 'ordinary_income', 'loan_issuance',
      'loan_repayment', 'refund', 'internal_transfer', 'capital_movement']);
    expect(new Set(ECONOMIC_ROLES).size).toBe(8);
    expect(Object.isFrozen(FINANCIAL_LAYERS)).toBe(true);
  });

  it.each(FINANCIAL_LAYERS)('accepts explicitly reviewed ordinary spending in %s', (layer) => {
    expect(value(input({ decisions: [approval(expense(), { economicRole: 'ordinary_expense', layer })] })))
      .toMatchObject({ state: 'approved', confirmed: { economicRole: 'ordinary_expense', layer } });
  });

  it('returns unclassified/unknown without any supplied decision or suggestion', () => {
    expect(value(input())).toEqual({ operation: expense(), taxonomyVersion: version,
      state: 'unclassified', confirmed: null, economicRole: 'unknown' });
  });

  it('exposes a proposal without a confirmed classification or inferred role', () => {
    expect(value(input({ suggestions: [suggestion()] }))).toMatchObject({
      state: 'proposed', confirmed: null, economicRole: 'unknown',
      proposal: { assignment: everyday, suggestions: [suggestion()] },
    });
  });

  it('gives current explicit approval priority over even conflicting suggestions', () => {
    const reviewed = approval(expense(), irregular);
    const result = value(input({ decisions: [reviewed], suggestions: [suggestion(), suggestion({ id: 'rule-b', assignment: irregular })] }));
    expect(result).toMatchObject({ state: 'approved', confirmed: irregular, decisions: [reviewed] });
    expect(result).not.toHaveProperty('proposal');
  });

  it('does not override an explicit unclassified decision with a proposal', () => {
    expect(value(input({ decisions: [decline()], suggestions: [suggestion()] })))
      .toMatchObject({ state: 'explicit_unclassified', confirmed: null, economicRole: 'unknown' });
  });

  it('never replaces an explicitly reviewed loan role with an ordinary spending suggestion', () => {
    const reviewed = approval(expense(), { economicRole: 'loan_issuance', layer: null });
    expect(value(input({ decisions: [reviewed], suggestions: [suggestion()] })))
      .toMatchObject({ state: 'approved', confirmed: { economicRole: 'loan_issuance', layer: null } });
  });

  it('deduplicates identical decision IDs and retains equivalent independent confirmations in ID order', () => {
    const a = approval(); const b = approval(expense(), everyday, 'decision-b');
    const result = value(input({ decisions: [b, a, { ...a }] }));
    expect(result).toMatchObject({ state: 'approved', decisions: [a, b] });
  });

  it.each<[ReviewedDecision, ReviewedDecision]>([
    [approval(), approval(expense(), irregular, 'decision-b')],
    [approval(), decline()],
    [approval(), { ...approval(), revision: 'different-active-revision' }],
    [approval(), { ...approval(), provenance: { kind: 'category_rule', ruleId: 'rule-a', ruleRevision: 'r1', sourceLabel: 'Еда' } }],
  ])('reports conflicting active decisions without choosing an array item', (a, b) => {
    expectError(input({ decisions: [a, b] }), 'conflicting_decisions');
    expectError(input({ decisions: [b, a] }), 'conflicting_decisions');
  });

  it('preserves the original approved rule provenance even when current suggestions change', () => {
    const reviewed: ReviewedDecision = { ...approval(), provenance: {
      kind: 'category_rule', ruleId: 'rule-a', ruleRevision: 'old-rule-v1', sourceLabel: 'Еда',
    } };
    expect(value(input({ decisions: [reviewed], suggestions: [suggestion({ ruleRevision: 'new-rule-v2', assignment: irregular })] })))
      .toMatchObject({ state: 'approved', confirmed: everyday, decisions: [reviewed] });
  });

  it('deduplicates matching suggestions while keeping all equivalent rule provenance', () => {
    const a = suggestion(); const b = suggestion({ id: 'rule-b' });
    expect(value(input({ suggestions: [b, a, { ...a }] })))
      .toMatchObject({ state: 'proposed', confirmed: null, proposal: { suggestions: [a, b] } });
  });

  it.each<[CategorySuggestion, CategorySuggestion]>([
    [suggestion(), suggestion({ id: 'rule-b', assignment: irregular })],
    [suggestion(), suggestion({ ruleRevision: 'conflicting-active-revision' })],
  ])('reports incompatible applicable suggestions without first/last wins', (a, b) => {
    expectError(input({ suggestions: [a, b] }), 'conflicting_suggestions');
    expectError(input({ suggestions: [b, a] }), 'conflicting_suggestions');
  });

  it.each([
    input({ suggestions: [suggestion({ ownerScope: 'other-synthetic-owner' })] }),
    input({ decisions: [{ ...approval(), reviewerScope: 'other-synthetic-owner' }] }),
    input({ decisions: [approval({ ...expense(), ownerScope: 'other-synthetic-owner' })] }),
  ])('rejects cross-owner candidates instead of confirming an assignment', (data) => {
    expectError(data, 'owner_mismatch');
  });

  it('keeps equal IDs in separate collections distinct and never applies expense-category rules to income', () => {
    expect(value(input({ operation: income(), decisions: [approval()], suggestions: [suggestion()] })).state).toBe('unclassified');
    const reviewed = approval(income(), { economicRole: 'ordinary_income', layer: null });
    expect(value(input({ operation: income(), decisions: [reviewed, approval()] })))
      .toMatchObject({ state: 'approved', confirmed: { economicRole: 'ordinary_income', layer: null }, decisions: [reviewed] });
  });

  it('ignores a well-formed decision for another transaction in the same owner scope', () => {
    expect(value(input({ decisions: [approval({ ...expense(), transactionId: 'another-id' })] })).state).toBe('unclassified');
  });

  it.each<Partial<ReturnType<typeof expense>>>([
    { revision: 'facts-v2' },
    { facts: { ...expense().facts, kopecks: 2 } },
    { facts: { ...expense().facts, timestamp: 1707609600000 } },
    { facts: { timestamp: 1707523200000, kopecks: 1, category: { kind: 'absent' } } },
    { facts: { timestamp: 1707523200000, kopecks: 1, category: { kind: 'label', value: 'Другое', dictionaryStatus: 'unresolved' } } },
    { facts: { timestamp: 1707523200000, kopecks: 1, category: { kind: 'label', value: 'Еда', dictionaryStatus: 'ambiguous' } } },
  ])('reports changed checked facts as stale, even beside a current decision', (changes) => {
    const changed = { ...expense(), ...changes };
    expectError(input({ operation: changed, decisions: [approval()] }), 'stale_decision');
    expectError(input({ operation: changed, decisions: [approval(changed), approval()] }), 'stale_decision');
  });

  it('detects a changed income source rather than approving its old snapshot', () => {
    const changed: CheckedOperationSnapshot = { ...income(), dataset: 'incomes', facts: {
      timestamp: 1707523200000, kopecks: 1, sourceLabel: 'Changed synthetic source',
    } };
    expectError(input({ operation: changed, decisions: [approval(income(), { economicRole: 'ordinary_income', layer: null })] }), 'stale_decision');
  });

  it('rejects unsupported requests and mismatched candidate taxonomy versions', () => {
    expectError(input({ taxonomyVersion: 'future-taxonomy' }), 'unsupported_taxonomy');
    expectError(input({ suggestions: [suggestion({ taxonomyVersion: 'future-taxonomy' })] }), 'taxonomy_mismatch');
    expectError(input({ decisions: [{ ...approval(), taxonomyVersion: 'future-taxonomy' }] }), 'taxonomy_mismatch');
  });

  it('distinguishes absent categories from the literal missing-category display label', () => {
    const absent: CheckedOperationSnapshot = { ...expense(), dataset: 'expenses', facts: {
      timestamp: 1707523200000, kopecks: 1, category: { kind: 'absent' },
    } };
    const literal: CheckedOperationSnapshot = { ...absent, facts: { ...absent.facts,
      category: { kind: 'label', value: 'Без категории', dictionaryStatus: 'unresolved' },
    } };
    const rules = [suggestion({ sourceLabel: 'Без категории' })];
    expect(value(input({ operation: absent, suggestions: rules })).state).toBe('unclassified');
    expect(value(input({ operation: literal, suggestions: rules })).state).toBe('proposed');
    expectError(input({ operation: literal, decisions: [approval(absent)] }), 'stale_decision');
  });

  it.each(['constructor', '__proto__', '家族 👨‍👩‍👧‍👦', ' е\u0301 ', '', '   '])('matches only the explicit exact source label %p', (label) => {
    const operation: CheckedOperationSnapshot = { ...expense(), dataset: 'expenses', facts: {
      timestamp: 1707523200000, kopecks: 1,
      category: { kind: 'label', value: label, dictionaryStatus: 'unresolved' },
    } };
    expect(value(input({ operation, suggestions: [suggestion({ sourceLabel: label })] })).state).toBe('proposed');
  });

  it.each(['еда', ' Еда', 'Еда ', 'ЕДА'])('does not normalize a nonmatching suggestion %p', (sourceLabel) => {
    expect(value(input({ suggestions: [suggestion({ sourceLabel })] })).state).toBe('unclassified');
  });

  it('does not normalize Unicode or resolve an ambiguous label to a dictionary', () => {
    const operation: CheckedOperationSnapshot = { ...expense(), dataset: 'expenses', facts: {
      timestamp: 1707523200000, kopecks: 1,
      category: { kind: 'label', value: 'e\u0301', dictionaryStatus: 'ambiguous' },
    } };
    expect(value(input({ operation, suggestions: [suggestion({ sourceLabel: 'é' })] })).state).toBe('unclassified');
    const result = value(input({ operation, suggestions: [suggestion({ sourceLabel: 'e\u0301' })] }));
    expect(result).toMatchObject({ state: 'proposed', confirmed: null,
      operation: { facts: { category: { dictionaryStatus: 'ambiguous' } } } });
    expect(JSON.stringify(result)).not.toMatch(/categoryId|dictionaryId/);
  });

  it.each(['Выдача займа', 'Возврат займа', 'Перевод'])('does not infer any economic role or layer from %s', (label) => {
    const operation: CheckedOperationSnapshot = { ...expense(), dataset: 'expenses', facts: {
      timestamp: 1707523200000, kopecks: 1,
      category: { kind: 'label', value: label, dictionaryStatus: 'unresolved' },
    } };
    expect(value(input({ operation }))).toMatchObject({ state: 'unclassified', confirmed: null, economicRole: 'unknown' });
  });

  it.each<['expenses' | 'incomes', Exclude<ClassificationAssignment['economicRole'], 'ordinary_expense'>]>([
    ['expenses', 'loan_issuance'], ['incomes', 'loan_repayment'], ['incomes', 'refund'],
    ['expenses', 'internal_transfer'], ['incomes', 'capital_movement'],
  ])('keeps the explicitly reviewed %s/%s role outside ordinary spending', (dataset, economicRole) => {
    const operation = dataset === 'expenses' ? expense() : income();
    expect(value(input({ operation, decisions: [approval(operation, { economicRole, layer: null })] })))
      .toMatchObject({ state: 'approved', confirmed: { economicRole, layer: null } });
  });

  it.each([
    { economicRole: 'loan_issuance', layer: 'everyday' },
    { economicRole: 'refund', layer: 'irregular' },
    { economicRole: 'internal_transfer', layer: 'long_term_capital' },
    { economicRole: 'unknown', layer: 'everyday' },
    { economicRole: 'ordinary_expense', layer: null },
  ])('rejects an inconsistent role/layer combination %p', (assignment) => {
    expectError(malformed({ ...input(), decisions: [{ ...approval(), assignment }] }), 'invalid_decision');
  });

  it('rejects roles inconsistent with dataset and provenance inconsistent with source facts', () => {
    expectError(input({ operation: income(), decisions: [approval(income())] }), 'invalid_decision');
    expectError(malformed({ ...input(), decisions: [{ ...approval(), provenance: {
      kind: 'category_rule', ruleId: 'rule-a', ruleRevision: 'r1', sourceLabel: 'different-label',
    } }] }), 'invalid_decision');
    expectError(malformed({ ...input(), decisions: [{ ...decline(), assignment: everyday }] }), 'invalid_decision');
  });

  it.each(['', ' ', 'padded-id ', 'two words', null, 42])('rejects malformed identity %p on operations and candidates', (id) => {
    expectError(malformed({ ...input(), operation: { ...expense(), transactionId: id } }), 'invalid_operation');
    expectError(malformed({ ...input(), operation: { ...expense(), ownerScope: id } }), 'invalid_operation');
    expectError(malformed({ ...input(), suggestions: [{ ...suggestion(), id }] }), 'invalid_suggestion');
    expectError(malformed({ ...input(), decisions: [{ ...approval(), id }] }), 'invalid_decision');
  });

  it('rejects malformed state, provenance and dataset shapes without throwing', () => {
    expectError(malformed(null), 'invalid_operation');
    expectError(malformed({ ...input(), operation: { ...expense(), dataset: 'unknown' } }), 'invalid_operation');
    expectError(malformed({ ...input(), suggestions: null }), 'invalid_suggestion');
    expectError(malformed({ ...input(), suggestions: Array(1) }), 'invalid_suggestion');
    expectError(malformed({ ...input(), decisions: Array(1) }), 'invalid_decision');
    expectError(malformed({ ...input(), decisions: [{ ...approval(), state: 'proposed' }] }), 'invalid_decision');
    expectError(malformed({ ...input(), suggestions: [{ ...suggestion(), assignment: { economicRole: 'ordinary_income', layer: null } }] }), 'invalid_suggestion');
  });

  it('has deterministic error priority independent of candidate ordering', () => {
    const rules = [suggestion({ ownerScope: 'other-owner' }), suggestion({ id: 'rule-b', taxonomyVersion: 'future-taxonomy' })];
    expectError(input({ suggestions: rules }), 'owner_mismatch');
    expectError(input({ suggestions: [...rules].reverse() }), 'owner_mismatch');
  });

  it('returns identical complete results for reordered equivalent suggestions and decisions', () => {
    const rules = [suggestion({ id: 'rule-b' }), suggestion()];
    const reviews = [approval(expense(), everyday, 'decision-b'), approval()];
    expect(resolveClassification(input({ suggestions: rules }))).toEqual(resolveClassification(input({ suggestions: [...rules].reverse() })));
    expect(resolveClassification(input({ suggestions: rules, decisions: reviews })))
      .toEqual(resolveClassification(input({ suggestions: [...rules].reverse(), decisions: [...reviews].reverse() })));
  });

  it('does not mutate frozen inputs or share mutable nested output objects with them', () => {
    const deepFreeze = <T,>(data: T): T => {
      if (data && typeof data === 'object') { Object.values(data).forEach(deepFreeze); Object.freeze(data); }
      return data;
    };
    const data = deepFreeze(input({ suggestions: [suggestion()], decisions: [approval()] }));
    const before = JSON.stringify(data); const result = value(data);
    expect(JSON.stringify(data)).toBe(before);
    expect(result.operation).not.toBe(data.operation);
    expect(result.operation.facts).not.toBe(data.operation.facts);
    if (result.state !== 'approved') throw new Error('Expected synthetic approval');
    expect(result.decisions[0]).not.toBe(data.decisions[0]);
    expect(result.confirmed).not.toBe(everyday);
    const proposed = value(input({ suggestions: data.suggestions }));
    if (proposed.state !== 'proposed') throw new Error('Expected synthetic proposal');
    expect(proposed.proposal.suggestions[0]).not.toBe(data.suggestions[0]);
  });
});
