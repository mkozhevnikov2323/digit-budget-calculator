/** @jest-environment node */
import { buildAnalytics } from '../calculations';
import { yearPeriod } from '../period';
import { historyMonthStatus } from '../historyCoverage';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from './fixtures';

describe('annual recorded history reconciliation', () => {
  it.each([2023, 2024, 2025, 2026])('reconciles all twelve UTC months in %i', year => {
    const period = yearPeriod(year); if (!period.ok) throw Error('fixture');
    const expenses = Array.from({ length: 12000 }, (_, i) => expense(`e${i}`, 0.01, `c${i % 7}`, `${year}-${String(i % 12 + 1).padStart(2, '0')}-01T00:00:00.000Z`));
    const incomes = [income('first', 1, 'Salary', `${year}-01-01T00:00:00.000Z`), income('last', 2, 'Salary', `${year}-12-31T23:59:59.999Z`)];
    const result = buildAnalytics(expenseResponse(expenses), incomeResponse(incomes), period.value);
    expect(result.ok).toBe(true); if (!result.ok) return;
    const d = result.value;
    expect(d.months).toHaveLength(12);
    expect(d.months.reduce((s, m) => s + m.expenseKopecks, 0)).toBe(d.expenseKopecks);
    expect(d.months.reduce((s, m) => s + m.incomeKopecks, 0)).toBe(300);
    expect(d.months.reduce((s, m) => s + m.expenseCount, 0)).toBe(12000);
    expect(d.months.reduce((s, m) => s + m.incomeCount, 0)).toBe(2);
    expect(d.categories.reduce((s, c) => s + c.kopecks, 0)).toBe(12000);
    expect(d.categories.reduce((s, c) => s + c.share, 0)).toBeCloseTo(100);
  });
  it('accepts leap day and rejects following-year records, duplicates and truncation', () => {
    const p = selectedPeriod('2024-01-01', '2024-12-31');
    expect(buildAnalytics(expenseResponse([expense('leap', 1, 'c', '2024-02-29')]), incomeResponse(), p).ok).toBe(true);
    for (const r of [expenseResponse([expense('next', 1, 'c', '2025-01-01')]), expenseResponse([expense(), expense()]), expenseResponse([], { total: 1 })]) {
      const result = buildAnalytics(r, incomeResponse(), p); expect(result.ok).toBe(false); expect(result).not.toHaveProperty('value');
    }
  });
  it('distinguishes elapsed, current, future and partial selected months', () => {
    const p = selectedPeriod('2026-01-01', '2026-12-31'), now = Date.parse('2026-10-21T00:00:00Z');
    expect(historyMonthStatus('2026-09', p, now)).toBe('elapsed');
    expect(historyMonthStatus('2026-10', p, now)).toBe('current_partial');
    expect(historyMonthStatus('2026-11', p, now)).toBe('future');
    expect(historyMonthStatus('2026-01', selectedPeriod('2026-01-10', '2026-01-20'), now)).toBe('partial_period');
    expect(historyMonthStatus('invalid', p, now)).toBe('unavailable');
  });
});
