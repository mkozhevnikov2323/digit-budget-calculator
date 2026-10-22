import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { closedData } from 'features/HistoricalClassification/model/contract';
import { buildClassificationStatistics, type ClassifiedHistory } from 'features/ClassificationStatistics/model/statistics';
import { monthPeriod } from 'features/FinancialAnalytics/model/period';
import { sumKopecks, subtractKopecks } from 'features/FinancialAnalytics/model/money';

export type LayerForecast = Readonly<{ historicalKopecks: number; meanMonthlyKopecks: number; medianMonthlyKopecks: number;
  minMonthlyKopecks: number; maxMonthlyKopecks: number; variationRangeKopecks: number;
  recentHalfChangeKopecks: number; method: 'median_monthly' | 'historical_allocation' | 'requires_user_target';
  monthlyEstimateKopecks: number | null; projectedAnnualKopecks: number | null }>;
export type ExpenseForecast = Readonly<{ version: 'expense-forecast-v1'; origin: ClassifiedHistory['origin'];
  projectionScope: 'confirmed_history_components_only'; classificationCoverage: 'complete' | 'partial';
  referencePeriod: ClassifiedHistory['period']; completeMonths: 12; uncoveredKopecks: number; uncoveredCount: number;
  adjustmentBasisPoints: number; rounding: 'nearest_kopeck_half_up_derived_only';
  layers: Record<FinancialLayer, LayerForecast>; projectedComponentsAnnualKopecks: number;
  otherRoles: { expenses: ClassifiedHistory['expenses']['roles']; incomes: ClassifiedHistory['incomes']['roles'] } }>;
type Code = 'invalid_history' | 'insufficient_history' | 'incomplete_months' | 'no_confirmed_spending' | 'invalid_assumption' | 'overflow' | 'scope_mismatch';
export type ForecastResult = { ok: true; value: ExpenseForecast } | { ok: false; error: { code: Code } };
const fail = (code: Code): ForecastResult => ({ ok: false, error: { code } });
const safe = (n: bigint): number | null => n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(n);
/** Explicit rounding of a DERIVED estimate only. Source amounts are never rounded. */
const ratio = (n: bigint, d: bigint): bigint => (n + d / 2n) / d;
const signedRatio = (n: bigint, d: bigint): bigint => n < 0n ? -ratio(-n, d) : ratio(n, d);

