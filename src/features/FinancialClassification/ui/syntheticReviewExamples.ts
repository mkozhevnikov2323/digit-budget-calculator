import { customPeriod } from '../../FinancialAnalytics/model/period';
import { buildClassificationSnapshots, type ClassificationSnapshots, type LocalSnapshotRevision } from '../model/snapshotAdapter';
import { PROVISIONAL_TAXONOMY_VERSION, type CategorySuggestion } from '../model/types';

export type SyntheticReviewExamples = {
  readonly sessionId: string;
  readonly ownerScope: string;
  readonly snapshots: ClassificationSnapshots;
  readonly suggestions: readonly CategorySuggestion[];
};

/** Fixed fictional API-shaped data, validated by the real adapter. No decisions
 * are pre-created; only explicit UI interactions can create local drafts. */
export const createSyntheticReviewExamples = (
  ownerScope = 'synthetic-review-owner', sessionId = 'synthetic-session-a',
): SyntheticReviewExamples => {
  const period = customPeriod('2028-02-01', '2028-02-29');
  if (!period.ok) throw new Error('Invalid fixed synthetic period');
  const expenses = [
    { _id: 'synthetic-shared-id', amount: 123.45, date: '2028-02-10T12:00:00Z', category: 'Вымышленная категория Альфа' },
    { _id: 'synthetic-unclassified', amount: 0.01, date: '2028-02-11', category: 'Выдача займа' },
  ];
  const incomes = [{ _id: 'synthetic-shared-id', amount: 678.90, date: '2028-02-10T12:00:00Z', source: 'Вымышленный источник Бета' }];
  const revisions: LocalSnapshotRevision[] = [
    ...expenses.map((record): LocalSnapshotRevision => ({ kind: 'caller_local', ownerScope,
      dataset: 'expenses', transactionId: record._id, revision: 'synthetic-expense-v1' })),
    ...incomes.map((record): LocalSnapshotRevision => ({ kind: 'caller_local', ownerScope,
      dataset: 'incomes', transactionId: record._id, revision: 'synthetic-income-v1' })),
  ];
  const snapshots = buildClassificationSnapshots({ ownerScope, period: period.value, revisions,
    expenseResponse: { total: expenses.length, page: 1, limit: expenses.length, expenses },
    incomeResponse: { total: incomes.length, page: 1, limit: incomes.length, incomes } });
  if (!snapshots.ok) throw new Error('Invalid fixed synthetic review data');
  return { ownerScope, sessionId, snapshots: snapshots.value, suggestions: [{
    id: 'synthetic-explicit-category-rule', ownerScope, taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION,
    ruleRevision: 'synthetic-rule-v1', sourceLabel: 'Вымышленная категория Альфа',
    assignment: { economicRole: 'ordinary_expense', layer: 'everyday' },
  }] };
};
