import { sumKopecks, subtractKopecks } from './money';
import { monthKeys, type CalendarPeriod } from './period';
import { validateExpenseResponse, validateIncomeResponse } from './validation';
import type { AnalyticsResult, CategoryTotal, FinancialAnalytics } from './types';

/** Adapted from legacy calculations.ts: raw recorded totals, Map groups and
 * zero-filled months. Money/period algorithms remain authoritative in PR #6.
 * A failure contains no partial totals. All outputs are new derived objects.
 */
export const buildAnalytics = (
  expenseResponse: unknown, incomeResponse: unknown, period: CalendarPeriod,
): AnalyticsResult<FinancialAnalytics> => {
  const expenses = validateExpenseResponse(expenseResponse, period);
  if (!expenses.ok) return expenses;
  const incomes = validateIncomeResponse(incomeResponse, period);
  if (!incomes.ok) return incomes;
  const months = monthKeys(period);
  if (!months.ok) return { ok: false, error: { code: 'invalid_period', cause: months.error } };
  const difference = subtractKopecks(incomes.value.totalKopecks, expenses.value.totalKopecks);
  if (!difference.ok) return { ok: false, error: { code: 'overflow', cause: difference.error } };

  const groups = new Map<string, CategoryTotal>();
  const monthly = new Map(months.value.map((key) => [key, 0]));
  const ledger = new Map(months.value.map(key => [key, { key, expenseKopecks: 0,
    incomeKopecks: 0, expenseCount: 0, incomeCount: 0 }]));
  for (const expense of expenses.value.records) {
    const group = groups.get(expense.category) ?? { category: expense.category, kopecks: 0, count: 0, share: 0 };
    const groupSum = sumKopecks([group.kopecks, expense.kopecks]);
    const month = new Date(expense.timestamp).toISOString().slice(0, 7);
    const previousMonth = monthly.get(month);
    if (previousMonth === undefined) return { ok: false, error: { code: 'outside_period', dataset: 'expenses' } };
    const monthSum = sumKopecks([previousMonth, expense.kopecks]);
    if (!groupSum.ok || !monthSum.ok) return { ok: false, error: { code: 'overflow', dataset: 'expenses' } };
    groups.set(expense.category, { ...group, kopecks: groupSum.value, count: group.count + 1 });
    monthly.set(month, monthSum.value);
    const entry = ledger.get(month)!;
    entry.expenseKopecks = monthSum.value;
    entry.expenseCount += 1;
  }
  for (const income of incomes.value.records) {
    const entry = ledger.get(new Date(income.timestamp).toISOString().slice(0, 7));
    if (!entry) return { ok: false, error: { code: 'outside_period', dataset: 'incomes' } };
    const sum = sumKopecks([entry.incomeKopecks, income.kopecks]);
    if (!sum.ok) return { ok: false, error: { code: 'overflow', dataset: 'incomes' } };
    entry.incomeKopecks = sum.value;
    entry.incomeCount += 1;
  }
  const issued = sumKopecks(expenses.value.records.filter((record) => record.isLoanIssuance).map((record) => record.kopecks));
  const returned = sumKopecks(incomes.value.records.filter((record) => record.source === 'Возврат займа').map((record) => record.kopecks));
  if (!issued.ok || !returned.ok) return { ok: false, error: { code: 'overflow' } };

  const expenseKopecks = expenses.value.totalKopecks;
  const categories = [...groups.values()].map((group) => ({
    ...group,
    share: expenseKopecks === 0 ? 0 : group.kopecks / expenseKopecks * 100,
  })).sort((a, b) => b.kopecks - a.kopecks || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));

  return {
    ok: true,
    value: {
      period: { ...period },
      incomeKopecks: incomes.value.totalKopecks,
      expenseKopecks,
      differenceKopecks: difference.value,
      incomeCount: incomes.value.records.length,
      expenseCount: expenses.value.records.length,
      categories,
      dynamics: [...monthly].map(([key, kopecks]) => ({ key, kopecks })),
      months: [...ledger.values()],
      loans: { issuedKopecks: issued.value, returnedKopecks: returned.value },
    },
  };
};