const fromHistory = (h: ClassifiedHistory, options: unknown): ForecastResult => {
  const config = closedData(options, ['asOf', 'adjustmentBasisPoints']);
  if (!config || typeof config.asOf !== 'number' || !Number.isSafeInteger(config.asOf)
    || !Number.isFinite(new Date(config.asOf).getTime()) || typeof config.adjustmentBasisPoints !== 'number'
    || !Number.isInteger(config.adjustmentBasisPoints) || config.adjustmentBasisPoints < -10000
    || config.adjustmentBasisPoints > 100000 || h.observedAt > config.asOf) return fail('invalid_assumption');
  if (h.months.length !== 12) return fail('insufficient_history');
  const asOf = config.asOf;
  if (h.months.some(m => {
    const p = monthPeriod(Number(m.key.slice(0, 4)), Number(m.key.slice(5, 7)));
    return !p.ok || m.recording !== 'complete' || m.calendar !== 'elapsed' || p.value.endExclusive > asOf;
  })) return fail('incomplete_months');
  if (!h.expenses.roles.ordinary_expense?.count) return fail('no_confirmed_spending');
  const uncovered = subtractKopecks(h.expenses.recorded.kopecks, h.expenses.statuses.approved.kopecks);
  if (!uncovered.ok) return fail('overflow');
  const layers = {} as Record<FinancialLayer, LayerForecast>;
  for (const layer of FINANCIAL_LAYERS) {
    const values = h.months.map(m => m.expenses.layers[layer].kopecks), ordered = [...values].sort((a, b) => a - b);
    const annual = h.expenses.layers[layer].kopecks;
    const mean = ratio(BigInt(annual), 12n), median = ratio(BigInt(ordered[5]) + BigInt(ordered[6]), 2n);
    const first = sumKopecks(values.slice(0, 6)), last = sumKopecks(values.slice(6));
    if (!first.ok || !last.ok) return fail('overflow');
    const method = layer === 'everyday' ? 'median_monthly'
      : layer === 'irregular' || layer === 'emergency' ? 'historical_allocation' : 'requires_user_target';
    const baseline = method === 'median_monthly' ? median : mean;
    const estimate = method === 'requires_user_target' ? null
      : safe(ratio(baseline * BigInt(10000 + config.adjustmentBasisPoints), 10000n));
    if (method !== 'requires_user_target' && estimate === null) return fail('overflow');
    const projected = estimate === null ? null : safe(BigInt(estimate) * 12n);
    if (estimate !== null && projected === null) return fail('overflow');
    layers[layer] = { historicalKopecks: annual, meanMonthlyKopecks: Number(mean), medianMonthlyKopecks: Number(median),
      minMonthlyKopecks: ordered[0], maxMonthlyKopecks: ordered[11], variationRangeKopecks: ordered[11] - ordered[0],
      recentHalfChangeKopecks: Number(signedRatio(BigInt(last.value) - BigInt(first.value), 6n)), method,
      monthlyEstimateKopecks: estimate, projectedAnnualKopecks: projected };
  }
  const total = sumKopecks(FINANCIAL_LAYERS.map(l => layers[l].projectedAnnualKopecks ?? 0));
  if (!total.ok) return fail('overflow');
  const expenseRoles = { ...h.expenses.roles }; delete expenseRoles.ordinary_expense;
  return { ok: true, value: { version: 'expense-forecast-v1', origin: h.origin, referencePeriod: { ...h.period },
    projectionScope: 'confirmed_history_components_only', completeMonths: 12,
    classificationCoverage: h.expenses.statuses.approved.count === h.expenses.recorded.count ? 'complete' : 'partial',
    uncoveredKopecks: uncovered.value, uncoveredCount: h.expenses.recorded.count - h.expenses.statuses.approved.count,
    adjustmentBasisPoints: config.adjustmentBasisPoints, rounding: 'nearest_kopeck_half_up_derived_only', layers,
    projectedComponentsAnnualKopecks: total.value, otherRoles: { expenses: expenseRoles, incomes: h.incomes.roles } } };
};

/** Revalidate source cohort, not caller-supplied precomputed totals. No IO/mutations. */
export const forecastExpenses = (historyInput: unknown, options: unknown): ForecastResult => {
  const h = buildClassificationStatistics(historyInput);
  return h.ok ? fromHistory(h.value, options) : fail('invalid_history');
};
export const compareForecastYears = (currentInput: unknown, previousInput: unknown, options: unknown):
  { ok: true; value: Record<FinancialLayer, number> } | { ok: false; error: { code: Code } } => {
  const c = buildClassificationStatistics(currentInput), p = buildClassificationStatistics(previousInput);
  if (!c.ok || !p.ok) return { ok: false, error: { code: 'invalid_history' } };
  const year = Number(c.value.period.firstDate.slice(0, 4)), previousYear = Number(p.value.period.firstDate.slice(0, 4));
  if (c.value.owner !== p.value.owner || year !== previousYear + 1 || !c.value.period.firstDate.endsWith('-01-01')
    || !p.value.period.firstDate.endsWith('-01-01') || !c.value.period.lastDate.endsWith('-12-31') || !p.value.period.lastDate.endsWith('-12-31'))
    return { ok: false, error: { code: 'scope_mismatch' } };
  const current = fromHistory(c.value, options), previous = fromHistory(p.value, options);
  if (!current.ok) return current; if (!previous.ok) return previous;
  const changes = {} as Record<FinancialLayer, number>;
  for (const l of FINANCIAL_LAYERS) {
    const d = subtractKopecks(current.value.layers[l].historicalKopecks, previous.value.layers[l].historicalKopecks);
    if (!d.ok) return { ok: false, error: { code: 'overflow' } }; changes[l] = d.value;
  }
  return { ok: true, value: changes };
};
