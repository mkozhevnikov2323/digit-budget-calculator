import { customPeriod } from '../period';

export const selectedPeriod = (first = '2024-02-01', last = '2024-02-29') => {
  const result = customPeriod(first, last);
  if (!result.ok) throw new Error('Invalid synthetic test period');
  return result.value;
};
export const expense = (
  id = 'expense-1', amount: unknown = 1, category: unknown = 'Еда', date: unknown = '2024-02-10T12:00:00Z',
) => ({ _id: id, amount, category, date, title: 'Synthetic item', recipient: 'Synthetic recipient' });
export const income = (
  id = 'income-1', amount: unknown = 1, source: unknown = 'Salary', date: unknown = '2024-02-10T12:00:00Z',
) => ({ _id: id, amount, source, date });
export const expenseResponse = (records: readonly unknown[] = [], metadata: Record<string, unknown> = {}) =>
  ({ total: records.length, page: 1, limit: records.length, expenses: records, ...metadata });
export const incomeResponse = (records: readonly unknown[] = [], metadata: Record<string, unknown> = {}) =>
  ({ total: records.length, page: 1, limit: records.length, incomes: records, ...metadata });
