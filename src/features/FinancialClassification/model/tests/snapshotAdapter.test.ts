/** @jest-environment node */
import * as validation from '../../../FinancialAnalytics/model/validation';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from '../../../FinancialAnalytics/model/tests/fixtures';
import { resolveClassification } from '../classification';
import { PROVISIONAL_TAXONOMY_VERSION as taxonomyVersion, type ReviewedDecision } from '../types';
import {
  buildClassificationSnapshots, type ClassificationSnapshotInput, type ExpenseCategoryEvidence,
  type LocalSnapshotRevision, type SnapshotAdapterError,
} from '../snapshotAdapter';

const ownerScope = 'synthetic-adapter-owner';
const expenseId = 'synthetic-expense';
const incomeId = 'synthetic-income';
const rawExpense = (amount: unknown = 0.01, category: unknown = 'Вымышленная категория', date: unknown = '2024-02-10T12:00:00Z') =>
  expense(expenseId, amount, category, date);
const rawIncome = (amount: unknown = 0.01, source: unknown = 'Вымышленный источник', date: unknown = '2024-02-10T12:00:00Z') =>
  income(incomeId, amount, source, date);
const revision = (dataset: 'expenses' | 'incomes', transactionId = dataset === 'expenses' ? expenseId : incomeId): LocalSnapshotRevision => ({
  kind: 'caller_local', ownerScope, dataset, transactionId, revision: 'synthetic-local-v1',
});
const evidence = (category: ExpenseCategoryEvidence['category']): ExpenseCategoryEvidence => ({
  ownerScope, dataset: 'expenses', transactionId: expenseId, category,
});
const input = (overrides: Partial<ClassificationSnapshotInput> = {}): ClassificationSnapshotInput => ({
  expenseResponse: expenseResponse([rawExpense()]), incomeResponse: incomeResponse([rawIncome()]),
  period: selectedPeriod(), ownerScope, revisions: [revision('expenses'), revision('incomes')], ...overrides,
});
const value = (data: ClassificationSnapshotInput) => {
  const result = buildClassificationSnapshots(data);
  if (!result.ok) throw new Error(`Unexpected synthetic adapter error: ${result.error.code}`);
  return result.value;
};
const expectError = (data: ClassificationSnapshotInput, error: Partial<SnapshotAdapterError>) => {
  const result = buildClassificationSnapshots(data);
  expect(result).toMatchObject({ ok: false, error });
  expect(result).not.toHaveProperty('value');
  expect(JSON.stringify(result)).not.toMatch(/synthetic-|Вымышленн|"(?:amount|category|sourceLabel|revision)":/);
};
// Exercise malformed runtime boundary inputs without weakening the public API.
const malformed = (data: unknown) => data as ClassificationSnapshotInput;
const deepFreeze = <T,>(data: T): T => {
  if (data && typeof data === 'object') { Object.values(data).forEach(deepFreeze); Object.freeze(data); }
  return data;
};

