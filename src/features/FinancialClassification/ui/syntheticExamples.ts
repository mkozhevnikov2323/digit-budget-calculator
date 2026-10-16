import {
  PROVISIONAL_TAXONOMY_VERSION as version,
  type CategorySuggestion, type CheckedOperationSnapshot, type ClassificationAssignment,
  type ResolveClassificationInput, type ReviewedDecision,
} from '../model/types';

/** Synthetic checked facts only. Never pass API records or session data here. */
export type SyntheticClassificationExample = {
  readonly title: string;
  readonly input: ResolveClassificationInput;
};

/** Fresh fictional examples; fixed valid UTC timestamp and safe integer kopecks.
 * These are explicitly authored inputs, not inferred rules or review events. */
export const createSyntheticClassificationExamples = (): readonly SyntheticClassificationExample[] => {
  const expense: CheckedOperationSnapshot = {
    ownerScope: 'synthetic-preview-owner', dataset: 'expenses',
    transactionId: 'synthetic-shared-id', revision: 'synthetic-facts-v1',
    facts: { timestamp: 1830297600000, kopecks: 12345,
      category: { kind: 'label', value: 'Вымышленная категория Альфа', dictionaryStatus: 'unresolved' } },
  };
  const income: CheckedOperationSnapshot = {
    ownerScope: expense.ownerScope, dataset: 'incomes', transactionId: expense.transactionId,
    revision: 'synthetic-income-v1', facts: { timestamp: 1830297600000, kopecks: 67890,
      sourceLabel: 'Вымышленный источник Бета' },
  };
  const everyday: ClassificationAssignment = { economicRole: 'ordinary_expense', layer: 'everyday' };
  const irregular: ClassificationAssignment = { economicRole: 'ordinary_expense', layer: 'irregular' };
  const suggestion: CategorySuggestion = {
    id: 'synthetic-rule-a', ownerScope: expense.ownerScope, taxonomyVersion: version,
    ruleRevision: 'synthetic-rule-v1', sourceLabel: 'Вымышленная категория Альфа', assignment: everyday,
  };
  const approved = (assignment: ClassificationAssignment, id = 'synthetic-review-a'): ReviewedDecision => ({
    id, revision: 'synthetic-review-v1', taxonomyVersion: version, reviewerScope: expense.ownerScope,
    operation: expense, state: 'approved', assignment, provenance: { kind: 'manual' },
  });
  const input = (overrides: Partial<ResolveClassificationInput> = {}): ResolveClassificationInput => ({
    operation: expense, taxonomyVersion: version, suggestions: [], decisions: [], ...overrides,
  });
  const reviewed = approved(irregular);
  return [
    { title: 'Без назначения', input: input() },
    { title: 'Подсказка для повседневного расхода', input: input({ suggestions: [suggestion] }) },
    { title: 'Проверенный нерегулярный расход', input: input({ decisions: [reviewed] }) },
    { title: 'Явно оставить без классификации', input: input({ suggestions: [suggestion], decisions: [{
      id: 'synthetic-unclassified', revision: 'synthetic-review-v1', taxonomyVersion: version,
      reviewerScope: expense.ownerScope, operation: expense, state: 'explicit_unclassified', provenance: { kind: 'manual' },
    }] }) },
    { title: 'Выдача займа', input: input({ suggestions: [suggestion],
      decisions: [approved({ economicRole: 'loan_issuance', layer: null })] }) },
    { title: 'Конфликт подсказок', input: input({ suggestions: [suggestion,
      { ...suggestion, id: 'synthetic-rule-b', assignment: irregular }] }) },
    { title: 'Конфликт проверенных решений', input: input({ decisions: [reviewed,
      approved(everyday, 'synthetic-review-b')] }) },
    { title: 'Решение до изменения суммы', input: input({ operation: { ...expense,
      revision: 'synthetic-facts-v2', facts: { ...expense.facts, kopecks: 12346 } }, decisions: [reviewed] }) },
    { title: 'Другая область владельца', input: input({ decisions: [{ ...reviewed,
      reviewerScope: 'synthetic-other-owner' }] }) },
    { title: 'Несовпадение версии решения', input: input({ decisions: [{ ...reviewed,
      taxonomyVersion: 'synthetic-other-taxonomy' }] }) },
    { title: 'Неподдерживаемая таксономия', input: input({ taxonomyVersion: 'synthetic-future-taxonomy',
      decisions: [reviewed] }) },
    // Same ID and same candidate list: an expense review must not classify income.
    { title: 'Расход с общим ID', input: input({ decisions: [reviewed] }) },
    { title: 'Доход с общим ID', input: input({ operation: income, decisions: [reviewed] }) },
  ];
};
