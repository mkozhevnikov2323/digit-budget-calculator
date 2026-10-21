import type { AnalyticsDataset, AnalyticsResult } from 'features/FinancialAnalytics/model/types';
import { validateExpenseResponse, validateIncomeResponse } from 'features/FinancialAnalytics/model/validation';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { canonicalId } from './contract';

export type HistoryOperation = Readonly<{ dataset: AnalyticsDataset; operationId: string; kopecks: number; timestamp: number;
  facts: Readonly<{ amount: number; date: string; category?: string; title?: string; recipient?: string; source?: string; comment?: string | null }> }>;
export type OwnedHistory = Readonly<{ owner: string; period: CalendarPeriod; operations: readonly HistoryOperation[] }>;

/** Reuse the existing complete-envelope/money/date validators. No category-based decisions. */
export const validateOwnedHistory = (expenses: unknown, incomes: unknown, period: CalendarPeriod, owner: string): AnalyticsResult<OwnedHistory> => {
  const e = validateExpenseResponse(expenses, period), i = validateIncomeResponse(incomes, period);
  if (!e.ok) return e; if (!i.ok) return i;
  if (!canonicalId(owner)) return { ok: false, error: { code: 'invalid_record' } };
  const operations: HistoryOperation[] = [];
  for (const [dataset, payload, checked] of [['expenses', expenses, e.value], ['incomes', incomes, i.value]] as const) {
    const raw = (payload as Record<string, unknown>)[dataset] as Record<string, unknown>[];
    for (let index = 0; index < checked.records.length; index++) {
      const r = raw[index], c = checked.records[index];
      if (!canonicalId(c.id) || r.owner !== owner || (dataset === 'expenses'
        ? !['category', 'title', 'recipient'].every(key => typeof r[key] === 'string') : typeof r.source !== 'string')
        || (Object.prototype.hasOwnProperty.call(r, 'comment') && r.comment !== null && typeof r.comment !== 'string'))
        return { ok: false, error: { code: 'invalid_record', dataset, index } };
      operations.push(Object.freeze({ dataset, operationId: c.id, kopecks: c.kopecks, timestamp: c.timestamp,
        facts: Object.freeze({ amount: r.amount as number, date: r.date as string,
          ...(dataset === 'expenses' ? { category: r.category as string, title: r.title as string, recipient: r.recipient as string }
            : { source: r.source as string }), ...(Object.prototype.hasOwnProperty.call(r, 'comment') ? { comment: r.comment as string | null } : {}) }) }));
    }
  }
  operations.sort((a, b) => a.timestamp - b.timestamp || a.dataset.localeCompare(b.dataset) || a.operationId.localeCompare(b.operationId));
  return { ok: true, value: Object.freeze({ owner, period: { ...period }, operations: Object.freeze(operations) }) };
};
