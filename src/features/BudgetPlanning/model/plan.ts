import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { closedData } from 'features/HistoricalClassification/model/contract';
import { dataArray, buildClassificationStatistics } from 'features/ClassificationStatistics/model/statistics';
import { yearPeriod, monthPeriod, customPeriod } from 'features/FinancialAnalytics/model/period';
import { rublesToKopecks, sumKopecks, subtractKopecks, formatKopecks } from 'features/FinancialAnalytics/model/money';

export type BudgetPlan = Readonly<{ version: 'budget-plan-v1'; basis: 'manual' | 'synthetic_suggestion'; year: number;
  reference: Readonly<{ firstDate: string; lastDate: string }>;
  layers: Readonly<Record<FinancialLayer, readonly number[]>>; reserve: readonly number[] }>;
type Code = 'invalid_plan' | 'invalid_amount' | 'overflow' | 'invalid_import' | 'incomplete_actual' | 'period_mismatch';
export type PlanResult<T> = { ok: true; value: T } | { ok: false; error: { code: Code } };
const fail = (code: Code): PlanResult<never> => ({ ok: false, error: { code } });
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
export const allocateAnnual = (input: unknown): PlanResult<readonly number[]> => {
  if (!amount(input)) return fail('invalid_amount');
  const n = BigInt(input), q = n / 12n, remainder = n % 12n;
  return { ok: true, value: Object.freeze(Array.from({ length: 12 }, (_, i) => Number(q + (BigInt(i) < remainder ? 1n : 0n)))) };
};
export const validateBudgetPlan = (input: unknown): PlanResult<BudgetPlan> => {
  const r = closedData(input, ['version', 'basis', 'year', 'reference', 'layers', 'reserve']);
  if (!r || r.version !== 'budget-plan-v1' || (r.basis !== 'manual' && r.basis !== 'synthetic_suggestion')
    || typeof r.year !== 'number') return fail('invalid_plan');
  const year = yearPeriod(r.year), reference = closedData(r.reference, ['firstDate', 'lastDate']);
  if (!year.ok || !reference || typeof reference.firstDate !== 'string' || typeof reference.lastDate !== 'string') return fail('invalid_plan');
  const ref = customPeriod(reference.firstDate, reference.lastDate);
  if (!ref.ok || ref.value.endExclusive > year.value.startInclusive) return fail('invalid_plan');
  const rawLayers = closedData(r.layers, FINANCIAL_LAYERS), reserve = dataArray(r.reserve, 12);
  if (!rawLayers || Object.keys(rawLayers).length !== 5 || !reserve || reserve.length !== 12 || !reserve.every(amount)) return fail('invalid_plan');
  const layers = {} as Record<FinancialLayer, readonly number[]>;
  for (const l of FINANCIAL_LAYERS) {
    const values = dataArray(rawLayers[l], 12);
    if (!values || values.length !== 12 || !values.every(amount)) return fail('invalid_plan');
    layers[l] = Object.freeze(values);
  }
  if (!sumKopecks([...FINANCIAL_LAYERS.flatMap(l => [...layers[l]]), ...reserve]).ok) return fail('overflow');
  return { ok: true, value: Object.freeze({ version: 'budget-plan-v1', basis: r.basis, year: r.year,
    reference: Object.freeze({ firstDate: reference.firstDate, lastDate: reference.lastDate }), layers: Object.freeze(layers), reserve: Object.freeze(reserve) }) };
};
export const createBudgetPlan = (year: unknown, reference: unknown, annualLayers: unknown, reserveAnnual: unknown,
  basis: unknown = 'manual'): PlanResult<BudgetPlan> => {
  const raw = closedData(annualLayers, FINANCIAL_LAYERS); if (!raw || Object.keys(raw).length !== 5) return fail('invalid_plan');
  const layers = {} as Record<FinancialLayer, readonly number[]>;
  for (const l of FINANCIAL_LAYERS) { const a = allocateAnnual(raw[l]); if (!a.ok) return a; layers[l] = a.value; }
  const reserve = allocateAnnual(reserveAnnual); if (!reserve.ok) return reserve;
  return validateBudgetPlan({ version: 'budget-plan-v1', basis, year, reference, layers, reserve: reserve.value });
};
export const budgetPlanTotals = (input: unknown): PlanResult<{ expenseTargetsKopecks: number; reserveAllocationKopecks: number;
  resourceAllocationKopecks: number; months: readonly { expenseTargetKopecks: number; reserveAllocationKopecks: number }[] }> => {
  const plan = validateBudgetPlan(input); if (!plan.ok) return plan;
  const expense = sumKopecks(FINANCIAL_LAYERS.flatMap(l => [...plan.value.layers[l]])), reserve = sumKopecks(plan.value.reserve);
  if (!expense.ok || !reserve.ok) return fail('overflow');
  const resources = sumKopecks([expense.value, reserve.value]); if (!resources.ok) return fail('overflow');
  const months: { expenseTargetKopecks: number; reserveAllocationKopecks: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const total = sumKopecks(FINANCIAL_LAYERS.map(l => plan.value.layers[l][i]));
    if (!total.ok) return fail('overflow');
    months.push({ expenseTargetKopecks: total.value, reserveAllocationKopecks: plan.value.reserve[i] });
  }
  return { ok: true, value: { expenseTargetsKopecks: expense.value, reserveAllocationKopecks: reserve.value,
    resourceAllocationKopecks: resources.value, months } };
};
export const updatePlanMonth = (input: unknown, layer: unknown, month: unknown, kopecks: unknown): PlanResult<BudgetPlan> => {
  const plan = validateBudgetPlan(input); if (!plan.ok) return plan;
  if (!amount(kopecks) || typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12
    || (layer !== 'reserve' && !FINANCIAL_LAYERS.some(l => l === layer))) return fail('invalid_amount');
  const p = plan.value, values = layer === 'reserve' ? [...p.reserve] : [...p.layers[layer as FinancialLayer]];
  values[month - 1] = kopecks;
  return validateBudgetPlan({ ...p, ...(layer === 'reserve' ? { reserve: values } : { layers: { ...p.layers, [layer as string]: values } }) });
};

