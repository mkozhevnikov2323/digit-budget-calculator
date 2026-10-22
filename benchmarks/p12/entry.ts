import { loadCoherentHistory, type HistoryReadPort, type CoherentHistory } from '../../src/features/HistoricalClassification/model/coherentHistory';
import * as reports from '../../src/features/ClassificationStatistics/model/recordedHistory';
import { forecastExpenses } from '../../src/features/ExpenseForecast/model/forecast';
import { recordingEvidenceInput } from '../../src/features/ExpenseForecast/model/recordingEvidence';
import { yearPeriod } from '../../src/features/FinancialAnalytics/model/period';
import type { ClassifiedHistory } from '../../src/features/ClassificationStatistics/model/statistics';
const checked = yearPeriod(2025); if (!checked.ok) throw Error('Fixture period unavailable');
export const period = checked.value;
const AS_OF = Date.UTC(2026, 0, 2), months = Array.from({ length: 12 }, (_, n) => `2025-${String(n + 1).padStart(2, '0')}`);
export type Reference = { totals: Record<'expenses' | 'incomes', number>; counts: Record<'expenses' | 'incomes', number>;
  months: Record<string, { minor: number; count: number }>; categories: Record<string, { minor: number; count: number }>;
  statuses: Record<string, { minor: number; count: number }>; roles: Record<string, { minor: number; count: number }>;
  layers: Record<string, { minor: number; count: number }> };
export const verifyFinancials = (cohort: CoherentHistory, stats: ClassifiedHistory, categories: NonNullable<ReturnType<typeof reports.recordedCategories>>, reference: Reference) => {
  const check = (ok: boolean) => { if (!ok) throw Error('PERFORMANCE_FINANCIAL_INVARIANT'); };
  const keys = new Set(cohort.history.operations.map(op => `${op.dataset}/${op.operationId}`));
  check(keys.size === cohort.history.operations.length);
  for (const dataset of ['expenses', 'incomes'] as const) {
    const d = stats[dataset]; check(d.recorded.kopecks === reference.totals[dataset] && d.recorded.count === reference.counts[dataset]);
    check(stats.months.reduce((n, m) => n + m[dataset].recorded.kopecks, 0) === d.recorded.kopecks);
    for (const m of stats.months) { const r = reference.months[`${m.key}/${dataset}`] ?? { minor: 0, count: 0 };
      check(m[dataset].recorded.kopecks === r.minor && m[dataset].recorded.count === r.count); }
    for (const [status, b] of Object.entries(d.statuses)) { const r = reference.statuses[`${dataset}/${status}`] ?? { minor: 0, count: 0 }; check(b.kopecks === r.minor && b.count === r.count); }
    for (const [role, b] of Object.entries(d.roles)) { const r = reference.roles[`${dataset}/${role}`]; check(!!r && b.kopecks === r.minor && b.count === r.count); }
  }
  for (const c of categories) { const r = reference.categories[c.category]; check(!!r && c.kopecks === r.minor && c.count === r.count); }
  check(categories.reduce((n, c) => n + c.kopecks, 0) === reference.totals.expenses);
  for (const [layer, b] of Object.entries(stats.expenses.layers)) { const r = reference.layers[layer] ?? { minor: 0, count: 0 }; check(b.kopecks === r.minor && b.count === r.count); }
};
export const measurePipeline = async (port: HistoryReadPort, owner: string, reference: Reference, current = () => true) => {
  const clock = globalThis as typeof globalThis & { __p12Timings?: Record<string, number> };
  clock.__p12Timings = {};
  const start = performance.now(); const cohort = await loadCoherentHistory(port, owner, period, current, 'p12-fictional-observation', () => AS_OF);
  const loadingMilliseconds = performance.now() - start, validationMilliseconds = { ...clock.__p12Timings };
  const aggregationStart = performance.now();
  // Same UI workload before/after: after optimization the UI's joint report is
  // used if available; baseline calls exactly the two existing report functions.
  const joint = reports as typeof reports & { recordedReport?: (c: CoherentHistory) => { result: ReturnType<typeof reports.recordedStatistics>; categories: ReturnType<typeof reports.recordedCategories> } };
  const { result, categories } = joint.recordedReport ? joint.recordedReport(cohort) : { result: reports.recordedStatistics(cohort), categories: reports.recordedCategories(cohort) };
  if (!result.ok || !categories) throw Error('PERFORMANCE_REPORT_UNAVAILABLE');
  const aggregationMilliseconds = performance.now() - aggregationStart;
  verifyFinancials(cohort, result.value, categories, reference);
  const forecastStart = performance.now(), evidence = recordingEvidenceInput(cohort, months, AS_OF);
  const forecast = evidence.ok ? forecastExpenses(evidence.value, { asOf: AS_OF, adjustmentBasisPoints: 0 }) : null;
  if (!forecast?.ok) throw Error('PERFORMANCE_FORECAST_UNAVAILABLE');
  return { cohort, metrics: { loadingMilliseconds, validationMilliseconds, aggregationMilliseconds,
    evidenceAndForecastMilliseconds: performance.now() - forecastStart, financialInvariants: true, uniqueOperations: cohort.history.operations.length } };
};
