/** @jest-environment node */
import { buildAnalytics } from '../calculations';
import { formatKopecks } from '../money';
import type { FinancialAnalytics } from '../types';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from './fixtures';

const analyticsValue = (result: ReturnType<typeof buildAnalytics>): FinancialAnalytics => {
  if (!result.ok) throw new Error(`Expected valid synthetic analytics: ${result.error.code}`);
  return result.value;
};

describe('complete recorded financial analytics', () => {
  it('adapts legacy totals/groups/counts using exact PR #6 kopecks', () => {
    const data = analyticsValue(buildAnalytics(expenseResponse([
      expense('1', 0.1), expense('2', 0.2), expense('3', 0.7, 'Транспорт'),
    ]), incomeResponse([income('i', 2)]), selectedPeriod()));
    expect(data).toMatchObject({ incomeKopecks: 200, expenseKopecks: 100, differenceKopecks: 100,
      expenseCount: 3, incomeCount: 1 });
    expect(data.categories).toEqual([
      { category: 'Транспорт', kopecks: 70, count: 1, share: 70 },
      { category: 'Еда', kopecks: 30, count: 2, share: 30 },
    ]);
    expect(formatKopecks(data.categories[1].kopecks)).toEqual({ ok: true, value: '0,30 ₽' });
    expect(data.dynamics).toEqual([{ key: '2024-02', kopecks: 100 }]);
  });

  it('rejects legacy half-up rounding and never returns partial totals', () => {
    const result = buildAnalytics(expenseResponse([expense('valid', 100), expense('unsupported', 1.005)]), incomeResponse(), selectedPeriod());
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_amount', cause: 'unsupported_precision' } });
    expect(result).not.toHaveProperty('value');
  });

  it('returns real zero totals for a successfully loaded empty period', () => {
    const data = analyticsValue(buildAnalytics(expenseResponse(), incomeResponse(), selectedPeriod()));
    expect(data).toMatchObject({ incomeKopecks: 0, expenseKopecks: 0, differenceKopecks: 0,
      incomeCount: 0, expenseCount: 0, categories: [], dynamics: [{ key: '2024-02', kopecks: 0 }],
      loans: { issuedKopecks: 0, returnedKopecks: 0 } });
  });

  it('counts zero-valued operations without dividing by zero and permits negative differences', () => {
    const zero = analyticsValue(buildAnalytics(expenseResponse([expense('zero', 0)]), incomeResponse(), selectedPeriod()));
    expect(zero.expenseCount).toBe(1);
    expect(zero.categories[0].share).toBe(0);
    expect(analyticsValue(buildAnalytics(expenseResponse([expense()]), incomeResponse(), selectedPeriod())).differenceKopecks).toBe(-100);
  });

  it('safely groups special object-key names and labels missing categories', () => {
    const data = analyticsValue(buildAnalytics(expenseResponse([
      expense('1', 1, 'constructor'), expense('2', 2, '__proto__'), expense('3', 3, 'toString'),
      expense('4', 1, null), { ...expense('5'), category: undefined }, expense('6', 1, '   '),
    ]), incomeResponse(), selectedPeriod()));
    expect(data.categories).toContainEqual({ category: 'Без категории', kopecks: 300, count: 3, share: 300 / 900 * 100 });
    expect(data.categories.find((group) => group.category === 'constructor')?.kopecks).toBe(100);
    expect(data.categories.find((group) => group.category === '__proto__')?.kopecks).toBe(200);
    expect(data.expenseKopecks).toBe(900);
  });

  it('returns every category and sorts equal totals by deterministic names', () => {
    const records = Array.from({ length: 16 }, (_, index) => expense(`e-${index}`, 1, `Category ${String(15 - index).padStart(2, '0')}`));
    const data = analyticsValue(buildAnalytics(expenseResponse(records), incomeResponse(), selectedPeriod()));
    expect(data.categories).toHaveLength(16);
    expect(data.categories.map((group) => group.category)).toEqual(
      Array.from({ length: 16 }, (_, index) => `Category ${String(index).padStart(2, '0')}`),
    );
    expect(data.categories[0].share).toBe(6.25);
  });

  it('retains loan transfers in raw cash flow with exact-label subtotals only', () => {
    const data = analyticsValue(buildAnalytics(expenseResponse([
      expense('loan', 1000, 'Выдача займа'), expense('ordinary', 100),
    ]), incomeResponse([income('repayment', 500, 'Возврат займа'), income('salary', 200)]), selectedPeriod()));
    expect(data).toMatchObject({ expenseKopecks: 110000, incomeKopecks: 70000, differenceKopecks: -40000,
      expenseCount: 2, incomeCount: 2, loans: { issuedKopecks: 100000, returnedKopecks: 50000 } });
    const similar = analyticsValue(buildAnalytics(expenseResponse([expense('e', 1, ' Выдача займа ')]),
      incomeResponse([income('i', 1, 'Возврат займа ')]), selectedPeriod()));
    expect(similar.loans).toEqual({ issuedKopecks: 0, returnedKopecks: 0 });
    expect(similar.expenseKopecks).toBe(100);
    expect(similar.incomeKopecks).toBe(100);
  });

  it('keeps chronological monthly buckets and fills missing months across years', () => {
    const period = selectedPeriod('2023-11-14', '2025-02-01');
    const data = analyticsValue(buildAnalytics(expenseResponse([
      expense('last', 1, 'Еда', '2025-02-01'), expense('earlier', 2, 'Еда', '2023-12-10'),
    ]), incomeResponse(), period));
    expect(data.dynamics).toHaveLength(16);
    expect(data.dynamics.slice(0, 3)).toEqual([
      { key: '2023-11', kopecks: 0 }, { key: '2023-12', kopecks: 200 }, { key: '2024-01', kopecks: 0 },
    ]);
    expect(data.dynamics[15]).toEqual({ key: '2025-02', kopecks: 100 });
  });

  it('uses the actual UTC instant for offset dates, includes the final day and excludes the next midnight', () => {
    const data = analyticsValue(buildAnalytics(expenseResponse([
      expense('late', 1, 'Еда', '2024-02-29T23:59:59.999Z'),
      expense('offset', 2, 'Еда', '2024-03-01T01:00:00+03:00'),
    ]), incomeResponse(), selectedPeriod()));
    expect(data.dynamics).toEqual([{ key: '2024-02', kopecks: 300 }]);
    expect(buildAnalytics(expenseResponse([expense('next', 1, 'Еда', '2024-03-01T00:00:00Z')]),
      incomeResponse(), selectedPeriod())).toMatchObject({ ok: false, error: { code: 'outside_period' } });
  });

  it('rejects overflow or incomplete data on either side without a successful zero fallback', () => {
    const result = buildAnalytics(expenseResponse(), incomeResponse([income('1', 5e13), income('2', 5e13)]), selectedPeriod());
    expect(result).toMatchObject({ ok: false, error: { code: 'overflow', dataset: 'incomes' } });
    expect(result).not.toHaveProperty('value');
    expect(buildAnalytics(expenseResponse(), incomeResponse([], { total: 10 }), selectedPeriod()))
      .toMatchObject({ ok: false, error: { code: 'incomplete_response' } });
  });

  it('allows the same opaque ID in different collections and never mutates cached API records', () => {
    const period = Object.freeze(selectedPeriod());
    const expenses = Object.freeze(expenseResponse(Object.freeze([Object.freeze(expense('same', 1, ' Еда '))])));
    const incomes = Object.freeze(incomeResponse(Object.freeze([Object.freeze(income('same', 2))])));
    const original = JSON.stringify({ period, expenses, incomes });
    const data = analyticsValue(buildAnalytics(expenses, incomes, period));
    expect(data.categories[0].category).toBe('Еда');
    expect(data.differenceKopecks).toBe(100);
    expect(JSON.stringify({ period, expenses, incomes })).toBe(original);
    expect(data.period).not.toBe(period);
  });
});
