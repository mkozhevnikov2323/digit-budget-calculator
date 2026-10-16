import { addKopecks, assertCompleteResponse, buildAnalytics, formatMoney, moneyToKopecks } from '../calculations';

const range = { start: '2024-02-01', end: '2024-02-29' };
const expense = (_id: string, amount: number, category?: string, date = '2024-02-10T12:00:00Z') => ({ _id, amount, category, date });

describe('validated integer-kopeck analytics', () => {
  it('calculates recorded totals, difference, groups, shares and counts exactly once', () => {
    const data = buildAnalytics([
      expense('1', 0.1, 'Еда'), expense('2', 0.2, 'Еда'), expense('3', 0.7, 'Транспорт'),
    ], [{ _id: 'income-1', amount: 2, date: '2024-02-01' }], range, 'day');
    expect(data).toMatchObject({ incomeKopecks: 200, expenseKopecks: 100, differenceKopecks: 100, expenseCount: 3, incomeCount: 1 });
    expect(data.categories).toEqual([
      { category: 'Транспорт', kopecks: 70, count: 1, share: 70 }, { category: 'Еда', kopecks: 30, count: 2, share: 30 },
    ]);
    expect(data.dynamics).toHaveLength(29);
    expect(data.dynamics.find((day) => day.key === '2024-02-10')?.kopecks).toBe(100);
    expect(data.dynamics[0].kopecks).toBe(0);
  });

  it('handles empty datasets and zero-valued records without dividing by zero', () => {
    expect(buildAnalytics([], [], range, 'month')).toMatchObject({ expenseCount: 0, incomeCount: 0, expenseKopecks: 0, incomeKopecks: 0, differenceKopecks: 0, categories: [], dynamics: [{ key: '2024-02', kopecks: 0 }] });
    expect(buildAnalytics([expense('zero', 0, 'Еда')], [], range, 'day').categories[0].share).toBe(0);
  });

  it('explicitly groups missing/blank categories', () => {
    expect(buildAnalytics([expense('1', 1), expense('2', 2, '  ')], [], range, 'day').categories).toEqual([
      { category: 'Без категории', kopecks: 300, count: 2, share: 100 },
    ]);
  });

  it('includes loan issuance and repayment as raw records without reclassification', () => {
    const repayments = [{ _id: 'r', amount: 500, date: '2024-02-01', source: 'Возврат займа' }];
    expect(buildAnalytics([expense('l', 1000, 'Выдача займа')], repayments, range, 'month')).toMatchObject({
      expenseKopecks: 100000, incomeKopecks: 50000, differenceKopecks: -50000,
      categories: [{ category: 'Выдача займа', count: 1 }],
    });
  });

  it('includes late final-day timestamps and rejects the following day', () => {
    expect(buildAnalytics([expense('1', 1, 'Еда', '2024-02-29T23:59:59.999Z')], [], range, 'day').expenseCount).toBe(1);
    expect(() => buildAnalytics([expense('2', 1, 'Еда', '2024-03-01T00:00:00Z')], [], range, 'day')).toThrow(/периоду/);
  });

  it('groups timestamp offsets by the UTC day consistently', () => {
    const data = buildAnalytics([expense('1', 1, 'Еда', '2024-03-01T01:00:00+03:00')], [], range, 'day');
    expect(data.dynamics[data.dynamics.length - 1]).toEqual({ key: '2024-02-29', kopecks: 100 });
  });

  it('aggregates chronological months across years and fills gaps', () => {
    const data = buildAnalytics([expense('1', 1, 'Еда', '2025-02-01'), expense('2', 2, 'Еда', '2023-12-01')], [],
      { start: '2023-12-01', end: '2025-02-28' }, 'month');
    expect(data.dynamics[0]).toEqual({ key: '2023-12', kopecks: 200 });
    expect(data.dynamics[1]).toEqual({ key: '2024-01', kopecks: 0 });
    expect(data.dynamics[data.dynamics.length - 1]).toEqual({ key: '2025-02', kopecks: 100 });
  });

  it.each([[0.1, 10], [0.2, 20], [1.005, 101], [10.999, 1100], [1e-7, 0], [1e3, 100000]])('rounds persisted decimal %s half-up', (amount, expected) => {
    expect(moneyToKopecks(amount)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity, -1, 1e308])('rejects invalid/overflow money %s', (amount) => {
    expect(() => moneyToKopecks(amount)).toThrow();
  });

  it('rejects runtime nonnumber data instead of coercing it', () => {
    expect(() => moneyToKopecks('12' as unknown as number)).toThrow();
  });

  it('detects aggregate overflow even when each amount is valid', () => {
    expect(() => buildAnalytics([expense('1', 5e13), expense('2', 5e13)], [], range, 'day')).toThrow(/Переполнение/);
    expect(() => addKopecks(Number.MAX_SAFE_INTEGER, 1)).toThrow(/Переполнение/);
  });

  it('rejects incomplete response metadata and duplicate IDs', () => {
    expect(() => assertCompleteResponse({ total: 2, page: 1, limit: 2 }, [expense('1', 1)])).toThrow(/неполный/);
    expect(() => assertCompleteResponse({ total: 0, page: 1, limit: 0 }, undefined)).toThrow();
    expect(() => buildAnalytics([expense('1', 1), expense('1', 1)], [], range, 'day')).toThrow(/идентификаторы/);
    expect(() => assertCompleteResponse({ total: 0, page: 1, limit: 0 }, [])).not.toThrow();
  });

  it('reports invalid dates and never mutates source records', () => {
    expect(() => buildAnalytics([expense('1', 1, 'Еда', '2024-02-30')], [], range, 'day')).toThrow();
    const records = [Object.freeze(expense('1', 2, ' Еда '))];
    buildAnalytics(records, [], range, 'day');
    expect(records[0].category).toBe(' Еда ');
  });

  it('formats integer kopecks with all cents and supports negative differences', () => {
    expect(formatMoney(101)).toBe('1,01 ₽');
    expect(formatMoney(-7)).toBe('−0,07 ₽');
  });
});
