import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { dataArray } from 'features/ClassificationStatistics/model/statistics';
import { forecastExpenses } from 'features/ExpenseForecast/model/forecast';
import { allocateAnnual, validateBudgetPlan, type BudgetPlan } from './plan';

/** Explicit user action only. Revalidate the original history through the one
 * existing forecasting engine; precomputed totals are never authority. */
export const planFromRecordedHistory = (planInput: unknown, historyInput: unknown, options: unknown, protectedInput: unknown):
  { ok: true; value: BudgetPlan } | { ok: false; error: { code: 'invalid_plan' | 'ineligible_reference' | 'invalid_protection' | 'unsafe_estimate' } } => {
  const plan = validateBudgetPlan(planInput), protectedLayers = dataArray(protectedInput, 5);
  if (!plan.ok || plan.value.basis !== 'manual') return { ok: false, error: { code: 'invalid_plan' } };
  if (!protectedLayers || protectedLayers.some(layer => !FINANCIAL_LAYERS.some(l => l === layer)) || new Set(protectedLayers).size !== protectedLayers.length)
    return { ok: false, error: { code: 'invalid_protection' } };
  const forecast = forecastExpenses(historyInput, options);
  if (!forecast.ok || forecast.value.origin !== 'coherent_adapter' || plan.value.reference.firstDate !== forecast.value.referencePeriod.firstDate
    || plan.value.reference.lastDate !== forecast.value.referencePeriod.lastDate) return { ok: false, error: { code: 'ineligible_reference' } };
  const layers = { ...plan.value.layers };
  for (const layer of ['everyday', 'irregular', 'emergency'] as const) {
    if (protectedLayers.includes(layer)) continue;
    const annual = forecast.value.layers[layer].projectedAnnualKopecks, split = allocateAnnual(annual);
    if (!split.ok) return { ok: false, error: { code: 'unsafe_estimate' } };
    layers[layer as FinancialLayer] = split.value;
  }
  // Preserve manual goals/capital/reserve and protected layers, including zero.
  const result = validateBudgetPlan({ ...plan.value, layers });
  return result.ok ? result : { ok: false, error: { code: 'unsafe_estimate' } };
};
