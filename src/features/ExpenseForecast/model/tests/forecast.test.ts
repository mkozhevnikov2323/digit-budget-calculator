/** @jest-environment node */
import { forecastExpenses, compareForecastYears } from '../forecast';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
import { customPeriod } from 'features/FinancialAnalytics/model/period';
const options = { asOf: Date.parse('2026-10-21T00:00:00Z'), adjustmentBasisPoints: 0 };
const value = (input: unknown = syntheticHistoryInput(), extra = {}) => {
  const r = forecastExpenses(input, { ...options, ...extra }); if (!r.ok) throw Error(r.error.code); return r.value;
};
describe('transparent twelve-month confirmed expense components', () => {
  it('calculates independent mean/median/range/trend with distinct event allocation', () => {
    const r = value(); expect(r.layers.everyday).toMatchObject({ historicalKopecks: 1207800,
      meanMonthlyKopecks: 100650, medianMonthlyKopecks: 100650, minMonthlyKopecks: 100100,
      maxMonthlyKopecks: 101200, variationRangeKopecks: 1100, recentHalfChangeKopecks: 600,
      monthlyEstimateKopecks: 100650, projectedAnnualKopecks: 1207800 });
    expect(r.layers.irregular).toMatchObject({ method: 'historical_allocation', monthlyEstimateKopecks: 10000, medianMonthlyKopecks: 0 });
    expect(r.layers.emergency.monthlyEstimateKopecks).toBe(5000);
    expect(r.layers.major_goals.monthlyEstimateKopecks).toBeNull();
    expect(r.layers.long_term_capital.monthlyEstimateKopecks).toBeNull();
    expect(r.projectedComponentsAnnualKopecks).toBe(1387800);
    expect(r.otherRoles.expenses.loan_issuance?.kopecks).toBe(80000);
    expect(r.otherRoles.expenses.ordinary_expense).toBeUndefined();
    expect(r.classificationCoverage).toBe('partial'); expect(r.uncoveredKopecks).toBe(60000);
  });
  it('retains a large outlier in historical totals and min/max while using robust median', () => {
    const input = syntheticHistoryInput(2025, false);
    input.operations[0] = { ...input.operations[0], kopecks: 5000000 };
    const r = value(input);
    expect(r.layers.everyday.maxMonthlyKopecks).toBe(5000000);
    expect(r.layers.everyday.historicalKopecks).toBe(6107700);
    expect(r.layers.everyday.monthlyEstimateKopecks).toBe(100750);
  });
  it('separates full classification from partial coverage and preserves genuine zero records', () => {
    const input = syntheticHistoryInput(2025, false); expect(value(input).classificationCoverage).toBe('complete');
    input.operations = input.operations.map(op => ({ ...op, kopecks: 0 }));
    expect(value(input).layers.everyday.monthlyEstimateKopecks).toBe(0);
    expect(value(input).projectedComponentsAnnualKopecks).toBe(0);
  });
  it.each(['missing', 'unverified'])('rejects %s month evidence instead of filling it with zero', recording => {
    const input = syntheticHistoryInput(); input.monthEvidence[2].recording = recording;
    expect(forecastExpenses(input, options)).toEqual({ ok: false, error: { code: 'incomplete_months' } });
  });
  it('rejects current/future months and fewer than twelve complete months', () => {
    const input = syntheticHistoryInput(); input.observedAt = Date.parse('2025-06-15T00:00:00Z');
    expect(forecastExpenses(input, options)).toEqual({ ok: false, error: { code: 'incomplete_months' } });
    const period = customPeriod('2025-01-01', '2025-11-30'); if (!period.ok) throw Error('fixture');
    expect(forecastExpenses({ ...input, observedAt: options.asOf, period: period.value, operations: [], decisions: [],
      monthEvidence: input.monthEvidence.slice(0, 11) }, options)).toEqual({ ok: false, error: { code: 'insufficient_history' } });
  });
  it('rejects empty/invalid history and unavailable source decisions', () => {
    const input = syntheticHistoryInput();
    expect(forecastExpenses({ ...input, operations: [], decisions: [] }, options)).toEqual({ ok: false, error: { code: 'no_confirmed_spending' } });
    expect(forecastExpenses({ ...input, decisions: [] }, options)).toEqual({ ok: false, error: { code: 'invalid_history' } });
  });
  it('labels explicit sensitivity assumptions and reconciles projected components', () => {
    const r = value(syntheticHistoryInput(), { adjustmentBasisPoints: 1000 });
    expect(r.layers.everyday.monthlyEstimateKopecks).toBe(110715);
    expect(r.projectedComponentsAnnualKopecks).toBe(1526580);
    expect(Object.values(r.layers).reduce((n, l) => n + (l.projectedAnnualKopecks ?? 0), 0)).toBe(r.projectedComponentsAnnualKopecks);
    expect(value(syntheticHistoryInput(), { adjustmentBasisPoints: -10000 }).projectedComponentsAnnualKopecks).toBe(0);
    for (const adjustmentBasisPoints of [undefined, NaN, 0.5, -10001, 100001, '100'])
      expect(forecastExpenses(syntheticHistoryInput(), { ...options, adjustmentBasisPoints }).ok).toBe(false);
  });
  it('rejects derived projection overflow without rounding source records', () => {
    const input = syntheticHistoryInput(2025, false);
    input.operations = input.operations.map((op, index) => ({ ...op, kopecks:
      (input.decisions[index] as { read: { confirmed?: { layer?: string } } }).read.confirmed?.layer === 'everyday' ? 750599937895082 : 0 }));
    expect(forecastExpenses(input, { ...options, adjustmentBasisPoints: 1000 })).toEqual({ ok: false, error: { code: 'overflow' } });
  });
  it('compares adjacent full years and preserves original inputs', () => {
    const current = syntheticHistoryInput(), previous = syntheticHistoryInput(2024), before = JSON.stringify(current);
    expect(compareForecastYears(current, previous, options)).toMatchObject({ ok: true, value: { everyday: 0, irregular: 0 } });
    expect(compareForecastYears(current, syntheticHistoryInput(2023), options).ok).toBe(false);
    value(current); expect(JSON.stringify(current)).toBe(before);
  });
});
