import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { STABLE_TAXONOMY } from 'features/HistoricalClassification/model/contract';
import { monthKeys } from 'features/FinancialAnalytics/model/period';
import { sumKopecks } from 'features/FinancialAnalytics/model/money';
import { buildClassificationStatistics } from './statistics';

/** Only call with an accepted P5 adapter result. The local observation IDs join
 * this one returned cohort; they are not server revisions or cryptographic proof. */
export const recordedHistoryInput = (cohort: CoherentHistory, confirmedMonths: readonly string[] = []) => {
  const keys = monthKeys(cohort.history.period);
  return { version: 'classification-statistics-input-v1' as const, origin: 'coherent_adapter' as const,
    taxonomyVersion: STABLE_TAXONOMY, owner: cohort.history.owner, period: cohort.history.period, observedAt: cohort.observedAt,
    operations: cohort.history.operations.map((op, index) => ({ owner: cohort.history.owner, dataset: op.dataset,
      operationId: op.operationId, timestamp: op.timestamp, kopecks: op.kopecks, sourceObservationId: `accepted-observation-${index}` })),
    decisions: cohort.decisions.map((read, index) => ({ owner: cohort.history.owner, dataset: read.dataset,
      operationId: read.operationId, sourceObservationId: `accepted-observation-${index}`, read })),
    monthEvidence: keys.ok ? keys.value.map(key => ({ key, recording: confirmedMonths.includes(key) ? 'complete' as const : 'unverified' as const })) : [],
  };
};

export const recordedStatistics = (cohort: CoherentHistory) => buildClassificationStatistics(recordedHistoryInput(cohort));

/** Categories are an independent partition of recorded expenses, never a source
 * of classification authority. Reuse safe money arithmetic and verify its sum. */
export const recordedCategories = (cohort: CoherentHistory): { category: string; kopecks: number; count: number }[] | null => {
  const stats = recordedStatistics(cohort); if (!stats.ok) return null;
  const groups = new Map<string, { category: string; kopecks: number; count: number }>();
  for (const op of cohort.history.operations) {
    if (op.dataset !== 'expenses') continue;
    const category = op.facts.category; if (typeof category !== 'string') return null;
    const group = groups.get(category) ?? { category, kopecks: 0, count: 0 };
    const amount = sumKopecks([group.kopecks, op.kopecks]); if (!amount.ok) return null;
    group.kopecks = amount.value; group.count++; groups.set(category, group);
  }
  const result = [...groups.values()].sort((a, b) => a.category.localeCompare(b.category));
  const total = sumKopecks(result.map(x => x.kopecks));
  return total.ok && total.value === stats.value.expenses.recorded.kopecks
    && result.reduce((n, x) => n + x.count, 0) === stats.value.expenses.recorded.count ? result : null;
};