describe('pure classification snapshot adapter with real Phase 1 validators', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => { fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Network forbidden'); }); });
  afterEach(() => {
    try { expect(fetchSpy).not.toHaveBeenCalled(); } finally { jest.restoreAllMocks(); }
  });

  it('returns complete checked expense/income snapshots and explicitly local revision authority', () => {
    expect(value(input())).toEqual({ revisionAuthority: 'caller_local',
      expenses: [{ ownerScope, dataset: 'expenses', transactionId: expenseId, revision: 'synthetic-local-v1',
        facts: { timestamp: 1707566400000, kopecks: 1,
          category: { kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'unresolved' } } }],
      incomes: [{ ownerScope, dataset: 'incomes', transactionId: incomeId, revision: 'synthetic-local-v1',
        facts: { timestamp: 1707566400000, kopecks: 1, sourceLabel: 'Вымышленный источник' } }],
    });
  });

  it('accepts complete zero-transaction datasets and explicit empty revision metadata', () => {
    expect(value(input({ expenseResponse: expenseResponse(), incomeResponse: incomeResponse(), revisions: [] })))
      .toEqual({ revisionAuthority: 'caller_local', expenses: [], incomes: [] });
  });

  it.each(['expenses', 'incomes'] as const)('preserves authoritative money/date results exactly for %s', (dataset) => {
    const record = dataset === 'expenses' ? rawExpense(0.29, 'Вымышленная категория', '2024-03-01T01:00:00.123+03:00')
      : rawIncome(0.29, '  Вымышленный источник e\u0301  ', '2024-03-01T01:00:00.123+03:00');
    const data = input(dataset === 'expenses' ? { expenseResponse: expenseResponse([record]) } : { incomeResponse: incomeResponse([record]) });
    const checked = dataset === 'expenses' ? validation.validateExpenseResponse(data.expenseResponse, data.period)
      : validation.validateIncomeResponse(data.incomeResponse, data.period);
    if (!checked.ok) throw new Error('Invalid synthetic validator fixture');
    const snapshot = value(data)[dataset][0];
    expect(snapshot.facts.kopecks).toBe(checked.value.records[0].kopecks);
    expect(snapshot.facts.timestamp).toBe(checked.value.records[0].timestamp);
    expect(snapshot.facts.kopecks).toBe(29);
    expect(snapshot.facts.timestamp).toBe(1709244000123);
    if (snapshot.dataset === 'incomes') expect(snapshot.facts.sourceLabel).toBe('  Вымышленный источник e\u0301  ');
  });

  it.each(['expenses', 'incomes'] as const)('rejects unsupported precision in %s without partial snapshots', (dataset) => {
    expectError(input(dataset === 'expenses' ? { expenseResponse: expenseResponse([rawExpense(1.005)]) }
      : { incomeResponse: incomeResponse([rawIncome(1.005)]) }),
    { code: 'invalid_amount', dataset, cause: 'unsupported_precision' });
  });

  it.each([-1, NaN, '0.01'])('rejects invalid amounts %p through Phase 1', (amount) => {
    expectError(input({ expenseResponse: expenseResponse([rawExpense(amount)]) }), { code: 'invalid_amount', dataset: 'expenses' });
  });

  it.each<[string, 'invalid_date' | 'outside_period']>([
    ['2024-02-30', 'invalid_date'], ['2024-02-10T12:00:00', 'invalid_date'],
    ['2024-03-01T00:00:00Z', 'outside_period'],
  ])('preserves date diagnostics for %s', (date, code) => {
    expectError(input({ incomeResponse: incomeResponse([rawIncome(1, 'Вымышленный источник', date)]) }), { code, dataset: 'incomes' });
  });

  it('validates the entire period, even for empty datasets', () => {
    expectError(input({ period: { ...selectedPeriod(), endExclusive: NaN },
      expenseResponse: expenseResponse(), incomeResponse: incomeResponse(), revisions: [] }),
    { code: 'invalid_period', cause: 'invalid_range' });
  });

  it.each(['expenses', 'incomes'] as const)('rejects incomplete and duplicate-ID %s responses', (dataset) => {
    const badResponse = dataset === 'expenses' ? { expenseResponse: expenseResponse([rawExpense()], { total: 2 }) }
      : { incomeResponse: incomeResponse([rawIncome()], { total: 2 }) };
    expectError(input(badResponse), { code: 'incomplete_response', dataset });
    const duplicates = dataset === 'expenses' ? { expenseResponse: expenseResponse([rawExpense(), rawExpense()]) }
      : { incomeResponse: incomeResponse([rawIncome(), rawIncome()]) };
    expectError(input(duplicates), { code: 'duplicate_id', dataset });
  });

  it('does not bypass authoritative response metadata or aggregate-overflow checks', () => {
    expectError(input({ expenseResponse: expenseResponse([rawExpense()], { page: 2 }) }), { code: 'invalid_metadata' });
    expectError(input({ expenseResponse: expenseResponse([rawExpense(5e13), { ...rawExpense(5e13), _id: 'synthetic-second' }]) }),
      { code: 'overflow', cause: 'overflow' });
    expectError(input({ incomeResponse: undefined }), { code: 'invalid_response', dataset: 'incomes' });
  });

  it('preserves same IDs across collections, regardless of contradictory raw owner fields', () => {
    const shared = 'synthetic-shared';
    const data = input({ expenseResponse: expenseResponse([{ ...rawExpense(), _id: shared, owner: 'synthetic-untrusted-owner' }]),
      incomeResponse: incomeResponse([{ ...rawIncome(), _id: shared }]),
      revisions: [revision('incomes', shared), revision('expenses', shared)] });
    const snapshots = value(data);
    expect(snapshots.expenses[0]).toMatchObject({ dataset: 'expenses', transactionId: shared, ownerScope });
    expect(snapshots.incomes[0]).toMatchObject({ dataset: 'incomes', transactionId: shared, ownerScope });
    expect(snapshots.expenses[0]).not.toHaveProperty('owner');
  });

  it('distinguishes missing and null categories from every actual string without changing analytics', () => {
    const { category: omitted, ...withoutCategory } = rawExpense();
    expect(omitted).toBe('Вымышленная категория');
    for (const record of [withoutCategory, rawExpense(1, null), { ...rawExpense(), category: undefined }]) {
      expect(value(input({ expenseResponse: expenseResponse([record]) })).expenses[0].facts.category).toEqual({ kind: 'absent' });
    }
  });

  it.each(['', 'Без категории', '  Вымышленная категория  ', '  ', 'é', 'e\u0301', '__proto__', 'constructor'])('preserves exact category provenance for %p', (category) => {
    const data = input({ expenseResponse: expenseResponse([rawExpense(0.01, category)]) });
    expect(value(data).expenses[0].facts.category).toEqual({ kind: 'label', value: category, dictionaryStatus: 'unresolved' });
    // Phase 1 retains its existing grouping; the adapter does not modify it.
    const analytics = validation.validateExpenseResponse(data.expenseResponse, data.period);
    expect(analytics).toMatchObject({ ok: true, value: { records: [{ category: category.trim() || 'Без категории' }] } });
  });

  it('retains explicit ambiguous evidence without claiming a dictionary identity', () => {
    const result = value(input({ categoryEvidence: [evidence({ kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'ambiguous' })] }));
    expect(result.expenses[0].facts.category).toEqual({ kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'ambiguous' });
    expect(JSON.stringify(result)).not.toMatch(/categoryId|dictionaryId/);
  });

  it.each([
    { kind: 'absent' },
    { kind: 'label', value: 'вымышленная категория', dictionaryStatus: 'ambiguous' },
    { kind: 'label', value: ' Вымышленная категория ', dictionaryStatus: 'unresolved' },
  ] as const)('rejects evidence inconsistent with the exact original source: %p', (category) => {
    expectError(input({ categoryEvidence: [evidence(category)] }), { code: 'inconsistent_category_provenance', reason: 'source_mismatch' });
  });

  it('does not equate absent category with literal Без категории', () => {
    expectError(input({ expenseResponse: expenseResponse([rawExpense(1, null)]), categoryEvidence: [
      evidence({ kind: 'label', value: 'Без категории', dictionaryStatus: 'unresolved' }),
    ] }), { code: 'inconsistent_category_provenance', reason: 'source_mismatch' });
    expect(value(input({ expenseResponse: expenseResponse([rawExpense(1, null)]), categoryEvidence: [evidence({ kind: 'absent' })] }))
      .expenses[0].facts.category).toEqual({ kind: 'absent' });
  });

  it.each([undefined, null, '', ' ', 'synthetic owner', 12])('rejects missing/malformed owner scope %p', (owner) => {
    expectError(malformed({ ...input(), ownerScope: owner }), { code: 'invalid_owner_scope' });
  });

  it.each<[unknown, 'missing' | 'malformed' | 'owner_mismatch' | 'unknown_operation' | 'duplicate']>([
    [undefined, 'missing'], [null, 'malformed'], [{}, 'malformed'], [Array(1), 'malformed'],
    [[], 'missing'], [[revision('expenses')], 'missing'],
    [[{ ...revision('expenses'), kind: 'backend_version' }], 'malformed'],
    [[{ ...revision('expenses'), revision: '' }], 'malformed'],
    [[{ ...revision('expenses'), revision: 'padded ' }], 'malformed'],
    [[{ ...revision('expenses'), ownerScope: 'synthetic-other-owner' }], 'owner_mismatch'],
    [[{ ...revision('expenses'), dataset: 'unknown' }], 'malformed'],
    [[revision('expenses', 'synthetic-unknown')], 'unknown_operation'],
    [[revision('expenses'), revision('expenses'), revision('incomes')], 'duplicate'],
    [[revision('expenses'), { ...revision('expenses'), revision: 'synthetic-local-v2' }, revision('incomes')], 'duplicate'],
  ])('fails explicitly for invalid revision metadata %#', (revisions, reason) => {
    expectError(malformed({ ...input(), revisions }), { code: 'invalid_revision_metadata', reason });
  });

  it.each<[unknown, 'malformed' | 'owner_mismatch' | 'unknown_operation' | 'duplicate']>([
    [null, 'malformed'], [Array(1), 'malformed'],
    [[{ ...evidence({ kind: 'absent' }), dataset: 'incomes' }], 'malformed'],
    [[{ ...evidence({ kind: 'absent' }), ownerScope: 'synthetic-other-owner' }], 'owner_mismatch'],
    [[{ ...evidence({ kind: 'absent' }), transactionId: 'synthetic-unknown' }], 'unknown_operation'],
    [[evidence({ kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'unresolved' }),
      evidence({ kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'ambiguous' })], 'duplicate'],
    [[{ ...evidence({ kind: 'absent' }), category: { kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'resolved' } }], 'malformed'],
  ])('rejects malformed/foreign/conflicting category evidence %#', (categoryEvidence, reason) => {
    expectError(malformed({ ...input(), categoryEvidence }), { code: 'inconsistent_category_provenance', reason });
  });

  it('joins original categories by validated ID even if validated record ordering differs', () => {
    const validate = validation.validateExpenseResponse;
    jest.spyOn(validation, 'validateExpenseResponse').mockImplementation((...args) => {
      const result = validate(...args);
      return result.ok ? { ok: true, value: { ...result.value, records: [...result.value.records].reverse() } } : result;
    });
    const data = input({ expenseResponse: expenseResponse([rawExpense(0.01, '  Альфа  '),
      { ...rawExpense(0.02, 'Бета'), _id: 'synthetic-second' }]),
      revisions: [revision('expenses'), revision('expenses', 'synthetic-second'), revision('incomes')] });
    expect(value(data).expenses.map((item) => item.facts)).toEqual([
      { timestamp: 1707566400000, kopecks: 1, category: { kind: 'label', value: '  Альфа  ', dictionaryStatus: 'unresolved' } },
      { timestamp: 1707566400000, kopecks: 2, category: { kind: 'label', value: 'Бета', dictionaryStatus: 'unresolved' } },
    ]);
  });

  it('produces deterministic results without mutating frozen inputs or aliasing category evidence', () => {
    const expenses = [rawExpense(), { ...rawExpense(0.02, 'Бета'), _id: 'synthetic-second' }];
    const incomes = [rawIncome(), { ...rawIncome(0, 'Гамма'), _id: 'synthetic-second' }];
    const revisions = [revision('expenses'), revision('expenses', 'synthetic-second'), revision('incomes'), revision('incomes', 'synthetic-second')];
    const categoryEvidence = [evidence({ kind: 'label', value: 'Вымышленная категория', dictionaryStatus: 'ambiguous' }),
      { ...evidence({ kind: 'label', value: 'Бета', dictionaryStatus: 'unresolved' }), transactionId: 'synthetic-second' }];
    const data = deepFreeze(input({ expenseResponse: expenseResponse(expenses), incomeResponse: incomeResponse(incomes), revisions, categoryEvidence }));
    const before = JSON.stringify(data);
    const result = value(data);
    expect(value(input({ expenseResponse: expenseResponse([...expenses].reverse().map((record) => ({ ...record, unrelated: 'ignored' }))),
      incomeResponse: incomeResponse([...incomes].reverse()), revisions: [...revisions].reverse(), categoryEvidence: [...categoryEvidence].reverse() }))).toEqual(result);
    expect(JSON.stringify(data)).toBe(before);
    expect(result.expenses[0].facts.category).not.toBe(categoryEvidence[0].category);
    expect(result.expenses[0]).not.toBe(expenses[0]);
  });

  it('passes checked snapshots to the unchanged resolver and detects stale facts/local revisions', () => {
    const current = value(input());
    for (const operation of [...current.expenses, ...current.incomes]) {
      expect(resolveClassification({ operation, taxonomyVersion, suggestions: [], decisions: [] }))
        .toMatchObject({ ok: true, value: { state: 'unclassified', operation } });
    }
    const reviewed: ReviewedDecision = { id: 'synthetic-review', revision: 'synthetic-review-v1', taxonomyVersion,
      reviewerScope: ownerScope, operation: current.expenses[0], state: 'approved',
      assignment: { economicRole: 'ordinary_expense', layer: 'everyday' }, provenance: { kind: 'manual' } };
    const changedAmount = value(input({ expenseResponse: expenseResponse([rawExpense(0.02)]) }));
    const changedRevision = value(input({ revisions: [{ ...revision('expenses'), revision: 'synthetic-local-v2' }, revision('incomes')] }));
    for (const operation of [changedAmount.expenses[0], changedRevision.expenses[0]]) {
      expect(resolveClassification({ operation, taxonomyVersion, suggestions: [], decisions: [reviewed] }))
        .toEqual({ ok: false, error: { code: 'stale_decision' } });
    }
  });
});
