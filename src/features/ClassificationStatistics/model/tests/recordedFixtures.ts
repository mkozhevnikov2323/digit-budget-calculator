import { yearPeriod } from 'features/FinancialAnalytics/model/period';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import type { ClassificationRead } from 'features/HistoricalClassification/model/contract';
export const recordedCohort = (year = 2025): CoherentHistory => {
  const period = yearPeriod(year); if (!period.ok) throw Error('Fixture');
  const operations = Array.from({ length: 24 }, (_, index) => {
    const dataset = index % 2 ? 'incomes' as const : 'expenses' as const;
    const timestamp = Date.UTC(year, Math.floor(index / 2), 15, 12, 0, 0, 1);
    return { dataset, operationId: (index + 1).toString(16).padStart(24, '0'), timestamp, kopecks: dataset === 'expenses' ? 1234 : 5678,
      facts: { amount: dataset === 'expenses' ? 12.34 : 56.78, date: new Date(timestamp).toISOString(),
        ...(dataset === 'expenses' ? { category: 'Транспорт', title: 'Fictional fuel', recipient: 'Fictional shop' } : { source: 'Fictional salary' }) } };
  });
  const decisions: ClassificationRead[] = operations.map(op => ({ version: 'classification-read-v1', dataset: op.dataset, operationId: op.operationId,
    status: 'approved', storedState: 'approved', decisionRevision: 1, consistency: 'observed_only_non_atomic',
    confirmed: op.dataset === 'expenses' ? { economicRole: 'ordinary_expense', layer: 'everyday' } : { economicRole: 'ordinary_income', layer: null } }));
  return { history: { owner: 'a'.repeat(24), period: period.value, operations }, decisions, observedAt: Date.UTC(year + 1, 0, 2),
    observationId: 'fixture-coherent-observation', consistency: 'observed_only_non_atomic' };
};
