import { yearPeriod } from 'features/FinancialAnalytics/model/period';
import { STABLE_TAXONOMY, type ClassificationStatus, type StableRole } from 'features/HistoricalClassification/model/contract';
import type { FinancialLayer } from 'features/FinancialClassification/model/types';
import { buildClassificationStatistics } from './statistics';

/** Fictional local examples only; never a conversion of real API records. */
export const syntheticHistoryInput = (year = 2025, includeUnreviewed = true) => {
  const period = yearPeriod(year); if (!period.ok) throw Error('Invalid synthetic year');
  const owner = 'a'.repeat(24), operations: object[] = [], decisions: object[] = [];
  const add = (month: number, amount: number, status: ClassificationStatus, role: StableRole, layer: FinancialLayer | null, dataset: 'expenses' | 'incomes' = 'expenses') => {
    const operationId = (operations.length + 1).toString(16).padStart(24, '0'), sourceObservationId = `fictional-${operationId}`;
    operations.push({ owner, dataset, operationId, sourceObservationId, kopecks: amount,
      timestamp: Date.parse(`${year}-${String(month).padStart(2, '0')}-10T12:00:00Z`) });
    decisions.push({ owner, dataset, operationId, sourceObservationId, read: { version: 'classification-read-v1', dataset, operationId,
      status, storedState: status === 'unreviewed' || status === 'blocked' ? null : status === 'stale' ? 'approved' : status,
      decisionRevision: status === 'unreviewed' || status === 'blocked' ? null : 1,
      confirmed: status === 'approved' ? { economicRole: role, layer } : null, consistency: 'observed_only_non_atomic' } });
  };
  for (let month = 1; month <= 12; month++) {
    add(month, 100000 + month * 100, 'approved', 'ordinary_expense', 'everyday');
    if (month % 3 === 0) add(month, 30000, 'approved', 'ordinary_expense', 'irregular');
    add(month, 300000, 'approved', 'ordinary_income', null, 'incomes');
    if (includeUnreviewed) add(month, 5000, 'unreviewed', 'ordinary_expense', 'everyday');
  }
  add(5, 200000, 'approved', 'ordinary_expense', 'major_goals');
  add(7, 60000, 'approved', 'ordinary_expense', 'emergency');
  add(8, 10000, 'approved', 'ordinary_expense', 'long_term_capital');
  add(9, 80000, 'approved', 'loan_issuance', null);
  return { version: 'classification-statistics-input-v1', origin: 'synthetic', taxonomyVersion: STABLE_TAXONOMY,
    owner, period: period.value, observedAt: period.value.endExclusive, operations, decisions,
    monthEvidence: Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, recording: 'complete' })) };
};
export const syntheticClassifiedHistory = (year = 2025, includeUnreviewed = true) => buildClassificationStatistics(syntheticHistoryInput(year, includeUnreviewed));
