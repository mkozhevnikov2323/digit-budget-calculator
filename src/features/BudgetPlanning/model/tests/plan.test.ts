/** @jest-environment node */
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
import { allocateAnnual, budgetPlanTotals, comparePlanActual, createBudgetPlan, exportBudgetPlan, importBudgetPlan,
  updatePlanMonth, validateBudgetPlan, planFromDraft, draftFromPlan, type PlanResult } from '../plan';
const valid = <T,>(r: PlanResult<T>): T => { if (!r.ok) throw Error(r.error.code); return r.value; };
const annual = (everyday = 120000) => Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, l === 'everyday' ? everyday : 0]));
const plan = (everyday = 120000) => valid(createBudgetPlan(2027, { firstDate: '2025-01-01', lastDate: '2025-12-31' }, annual(everyday), 1200));
const asOf = Date.parse('2027-03-15T00:00:00Z');
const actual = (uncertain = false) => ({ ...syntheticHistoryInput(2027, uncertain), observedAt: asOf });

describe('local budget plans with separate reserves', () => {
  it('distributes exact annual kopecks with deterministic remainder and no floating-point loss', () => {
    for (const amount of [...Array.from({ length: 101 }, (_, i) => i), Number.MAX_SAFE_INTEGER]) {
      const allocation = valid(allocateAnnual(amount)); expect(allocation).toHaveLength(12);
      expect(allocation.reduce((n, x) => n + BigInt(x), 0n)).toBe(BigInt(amount));
      expect(Math.max(...allocation) - Math.min(...allocation)).toBeLessThanOrEqual(1);
    }
    expect(valid(allocateAnnual(5))).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });
  it.each([-1, 1.1, NaN, Infinity, '100', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid allocation %#', value => {
    expect(allocateAnnual(value).ok).toBe(false);
  });
  it('keeps reserve out of expense targets and owns immutable edits', () => {
    const p = plan(), before = JSON.stringify(p), changed = valid(updatePlanMonth(p, 'everyday', 1, 20000));
    expect(valid(budgetPlanTotals(p))).toMatchObject({ expenseTargetsKopecks: 120000, reserveAllocationKopecks: 1200, resourceAllocationKopecks: 121200 });
    expect(valid(budgetPlanTotals(changed)).expenseTargetsKopecks).toBe(130000);
    expect(JSON.stringify(p)).toBe(before); expect(changed.layers.everyday).not.toBe(p.layers.everyday);
  });
  it('roundtrips explicit versioned JSON and rejects malformed/duplicate/extra inputs', () => {
    const p = plan(), encoded = valid(exportBudgetPlan(p)); expect(valid(importBudgetPlan(encoded))).toEqual(p);
    for (const s of ['{', 'null', '[]', encoded.replace('"version":', '"version":"unsupported","version":'),
      JSON.stringify({ ...p, unknown: true }), JSON.stringify({ ...p, version: 'budget-plan-v2' }), 'x'.repeat(65537)])
      expect(importBudgetPlan(s).ok).toBe(false);
    const synthetic = valid(createBudgetPlan(2027, p.reference, annual(), 0, 'synthetic_suggestion'));
    expect(valid(importBudgetPlan(valid(exportBudgetPlan(synthetic)))).basis).toBe('synthetic_suggestion');
  });
  it('rejects getters, prototypes, wrong arrays and safe-range overflow', () => {
    const p = plan(), hook = jest.fn(() => { throw Error('fictional'); });
    for (const input of [Object.create(p), { ...p, reserve: [] }, { ...p, year: 2025 },
      Object.defineProperty({ ...p }, 'year', { get: hook, enumerable: true })]) expect(validateBudgetPlan(input).ok).toBe(false);
    expect(hook).not.toHaveBeenCalled();
    expect(createBudgetPlan(2027, p.reference, annual(Number.MAX_SAFE_INTEGER), 1)).toEqual({ ok: false, error: { code: 'overflow' } });
  });
  it('keeps invalid human draft strings without rounding and preserves exact valid decimals', () => {
    const draft = draftFromPlan(plan()); draft.layers.everyday[0] = '1.005';
    expect(planFromDraft(draft).ok).toBe(false); expect(draft.layers.everyday[0]).toBe('1.005');
    draft.layers.everyday[0] = '0,01'; expect(valid(planFromDraft(draft)).layers.everyday[0]).toBe(1);
  });
});
describe('elapsed plan versus confirmed actual consumption', () => {
  it('excludes the unfinished month, reserves and non-spending roles', () => {
    const input = actual(), before = JSON.stringify(input), r = valid(comparePlanActual(plan(), input, asOf));
    expect(r).toMatchObject({ elapsedMonths: 2, plannedElapsedKopecks: 20000, actualElapsedKopecks: 200300,
      varianceKopecks: 180300, remainingScheduledKopecks: 100000, remainingAgainstAnnualTargetKopecks: -80300 });
    expect(JSON.stringify(input)).toBe(before);
    expect(valid(comparePlanActual(plan(2400000), input, asOf)).varianceKopecks).toBe(-199700);
  });
  it('marks insufficient classification, recording or observation as unavailable', () => {
    expect(comparePlanActual(plan(), actual(true), asOf)).toEqual({ ok: false, error: { code: 'incomplete_actual' } });
    const input = actual(); input.monthEvidence[0].recording = 'missing';
    expect(comparePlanActual(plan(), input, asOf).ok).toBe(false);
    expect(comparePlanActual(plan(), { ...actual(), observedAt: Date.parse('2027-02-15T00:00:00Z') }, asOf).ok).toBe(false);
    expect(comparePlanActual(plan(), syntheticHistoryInput(2025, false), asOf)).toEqual({ ok: false, error: { code: 'period_mismatch' } });
  });
});
