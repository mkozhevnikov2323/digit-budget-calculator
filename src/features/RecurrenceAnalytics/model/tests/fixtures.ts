import type { RecurrenceWindow } from '../types';

export const fixedWindow = { startMonth: '2025-01', endMonthExclusive: '2025-04' };
export const recurrenceFixture = (window: RecurrenceWindow = fixedWindow, owner = 'A') => {
  const start = Number(window.startMonth.slice(0, 4)) * 12 + Number(window.startMonth.slice(5)) - 1;
  const end = Number(window.endMonthExclusive.slice(0, 4)) * 12 + Number(window.endMonthExclusive.slice(5)) - 1;
  const months = Array.from({ length: end - start }, (_, i) => {
    const index = start + i;
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
  });
  const incomeMonths = months.length > 1 ? [months[0], months[months.length - 1]] : months;
  const common = { activeMonthCount: months.length, activeMonths: months,
    intervalsInMonths: months.slice(1).map(() => 1), longestConsecutiveMonths: months.length };
  return {
    version: 'observations-v0', window: { ...window }, coverage: {
      source: 'stored_records_only', historicalContinuity: 'unverified', atomicSnapshot: false, maxRecordsPerDataset: 1000,
    }, observations: [
      { group: { dataset: 'expenses', level: 'category_or_source',
        identity: { provenance: 'label_only', value: `Fictional category ${owner}` } }, operationCount: months.length + 1, ...common },
      { group: { dataset: 'expenses', level: 'similar_expense',
        identity: { provenance: 'label_only', value: `Fictional category ${owner}` },
        title: `Fictional shop ${owner}`, recipient: `Fictional recipient ${owner}` }, operationCount: months.length, ...common },
      { group: { dataset: 'incomes', level: 'category_or_source',
        identity: { provenance: 'label_only', value: `Fictional source ${owner}` } }, operationCount: incomeMonths.length,
      activeMonthCount: incomeMonths.length, activeMonths: incomeMonths,
      intervalsInMonths: incomeMonths.length > 1 ? [months.length - 1] : [], longestConsecutiveMonths: months.length === 2 ? 2 : 1 },
    ],
  };
};