/** Fully owned JSON tree, without inherited toJSON hooks. */
const jsonData = (x: unknown): unknown => {
  if (Array.isArray(x)) { const a = x.map(jsonData); Object.setPrototypeOf(a, null); return a; }
  if (x && typeof x === 'object') { const r: Record<string, unknown> = Object.create(null); for (const [k, v] of Object.entries(x)) r[k] = jsonData(v); return r; }
  return x;
};
export const exportBudgetPlan = (input: unknown): PlanResult<string> => {
  const plan = validateBudgetPlan(input); if (!plan.ok) return plan;
  try { return { ok: true, value: JSON.stringify(jsonData(plan.value), null, 2) }; } catch { return fail('invalid_plan'); }
};
const compactJson = (s: string): string => {
  let quoted = false, escaped = false, out = '';
  for (const c of s) {
    if (quoted) { out += c; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') { quoted = true; out += c; } else if (!/\s/.test(c)) out += c;
  }
  return out;
};
export const importBudgetPlan = (input: unknown): PlanResult<BudgetPlan> => {
  if (typeof input !== 'string' || input.length > 65536) return fail('invalid_import');
  try {
    const parsed: unknown = JSON.parse(input), plan = validateBudgetPlan(parsed);
    if (!plan.ok || JSON.stringify(jsonData(parsed)) !== compactJson(input)) return fail('invalid_import');
    return plan;
  } catch { return fail('invalid_import'); }
};

export type PlanComparison = Readonly<{ origin: 'synthetic' | 'coherent_adapter'; elapsedMonths: number;
  plannedElapsedKopecks: number; actualElapsedKopecks: number; varianceKopecks: number;
  remainingScheduledKopecks: number; remainingAgainstAnnualTargetKopecks: number;
  layers: Record<FinancialLayer, { plannedKopecks: number; actualKopecks: number; varianceKopecks: number }> }>;
/** Only closed elapsed months, complete recording and complete classification.
 * Reserve, loan and non-spending flows never enter consumption comparisons. */
export const comparePlanActual = (planInput: unknown, historyInput: unknown, asOf: unknown): PlanResult<PlanComparison> => {
  const plan = validateBudgetPlan(planInput), history = buildClassificationStatistics(historyInput);
  if (!plan.ok) return plan;
  if (!history.ok || typeof asOf !== 'number' || !Number.isSafeInteger(asOf) || !Number.isFinite(new Date(asOf).getTime())
    || history.value.observedAt > asOf) return fail('incomplete_actual');
  const p = yearPeriod(plan.value.year); if (!p.ok) return fail('invalid_plan');
  const h = history.value;
  if (h.period.startInclusive !== p.value.startInclusive || h.period.endExclusive !== p.value.endExclusive) return fail('period_mismatch');
  const indices = Array.from({ length: 12 }, (_, i) => i).filter(i => {
    const m = monthPeriod(plan.value.year, i + 1); return m.ok && m.value.endExclusive <= asOf;
  });
  if (!indices.length || indices.some(i => {
    const m = h.months[i]; return !m || m.recording !== 'complete' || m.calendar !== 'elapsed'
      || m.expenses.statuses.approved.count !== m.expenses.recorded.count;
  })) return fail('incomplete_actual');
  const layers = {} as PlanComparison['layers'];
  for (const l of FINANCIAL_LAYERS) {
    const planned = sumKopecks(indices.map(i => plan.value.layers[l][i])), actual = sumKopecks(indices.map(i => h.months[i].expenses.layers[l].kopecks));
    if (!planned.ok || !actual.ok) return fail('overflow');
    const delta = subtractKopecks(actual.value, planned.value); if (!delta.ok) return fail('overflow');
    layers[l] = { plannedKopecks: planned.value, actualKopecks: actual.value, varianceKopecks: delta.value };
  }
  const total = budgetPlanTotals(plan.value), planned = sumKopecks(FINANCIAL_LAYERS.map(l => layers[l].plannedKopecks)),
    actual = sumKopecks(FINANCIAL_LAYERS.map(l => layers[l].actualKopecks));
  if (!total.ok || !planned.ok || !actual.ok) return fail('overflow');
  const variance = subtractKopecks(actual.value, planned.value), scheduled = subtractKopecks(total.value.expenseTargetsKopecks, planned.value),
    againstTarget = subtractKopecks(total.value.expenseTargetsKopecks, actual.value);
  if (!variance.ok || !scheduled.ok || !againstTarget.ok) return fail('overflow');
  return { ok: true, value: { origin: h.origin, elapsedMonths: indices.length, plannedElapsedKopecks: planned.value,
    actualElapsedKopecks: actual.value, varianceKopecks: variance.value, remainingScheduledKopecks: scheduled.value,
    remainingAgainstAnnualTargetKopecks: againstTarget.value, layers } };
};

export type PlanDraft = { year: string; firstDate: string; lastDate: string; basis: BudgetPlan['basis'];
  layers: Record<FinancialLayer, string[]>; reserve: string[] };
const decimal = (n: number): string => { const r = formatKopecks(n); return r.ok ? r.value.replace(' ₽', '').replace(',', '.') : ''; };
export const draftFromPlan = (p: BudgetPlan): PlanDraft => ({ year: String(p.year), firstDate: p.reference.firstDate, lastDate: p.reference.lastDate,
  basis: p.basis, layers: Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, p.layers[l].map(decimal)])) as PlanDraft['layers'], reserve: p.reserve.map(decimal) });
export const planFromDraft = (draft: PlanDraft): PlanResult<BudgetPlan> => {
  if (!/^\d{1,4}$/.test(draft.year)) return fail('invalid_plan');
  const layers = {} as Record<FinancialLayer, number[]>;
  for (const l of FINANCIAL_LAYERS) {
    layers[l] = []; for (const s of draft.layers[l]) { const n = rublesToKopecks(s); if (!n.ok) return fail('invalid_amount'); layers[l].push(n.value); }
  }
  const reserve: number[] = [];
  for (const s of draft.reserve) { const n = rublesToKopecks(s); if (!n.ok) return fail('invalid_amount'); reserve.push(n.value); }
  return validateBudgetPlan({ version: 'budget-plan-v1', basis: draft.basis, year: Number(draft.year),
    reference: { firstDate: draft.firstDate, lastDate: draft.lastDate }, layers, reserve });
};
