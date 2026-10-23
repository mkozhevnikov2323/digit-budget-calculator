import { recordedReport, recordedHistoryInput } from '../recordedHistory';
import { recordedCohort } from './recordedFixtures';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
import type { ClassificationRead, StableRole } from 'features/HistoricalClassification/model/contract';
import type { FinancialLayer } from 'features/FinancialClassification/model/types';
import { recordingEvidenceInput } from 'features/ExpenseForecast/model/recordingEvidence';
import { forecastExpenses } from 'features/ExpenseForecast/model/forecast';
import { createBudgetPlan } from 'features/BudgetPlanning/model/plan';
import { planFromRecordedHistory } from 'features/BudgetPlanning/model/recordedPlan';

// Fixed seeds, bounded LCG, integer-only independent oracle. It neither imports
// money arithmetic nor derives expected totals from a production calculator.
for (const seed of [1, 7, 19, 42, 73, 101, 509, 1021, 2025, 65537, 104729, 2147483647]) it(`reconciles independent kopeck partitions and immutable estimates, seed ${seed}`, () => {
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const cohort = recordedCohort(), operations: HistoryOperation[] = [], decisions: ClassificationRead[] = [];
  const totals = { expenses: 0n, incomes: 0n }, byMonth = new Map<string, bigint>(), categories = new Map<string, bigint>();
  const statuses = new Map<string, bigint>(), roles = new Map<string, bigint>(), layers = new Map<string, bigint>();
  const add = (map: Map<string, bigint>, key: string, n: number) => map.set(key, (map.get(key) ?? 0n) + BigInt(n));
  const layerNames: FinancialLayer[] = ['everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital'];
  for (let i = 0; i < 240; i++) {
    const dataset = i % 3 ? 'expenses' : 'incomes', minor = next() % 1000000;
    const month = i % 12, timestamp = i === 0 ? Date.UTC(2025, 0, 1) : i === 239 ? Date.UTC(2026, 0, 1) - 1 : Date.UTC(2025, month, 15, 12);
    const category = ['Транспорт', ' Транспорт ', 'é', 'e\u0301'][next() % 4];
    const operationId = (Math.floor(i / 3) * 3 + (dataset === 'expenses' ? i % 3 : 1)).toString(16).padStart(24, '0');
    // Cross-dataset identity collisions are valid; same-dataset duplicates are not.
    const amount = Number(`${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`);
    const op: HistoryOperation = { dataset, operationId, timestamp, kopecks: minor,
      facts: { amount, date: new Date(timestamp).toISOString(), ...(dataset === 'expenses' ? { category, title: 'Fictional', recipient: 'Fictional' } : { source: 'Fictional' }),
        ...(i % 3 === 0 ? {} : { comment: i % 3 === 1 ? null : '' }) } };
    const status = i % 5 === 0 ? 'unreviewed' : i % 5 === 1 ? 'stale' : 'approved';
    const choices: StableRole[] = dataset === 'expenses' ? ['ordinary_expense', 'loan_issuance', 'internal_transfer', 'capital_movement']
      : ['ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement'];
    const role = choices[next() % choices.length], layer = role === 'ordinary_expense' ? layerNames[next() % 5] : null;
    operations.push(op); decisions.push({ version: 'classification-read-v1', dataset, operationId, status,
      storedState: status === 'unreviewed' ? null : 'approved', decisionRevision: status === 'unreviewed' ? null : 1,
      confirmed: status === 'approved' ? { economicRole: role, layer } : null, consistency: 'observed_only_non_atomic' });
    totals[dataset] += BigInt(minor); add(byMonth, `${op.facts.date.slice(0, 7)}/${dataset}`, minor); add(statuses, `${dataset}/${status}`, minor);
    if (dataset === 'expenses') add(categories, category, minor);
    if (status === 'approved') { add(roles, `${dataset}/${role}`, minor); if (layer) add(layers, layer, minor); }
  }
  cohort.history = { ...cohort.history, operations }; cohort.decisions = decisions;
  const before = JSON.stringify(cohort), report = recordedReport(cohort);
  expect(report.result.ok).toBe(true); expect(report.categories).not.toBeNull(); if (!report.result.ok || !report.categories) return;
  const stats = report.result.value;
  for (const dataset of ['expenses', 'incomes'] as const) {
    expect(BigInt(stats[dataset].recorded.kopecks)).toBe(totals[dataset]);
    expect(stats.months.reduce((n, m) => n + BigInt(m[dataset].recorded.kopecks), 0n)).toBe(totals[dataset]);
    for (const m of stats.months) expect(BigInt(m[dataset].recorded.kopecks)).toBe(byMonth.get(`${m.key}/${dataset}`) ?? 0n);
    for (const [key, bucket] of Object.entries(stats[dataset].statuses)) expect(BigInt(bucket.kopecks)).toBe(statuses.get(`${dataset}/${key}`) ?? 0n);
    for (const [key, bucket] of Object.entries(stats[dataset].roles)) expect(BigInt(bucket.kopecks)).toBe(roles.get(`${dataset}/${key}`) ?? 0n);
    expect(Object.keys(stats[dataset].roles).length).toBe([...roles.keys()].filter(key => key.startsWith(`${dataset}/`)).length);
    expect(Object.values(stats[dataset].statuses).reduce((n, b) => n + BigInt(b.kopecks), 0n)).toBe(totals[dataset]);
    expect(stats[dataset].coverage.byCount).toBeLessThan(1);
  }
  for (const c of report.categories) expect(BigInt(c.kopecks)).toBe(categories.get(c.category));
  for (const [key, bucket] of Object.entries(stats.expenses.layers)) expect(BigInt(bucket.kopecks)).toBe(layers.get(key) ?? 0n);
  expect(Object.values(stats.expenses.layers).reduce((n, b) => n + b.kopecks, 0)).toBe(stats.expenses.roles.ordinary_expense?.kopecks ?? 0);
  const evidence = recordingEvidenceInput(cohort, Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`), cohort.observedAt);
  expect(evidence.ok).toBe(true); if (!evidence.ok) return;
  const forecast = forecastExpenses(evidence.value, { asOf: cohort.observedAt, adjustmentBasisPoints: 0 });
  expect(forecast.ok).toBe(true);
  const plan = createBudgetPlan(2027, { firstDate: '2025-01-01', lastDate: '2025-12-31' }, Object.fromEntries(layerNames.map(l => [l, 0])), 120000);
  expect(plan.ok).toBe(true); if (!plan.ok) return;
  const estimate = planFromRecordedHistory(plan.value, evidence.value, { asOf: cohort.observedAt, adjustmentBasisPoints: 0 }, []);
  expect(estimate.ok).toBe(true); if (estimate.ok) expect(estimate.value.reserve).toEqual(plan.value.reserve);
  expect(JSON.stringify(cohort) === before).toBe(true);
  expect(recordedHistoryInput(cohort).monthEvidence.every(m => m.recording === 'unverified')).toBe(true);
});

it('retains very large safe totals and rejects aggregate overflow without zero fallback', () => {
  const c = recordedCohort(); c.history = { ...c.history, operations: c.history.operations.map(op => ({ ...op, kopecks: 300000000000000, facts: { ...op.facts, amount: 3000000000000 } })) };
  const r = recordedReport(c); expect(r.result.ok).toBe(true);
  if (r.result.ok) expect(r.result.value.expenses.recorded.kopecks).toBe(3600000000000000);
  c.history = { ...c.history, operations: c.history.operations.map(op => ({ ...op, kopecks: 1000000000000000, facts: { ...op.facts, amount: 10000000000000 } })) };
  expect(recordedReport(c).result.ok).toBe(false); expect(recordedReport(c).categories).toBeNull();
});
