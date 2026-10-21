import type { AnalyticsDataset } from 'features/FinancialAnalytics/model/types';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';

export const STABLE_TAXONOMY = 'financial-classification-v1' as const;
export const ROLE_DATASETS = {
  ordinary_expense: ['expenses'], ordinary_income: ['incomes'], loan_issuance: ['expenses'],
  loan_repayment: ['incomes'], refund: ['incomes'], internal_transfer: ['expenses', 'incomes'],
  capital_movement: ['expenses', 'incomes'],
} as const;
export type StableRole = keyof typeof ROLE_DATASETS;
export type StableAssignment = { readonly economicRole: StableRole; readonly layer: FinancialLayer | null };
export type DecisionState = 'approved' | 'explicit_unclassified' | 'cleared';
export type ClassificationStatus = DecisionState | 'unreviewed' | 'stale' | 'blocked';
export type ClassificationRead = Readonly<{ version: 'classification-read-v1'; dataset: AnalyticsDataset;
  operationId: string; status: ClassificationStatus; storedState: DecisionState | null;
  decisionRevision: number | null; confirmed: StableAssignment | null; consistency: 'observed_only_non_atomic' }>;

export const closedData = (value: unknown, fields: readonly string[]): Record<string, unknown> | null => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !fields.includes(key)) return null;
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (!d || !d.enumerable || !Object.prototype.hasOwnProperty.call(d, 'value')) return null;
      out[key] = d.value;
    }
    return out;
  } catch { return null; }
};
export const canonicalId = (value: unknown): value is string => typeof value === 'string'
  && value.length === 24 && /^[a-f0-9]{24}$/.test(value);
export const stableAssignment = (value: unknown, dataset: AnalyticsDataset): StableAssignment | null => {
  const r = closedData(value, ['economicRole', 'layer']);
  if (!r || typeof r.economicRole !== 'string' || !Object.prototype.hasOwnProperty.call(ROLE_DATASETS, r.economicRole)) return null;
  const role = r.economicRole as StableRole;
  if (!(ROLE_DATASETS[role] as readonly string[]).includes(dataset)) return null;
  if (role === 'ordinary_expense' ? !FINANCIAL_LAYERS.some(layer => layer === r.layer) : r.layer !== null) return null;
  return Object.freeze({ economicRole: role, layer: r.layer as FinancialLayer | null });
};
const state = (x: unknown): x is DecisionState => ['approved', 'explicit_unclassified', 'cleared'].some(s => s === x);
/** C3.2 exact DTO. An error/missing response is never an unreviewed decision. */
export const validateClassificationRead = (value: unknown, dataset: AnalyticsDataset, operationId: string): ClassificationRead | null => {
  const r = closedData(value, ['version', 'dataset', 'operationId', 'status', 'storedState', 'decisionRevision', 'confirmed', 'consistency']);
  if (!r || Object.keys(r).length !== 8 || r.version !== 'classification-read-v1' || r.dataset !== dataset
    || r.operationId !== operationId || !canonicalId(operationId) || r.consistency !== 'observed_only_non_atomic') return null;
  if (r.status === 'unreviewed' || r.status === 'blocked') {
    if (r.storedState !== null || r.decisionRevision !== null || r.confirmed !== null) return null;
  } else {
    if (!state(r.storedState) || typeof r.decisionRevision !== 'number' || !Number.isSafeInteger(r.decisionRevision)
      || r.decisionRevision < 1 || (r.status !== 'stale' && r.status !== r.storedState)) return null;
    if (r.status === 'approved') {
      if (!stableAssignment(r.confirmed, dataset)) return null;
    } else if (r.confirmed !== null) return null;
  }
  const status = r.status;
  if (!state(status) && status !== 'unreviewed' && status !== 'stale' && status !== 'blocked') return null;
  return Object.freeze({ version: 'classification-read-v1', dataset, operationId, status,
    storedState: r.storedState as DecisionState | null, decisionRevision: r.decisionRevision as number | null,
    confirmed: status === 'approved' ? stableAssignment(r.confirmed, dataset) : null, consistency: 'observed_only_non_atomic' });
};
